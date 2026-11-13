import SwiftUI
import UIKit

/// Editing state shared by the task lists: the task being edited in place, the new task being written (and the run of
/// tasks written one after another), tasks that were just ticked and stay where they are while the tick plays, and
/// tasks on their way to another day.
@MainActor
@Observable
final class ListEditor {
    private(set) var editing: String?
    /// The day whose new-task row is open.
    private(set) var composerDay: DayKey?
    var newTitle = ""
    var newNotes = ""
    /// Changes each time the new-task row starts afresh (the next one fades in).
    private(set) var composerRun = 0
    /// Just ticked: still listed with what's left while the tick plays (240 ms), then it travels into Done.
    private(set) var settling: Set<String> = []
    /// On their way to another day: still listed (as they were) while they slide 24 pt toward it and fade.
    private(set) var leaving: [String: Leaving] = [:]

    struct Leaving {
        let task: TaskItem
        /// 1: to a later day (the row slides right), -1: to an earlier one.
        let direction: Int
    }

    /// The words a task had when its edit began, for Undo and Esc.
    @ObservationIgnored private var snapshot: TaskItem?
    /// The task the open new-task row added last: the next one goes right after it, so a run lands in the order written.
    @ObservationIgnored private var lastAdded: String?
    /// Return in the new-task row can take the keyboard away just before the row is submitted (the on-screen keyboard
    /// does): losing focus closes the row only if it stays lost for a moment.
    @ObservationIgnored private var pendingClose: Task<Void, Never>?

    func isSettling(_ id: String) -> Bool { settling.contains(id) }

    // MARK: Ticking

    /// Ticks a task: the box fills where the task is, a moment later it travels into Done while the rest close up.
    /// Opening a done task again sends it straight back up to what's left. Reduce Motion: short fades, no travel.
    func toggle(_ task: TaskItem, actions: TaskActions, focus: FocusState<TaskField?>.Binding) {
        if editing == task.id { focus.wrappedValue = nil }
        let reduce = UIAccessibility.isReduceMotionEnabled
        let travel = Motion.choose(Motion.travel, reduceMotion: reduce)
        if task.done {
            withAnimation(travel) { actions.toggle(task) }
            return
        }
        settling.insert(task.id)
        actions.toggle(task)
        Task {
            try? await Task.sleep(for: .seconds(reduce ? Tokens.Motion.reduced : Tokens.Motion.base))
            withAnimation(travel) { _ = settling.remove(task.id) }
        }
    }

    // MARK: Moving to another day

    /// Moves a task to another day: it stays in the list a moment longer, sliding 24 pt toward that day as it fades
    /// (240 ms, easing in), then the list closes up. The move itself (and its toast, with Undo) happens at once.
    func leave(_ task: TaskItem, to date: DayKey, actions: TaskActions) {
        guard task.date != date else { return }
        let reduce = UIAccessibility.isReduceMotionEnabled
        if editing == task.id { editing = nil }
        withAnimation(reduce ? Motion.reduced : Motion.in(Tokens.Motion.base)) {
            leaving[task.id] = Leaving(task: task, direction: date > task.date ? 1 : -1)
        }
        actions.move(task, to: date)
        Task {
            try? await Task.sleep(for: .seconds(reduce ? Tokens.Motion.reduced : Tokens.Motion.base))
            withAnimation(Motion.choose(Motion.settle, reduceMotion: reduce)) { _ = leaving.removeValue(forKey: task.id) }
        }
    }

    // MARK: Editing a task's words

    func startEditing(_ task: TaskItem, field: TaskField, store: TaskStore, focus: FocusState<TaskField?>.Binding) {
        if let editing, editing != task.id { finishEditing(store: store) }
        closeComposer(store: store)
        if editing != task.id { snapshot = task }
        editing = task.id
        Task { focus.wrappedValue = field }
    }

