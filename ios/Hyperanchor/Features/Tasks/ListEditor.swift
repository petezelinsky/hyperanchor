import SwiftUI

/// Editing state shared by the Day and Week lists: the task being edited in place, the quick-add row,
/// and tasks that were just completed and stay where they are while the tick plays.
@MainActor
@Observable
final class ListEditor {
    private(set) var editing: String?
    /// The day whose quick-add row is open.
    private(set) var composerDay: DayKey?
    var newTitle = ""
    var newNotes = ""
    /// Just completed (≈0.9 s): still listed with the open tasks.
    private(set) var settling: Set<String> = []
    /// When a task was last ticked off — to tell a day the person just closed from one that loaded closed.
    private(set) var lastToggle = Date.distantPast

    @ObservationIgnored private var snapshot = (title: "", notes: "")

    var justToggled: Bool { Date.now.timeIntervalSince(lastToggle) < 2 }

    func isSettling(_ id: String) -> Bool { settling.contains(id) }

    func toggle(_ task: TaskItem, actions: TaskActions, focus: FocusState<TaskField?>.Binding) {
        if editing == task.id { focus.wrappedValue = nil }
        lastToggle = .now
        if !task.done {
            settling.insert(task.id)
            Task {
                try? await Task.sleep(for: .milliseconds(900))
                withAnimation(.snappy(duration: 0.4)) { _ = settling.remove(task.id) }
            }
        }
        actions.toggle(task)
    }

    func startEditing(_ task: TaskItem, field: TaskField, store: TaskStore, focus: FocusState<TaskField?>.Binding) {
        if let editing, editing != task.id { finishEditing(store: store) }
        closeComposer(store: store)
        if editing != task.id { snapshot = (task.title, task.notes) }
        editing = task.id
        Task { focus.wrappedValue = field }
    }

    /// Saves the edit: titles and notes are trimmed, and an emptied title falls back to what it was.
    func finishEditing(store: TaskStore) {
        guard let id = editing else { return }
        editing = nil
        guard let t = store.task(id) else { return }
        var patch = TaskPatch()
        let title = t.title.trimmingCharacters(in: .whitespacesAndNewlines)
        let fixed = title.isEmpty ? (snapshot.title.isEmpty ? "Untitled" : snapshot.title) : title
        if fixed != t.title { patch.title = fixed }
        let notes = t.notes.trimmingCharacters(in: .whitespacesAndNewlines)
        if notes != t.notes { patch.notes = notes }
        if patch.isEmpty { store.flush(id) } else { store.edit(id, patch) }
    }

    func openComposer(on day: DayKey, store: TaskStore, focus: FocusState<TaskField?>.Binding) {
        finishEditing(store: store)
        if composerDay != day { closeComposer(store: store) }
        composerDay = day
        Task { focus.wrappedValue = .newTitle }
    }

    /// Return in the title: adds the task; the row stays open for the next one.
    func submitComposer(store: TaskStore, keepOpen: Bool, focus: FocusState<TaskField?>.Binding?) {
        guard let day = composerDay else { return }
        let title = newTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        if !title.isEmpty {
            store.create(title: title, notes: newNotes.trimmingCharacters(in: .whitespacesAndNewlines), date: day)
        }
        newTitle = ""
        newNotes = ""
        if keepOpen, !title.isEmpty, let focus {
            Task { focus.wrappedValue = .newTitle }
        } else {
            composerDay = nil
        }
    }

    func closeComposer(store: TaskStore) {
        if composerDay != nil { submitComposer(store: store, keepOpen: false, focus: nil) }
    }

    /// Leaving a field ends its edit (or closes the quick-add row, adding what was typed).
    func focusChanged(from old: TaskField?, to new: TaskField?, store: TaskStore) {
        switch old {
        case .title(let id), .notes(let id):
            if new == .title(id) || new == .notes(id) { return }
            if editing == id { finishEditing(store: store) }
        case .newTitle, .newNotes:
            if new == .newTitle || new == .newNotes { return }
            closeComposer(store: store)
        case nil:
            break
        }
    }

    func reset(store: TaskStore) {
        finishEditing(store: store)
        closeComposer(store: store)
        settling = []
    }
}
