import SwiftUI

/// The week as a list of days, where seven lanes don't fit (iPhone, a narrow iPad window): a band per day with its name,
/// its date and how much is done (today marked), + on today and the days ahead, then the day's tasks — what's left, then
/// what's done. A day without tasks is just its band. Swipe right: done (or open again); swipe left: tomorrow; hold a
/// task (or tap its ⋯) for its menu.
struct WeekList: View {
    let days: [WeekDay]
    let work: WeekWork

    var body: some View {
        let rows = WeekListRow.rows(days, composerDay: work.state.composerDay)
        ScrollViewReader { proxy in
            List {
                ForEach(rows) { row in
                    switch row.kind {
                    case .header(let day, let lineAbove):
                        BandHeader(day: day, lineAbove: lineAbove, work: work)
                    case .composer(let day):
                        BandComposer(day: day, work: work)
                    case .task(let task, let last):
                        BandRow(task: task, hairline: !last, work: work)
                    }
                }
            }
            .listStyle(.plain)
            .environment(\.defaultMinListRowHeight, 0)
            .scrollContentBackground(.hidden)
            .background(.surface)
            .contentMargins(.bottom, 24, for: .scrollContent)
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: work.router.selectedTask) { _, id in
                guard let id else { return }
                withAnimation(Motion.choose(Motion.settle, reduceMotion: work.reduceMotion)) { proxy.scrollTo(id) }
            }
            .onChange(of: work.state.composerDay) { _, day in
                guard let day else { return }
                withAnimation(Motion.choose(Motion.settle, reduceMotion: work.reduceMotion)) { proxy.scrollTo(WeekListRow.composerID(day)) }
            }
        }
    }
}

/// A line of the list: a day's band, the composer under it, or a task.
struct WeekListRow: Identifiable {
    enum Kind {
        /// `lineAbove`: the day before ends in a task (an empty day's band already ends in a line).
        case header(WeekDay, lineAbove: Bool)
        case composer(DayKey)
        /// `last`: the day's last task (the next band's line closes it).
        case task(TaskItem, last: Bool)
    }

    let id: String
    let kind: Kind

    static func composerID(_ day: DayKey) -> String { "composer-\(day.ordinal)" }

    static func rows(_ days: [WeekDay], composerDay: DayKey?) -> [WeekListRow] {
        var rows: [WeekListRow] = []
        for (i, day) in days.enumerated() {
            let lineAbove: Bool = if case .header = rows.last?.kind { false } else { i > 0 }
            rows.append(WeekListRow(id: "day-\(day.day.ordinal)", kind: .header(day, lineAbove: lineAbove)))
            if composerDay == day.day { rows.append(WeekListRow(id: composerID(day.day), kind: .composer(day.day))) }
            let tasks = day.open + day.done
            for (j, task) in tasks.enumerated() {
                // The week's very last row keeps its line; elsewhere the next band draws one.
                let last = j == tasks.count - 1 && i < days.count - 1
                rows.append(WeekListRow(id: task.id, kind: .task(task, last: last)))
            }
        }
        return rows
    }
}

/// A day's band: "Today", the day's name and date, how much is done, and + on today and the days ahead.
private struct BandHeader: View {
    let day: WeekDay
    let lineAbove: Bool
    let work: WeekWork

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let isToday = day.day == work.today
        let past = day.day < work.today
        HStack(spacing: 10) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                if isToday {
                    Text("Today")
                        .font(.token(Tokens.Typography.caption2, weight: .semibold))
                        .foregroundStyle(.onPrimary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 1)
                        .background(.primaryFill, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                }
                Text(Dates.dayName(day.day))
                    .font(.token(Tokens.Typography.footnote, weight: .semibold))
                    .foregroundStyle(past ? .ink3 : .ink)
                Text(Dates.short(day.day))
                    .font(.token(Tokens.Typography.footnote))
                    .foregroundStyle(.ink3)
            }
            .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
            .frame(maxWidth: .infinity, alignment: .leading)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(BandHeader.summary(day, today: work.today))
            .accessibilityAddTraits(.isHeader)
            if day.total > 0 {
                Text(verbatim: "\(day.finished) of \(day.total)")
                    .font(.token(Tokens.Typography.caption))
                    .monospacedDigit()
                    .foregroundStyle(.ink3)
                    .contentTransition(.numericText())
                    .accessibilityHidden(true)
            }
            if !past {
                DayPlusButton(label: "New task on \(Dates.dayName(day.day))") { work.openComposer(on: day.day) }
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, 12)
        .padding(.vertical, typeSize.isAccessibilitySize ? 8 : 0)
        .frame(minHeight: 40)
        .overlay(alignment: .top) { if lineAbove { Rectangle().fill(.line).frame(height: 1) } }
        .overlay(alignment: .bottom) { Rectangle().fill(.line).frame(height: 1) }
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface2)
    }

    static func summary(_ day: WeekDay, today: DayKey) -> String {
        let name = (day.day == today ? "Today, " : "") + Dates.long(day.day)
        return day.total > 0 ? "\(name): \(day.finished) of \(day.total) done" : "\(name): no tasks"
    }
}

/// The composer under a day's band: an empty box and the field. Return adds the task at the top of the day and leaves
/// a fresh field for the next one.
private struct BandComposer: View {
    let day: DayKey
    let work: WeekWork