    /// Saves the edit: titles and notes are trimmed, an emptied title falls back to what it was, and the words it had
    /// before can be taken back (⌘Z).
    func finishEditing(store: TaskStore) {
        guard let id = editing else { return }
        editing = nil
        let before = snapshot
        snapshot = nil
        guard let t = store.task(id) else { return }
        var patch = TaskPatch()
        let title = t.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let fallback = before.map(\.title).flatMap { $0.isEmpty ? nil : $0 } ?? "Untitled"
        let fixed = title.isEmpty ? fallback : title
        if fixed != t.title { patch.title = fixed }
        let notes = t.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        if notes != t.notes { patch.notes = notes }
        if !patch.isEmpty { store.edit(id, patch) }
        if let before, before.id == id { store.finishedEditing(id, before: before) } else { store.flush(id) }
    }

    /// Esc: the words go back to what they were when the edit began.
    func cancelEditing(store: TaskStore, focus: FocusState<TaskField?>.Binding) {
        guard let id = editing else { return }
        if let before = snapshot, let t = store.task(id), t.title != before.title || t.notes != before.notes {
            store.edit(id, TaskPatch(title: before.title, notes: before.notes))
        }
        editing = nil
        snapshot = nil
        focus.wrappedValue = nil
    }

    // MARK: The new task

    func openComposer(on day: DayKey, store: TaskStore, focus: FocusState<TaskField?>.Binding) {
        finishEditing(store: store)
        if composerDay != day { closeComposer(store: store) }
        if composerDay == nil { composerRun += 1 }
        composerDay = day
        Task { focus.wrappedValue = .newTitle }
    }

    /// Return: adds the task at the top of its day's open tasks (after the one added just before it) and keeps the
    /// row open for the next one.
    func submitComposer(store: TaskStore, keepOpen: Bool, focus: FocusState<TaskField?>.Binding?) {
        guard let day = composerDay else { return }
        let title = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty {
            let notes = newNotes.trimmingCharacters(in: .whitespacesAndNewlines)
            let added = withAnimation(TaskActions.motion(Motion.out(Tokens.Motion.base))) {
                store.createAtTop(title: String(title.prefix(TaskItem.titleMax)), notes: String(notes.prefix(TaskItem.notesMax)),
                                  date: day, after: lastAdded)
            }
            lastAdded = added.id
        }
        newTitle = ""
        newNotes = ""
        if keepOpen, !title.isEmpty, let focus {
            composerRun += 1
            Task {
                try? await Task.sleep(for: .milliseconds(60))
                focus.wrappedValue = .newTitle
            }
        } else {
            composerDay = nil
            lastAdded = nil
        }
    }

    func closeComposer(store: TaskStore) {
        if composerDay != nil { submitComposer(store: store, keepOpen: false, focus: nil) }
    }

    /// Esc in the new-task row: what was typed is let go.
    func cancelComposer(focus: FocusState<TaskField?>.Binding) {
        pendingClose?.cancel()
        newTitle = ""
        newNotes = ""
        composerDay = nil
        lastAdded = nil
        focus.wrappedValue = nil
    }

    /// Leaving a field ends its edit (or closes the new-task row, adding what was typed).
    func focusChanged(from old: TaskField?, to new: TaskField?, store: TaskStore, focus: FocusState<TaskField?>.Binding) {
        pendingClose?.cancel()
        switch old {
        case .title(let id), .notes(let id):
            if new == .title(id) || new == .notes(id) { return }
            if editing == id { finishEditing(store: store) }
        case .newTitle, .newNotes:
            if new == .newTitle || new == .newNotes { return }
            if new == nil {
                pendingClose = Task {
                    try? await Task.sleep(for: .milliseconds(250))
                    guard !Task.isCancelled, focus.wrappedValue == nil else { return }
                    closeComposer(store: store)
                }
                return
            }
            closeComposer(store: store)
        case nil:
            break
        }
    }

