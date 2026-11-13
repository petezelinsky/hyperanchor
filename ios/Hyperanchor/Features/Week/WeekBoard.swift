import SwiftUI
import UniformTypeIdentifiers

/// The week as seven lanes that run the height of the screen, split by hairlines; today's lane is shaded (`WeekBoard` on
/// the web). Each day: its name and how much is done, its date (today's on a filled tile) with + beside it (not on days
/// gone by), a thin line that fills as tasks get done, then what's left, and what's finished below as quiet lines. A
/// new task starts at the top of its day. A task can be dragged to another day, or to another place in its own.
struct WeekBoard: View {
    /// Narrower than this the lanes get too tight for titles (112 points each), and the week becomes a list of days.
    static let minimumWidth: CGFloat = 7 * 112

    let days: [WeekDay]
    let work: WeekWork
    let size: CGSize

    @Namespace private var travel

    var body: some View {
        let laneWidth = size.width / 7
        ScrollViewReader { proxy in
            ScrollView(.vertical) {
                HStack(alignment: .top, spacing: 0) {
                    ForEach(days) { day in
                        WeekLane(day: day, first: day.id == days.first?.id, tight: laneWidth < 140, laneWidth: laneWidth,
                                 work: work, travel: travel)
                            .frame(maxWidth: .infinity, minHeight: size.height, maxHeight: .infinity, alignment: .top)
                    }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
            .scrollDismissesKeyboard(.interactively)
            .onChange(of: work.router.selectedTask) { _, id in
                guard let id else { return }
                withAnimation(Motion.choose(Motion.settle, reduceMotion: work.reduceMotion)) { proxy.scrollTo(id) }
            }
        }
    }
}

/// One day of the board: its header, then its tasks; it takes a dropped task anywhere.
private struct WeekLane: View {
    let day: WeekDay
    let first: Bool
    /// Narrow lanes give their padding to the titles.
    let tight: Bool
    let laneWidth: CGFloat
    let work: WeekWork
    let travel: Namespace.ID

    @Environment(\.palette) private var palette

    var body: some View {
        let state = work.state
        let isToday = day.day == work.today
        let composing = state.composerDay == day.day
        let hot = state.dropSpot?.day == day.day
        VStack(alignment: .leading, spacing: 0) {
            LaneHeader(day: day, today: work.today) { work.openComposer(on: day.day) }
            Color.clear
                .frame(height: 0)
                .onGeometryChange(for: CGFloat.self) { $0.frame(in: .named(day.id)).minY } action: { state.listTops[day.day] = $0 }
            VStack(spacing: 1) {
                if composing {
                    LaneComposer(day: day.day, work: work)
                        .transition(.opacity)
                }
                ForEach(day.open) { task in
                    card(task)
                        .onGeometryChange(for: CGRect.self) { $0.frame(in: .named(day.id)) } action: { frame in
                            state.rowFrames[day.day, default: [:]][task.id] = frame
                        }
                }
            }
            if !day.done.isEmpty {
                VStack(spacing: 1) {
                    ForEach(day.done) { card($0) }
                }
                .padding(.top, day.open.isEmpty && !composing ? 0 : 10)
            }
        }
        .padding(.horizontal, tight ? 4 : 8)
        .padding(.bottom, 12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .background {
            Rectangle()
                .fill(hot ? palette.accentSoft : isToday ? Color.surface2 : Color.surface)
                .animation(Motion.out(Tokens.Motion.fast), value: hot)
        }
        .overlay(alignment: .topLeading) {
            if hot, let y = state.dropSpot?.lineY {
                DropLine()
                    .padding(.horizontal, 8)
                    .offset(y: y - 1)
                    .allowsHitTesting(false)
            }
        }
        .overlay(alignment: .leading) {
            if !first { Rectangle().fill(.line).frame(width: 1) }
        }
        .contentShape(Rectangle())
        // A double tap on a lane's free space starts a task there; a single tap lets go of the picked one.
        .onTapGesture(count: 2) { work.openComposer(on: day.day) }
        .onTapGesture { work.clearSelection() }
        .coordinateSpace(.named(day.id))
        .onDrop(of: [.plainText], delegate: LaneDrop(day: day, work: work))
        .accessibilityElement(children: .contain)
    }

    private func card(_ task: TaskItem) -> some View {
        LaneCard(task: task, laneWidth: laneWidth, work: work)
            .id(task.id)
            .matchedGeometryEffect(id: task.id, in: travel)
            .transition(.asymmetric(
                insertion: .opacity,
                removal: .modifier(active: Leaving(dx: CGFloat(work.state.exits[task.id] ?? 0) * 24), identity: Leaving(dx: 0, opacity: 1))
            ))
    }
}

/// A row on its way out: to a day off screen it slides 24 points toward it as it fades; deleted, it just fades while
/// the rows below close up.
private struct Leaving: ViewModifier {
    var dx: CGFloat
    var opacity: Double = 0

    func body(content: Content) -> some View {
        content.offset(x: dx).opacity(opacity)
    }
}

/// A lane's head: "Mon" and "2 of 4"; the date, today's on a filled tile, with + for today and the days ahead; a hairline
/// that fills as the day's tasks get done.
private struct LaneHeader: View {
    let day: WeekDay
    let today: DayKey
    let add: () -> Void

    var body: some View {
        let isToday = day.day == today
        let past = day.day < today
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 4) {
                Text(Dates.dayShort(day.day))
                    .font(.token(Tokens.Typography.footnote, weight: .medium))
                    .foregroundStyle(isToday ? .ink : .ink3)
                Spacer(minLength: 4)
                if day.total > 0 {
                    Text(verbatim: "\(day.finished) of \(day.total)")
                        .font(.token(Tokens.Typography.caption))
                        .monospacedDigit()
                        .foregroundStyle(.ink3)
                        .contentTransition(.numericText())
                }
            }
            .lineLimit(1)
            .frame(minHeight: 18)
            Text(verbatim: "\(day.day.day)")
                .font(.token(Tokens.Typography.title2, weight: .semibold))
                .tracking(-0.4)
                .monospacedDigit()
                .foregroundStyle(isToday ? Color.onPrimary : past ? .ink3 : .ink)
                .padding(.horizontal, isToday ? 6 : 0)
                .frame(minWidth: isToday ? 30 : nil, minHeight: 30)
                .background {
                    if isToday {
                        RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).fill(.primaryFill)
                    }
                }
                .padding(.leading, isToday ? -2 : 0)
                .padding(.top, 6)
            DayProgressLine(fraction: day.total > 0 ? Double(day.finished) / Double(day.total) : 0)
                .padding(.top, 10)
                .padding(.bottom, 8)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        // VoiceOver reads the day as one line ("Monday, November 9: 2 of 4 done"); + stays a button of its own.
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(Self.summary(day))
        .accessibilityAddTraits(.isHeader)
        .overlay(alignment: .topTrailing) {
            if !past {
                DayPlusButton(label: "New task on \(Dates.long(day.day))", action: add)
                    .padding(.top, 27)
            }
        }
        .padding(.horizontal, 6)
        .padding(.top, 16)
    }

    static func summary(_ day: WeekDay) -> String {
        let name = Dates.long(day.day)
        return day.total > 0 ? "\(name): \(day.finished) of \(day.total) done" : "\(name): no tasks"
    }
}

/// A day's progress: a thin line that fills as its tasks get done.
struct DayProgressLine: View {
    let fraction: Double

