import SwiftUI

/// Which of Week's fields has the keyboard: a task's title being edited, or the new task being written on a day.
enum WeekField: Hashable {
    case title(String)
    case composer(DayKey)
}

/// A day of the week on screen: what's left (with tasks ticked a moment ago, until their tick has played), then what's
/// done, each in the person's order (Settings → Task order).
struct WeekDay: Identifiable {
    let day: DayKey
    let open: [TaskItem]
    let done: [TaskItem]

    var id: Int { day.ordinal }
    var total: Int { open.count + done.count }
    var finished: Int { done.count + open.count { $0.done } }

    @MainActor
    static func week(from start: DayKey, store: TaskStore, sort: TaskSort, settling: Set<String>) -> [WeekDay] {
        (0..<7).map { i in
            let day = start.adding(days: i)
            let list = TaskSorting.sorted(store.tasks(on: day), by: sort)
            return WeekDay(day: day,
                           open: list.filter { !$0.done || settling.contains($0.id) },
                           done: list.filter { $0.done && !settling.contains($0.id) })
        }
    }
}

/// Where a task dragged over a lane would land: the day, its place among the day's open tasks (in the person's own
/// order), and where the line that shows it is drawn.
struct LaneDropSpot: Equatable {
    let day: DayKey
    let index: Int?
    let lineY: CGFloat?
}

/// What Week keeps while the person works in it: the task being written or edited, ticks still playing, rows leaving
/// for days off screen, and a drag in progress.
@MainActor
@Observable
final class WeekState {
    /// The day a new task is being written on, at the top of its list.
    var composerDay: DayKey?
    var composerText = ""
    /// The task written just before in this composer: the next one lands after it, so a run keeps the order written.
    var composerAfter: String?
    @ObservationIgnored var lastSubmit = Date.distantPast

    /// The task whose title is being edited, and the task as it was (for Undo and for an emptied title).
    var editing: String?
    @ObservationIgnored var editBefore: TaskItem?

    /// Just ticked: still among the open tasks while the tick plays (then they travel down to the done ones).
    var settling: Set<String> = []
    /// Rows leaving for a day that isn't on screen slide toward it: +1 later, -1 earlier.
    var exits: [String: Int] = [:]

    /// The task being dragged (lanes), and where it would land.
    var dragging: String?
    var dropSpot: LaneDropSpot?
    /// Each lane's open rows and where its list starts, in the lane's own coordinates (for working out a drop's place).
    @ObservationIgnored var rowFrames: [DayKey: [String: CGRect]] = [:]
    @ObservationIgnored var listTops: [DayKey: CGFloat] = [:]
}

/// What Week does, for both of its layouts (lanes and the list of days): the web's `TableActions` with Week's motion.
@MainActor
struct WeekWork {
    let store: TaskStore
    let router: Router
    let state: WeekState
    let actions: PlannerActions
    let sort: TaskSort
    /// The days on screen.
    let week: ClosedRange<DayKey>
    let reduceMotion: Bool
    let focus: FocusState<WeekField?>.Binding

    var today: DayKey { actions.today }

    private func animate(_ animation: Animation, _ change: () -> Void) {
        withAnimation(Motion.choose(animation, reduceMotion: reduceMotion), change)
    }

    // MARK: Picking and editing

    /// The first tap picks a task (its title shows whole and its ⋯ appears); a tap on the picked task edits it.
    func tap(_ task: TaskItem) {
        guard state.editing != task.id else { return }
        if router.selectedTask == task.id {
            startEditing(task)
        } else {
            closeFields()
            router.selectedTask = task.id
        }
    }

    /// A tap on a day's free space: the selection goes, and what was being written is kept.
    func clearSelection() {
        closeFields()
        router.selectedTask = nil
    }

    func startEditing(_ task: TaskItem) {
        if state.composerDay != nil { closeComposer() }
        if let editing = state.editing, editing != task.id { finishEditing() }
        if state.editing != task.id { state.editBefore = task }
        state.editing = task.id
        router.selectedTask = task.id
        Task { focus.wrappedValue = .title(task.id) }
    }

    /// The title as it's typed: saved after a pause, as on the web.
    func titleBinding(_ id: String) -> Binding<String> {
        let store = store
        return Binding(
            get: { store.task(id)?.title ?? "" },
            set: { store.edit(id, TaskPatch(title: $0), debounce: true) }
        )
    }

    /// The end of an edit: the title is trimmed, an emptied one goes back to what it was, and Undo can restore the words.
    func finishEditing() {
        guard let id = state.editing else { return }
        state.editing = nil
        defer { state.editBefore = nil }
        guard let before = state.editBefore, let task = store.task(id) else { return }
        let title = task.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let fixed = title.isEmpty ? (before.title.isEmpty ? "Untitled" : before.title) : title
        if fixed != task.title { store.edit(id, TaskPatch(title: fixed)) }
        store.finishedEditing(id, before: before)
    }

    // MARK: Writing a new task

    /// Opens the composer at the top of `day` (the + in its header, N on a keyboard, a double tap on a lane).
    func openComposer(on day: DayKey) {
        finishEditing()
        if state.composerDay != day {
            closeComposer()
            focus.wrappedValue = nil
        }
        router.selectedTask = nil
        animate(Motion.out(Tokens.Motion.fast)) { state.composerDay = day }
        Task { focus.wrappedValue = .composer(day) }
    }

