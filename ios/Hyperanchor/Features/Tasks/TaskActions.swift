import SwiftUI
import UIKit

/// What every view can do with a task: the store's actions, each one undoable, with the web's messages and Undo.
/// Lists answer with the web's motion: a deleted row folds away, tasks brought along travel to their place, a nudged
/// task's neighbours make room, and Undo opens things up again (a short fade with Reduce Motion).
@MainActor
struct TaskActions {
    let store: TaskStore
    let toaster: Toaster
    let today: DayKey

    var tomorrow: DayKey { today.adding(days: 1) }
    /// The first day of next week (`startOfWeek(today) + 7` on the web).
    var nextWeek: DayKey { today.startOfWeek.adding(days: 7) }

    /// Ticks a task or opens it again. As on the web there's no toast: ⌘Z takes it back.
    func toggle(_ task: TaskItem) {
        store.toggle(task.id)
    }

    /// To another day: "Moved to tomorrow", with Undo.
    func move(_ task: TaskItem, to date: DayKey) {
        let notice = withAnimation(Self.motion(Motion.settle)) { store.moveTo(task.id, date, today: today) }
        show(notice)
    }

    /// "Deleted “Call Mom”", with Undo; the row folds away.
    func delete(_ task: TaskItem) {
        guard let notice = withAnimation(Self.motion(Motion.in(Tokens.Motion.base)), { store.delete(task.id) }) else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        show(notice)
    }

    /// Tasks left open on earlier days, to today: "Moved 4 tasks to today", with Undo.
    func moveToToday(_ tasks: [TaskItem]) {
        let notice = withAnimation(Self.motion(Motion.travel)) { store.moveAllToToday(tasks.map(\.id), today: today) }
        show(notice)
    }

    /// One place up (-1) or down (+1) its day, in the person's own order. As on the web there's no toast: ⌘Z takes it
    /// back.
    func nudge(_ task: TaskItem, by direction: Int) {
        withAnimation(Self.motion(Motion.settle)) { store.nudge(task.id, by: direction) }
    }

    /// A task dragged to `index` among `date`'s open tasks (the list has already moved it there).
    func place(_ task: TaskItem, on date: DayKey, at index: Int) {
        show(store.place(task.id, on: date, at: index, today: today))
    }

    /// The toast for an action, its Undo opening things up again where they were.
    private func show(_ notice: TaskStore.Notice?) {
        guard let notice else { return }
        guard let step = notice.undo else { return toaster.show(notice.message) }
        toaster.show(notice.message, action: "Undo") { [store] in
            withAnimation(Self.motion(Motion.settle)) { _ = store.undo(step) }
        }
    }

    /// `animation`, or the short fade when the person asked for less motion.
    static func motion(_ animation: Animation) -> Animation {
        Motion.choose(animation, reduceMotion: UIAccessibility.isReduceMotionEnabled)
    }
}

/// A task's menu (the long press and "…"), as on the web: done or open, edit, the three moves, up and down in the
/// person's own order, and delete.
struct TaskMenuItems: View {
    let task: TaskItem
    let actions: TaskActions
    let toggle: () -> Void
    var edit: (() -> Void)?
    /// Move up / Move down (a day in My order): whether each way is open. Nil: not offered.
    var order: (up: Bool, down: Bool)?
    var nudge: ((Int) -> Void)?
    /// Moves the task to another day (the Day list lets the row slide toward it first); by default straight away.
    var move: ((DayKey) -> Void)?

    init(task: TaskItem, actions: TaskActions, toggle: @escaping () -> Void, edit: (() -> Void)? = nil) {
        self.task = task
        self.actions = actions
        self.toggle = toggle
        self.edit = edit
    }

    init(task: TaskItem, actions: TaskActions, toggle: @escaping () -> Void, edit: (() -> Void)?,
         order: (up: Bool, down: Bool)?, nudge: @escaping (Int) -> Void, move: @escaping (DayKey) -> Void) {
        self.init(task: task, actions: actions, toggle: toggle, edit: edit)
        self.order = order
        self.nudge = nudge
        self.move = move
    }

    var body: some View {
        Button(task.done ? "Mark as open" : "Mark as done", systemImage: task.done ? "square" : "checkmark.square", action: toggle)
        if let edit {
            Button("Edit", systemImage: "pencil", action: edit)
        }
        Divider()
        Button("Move to today", systemImage: "sun.max") { go(actions.today) }
            .disabled(task.date == actions.today)
        Button("Move to tomorrow", systemImage: "arrow.right") { go(actions.tomorrow) }
            .disabled(task.date == actions.tomorrow)
        Button("Move to next week", systemImage: "calendar") { go(actions.nextWeek) }
            .disabled(task.date == actions.nextWeek)
        if let order, let nudge, !task.done {
            Divider()
            Button("Move up", systemImage: "arrow.up") { nudge(-1) }
                .disabled(!order.up)
            Button("Move down", systemImage: "arrow.down") { nudge(1) }
                .disabled(!order.down)
        }
        Divider()
        Button("Delete", systemImage: "trash", role: .destructive) { actions.delete(task) }
    }

