import Foundation
import Observation

/// A change waiting to reach the server. Kept on disk, so nothing is lost offline or when the app quits.
struct PendingOperation: Codable, Sendable, Identifiable {
    enum Kind: Codable, Sendable {
        case create(TaskItem)
        case update(TaskPatch)
        case delete
    }

    var id = UUID()
    let taskID: String
    var kind: Kind
    var attempts = 0
}

/// The app's copy of the tasks — the iOS counterpart of the web's `useTasks`.
///
/// Local state is authoritative while editing: changes apply at once, requests for the same task go out
/// strictly in order, and typing is batched into a save after 600 ms of quiet. While a task has unsaved
/// changes, data from the server doesn't overwrite it. Changes made offline wait in a queue on disk and
/// go out when the connection is back. On any other failure: a message, and the loaded ranges reload.
@MainActor
@Observable
final class TaskStore {
    static let saveDelay: Duration = .milliseconds(600)

    /// Every task the app knows about, by id. Change it only through `put`, `drop` and `replaceAll`,
    /// which keep `index` in step.
    private(set) var tasks: [String: TaskItem] = [:]

    /// Tasks per day, in the order they were added.
    private(set) var index: [DayKey: [TaskItem]] = [:]
    /// Whether the last request reached the server.
    private(set) var isOnline = true
    /// Changes not yet on the server.
    private(set) var pendingCount = 0

    /// Shown to the person (as a toast).
    @ObservationIgnored var onError: ((String) -> Void)?
    /// The server rejected the token.
    @ObservationIgnored var onUnauthorized: (() -> Void)?

    @ObservationIgnored private let backend: Backend
    @ObservationIgnored private let cache: TaskCache?
    @ObservationIgnored private var outbox: [PendingOperation] = [] {
        didSet { if pendingCount != outbox.count { pendingCount = outbox.count } }
    }
    @ObservationIgnored private var drafts: [String: TaskPatch] = [:]
    @ObservationIgnored private var draftTimers: [String: Task<Void, Never>] = [:]
    /// Recently loaded ranges, re-fetched after a failure or when the app comes back.
    @ObservationIgnored private var ranges: [ClosedRange<DayKey>] = []
    @ObservationIgnored private var loading: Set<ClosedRange<DayKey>> = []
    @ObservationIgnored private var inFlight: UUID?
    @ObservationIgnored private var syncTask: Task<Void, Never>?
    @ObservationIgnored private var retryTask: Task<Void, Never>?
    @ObservationIgnored private var saveTask: Task<Void, Never>?
    @ObservationIgnored private var retryDelay: Duration = .seconds(5)
    @ObservationIgnored private var lastCreated = Date.distantPast

    init(backend: Backend, cache: TaskCache?) {
        self.backend = backend
        self.cache = cache
        if let saved = cache?.load() {
            tasks = Dictionary(saved.tasks.map { ($0.id, $0) }, uniquingKeysWith: { _, b in b })
            index = Self.makeIndex(tasks)
            outbox = saved.outbox
            pendingCount = outbox.count
        }
    }

    // MARK: Reading

    /// The day's tasks in the order they were added.
    func tasks(on day: DayKey) -> [TaskItem] { index[day] ?? [] }

    func task(_ id: String) -> TaskItem? { tasks[id] }

    /// Open tasks from `range`, oldest day first.
    func openTasks(in range: ClosedRange<DayKey>) -> [TaskItem] {
        stride(from: range.lowerBound.ordinal, through: range.upperBound.ordinal, by: 1)
            .flatMap { tasks(on: DayKey(ordinal: $0)).filter { !$0.done } }
    }

    private static func makeIndex(_ tasks: [String: TaskItem]) -> [DayKey: [TaskItem]] {
        var index = Dictionary(grouping: tasks.values, by: \.date)
        for (day, list) in index { index[day] = list.sorted(by: TaskSorting.addedBefore) }
        return index
    }

