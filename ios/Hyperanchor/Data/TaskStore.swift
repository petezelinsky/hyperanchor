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

    /// Every task the app knows about, by id.
    private(set) var tasks: [String: TaskItem] = [:] {
        didSet { index = Self.makeIndex(tasks) }
    }

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
            if next != tasks { tasks = next }
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

    /// Adds a task and returns it.
    @discardableResult
    func create(title: String, notes: String = "", date: DayKey, done: Bool = false) -> TaskItem {
        // Strictly increasing, so tasks added in quick succession keep their order.
        let instant = max(Date.now, lastCreated.addingTimeInterval(0.001))
        lastCreated = instant
        let now = TaskItem.timestamp(instant)
        let task = TaskItem(id: TaskItem.newID(), date: date, title: title, notes: notes, done: done, createdAt: now, updatedAt: now)
        tasks[task.id] = task
        enqueue(task.id, .create(task))
        return task
    }

    /// Applies `patch` locally and saves it — now, or after 600 ms without further changes (typing).
    func edit(_ id: String, _ patch: TaskPatch, debounce: Bool = false) {
        guard let task = tasks[id], !patch.isEmpty else { return }
        let updated = patch.applied(to: task)
        if updated != task { tasks[id] = updated }
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
        guard let task = tasks.removeValue(forKey: id) else { return nil }
        enqueue(id, .delete)
        return task
    }

    /// Puts a deleted task back (undo), keeping its id.
    func restore(_ task: TaskItem) {
        tasks[task.id] = task
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
        tasks = [:]
        cache?.clear()
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