    private func go(_ date: DayKey) {
        if let move { move(date) } else { actions.move(task, to: date) }
    }
}

/// Which text field has the keyboard.
enum TaskField: Hashable {
    case title(String)
    case notes(String)
    case newTitle
    case newNotes
}

/// The new task being written, at the top of its day (the web's composer): an empty box, "New task", and "Notes" under
/// it. Return adds the task there and keeps the row open for the next one, which fades in; Esc lets it go.
struct ComposerRow: View {
    @Binding var title: String
    @Binding var notes: String
    var focus: FocusState<TaskField?>.Binding
    let submit: () -> Void
    /// Changes each time the row starts afresh: the field fades in.
    var run = 0
    var cancel: (() -> Void)?

    @Environment(\.horizontalSizeClass) private var sizeClass
    @ScaledMetric(relativeTo: .callout) private var firstLine: CGFloat = 50
    @ScaledMetric(relativeTo: .callout) private var padding: CGFloat = 14
    @State private var shown = 1.0

    init(title: Binding<String>, notes: Binding<String>, focus: FocusState<TaskField?>.Binding, run: Int = 0,
         cancel: (() -> Void)? = nil, submit: @escaping () -> Void) {
        _title = title
        _notes = notes
        self.focus = focus
        self.run = run
        self.cancel = cancel
        self.submit = submit
    }

    var body: some View {
        let wide = sizeClass == .regular
        HStack(alignment: .top, spacing: 0) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .fill(.surface)
                .strokeBorder(.checkRing, lineWidth: 1.5)
                .frame(width: 18, height: 18)
                .frame(width: 30, height: firstLine, alignment: .leading)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                TextField("New task", text: $title, prompt: Text("New task").foregroundStyle(.ink3))
                    .font(.token(Tokens.Typography.callout))
                    .foregroundStyle(.ink)
                    .focused(focus, equals: .newTitle)
                    .submitLabel(.next)
                    .onSubmit(submit)
                    .onKeyPress(.escape) { escape() }
                    .accessibilityLabel("New task title")
                    .accessibilityIdentifier("composer.title")
                TextField("Notes", text: $notes, prompt: Text("Notes").foregroundStyle(.ink3))
                    .font(.token(Tokens.Typography.body))
                    .foregroundStyle(.ink2)
                    .focused(focus, equals: .newNotes)
                    .submitLabel(.next)
                    .onSubmit(submit)
                    .onKeyPress(.escape) { escape() }
                    .accessibilityLabel("New task notes")
                    .accessibilityIdentifier("composer.notes")
            }
            .padding(.vertical, padding - 1)
            .padding(.trailing, 12)
        }
        .padding(.leading, wide ? 12 : 16)
        .frame(minHeight: firstLine)
        .opacity(shown)
        .onChange(of: run) { _, _ in
            // The field that was here just became a task; a new one appears in its place.
            shown = 0
            Task {
                try? await Task.sleep(for: .milliseconds(16))
                withAnimation(Motion.out(Tokens.Motion.fast)) { shown = 1 }
            }
        }
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(RowBox(wide: wide, fill: .surface2))
        .onChange(of: title) { _, t in if t.count > TaskItem.titleMax { title = String(t.prefix(TaskItem.titleMax)) } }
        .onChange(of: notes) { _, n in if n.count > TaskItem.notesMax { notes = String(n.prefix(TaskItem.notesMax)) } }
    }

    private func escape() -> KeyPress.Result {
        guard let cancel else { return .ignored }
        cancel()
        return .handled
    }
}

/// The box a picked, edited or new row becomes (the web's `bg-surface-3 shadow-ring-line-2`): a shade darker with an
/// edge — rounded on iPad, edge to edge on iPhone (where only its top and bottom show).
struct RowBox: View {
    let wide: Bool
    var fill: Color = .surface3

    var body: some View {
        if wide {
            RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
                .fill(fill)
                .strokeBorder(.line2, lineWidth: 1)
        } else {
            fill
                .overlay(alignment: .top) { Rectangle().fill(.line2).frame(height: 1) }
                .overlay(alignment: .bottom) { Rectangle().fill(.line2).frame(height: 1) }
        }
    }
}

extension View {
    /// The hairline under a list row: from where the words start (46 pt in, 42 on iPad) to the row's inset on the right.
    func rowHairline(_ shown: Bool = true, wide: Bool) -> some View {
        overlay(alignment: .bottom) {
            if shown {
                Rectangle()
                    .fill(.line)
                    .frame(height: 1)
                    .padding(.leading, wide ? 42 : 46)
                    .padding(.trailing, wide ? 12 : 16)
                    .accessibilityHidden(true)
            }
        }
    }
}