    func reset(store: TaskStore) {
        finishEditing(store: store)
        closeComposer(store: store)
        settling = []
        leaving = [:]
    }
}

/// Hardware keyboard for a task list: publishes the ids on screen for ↑ ↓, keeps the selection visible, and carries
/// out Space (complete), Return (edit) and ⌥↑ / ⌥↓ (one place up or down, in My order) on the selected task.
struct ListKeyboard: ViewModifier {
    let tab: Router.Tab
    let ids: [String]
    let editor: ListEditor
    var focus: FocusState<TaskField?>.Binding
    let actions: TaskActions
    let proxy: ScrollViewProxy

    @Environment(Router.self) private var router
    @Environment(AppModel.self) private var model
    @Environment(Preferences.self) private var prefs
    /// The list itself takes keyboard focus whenever no text field has it, so arrows reach us before the
    /// system's focus navigation.
    @FocusState private var listFocused: Bool

    func body(content: Content) -> some View {
        content
            .focusable()
            .focusEffectDisabled()
            .focused($listFocused)
            .onKeyPress(keys: [.upArrow, .downArrow, .space, .return, .delete, .escape]) { press in
                guard focus.wrappedValue == nil, router.tab == tab else { return .ignored }
                if press.modifiers.contains(.option) {
                    guard press.key == .upArrow || press.key == .downArrow, let id = router.selectedTask else { return .ignored }
                    nudge(id, press.key == .upArrow ? -1 : 1)
                    return .handled
                }
                if press.modifiers.contains(.command) || press.modifiers.contains(.control) { return .ignored }
                let keys = model.keyboard
                switch press.key {
                case .upArrow: keys.select(-1)
                case .downArrow: keys.select(1)
                case .space: keys.complete()
                case .return: keys.edit()
                case .delete: keys.delete()
                case .escape: keys.escape()
                default: return .ignored
                }
                return .handled
            }
            .onAppear { listFocused = true }
            .onChange(of: focus.wrappedValue) { _, field in if field == nil { listFocused = true } }
            .onChange(of: router.tab) { _, t in if t == tab { listFocused = true } }
            .onChange(of: ids, initial: true) { _, ids in publish(ids) }
            .onChange(of: router.tab) { _, _ in publish(ids) }
            .onChange(of: router.toggleRequest) { _, request in
                guard router.tab == tab, let request, let task = actions.store.task(request.id) else { return }
                editor.toggle(task, actions: actions, focus: focus)
            }
            .onChange(of: router.editRequest) { _, request in
                guard router.tab == tab, let request, let task = actions.store.task(request.id) else { return }
                editor.startEditing(task, field: .title(task.id), store: actions.store, focus: focus)
            }
            .onChange(of: router.nudgeRequest) { _, request in
                guard router.tab == tab, let request else { return }
                nudge(request.id, request.direction)
            }
            .onChange(of: router.selectedTask) { _, id in
                guard router.tab == tab, let id else { return }
                withAnimation(TaskActions.motion(Motion.settle)) { proxy.scrollTo(id) }
            }
    }

    /// ⌥↑ / ⌥↓: the picked task one place up or down its day (only in the person's own order, as on the web).
    private func nudge(_ id: String, _ direction: Int) {
        guard prefs.sort.allowsReordering, let task = actions.store.task(id), !task.done else { return }
        actions.nudge(task, by: direction)
    }

    private func publish(_ ids: [String]) {
        guard router.tab == tab else { return }
        router.visibleTaskIDs = ids
        // A selection that left the list (collapsed into Done, another day) is dropped, so keys never act unseen.
        if let selected = router.selectedTask, !ids.contains(selected) { router.selectedTask = nil }
    }
}

extension View {
    /// A "Done" button above the on-screen keyboard while a task's words are being written.
    func keyboardDoneButton(focus: FocusState<TaskField?>.Binding) -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focus.wrappedValue = nil }.fontWeight(.semibold)
            }
        }
    }
}