    var body: some View {
        Capsule()
            .fill(.line2)
            .frame(height: 2)
            .overlay(alignment: .leading) {
                Capsule()
                    .fill(.ink)
                    .scaleEffect(x: max(0, min(1, fraction)), y: 1, anchor: .leading)
                    .animation(Motion.out(Tokens.Motion.data), value: fraction)
            }
            .accessibilityHidden(true)
    }
}

/// A task on the board: a line of the day, like a row in Day (a 16-point box, the title in two lines at most, long
/// words hyphenated calmly). Finished tasks step back to one quiet line. Picked, it shows its title whole and its ⋯.
private struct LaneCard: View {
    let task: TaskItem
    let laneWidth: CGFloat
    let work: WeekWork

    @State private var hovering = false

    var body: some View {
        let selected = work.router.selectedTask == task.id
        let editing = work.state.editing == task.id
        let compact = task.done && !selected && !editing
        let showsMenu = (selected || hovering) && !editing
        HStack(alignment: .top, spacing: 8) {
            TaskCheckbox(task: task, size: 16) { work.toggle(task) }
                .padding(-14)
                .padding(.top, 1)
            Group {
                if editing {
                    TextField("Task title", text: work.titleBinding(task.id).returnSubmits { work.focus.wrappedValue = nil }, axis: .vertical)
                        .font(.token(Tokens.Typography.footnote))
                        .foregroundStyle(.ink)
                        .lineLimit(1...8)
                        .focused(work.focus, equals: .title(task.id))
                        .submitLabel(.done)
                        .onSubmit { work.focus.wrappedValue = nil }
                        .accessibilityIdentifier("task.title.field")
                } else {
                    Text(CalmHyphens.apply(task.title))
                        .font(.token(Tokens.Typography.footnote))
                        .foregroundStyle(task.done ? .ink3 : .ink)
                        .lineLimit(selected ? nil : compact ? 1 : 2)
                        .truncationMode(.tail)
                        .animation(Motion.out(Tokens.Motion.base), value: task.done)
                        .accessibilityLabel(task.title)
                        .accessibilityValue(task.done ? "Done" : "Open")
                        .accessibilityHint(selected ? "Edits the title" : "Picks the task")
                        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                        .accessibilityActions { menu }
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.trailing, selected && !editing ? 20 : 0)
        }
        .padding(.horizontal, 6)
        .padding(.vertical, compact ? 5 : 6)
        // A task to act on gets a full 44-point row; a finished one is a quiet line (its box still answers in 44).
        .frame(maxWidth: .infinity, minHeight: compact ? 32 : 44, alignment: .leading)
        .background {
            RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
                .fill(selected || editing ? Color.surface3 : hovering ? Color.surface2 : Color.clear)
        }
        .overlay {
            if selected || editing || hovering {
                RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1)
            }
        }
        .overlay(alignment: .topTrailing) {
            if showsMenu { moreButton(selected: selected) }
        }
        .contentShape(Rectangle())
        .onTapGesture { work.tap(task) }
        .onHover { hovering = $0 }
        .contextMenu { menu }
        .onDrag {
            work.state.dragging = task.id
            return TaskDrop.provider(for: task)
        } preview: {
            TaskDragPreview(task: task, width: min(max(laneWidth, 220), 320))
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("task.\(task.title)")
    }

    /// ⋯ over the corner (on the picked task, and under the pointer); the title fades out before it rather than running
    /// under it.
    private func moreButton(selected: Bool) -> some View {
        let shade: Color = selected ? .surface3 : .surface2
        return Menu {
            menu
        } label: {
            Image(systemName: Icon.more)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(.ink2)
                .frame(width: 24, height: 24)
                .background(shade, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                .padding(10)
                .contentShape(Rectangle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .padding(-10)
        .background(alignment: .leading) {
            LinearGradient(colors: [shade.opacity(0), shade], startPoint: .leading, endPoint: .trailing)
                .frame(width: 20)
                .offset(x: -20)
                .allowsHitTesting(false)
        }
        .padding(.top, 4)
        .padding(.trailing, 4)
        .accessibilityLabel("More actions")
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

/// The composer at the top of a lane: Return adds the task and leaves a fresh field for the next; Esc closes it.
private struct LaneComposer: View {
    let day: DayKey
    let work: WeekWork

    var body: some View {
        @Bindable var state = work.state
        TextField("New task", text: $state.composerText.returnSubmits { work.submitComposer() }, axis: .vertical)
            .font(.token(Tokens.Typography.footnote))
            .lineLimit(2...6)
            .focused(work.focus, equals: .composer(day))
            .submitLabel(.done)
            .onSubmit { work.submitComposer() }
            .onKeyPress(.escape) {
                work.cancelComposer()
                return .handled
            }
            .padding(6)
            .background(.surface2, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1))
            .accessibilityLabel("New task title")
            .accessibilityIdentifier("composer.title")
    }
}

/// Where a dragged task would go: a line in the gap, with a small ring at its start (the web's insertion line).
private struct DropLine: View {
    @Environment(\.palette) private var palette

    var body: some View {
        Capsule()
            .fill(palette.accent)
            .frame(height: 2)
            .overlay(alignment: .leading) {
                Circle()
                    .fill(.surface)
                    .overlay(Circle().strokeBorder(palette.accent, lineWidth: 2))
                    .frame(width: 8, height: 8)
                    .offset(x: -4)
            }
            .transition(.opacity)
    }
}

/// A lane takes a dragged task anywhere in it. In the person's own order the open rows set where it lands, and a line
/// shows the gap; otherwise it goes to the end of the day.
private struct LaneDrop: DropDelegate {
    let day: WeekDay
    let work: WeekWork

    func validateDrop(info: DropInfo) -> Bool {
        work.state.dragging != nil
    }

    func dropEntered(info: DropInfo) {
        update(info)
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        update(info)
        return DropProposal(operation: .move)
    }

    func dropExited(info: DropInfo) {
        if work.state.dropSpot?.day == day.day { work.state.dropSpot = nil }
    }

    func performDrop(info: DropInfo) -> Bool {
        guard let id = work.state.dragging, let task = work.store.task(id) else { return false }
        let index = spot(at: info.location.y, dragging: id).index
        let work = work
        let day = day.day
        work.state.dropSpot = nil
        TaskDrop.confirm(info, title: task.title) { work.drop(id, on: day, at: index) }
        return true
    }

    private func update(_ info: DropInfo) {
        guard let id = work.state.dragging else { return }
        let next = spot(at: info.location.y, dragging: id)
        if work.state.dropSpot != next {
            withAnimation(Motion.out(Tokens.Motion.fast)) { work.state.dropSpot = next }
        }
    }

    private func spot(at y: CGFloat, dragging id: String) -> LaneDropSpot {
        guard work.sort.allowsReordering else { return LaneDropSpot(day: day.day, index: nil, lineY: nil) }
        let frames = work.state.rowFrames[day.day] ?? [:]
        let rows = day.open.filter { $0.id != id && !$0.done }.compactMap { frames[$0.id] }
        let index = rows.firstIndex { y < $0.midY } ?? rows.count
        let above = index > 0 ? rows[index - 1] : nil
        let below = index < rows.count ? rows[index] : nil
        let lineY: CGFloat = switch (above, below) {
        case let (a?, b?): (a.maxY + b.minY) / 2
        case let (a?, nil): a.maxY + 2
        case let (nil, b?): b.minY - 2
        case (nil, nil): (work.state.listTops[day.day] ?? 0) + 8
        }
        return LaneDropSpot(day: day.day, index: index, lineY: lineY)
    }
}