    var body: some View {
        @Bindable var state = work.state
        HStack(alignment: .top, spacing: 0) {
            RoundedRectangle(cornerRadius: 6, style: .continuous)
                .strokeBorder(.checkRing, lineWidth: 1.5)
                .background(.surface, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                .frame(width: 18, height: 18)
                .frame(width: 30, height: 22, alignment: .leading)
                .accessibilityHidden(true)
            TextField("New task", text: $state.composerText.returnSubmits { work.submitComposer() }, axis: .vertical)
                .font(.token(Tokens.Typography.callout))
                .lineLimit(1...4)
                .focused(work.focus, equals: .composer(day))
                .submitLabel(.done)
                .onSubmit { work.submitComposer() }
                .onKeyPress(.escape) {
                    work.cancelComposer()
                    return .handled
                }
                .accessibilityLabel("New task title")
                .accessibilityIdentifier("composer.title")
        }
        .padding(.leading, 16)
        .padding(.trailing, 16)
        .padding(.vertical, 14)
        .frame(minHeight: 50)
        .contentShape(Rectangle())
        .onTapGesture { work.focus.wrappedValue = .composer(day) }
        .overlay(Rectangle().strokeBorder(.line2, lineWidth: 1))
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface2)
    }
}

/// A task in the list, as in Day: its box, its title on one line (whole once picked), ⋯ for its menu, a hairline under
/// it from where the text starts. The first tap picks it; a tap on the picked task edits it.
private struct BandRow: View {
    let task: TaskItem
    let hairline: Bool
    let work: WeekWork

    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var scheme
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let selected = work.router.selectedTask == task.id
        let editing = work.state.editing == task.id
        let tomorrow = work.today.adding(days: 1)
        HStack(alignment: .top, spacing: 0) {
            TaskCheckbox(task: task, size: 18) { work.toggle(task) }
                .padding(-13)
                .frame(width: 30, height: 22, alignment: .leading)
            Group {
                if editing {
                    TextField("Task title", text: work.titleBinding(task.id).returnSubmits { work.focus.wrappedValue = nil }, axis: .vertical)
                        .font(.token(Tokens.Typography.callout))
                        .foregroundStyle(.ink)
                        .lineLimit(1...8)
                        .focused(work.focus, equals: .title(task.id))
                        .submitLabel(.done)
                        .onSubmit { work.focus.wrappedValue = nil }
                        .accessibilityIdentifier("task.title.field")
                } else {
                    Text(task.title)
                        .font(.token(Tokens.Typography.callout))
                        .foregroundStyle(task.done ? .ink3 : .ink)
                        // One line, as in Day; huge text gets three before it's cut.
                        .lineLimit(selected ? nil : typeSize.isAccessibilitySize ? 3 : 1)
                        .animation(Motion.out(Tokens.Motion.base), value: task.done)
                        .accessibilityValue(task.done ? "Done" : "Open")
                        .accessibilityHint(selected ? "Edits the title" : "Picks the task")
                        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                        .accessibilityActions { menu }
                }
            }
            .frame(maxWidth: .infinity, minHeight: 22, alignment: .leading)
            .padding(.trailing, 8)
            Menu {
                menu
            } label: {
                Image(systemName: Icon.more)
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(.ink2)
                    .frame(width: 36, height: 50)
                    .contentShape(Rectangle())
            }
            .menuStyle(.button)
            .buttonStyle(.plain)
            .padding(.vertical, -14)
            .accessibilityLabel("More actions")
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .padding(.vertical, 14)
        .frame(minHeight: 50)
        .background(selected || editing ? Color.surface3 : Color.surface)
        .overlay {
            if selected || editing { Rectangle().strokeBorder(.line2, lineWidth: 1) }
        }
        .overlay(alignment: .bottom) {
            if hairline && !(selected || editing) {
                Rectangle().fill(.line).frame(height: 1).padding(.leading, 46).padding(.trailing, 16)
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { work.tap(task) }
        .contextMenu { menu }
        .swipeActions(edge: .leading, allowsFullSwipe: true) {
            Button { work.toggle(task) } label: {
                Label(task.done ? "Open" : "Done", systemImage: "checkmark")
            }
            .tint(doneTint)
        }
        .swipeActions(edge: .trailing, allowsFullSwipe: true) {
            if task.date != tomorrow {
                Button { work.move(task, to: tomorrow) } label: {
                    Label("Tomorrow", systemImage: "arrow.right")
                }
                .tint(tomorrowTint)
            }
        }
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(selected || editing ? Color.surface3 : Color.surface)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("task.\(task.title)")
    }

    /// Swiping right finishes the task on the accent; graphite's accent turns light in dark mode, where the white label
    /// would vanish, so it stays dark there.
    private var doneTint: Color {
        palette.choice == .graphite && scheme == .dark ? Color(white: 0.3) : palette.accentSolid
    }

    /// Swiping left moves the task to tomorrow, on black (a dark gray in dark mode, under a white label).
    private var tomorrowTint: Color {
        scheme == .dark ? Color(white: 0.22) : .primaryFill
    }

    @ViewBuilder
    private var menu: some View {
        PlannerTaskMenu(task: task, today: work.today,
                        toggle: { work.toggle(task) },
                        edit: { work.startEditing(task) },
                        move: { work.move(task, to: $0) },
                        delete: { work.delete(task) })
    }
}
