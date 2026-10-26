import SwiftUI
import UIKit

/// What every view can do with a task, with the web's messages and Undo.
@MainActor
struct TaskActions {
    let store: TaskStore
    let toaster: Toaster
    let today: DayKey

    var tomorrow: DayKey { today.adding(days: 1) }
    /// Monday of next week.
    var nextWeek: DayKey { today.startOfWeek.adding(days: 7) }

    func toggle(_ task: TaskItem) {
        store.setDone(task.id, !task.done)
    }

    func move(_ task: TaskItem, to date: DayKey) {
        let from = task.date
        store.move(task.id, to: date)
        let name = Dates.relative(date, today: today) ?? Dates.medium(date)
        toaster.show("Moved to \(name)", action: "Undo") { store.move(task.id, to: from) }
    }

    func delete(_ task: TaskItem) {
        guard let removed = store.remove(task.id) else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        toaster.show("Deleted “\(task.title)”", action: "Undo") { store.restore(removed) }
    }

    func moveToToday(_ tasks: [TaskItem]) {
        guard !tasks.isEmpty else { return }
        let original = tasks.map { ($0.id, $0.date) }
        for t in tasks { store.move(t.id, to: today) }
        toaster.show(tasks.count == 1 ? "Moved 1 task to Today" : "Moved \(tasks.count) tasks to Today", action: "Undo") {
            for (id, date) in original { store.move(id, to: date) }
        }
    }
}

/// The task's menu (long press), as on the web.
struct TaskMenuItems: View {
    let task: TaskItem
    let actions: TaskActions
    let toggle: () -> Void
    var edit: (() -> Void)?

    var body: some View {
        Button(task.done ? "Mark as Not Done" : "Mark as Done", systemImage: task.done ? "circle" : "checkmark.circle", action: toggle)
        if let edit {
            Button("Edit", systemImage: "pencil", action: edit)
        }
        Divider()
        Button("Move to Today", systemImage: "sun.max") { actions.move(task, to: actions.today) }
            .disabled(task.date == actions.today)
        Button("Move to Tomorrow", systemImage: "arrow.right") { actions.move(task, to: actions.tomorrow) }
            .disabled(task.date == actions.tomorrow)
        Button("Move to Next Week", systemImage: "calendar") { actions.move(task, to: actions.nextWeek) }
            .disabled(task.date == actions.nextWeek)
        Divider()
        Button("Delete", systemImage: "trash", role: .destructive) { actions.delete(task) }
    }
}

extension View {
    /// Swipe right: Done. Swipe left: Delete, or Tomorrow.
    func taskSwipeActions(_ task: TaskItem, actions: TaskActions, accent: Color, toggle: @escaping () -> Void) -> some View {
        swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button(action: toggle) {
                Label(task.done ? "Not Done" : "Done", systemImage: task.done ? "arrow.uturn.backward" : "checkmark")
            }
            .tint(task.done ? .ink3 : accent)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            Button(role: .destructive) { actions.delete(task) } label: {
                Label("Delete", systemImage: "trash")
            }
            .tint(.redInk)
            if task.date != actions.tomorrow {
                Button { actions.move(task, to: actions.tomorrow) } label: {
                    Label("Tomorrow", systemImage: "arrow.right")
                }
                .tint(.ink3)
            }
        }
    }
}

/// Which text field has the keyboard.
enum TaskField: Hashable {
    case title(String)
    case notes(String)
    case newTitle
    case newNotes
}

/// One task: checkbox, title, notes on the second line. Tapping the text edits it in place.
struct TaskRow: View {
    let task: TaskItem
    let isEditing: Bool
    var focus: FocusState<TaskField?>.Binding
    let toggle: () -> Void
    let startEditing: (TaskField) -> Void
    let change: (TaskPatch) -> Void
    let commit: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            TaskCheckbox(task: task, toggle: toggle)
                .padding(.leading, -12)
                .padding(.vertical, -10)
            if isEditing { editor } else { label }
        }
        .padding(.vertical, 2)
    }

    private var label: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(task.title)
                .font(.body)
                .foregroundStyle(task.done ? .ink3 : .ink)
                .animation(.easeOut(duration: 0.3), value: task.done)
            if !task.notes.isEmpty {
                Text(task.notes.replacing(/\s*\n\s*/, with: " · "))
                    .font(.subheadline)
                    .foregroundStyle(.ink2)
                    .lineLimit(2)
            }
        }
        .frame(maxWidth: .infinity, minHeight: 24, alignment: .leading)
        .contentShape(Rectangle())
        .onTapGesture { startEditing(.title(task.id)) }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
        .accessibilityHint("Edits the task")
    }

    private var editor: some View {
        VStack(alignment: .leading, spacing: 4) {
            TextField("Title", text: Binding(get: { task.title }, set: { change(TaskPatch(title: String($0.prefix(TaskItem.titleMax)))) }))
                .font(.body)
                .focused(focus, equals: .title(task.id))
                .submitLabel(.done)
                .onSubmit(commit)
                .accessibilityIdentifier("task.title.field")
            TextField("Notes", text: Binding(get: { task.notes }, set: { change(TaskPatch(notes: String($0.prefix(TaskItem.notesMax)))) }), axis: .vertical)
                .font(.subheadline)
                .foregroundStyle(.ink2)
                .lineLimit(1...8)
                .focused(focus, equals: .notes(task.id))
                .accessibilityIdentifier("task.notes.field")
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// The quick-add row: a dashed circle, "New Task" and "Notes". Return adds the task and keeps the row open.
struct ComposerRow: View {
    @Binding var title: String
    @Binding var notes: String
    var focus: FocusState<TaskField?>.Binding
    let submit: () -> Void

    var body: some View {
        HStack(alignment: .top, spacing: 4) {
            Circle()
                .strokeBorder(.ink4, style: StrokeStyle(lineWidth: 1.5, dash: [3, 2.5]))
                .frame(width: 20, height: 20)
                .frame(width: 44, height: 24)
                .padding(.leading, -12)
            VStack(alignment: .leading, spacing: 4) {
                TextField("New Task", text: $title)
                    .font(.body)
                    .focused(focus, equals: .newTitle)
                    .submitLabel(.next)
                    .onSubmit(submit)
                    .accessibilityIdentifier("composer.title")
                TextField("Notes", text: $notes, axis: .vertical)
                    .font(.subheadline)
                    .lineLimit(1...4)
                    .focused(focus, equals: .newNotes)
                    .accessibilityIdentifier("composer.notes")
            }
        }
        .padding(.vertical, 2)
        .onChange(of: title) { _, t in if t.count > TaskItem.titleMax { title = String(t.prefix(TaskItem.titleMax)) } }
    }
}

/// "+ Add a task": opens the quick-add row.
struct AddTaskRow: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Image(systemName: "plus")
                    .frame(width: 44)
                    .padding(.leading, -12)
                Text("Add a task")
                Spacer()
            }
            .font(.body)
            .foregroundStyle(.ink3)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("addTask")
    }
}