    /// Adds or updates one task; only its day(s) in the index change.
    private func put(_ task: TaskItem) {
        let old = tasks[task.id]
        tasks[task.id] = task
        if let old, old.date == task.date, old.createdAt == task.createdAt,
           let i = index[task.date]?.firstIndex(where: { $0.id == task.id }) {
            index[task.date]![i] = task
            return
        }
        if let old { removeFromIndex(old) }
        var list = index[task.date] ?? []
        let at = list.firstIndex { TaskSorting.addedBefore(task, $0) } ?? list.count
        list.insert(task, at: at)
        index[task.date] = list
    }

    private func drop(_ id: String) -> TaskItem? {
        guard let old = tasks.removeValue(forKey: id) else { return nil }
        removeFromIndex(old)
        return old
    }

    private func removeFromIndex(_ task: TaskItem) {
        index[task.date]?.removeAll { $0.id == task.id }
        if index[task.date]?.isEmpty == true { index[task.date] = nil }
    }

    private func replaceAll(_ next: [String: TaskItem]) {
        tasks = next
        index = Self.makeIndex(next)
    }

    // MARK: Loading

    /// Fetches `range` from the server and merges it in: tasks with unsaved changes keep their local state.
    func load(_ range: ClosedRange<DayKey>) async {
        ranges.removeAll { $0 == range }
        ranges.append(range)
        if ranges.count > 6 { ranges.removeFirst(ranges.count - 6) }
        guard !loading.contains(range) else { return }
        loading.insert(range)
        defer { loading.remove(range) }
        do {
            let fetched = try await backend.fetchTasks(from: range.lowerBound, to: range.upperBound)
            var next: [String: TaskItem] = [:]
            for t in tasks.values where !range.contains(t.date) || isBusy(t.id) { next[t.id] = t }
            for t in fetched where !isBusy(t.id) { next[t.id] = t }
            if next != tasks { replaceAll(next) }
            setOnline(true)
            saveSoon()
        } catch APIError.offline {
            setOnline(false)
        } catch APIError.unauthorized {
            onUnauthorized?()
        } catch {
            onError?((error as? APIError)?.errorDescription ?? "Couldn’t load tasks")
        }
    }

    /// Re-fetches everything loaded recently (coming back to the app, the connection returning).
    func refresh() async {
        sync()
        for range in ranges.reversed() { await load(range) }
    }

    private func isBusy(_ id: String) -> Bool {
        drafts[id] != nil || outbox.contains { $0.taskID == id }
    }

    // MARK: Changing

    /// Adds a task and returns it. `position` places it in the day's manual order (nil: by its creation time, the end).
    @discardableResult
    func create(title: String, notes: String = "", date: DayKey, done: Bool = false, position: Double? = nil) -> TaskItem {
        // Strictly increasing, so tasks added in quick succession keep their order.
        let instant = max(Date.now, lastCreated.addingTimeInterval(0.001))
        lastCreated = instant
        let now = TaskItem.timestamp(instant)
        let task = TaskItem(id: TaskItem.newID(), date: date, title: title, notes: notes, done: done, position: position, createdAt: now, updatedAt: now)
        put(task)
        enqueue(task.id, .create(task))
        return task
    }

    /// Applies `patch` locally and saves it — now, or after 600 ms without further changes (typing).
    func edit(_ id: String, _ patch: TaskPatch, debounce: Bool = false) {
        guard let task = tasks[id], !patch.isEmpty else { return }
        let updated = patch.applied(to: task)
        if updated != task { put(updated) }
        drafts[id] = (drafts[id] ?? TaskPatch()).merged(with: patch)
        if debounce {
            draftTimers[id]?.cancel()
            draftTimers[id] = Task { [weak self] in
                try? await Task.sleep(for: Self.saveDelay)
                guard !Task.isCancelled else { return }
                self?.flush(id)
            }
        } else {
            flush(id)
        }
    }

