import SwiftUI
import UIKit

/// A task in a list, as the web's row: its square box, its title with its notes quietly beside it, and "…" for its
/// menu; a hairline under it from where the words start. A tap picks it and shows it whole (the title wraps, the notes
/// show in full); a tap on the picked task edits it, the title in a field that grows. Swipe right: done (or open
/// again); swipe left: tomorrow. Long press: the menu — and, where the list allows it, a drag to another place.
struct EditableTaskRow: View {
    let task: TaskItem
    let editor: ListEditor
    var focus: FocusState<TaskField?>.Binding
    let actions: TaskActions
    /// The hairline under it: the list hides it where the row below is picked (that row's edge takes its place).
    var hairline: Bool
    /// Move up / Move down (a day in My order): whether each way is open. Nil: not offered.
    var order: (up: Bool, down: Bool)?

    @Environment(Router.self) private var router
    @Environment(\.palette) private var palette
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    /// Grows the row's measures with the text (Dynamic Type), from the web's 50-point rows (48 on iPad).
    @ScaledMetric(relativeTo: .callout) private var scale: CGFloat = 1

    init(task: TaskItem, editor: ListEditor, focus: FocusState<TaskField?>.Binding, actions: TaskActions,
         hairline: Bool = true, order: (up: Bool, down: Bool)? = nil) {
        self.task = task
        self.editor = editor
        self.focus = focus
        self.actions = actions
        self.hairline = hairline
        self.order = order
    }