    /// Return in the composer: the task lands at the top of its day, after the one written just before it, and a new
    /// field takes its place. Return on an empty field closes it.
    func submitComposer() {
        guard let day = state.composerDay else { return }
        let text = state.composerText
        // Return reaches a growing field either as a line break or as a submit (it depends on the system); the second
        // of the pair, on the field just emptied, is not a Return on an empty field.
        if text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, Date.now.timeIntervalSince(state.lastSubmit) < 0.5 { return }
        state.lastSubmit = .now
        state.composerText = ""
        var created: TaskItem?
        animate(Motion.travel) { created = actions.create(text, on: day, after: state.composerAfter) }
        if let created {
            state.composerAfter = created.id
            // The field stays for the next one (a list redrawing around it can take the keyboard for a moment).
            Task { focus.wrappedValue = .composer(day) }
        } else {
            closeComposer()
            focus.wrappedValue = nil
        }
    }

    /// The composer closes when the keyboard leaves it: what was typed is kept as a task.
    func closeComposer() {
        guard let day = state.composerDay else { return }
        let text = state.composerText
        animate(Motion.travel) {
            actions.create(text, on: day, after: state.composerAfter)
            state.composerText = ""
            state.composerAfter = nil
            state.composerDay = nil
        }
    }

    /// Esc: the composer closes without adding anything.
    func cancelComposer() {
        state.composerText = ""
        state.composerAfter = nil
        animate(Motion.exit) { state.composerDay = nil }
        focus.wrappedValue = nil
    }

    private func closeFields() {
        finishEditing()
        closeComposer()
        if focus.wrappedValue != nil { focus.wrappedValue = nil }
    }

    /// The keyboard moved on: leaving a title ends its edit, leaving the composer keeps what was typed.
    func focusChanged(from old: WeekField?, to new: WeekField?) {
        switch old {
        case .title(let id):
            if new != old, state.editing == id { finishEditing() }
        case .composer(let day):
            // Only the composer that lost the keyboard closes (opening one on another day moves the keyboard there).
            guard new != old, state.composerDay == day else { return }
            guard new == nil else { return closeComposer() }
            // A task landing can take the keyboard away for a moment: the composer closes only if it stays away.
            let state = state
            Task {
                try? await Task.sleep(for: .milliseconds(250))
                guard focus.wrappedValue == nil, state.composerDay == day else { return }
                closeComposer()
            }
        case nil:
            break
        }
    }

    // MARK: Changing tasks

    /// Ticked: the tick plays where the task is, then it travels down to what's done. Opened again: it travels back up
    /// at once. The task gets picked, as on the web.
    func toggle(_ task: TaskItem) {
        if state.editing == task.id { focus.wrappedValue = nil }
        router.selectedTask = task.id
        guard !task.done else {
            animate(Motion.travel) { actions.toggle(task) }
            return
        }
        state.settling.insert(task.id)
        actions.toggle(task)
        let wait = reduceMotion ? Tokens.Motion.reduced : Tokens.Motion.base
        let state = state
        let travel = Motion.choose(Motion.travel, reduceMotion: reduceMotion)
        Task {
            try? await Task.sleep(for: .seconds(wait))
            withAnimation(travel) { _ = state.settling.remove(task.id) }
        }
    }

    /// To a day on screen the task travels to its new place; to one off screen it slides toward it and fades.
    func move(_ task: TaskItem, to day: DayKey) {
        guard day != task.date else { return }
        if week.contains(day) {
            animate(Motion.travel) { actions.move(task, to: day) }
            return
        }
        if router.selectedTask == task.id { router.selectedTask = nil }
        state.exits[task.id] = reduceMotion ? 0 : (day > task.date ? 1 : -1)
        let state = state
        let actions = actions
        let leave = Motion.choose(Motion.in(Tokens.Motion.base), reduceMotion: reduceMotion)
        Task {
            // A frame for the row to learn which way it leaves, then it goes.
            try? await Task.sleep(for: .milliseconds(20))
            withAnimation(leave) { actions.move(task, to: day) }
            try? await Task.sleep(for: .seconds(Tokens.Motion.move))
            state.exits[task.id] = nil
        }
    }

    /// The row folds away; the selection moves on to its neighbour, as on the web.
    func delete(_ task: TaskItem) {
        if router.selectedTask == task.id {
            let ids = router.visibleTaskIDs
            if let i = ids.firstIndex(of: task.id) {
                router.selectedTask = i + 1 < ids.count ? ids[i + 1] : (i > 0 ? ids[i - 1] : nil)
            } else {
                router.selectedTask = nil
            }
        }
        if state.editing == task.id {
            state.editing = nil
            state.editBefore = nil
        }
        animate(Motion.in(Tokens.Motion.base)) { actions.delete(task) }
    }

    /// A dropped task takes the place it was dropped in (in the person's own order; otherwise only the day changes),
    /// and stays picked.
    func drop(_ id: String, on day: DayKey, at index: Int?) {
        state.dragging = nil
        state.dropSpot = nil
        animate(Motion.travel) { actions.place(id, on: day, at: sort.allowsReordering ? index : nil) }
        router.selectedTask = id
    }

    /// ⌥↑ / ⌥↓: the picked task one place up or down its day, in the person's own order.
    func nudge(_ direction: Int) {
        guard sort.allowsReordering, let id = router.selectedTask else { return }
        animate(Motion.travel) { store.nudge(id, by: direction) }
    }

    /// Another week: whatever was being written or edited is kept, and the ticks in flight land.
    func reset() {
        closeFields()
        state.settling = []
        state.dropSpot = nil
    }
}