    /// Sends a task's unsaved typing now.
    func flush(_ id: String) {
        draftTimers.removeValue(forKey: id)?.cancel()
        guard let patch = drafts.removeValue(forKey: id), !patch.isEmpty else { return }
        enqueue(id, .update(patch))
    }

    /// Sends all unsaved typing (the app is going to the background).
    func flushAll() {
        for id in Array(drafts.keys) { flush(id) }
        saveNow()
    }

    func move(_ id: String, to date: DayKey) { edit(id, TaskPatch(date: date)) }

    func setDone(_ id: String, _ done: Bool) { edit(id, TaskPatch(done: done)) }

    /// Deletes a task; returns it for undo.
    @discardableResult
    func remove(_ id: String) -> TaskItem? {
        draftTimers.removeValue(forKey: id)?.cancel()
        drafts[id] = nil
        guard let task = drop(id) else { return nil }
        enqueue(id, .delete)
        return task
    }

    /// Puts a deleted task back (undo), keeping its id.
    func restore(_ task: TaskItem) {
        put(task)
        enqueue(task.id, .create(task))
    }

    /// Forgets everything (signing out, deleting the account).
    func reset() {
        syncTask?.cancel()
        retryTask?.cancel()
        saveTask?.cancel()
        for timer in draftTimers.values { timer.cancel() }
        syncTask = nil
        retryTask = nil
        draftTimers = [:]
        drafts = [:]
        outbox = []
        ranges = []
        inFlight = nil
        undos = []
        undoCount = 0
        earlierLoaded = nil
        replaceAll([:])
        cache?.clear()
    }

    // MARK: Earlier days

    /// The day before which every open task has been fetched (`GET /api/tasks/open`), once it has.
    private(set) var earlierLoaded: DayKey?

    /// Every task still open before `day` that the app knows about, most recent day first, newest first within a day:
    /// what Today offers to bring along ("From earlier days").
    func openBefore(_ day: DayKey) -> [TaskItem] {
        tasks.values.filter { !$0.done && $0.date < day }
            .sorted { $0.date != $1.date ? $0.date > $1.date : !TaskSorting.addedBefore($0, $1) }
    }

    /// Fetches every task left open before `today` (however old). Open tasks the app had from those days that the server
    /// no longer lists open (done or deleted elsewhere) are dropped until their day is loaded again.
    func loadEarlier(before today: DayKey) async {
        do {
            let fetched = try await backend.fetchOpenTasks(before: today)
            var next = tasks
            if fetched.count < 500 {
                let listed = Set(fetched.map(\.id))
                for t in tasks.values where t.date < today && !t.done && !listed.contains(t.id) && !isBusy(t.id) { next[t.id] = nil }
            }
            for t in fetched where !isBusy(t.id) { next[t.id] = t }
            if next != tasks { replaceAll(next) }
            earlierLoaded = today
            setOnline(true)
            saveSoon()
        } catch APIError.offline {
            setOnline(false)
        } catch APIError.unauthorized {
            onUnauthorized?()
        } catch {
            // The list simply stays as it was; the day's own tasks are unaffected.
        }
    }

    // MARK: Manual order

    /// A day's open tasks in the person's own order, without `excluding`.
    func openInOrder(on day: DayKey, excluding: String? = nil) -> [TaskItem] {
        TaskSorting.sorted(tasks(on: day).filter { !$0.done && $0.id != excluding }, by: .manual)
    }

    /// The position that puts a task at `index` of `list` (a day's open tasks without it). Splitting the same gap over
    /// and over eventually leaves no number in between; then the day is renumbered, in its order, to make room again.
    func position(at index: Int, in list: [TaskItem]) -> Double {
        let before = index > 0 && index - 1 < list.count ? list[index - 1] : nil
        let after = index < list.count ? list[index] : nil
        let p = TaskSorting.placeBetween(before, after)
        if before == nil || after == nil || (p > TaskSorting.place(of: before!) && p < TaskSorting.place(of: after!)) { return p }
        let base = TaskSorting.place(of: list[0])
        for (i, t) in list.enumerated() { edit(t.id, TaskPatch(position: base + Double(i) * 1024)) }
        return base + (Double(index) - 0.5) * 1024
    }