    var body: some View {
        let wide = sizeClass == .regular
        let editing = editor.editing == task.id
        let picked = editing || router.selectedTask == task.id
        let leaving = editor.leaving[task.id]
        // The box and "…" center on the first line of the title.
        let firstLine = (wide ? 48 : 50) * scale
        HStack(alignment: .top, spacing: 0) {
            TaskCheckbox(task: task, size: 18, toggle: toggle)
                // A 30-point column, the box at its start; the 44-point target reaches past it.
                .padding(.leading, -13)
                .padding(.trailing, -1)
                .frame(height: firstLine)
            words(picked: picked, editing: editing, padding: (wide ? 13 : 14) * scale)
                .frame(maxWidth: .infinity, alignment: .leading)
            more(wide: wide)
                .frame(height: firstLine)
        }
        .padding(.leading, wide ? 12 : 16)
        .padding(.trailing, wide ? 4 : 0)
        .frame(minHeight: firstLine)
        .rowHairline(hairline && !picked, wide: wide)
        .offset(x: leaving.map { reduceMotion ? 0 : CGFloat($0.direction) * 24 } ?? 0)
        .opacity(leaving == nil ? 1 : 0)
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(RowBackground(picked: picked, wide: wide))
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button(action: toggle) {
                Label(task.done ? "Open" : "Done", systemImage: "checkmark")
            }
            .tint(palette.choice == .graphite ? SwipeTint.neutral : palette.accentSolid)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            if task.date != actions.tomorrow {
                // The row leaves the list the way the finger sent it.
                Button(role: .destructive) { actions.move(task, to: actions.tomorrow) } label: {
                    Label("Tomorrow", systemImage: "arrow.right")
                }
                .tint(SwipeTint.neutral)
            }
        }
        .contextMenu { menuItems }
    }

    // MARK: Pieces

    /// The title, and the notes: beside it on one quiet line; in full under it once picked; fields while edited.
    /// `padding` is the space above and below them (part of what answers a tap).
    @ViewBuilder
    private func words(picked: Bool, editing: Bool, padding: CGFloat) -> some View {
        let title = Font.token(Tokens.Typography.callout)
        let notes = Font.token(Tokens.Typography.body)
        if editing {
            VStack(alignment: .leading, spacing: 4) {
                TextField("Title", text: titleBinding, axis: .vertical)
                    .font(title)
                    .foregroundStyle(.ink)
                    .focused(focus, equals: .title(task.id))
                    .submitLabel(.done)
                    .onKeyPress(.escape) { cancel() }
                    .onKeyPress(.tab) {
                        focus.wrappedValue = .notes(task.id)
                        return .handled
                    }
                    .accessibilityLabel("Task title")
                    .accessibilityIdentifier("task.title.field")
                TextField("Notes", text: notesBinding, prompt: Text("Notes").foregroundStyle(.ink3), axis: .vertical)
                    .font(notes)
                    .foregroundStyle(.ink2)
                    .lineLimit(1...8)
                    .focused(focus, equals: .notes(task.id))
                    .onKeyPress(.escape) { cancel() }
                    // A hardware keyboard's Return finishes, as on the web; Shift-Return starts a new line.
                    .onKeyPress(.return, phases: .down) { press in
                        guard !press.modifiers.contains(.shift) else { return .ignored }
                        focus.wrappedValue = nil
                        return .handled
                    }
                    .accessibilityLabel("Notes")
                    .accessibilityIdentifier("task.notes.field")
            }
            .padding(.vertical, padding)
            .padding(.trailing, 8)
        } else {
            // A button rather than a tap gesture: it answers at once in a row that can also be dragged.
            Button(action: tap) {
                Group {
                    if picked {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(task.title)
                                .font(title)
                                .foregroundStyle(task.done ? .ink3 : .ink)
                            if !task.notes.isEmpty {
                                Text(task.notes)
                                    .font(notes)
                                    .foregroundStyle(.ink2)
                            }
                        }
                        .fixedSize(horizontal: false, vertical: true)
                    } else {
                        HStack(alignment: .firstTextBaseline, spacing: 10) {
                            Text(task.title)
                                .font(title)
                                .foregroundStyle(task.done ? .ink3 : .ink)
                                .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
                                .layoutPriority(1)
                            if !task.notes.isEmpty {
                                Text(task.notes.replacing(/\s*\n\s*/, with: " · "))
                                    .font(notes)
                                    .foregroundStyle(.ink3)
                                    .lineLimit(1)
                            }
                        }
                    }
                }
                .multilineTextAlignment(.leading)
                .padding(.vertical, padding)
                .padding(.trailing, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .contentShape(Rectangle())
            }
            .buttonStyle(RowTapStyle())
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(picked ? [.isButton, .isSelected] : .isButton)
            .accessibilityValue(task.done ? "Done" : "Open")
            .accessibilityHint(picked ? "Edits the task" : "Shows the task whole")
            .accessibilityActions { voiceOverActions }
            .accessibilityIdentifier("task.\(task.title)")
        }
    }

    /// "…": the same menu as the long press.
    private func more(wide: Bool) -> some View {
        Menu {
            menuItems
        } label: {
            Image(systemName: Icon.more)
                .font(.system(size: 14, weight: .light))
                .foregroundStyle(.ink2)
                .frame(width: wide ? 36 : 44, height: 44)
                .accessibilityHidden(true)
                .contentShape(Rectangle().inset(by: wide ? -4 : 0))
        }
        .menuIndicator(.hidden)
        .accessibilityLabel("More actions")
        .accessibilityIdentifier("task.more")
    }

    private var menuItems: some View {
        TaskMenuItems(task: task, actions: actions, toggle: toggle, edit: edit, order: order,
                      nudge: { actions.nudge(task, by: $0) },
                      move: { editor.leave(task, to: $0, actions: actions) })
    }

    /// VoiceOver: the menu's actions, on the row itself (the swipes add Done or Open and Tomorrow on their own).
    @ViewBuilder
    private var voiceOverActions: some View {
        Button("Edit", action: edit)
        if task.date != actions.today {
            Button("Move to today") { editor.leave(task, to: actions.today, actions: actions) }
        }
        if task.date != actions.nextWeek {
            Button("Move to next week") { editor.leave(task, to: actions.nextWeek, actions: actions) }
        }
        if let order, !task.done {
            if order.up { Button("Move up") { actions.nudge(task, by: -1) } }
            if order.down { Button("Move down") { actions.nudge(task, by: 1) } }
        }
        Button("Delete") { actions.delete(task) }
    }

    // MARK: Doing

    private func toggle() { editor.toggle(task, actions: actions, focus: focus) }

    private func edit() { editor.startEditing(task, field: .title(task.id), store: actions.store, focus: focus) }

    /// The first tap picks the task (and shows it whole); a tap on the picked task edits it.
    private func tap() {
        if router.selectedTask == task.id {
            edit()
        } else {
            // Whatever was being written elsewhere is kept, as a tap elsewhere keeps it on the web.
            if focus.wrappedValue != nil { focus.wrappedValue = nil }
            router.selectedTask = task.id
        }
    }

    private func cancel() -> KeyPress.Result {
        editor.cancelEditing(store: actions.store, focus: focus)
        return .handled
    }

    /// The title as it's typed: Return finishes (a title is one line), pasted line breaks become spaces.
    private var titleBinding: Binding<String> {
        Binding(
            get: { task.title },
            set: { next in
                guard next.contains("\n") else { return save(title: next) }
                if next.replacingOccurrences(of: "\n", with: "") == task.title {
                    focus.wrappedValue = nil
                } else {
                    save(title: next.replacingOccurrences(of: "\n", with: " "))
                }
            }
        )
    }

    private var notesBinding: Binding<String> {
        Binding(
            get: { task.notes },
            set: { actions.store.edit(task.id, TaskPatch(notes: String($0.prefix(TaskItem.notesMax))), debounce: true) }
        )
    }

    private func save(title: String) {
        actions.store.edit(task.id, TaskPatch(title: String(title.prefix(TaskItem.titleMax))), debounce: true)
    }
}

/// A tap on a row's words: nothing changes under the finger (the row answers by being picked).
private struct RowTapStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View { configuration.label }
}

/// A row's background: the surface, or the box a picked row becomes.
private struct RowBackground: View {
    let picked: Bool
    let wide: Bool

    var body: some View {
        if picked { RowBox(wide: wide) } else { Color.surface }
    }
}

/// Behind a swiped row. The web's swipes are black and white (accent-solid, primary); a swipe button's label is always
/// white, so in dark mode the black-and-white tile is a gray it can be read on.
enum SwipeTint {
    static let neutral = Color(uiColor: UIColor {
        $0.userInterfaceStyle == .dark ? Tokens.ink2.light.uiColor : Tokens.primary.light.uiColor
    })
}