    /// A new task written at the top of its day's open tasks, after `after` (the one written just before it), so a run
    /// of new tasks lands in the order written.
    @discardableResult
    func createAtTop(title: String, notes: String = "", date: DayKey, after: String? = nil) -> TaskItem {
        let open = openInOrder(on: date)
        let prev = after.flatMap { id in open.first { $0.id == id } }
        let next = prev.flatMap { p in open.firstIndex(of: p).flatMap { $0 + 1 < open.count ? open[$0 + 1] : nil } } ?? (prev == nil ? open.first : nil)
        return create(title: title, notes: notes, date: date, position: TaskSorting.placeBetween(prev, next))
    }

    /// The way back after a task changed place: to its old day, at its old place among that day's open tasks.
    private func placeBack(_ task: TaskItem) -> @MainActor () -> Bool {
        let index = openInOrder(on: task.date).firstIndex { $0.id == task.id }
        return { [weak self] in
            guard let self, self.tasks[task.id] != nil else { return false }
            let rest = self.openInOrder(on: task.date, excluding: task.id)
            let position = index.map { self.position(at: min($0, rest.count), in: rest) } ?? task.position
            self.edit(task.id, TaskPatch(date: task.date, position: position))
            return true
        }
    }

    /// A task dropped (or nudged) into `index` of `date`'s open tasks; nil index: the end of another day.
    /// Returns the message for a toast when it went to another day.
    @discardableResult
    func place(_ id: String, on date: DayKey, at index: Int?, today: DayKey) -> Notice? {
        guard let task = tasks[id] else { return nil }
        let list = openInOrder(on: date, excluding: id)
        let position: Double? = index.map { self.position(at: $0, in: list) } ?? (date != task.date ? TaskSorting.placeBetween(list.last, nil) : task.position)
        if date == task.date && position == task.position { return nil }
        let back = placeBack(task)
        edit(id, TaskPatch(date: date, position: position))
        if date == task.date {
            remember("Order restored", back)
            return nil
        }
        let step = remember("Moved back to \(Self.dayLabel(task.date, today: today))", back)
        return Notice(message: "Moved to \(Self.dayLabel(date, today: today))", undo: step)
    }

    /// ⌥↑ / ⌥↓ (and the menu's Move up / Move down): one place up or down the day, in the person's own order.
    func nudge(_ id: String, by direction: Int) {
        guard let task = tasks[id], !task.done else { return }
        let list = openInOrder(on: task.date)
        guard let i = list.firstIndex(where: { $0.id == id }) else { return }
        let j = i + direction
        guard j >= 0, j < list.count else { return }
        let back = placeBack(task)
        edit(id, TaskPatch(position: position(at: j, in: list.filter { $0.id != id })))
        remember("Order restored", back)
    }

    // MARK: Actions (each one can be taken back)

    /// A message for the toast, and the step its Undo takes back.
    struct Notice {
        let message: String
        let undo: UndoStep?
    }

    /// "today", "tomorrow", "yesterday" or "Thu, Nov 12" (`dayLabel` on the web).
    static func dayLabel(_ day: DayKey, today: DayKey) -> String {
        Dates.relative(day, today: today)?.lowercased() ?? Dates.medium(day)
    }

    /// Ticks a task, or opens it again.
    func toggle(_ id: String) {
        guard let task = tasks[id] else { return }
        setDone(id, !task.done)
        remember("“\(task.title)” is \(task.done ? "done" : "open") again") { [weak self] in
            guard let self, let t = self.tasks[id], t.done != task.done else { return false }
            self.setDone(id, task.done)
            return true
        }
    }

    /// Moves a task to another day (to the end of that day's own order).
    func moveTo(_ id: String, _ date: DayKey, today: DayKey) -> Notice? {
        guard let task = tasks[id], task.date != date else { return nil }
        edit(id, TaskPatch(date: date))
        let step = remember("Moved back to \(Self.dayLabel(task.date, today: today))") { [weak self] in
            guard let self, self.tasks[id] != nil else { return false }
            self.edit(id, TaskPatch(date: task.date))
            return true
        }
        return Notice(message: "Moved to \(Self.dayLabel(date, today: today))", undo: step)
    }

    /// Deletes a task; Undo puts it back as it was.
    func delete(_ id: String) -> Notice? {
        guard let task = remove(id) else { return nil }
        let step = remember("Restored “\(task.title)”") { [weak self] in
            guard let self, self.tasks[id] == nil else { return false }
            self.restore(task)
            return true
        }
        return Notice(message: "Deleted “\(task.title)”", undo: step)
    }

    /// Brings tasks left open on earlier days to `today`.
    func moveAllToToday(_ ids: [String], today: DayKey) -> Notice? {
        let list = ids.compactMap { tasks[$0] }
        guard !list.isEmpty else { return nil }
        for t in list { edit(t.id, TaskPatch(date: today)) }
        let step = remember(list.count == 1 ? "Moved back" : "Moved \(list.count) tasks back") { [weak self] in
            guard let self else { return false }
            let back = list.filter { self.tasks[$0.id] != nil }
            for t in back { self.edit(t.id, TaskPatch(date: t.date)) }
            return !back.isEmpty
        }
        return Notice(message: list.count == 1 ? "Moved 1 task to today" : "Moved \(list.count) tasks to today", undo: step)
    }

    /// What the voice screen sorted becomes tasks, in the order it was said; one Undo takes all of them back.
    func addDrafts(_ drafts: [TaskDraft], today: DayKey) -> Notice? {
        guard !drafts.isEmpty else { return nil }
        let now = (Date.now.timeIntervalSince1970 * 1000).rounded()
        let ids = drafts.enumerated().map { i, d in
            create(title: d.title, notes: d.notes, date: d.date, position: now + Double(i)).id
        }
        let n = ids.count
        let days = Set(drafts.map(\.date))
        let step = remember(n == 1 ? "Task removed" : "\(n) tasks removed") { [weak self] in
            guard let self else { return false }
            let left = ids.filter { self.tasks[$0] != nil }
            for id in left { self.remove(id) }
            return !left.isEmpty
        }
        let whereTo = days.count == 1 ? " for \(Self.dayLabel(days.first!, today: today))" : ""
        return Notice(message: "Added \(n == 1 ? "1 task" : "\(n) tasks")\(whereTo)", undo: step)
    }

    /// The end of editing a task's words: remembers the words it had before, for Undo.
    func finishedEditing(_ id: String, before: TaskItem) {
        flush(id)
        guard let t = tasks[id], t.title != before.title || t.notes != before.notes else { return }
        remember("Edit undone") { [weak self] in
            guard let self, self.tasks[id] != nil else { return false }
            self.edit(id, TaskPatch(title: before.title, notes: before.notes))
            return true
        }
    }

    // MARK: Undo

    /// One action that can be taken back: `run` does it (false when it no longer applies); `done` is what to say after.
    final class UndoStep {
        let done: String
        let run: @MainActor () -> Bool
        init(done: String, run: @escaping @MainActor () -> Bool) {
            self.done = done
            self.run = run
        }
    }

    /// How many steps can be taken back (the last 20 actions).
    private(set) var undoCount = 0
    @ObservationIgnored private var undos: [UndoStep] = [] {
        didSet { if undoCount != undos.count { undoCount = undos.count } }
    }

    @discardableResult
    func remember(_ done: String, _ run: @escaping @MainActor () -> Bool) -> UndoStep {
        let step = UndoStep(done: done, run: run)
        undos = Array((undos + [step]).suffix(20))
        return step
    }

    /// A toast's own Undo: takes back that step, wherever it is in the list.
    @discardableResult
    func undo(_ step: UndoStep) -> Bool {
        undos.removeAll { $0 === step }
        return step.run()
    }

    /// ⌘Z / shake: takes back the latest action that still applies, and returns what to say.
    func undoLast() -> String? {
        while let step = undos.popLast() {
            if step.run() { return step.done }
        }
        return nil
    }

    // MARK: Sync

    private func enqueue(_ taskID: String, _ kind: PendingOperation.Kind) {
        // Fold into the task's last queued change while it hasn't been sent yet.
        if let i = outbox.lastIndex(where: { $0.taskID == taskID }), outbox[i].id != inFlight {
            switch (outbox[i].kind, kind) {
            case (.create(let t), .update(let p)):
                outbox[i].kind = .create(p.applied(to: t))
                return afterChange()
            case (.update(let a), .update(let b)):
                outbox[i].kind = .update(a.merged(with: b))
                return afterChange()
            case (.create, .delete):
                outbox.remove(at: i) // never reached the server
                return afterChange()
            case (.update, .delete):
                outbox[i].kind = .delete
                return afterChange()
            default:
                break
            }
        }
        outbox.append(PendingOperation(taskID: taskID, kind: kind))
        afterChange()
    }

    private func afterChange() {
        saveSoon()
        sync()
    }

    /// Starts sending queued changes, one at a time, unless that's already happening.
    func sync() {
        guard syncTask == nil, !outbox.isEmpty else { return }
        syncTask = Task { [weak self] in
            await self?.drain()
            self?.syncTask = nil
        }
    }

    private func drain() async {
        while let op = outbox.first, !Task.isCancelled {
            inFlight = op.id
            do {
                switch op.kind {
                case .create(let t): try await backend.createTask(t)
                case .update(let p): try await backend.updateTask(id: op.taskID, patch: p)
                case .delete: try await backend.deleteTask(id: op.taskID)
                }
                inFlight = nil
                outbox.removeAll { $0.id == op.id }
                setOnline(true)
                saveSoon()
            } catch APIError.offline {
                inFlight = nil
                setOnline(false)
                scheduleRetry()
                return
            } catch APIError.unauthorized {
                inFlight = nil
                onUnauthorized?()
                return
            } catch {
                inFlight = nil
                if let status = (error as? APIError)?.status, status >= 500, op.attempts < 2,
                   let i = outbox.firstIndex(where: { $0.id == op.id }) {
                    // A hiccup on the server: try again shortly before giving up.
                    outbox[i].attempts += 1
                    try? await Task.sleep(for: .seconds(2 * (op.attempts + 1)))
                    continue
                }
                // The server said no: drop this task's queued changes and show what the server has.
                outbox.removeAll { $0.taskID == op.taskID }
                saveSoon()
                onError?((error as? APIError)?.errorDescription ?? "Something went wrong")
                for range in ranges.reversed() { await load(range) }
            }
        }
    }

    private func setOnline(_ online: Bool) {
        if isOnline != online { isOnline = online }
        if online {
            retryDelay = .seconds(5)
            retryTask?.cancel()
            retryTask = nil
        }
    }

    /// Offline: try again after a growing pause (5 s … 1 min), or sooner when the network comes back.
    private func scheduleRetry() {
        retryTask?.cancel()
        let delay = retryDelay
        retryDelay = min(retryDelay * 2, .seconds(60))
        retryTask = Task { [weak self] in
            try? await Task.sleep(for: delay)
            guard !Task.isCancelled else { return }
            self?.retryTask = nil
            await self?.refresh()
        }
    }

    /// The device's connection changed.
    func networkChanged(available: Bool) {
        if available {
            retryDelay = .seconds(5)
            Task { await refresh() }
        } else {
            setOnline(false)
        }
    }

    // MARK: Disk

    private func saveSoon() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }

    func saveNow() {
        saveTask?.cancel()
        saveTask = nil
        cache?.save(TaskCache.Snapshot(tasks: Array(tasks.values), outbox: outbox))
    }
}
