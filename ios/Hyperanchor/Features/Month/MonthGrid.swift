import SwiftUI
import UniformTypeIdentifiers

/// iPad: the whole month as a grid that fills the work area down to its last line, the weekdays on top. The days show
/// their tasks as text, what's left first — as many as fit, then "+N more"; days of the months around are quiet. A tap
/// on a day opens it in a small window; a task can be dragged from one day onto another.
struct MonthGrid: View {
    let month: DayKey

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// The day whose window is open.
    @State private var open: DayKey?
    @State private var drag = MonthDrag()
    /// A title's line in a day, with the gap under it; the date's row above them.
    @ScaledMetric(relativeTo: .caption) private var titleLine: CGFloat = 19
    @ScaledMetric(relativeTo: .footnote) private var dateRow: CGFloat = 28

    private static let header: CGFloat = 32

    var body: some View {
        let today = clock.today
        let grid = Dates.monthGrid(year: month.year, month: month.month)
        GeometryReader { geo in
            // The weeks share the height, so the month always fills the work area down to its last line.
            let rowHeight = max(104, ((geo.size.height - Self.header) / CGFloat(grid.rows)).rounded(.down))
            // Lines under the date; a day with one task too many shows "+N more" on the last of them.
            let lines = max(1, Int((rowHeight - 16 - dateRow + 3) / titleLine))
            let narrow = geo.size.width / 7 < 110
            ScrollView {
                VStack(spacing: 0) {
                    weekdays(today: today, narrow: narrow)
                    VStack(spacing: 0) {
                        ForEach(0..<grid.rows, id: \.self) { row in
                            HStack(spacing: 0) {
                                ForEach(0..<7, id: \.self) { column in
                                    cell(grid.start.adding(days: row * 7 + column), column: column, lines: lines, narrow: narrow, today: today)
                                }
                            }
                            .frame(height: rowHeight)
                            .overlay(alignment: .top) {
                                if row > 0 { Rectangle().fill(.line).frame(height: 1) }
                            }
                        }
                    }
                    .id(month)
                    .transition(.opacity.animation(Motion.out(Tokens.Motion.fast)))
                }
            }
            .scrollBounceBehavior(.basedOnSize)
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        // Another month on screen: the day that was open belonged to the last one.
        .onChange(of: month) { _, _ in open = nil }
    }

    private func weekdays(today: DayKey, narrow: Bool) -> some View {
        let names = Dates.weekdayNames(.short)
        let current = month == today.startOfMonth
        return HStack(spacing: 0) {
            ForEach(names.indices, id: \.self) { i in
                Text(names[i])
                    .font(.token(Tokens.Typography.caption, weight: .medium))
                    .foregroundStyle(current && i == today.weekday ? .ink : .ink3)
                    .lineLimit(1)
                    .padding(.horizontal, narrow ? 8 : 12)
                    .frame(maxWidth: .infinity, minHeight: Self.header, alignment: .leading)
                    .overlay(alignment: .leading) {
                        if i > 0 { Rectangle().fill(.line).frame(width: 1) }
                    }
            }
        }
        .hairline(.bottom)
        .accessibilityHidden(true)
    }

    private func cell(_ day: DayKey, column: Int, lines: Int, narrow: Bool, today: DayKey) -> some View {
        let tasks = TaskSorting.sorted(store.tasks(on: day), by: .manual)
        // What's left first, then what's done.
        let ordered = tasks.filter { !$0.done } + tasks.filter(\.done)
        return MonthCell(day: day, month: month, tasks: ordered, fit: lines - 1, today: today,
                         open: open == day, hot: drag.hot == day, first: column == 0, narrow: narrow, drag: drag) {
            router.selected = day
            router.selectedTask = nil
            open = day
        }
        .popover(isPresented: Binding(get: { open == day }, set: { if !$0, open == day { open = nil } }),
                 attachmentAnchor: .rect(.bounds)) {
            DayWindow(day: day) { open = nil }
        }
        .onDrop(of: [.plainText], delegate: MonthCellDrop(day: day, drag: drag, store: store) { id in
            withAnimation(Motion.choose(Motion.travel, reduceMotion: reduceMotion)) {
                PlannerActions(store: store, toaster: toaster, today: today).place(id, on: day, at: nil)
            }
        })
    }
}

/// A drag in the month: which task is under the finger, and the day that would take it.
@MainActor
@Observable
final class MonthDrag {
    var dragging: String?
    var hot: DayKey?
}

/// A day of the grid: its date (today's on a filled tile), then its tasks as text. Tapping it opens its window.
private struct MonthCell: View {
    let day: DayKey
    let month: DayKey
    /// What's left first, then what's done.
    let tasks: [TaskItem]
    /// How many titles fit under the date beside "+N more".
    let fit: Int
    let today: DayKey
    let open: Bool
    let hot: Bool
    let first: Bool
    let narrow: Bool
    let drag: MonthDrag
    let tap: () -> Void

    @Environment(\.palette) private var palette
    @State private var hovering = false

    var body: some View {
        let out = day.month != month.month
        let isToday = day == today
        // A day that would show "+1 more" shows that task instead.
        let shown = tasks.count == fit + 1 ? tasks.count : min(tasks.count, max(0, fit))
        VStack(alignment: .leading, spacing: 3) {
            Text(verbatim: "\(day.day)")
                .font(.token(Tokens.Typography.footnote, weight: isToday ? .semibold : .medium))
                .monospacedDigit()
                .foregroundStyle(isToday ? Color.onPrimary : out ? .ink4 : .ink)
                .padding(.horizontal, isToday ? 5 : 0)
                .frame(minWidth: isToday ? 24 : nil, minHeight: 24)
                .background {
                    if isToday { RoundedRectangle(cornerRadius: 7, style: .continuous).fill(.primaryFill) }
                }
                .padding(.bottom, 1)
            ForEach(tasks.prefix(shown)) { task in
                Text(task.title)
                    .font(.token(Tokens.Typography.caption))
                    .foregroundStyle(task.done || out ? .ink3 : .ink)
                    .lineLimit(1)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .contentShape(Rectangle())
                    // A task can be dragged straight from here onto another day.
                    .onDrag {
                        drag.dragging = task.id
                        return TaskDrop.provider(for: task)
                    } preview: {
                        TaskDragPreview(task: task)
                    }
            }
            if tasks.count > shown {
                Text(verbatim: "+\(tasks.count - shown) more")
                    .font(.token(Tokens.Typography.caption))
                    .foregroundStyle(.ink3)
            }
        }
        .padding(.horizontal, narrow ? 8 : 12)
        .padding(.vertical, 8)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .clipped()
        .background(background(out: out))
        .overlay {
            if hot {
                Rectangle().strokeBorder(palette.accent, lineWidth: 1)
            } else if open {
                Rectangle().strokeBorder(.line2, lineWidth: 1)
            }
        }
        .overlay(alignment: .leading) {
            if !first { Rectangle().fill(.line).frame(width: 1) }
        }
        .contentShape(Rectangle())
        .onTapGesture(perform: tap)
        .onHover { hovering = $0 }
        .animation(Motion.out(Tokens.Motion.fast), value: hot)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(label)
        .accessibilityAddTraits(.isButton)
        .accessibilityAction(.default, tap)
    }

    private func background(out: Bool) -> Color {
        if hot { return palette.accentSoft }
        if open { return .surface3 }
        if out { return hovering ? .surface3 : .surface2 }
        return hovering ? .surface2 : .surface
    }

    /// "Thursday, October 22, 5 tasks, 2 done" (the web says the day and how many tasks).
    private var label: String {
        guard !tasks.isEmpty else { return Dates.long(day) }
        return "\(Dates.long(day)), \(Dates.plural(tasks.count, "task")), \(tasks.count { $0.done }) done"
    }
}

/// A day of the grid takes a dragged task: it lights up while the task is over it, and the task joins the end of the
/// day's open tasks.
private struct MonthCellDrop: DropDelegate {
    let day: DayKey
    let drag: MonthDrag
    let store: TaskStore
    let drop: @MainActor (String) -> Void

    func validateDrop(info: DropInfo) -> Bool {
        drag.dragging != nil
    }

    func dropEntered(info: DropInfo) {
        drag.hot = day
    }

    func dropUpdated(info: DropInfo) -> DropProposal? {
        DropProposal(operation: .move)
    }

    func dropExited(info: DropInfo) {
        if drag.hot == day { drag.hot = nil }
    }

    func performDrop(info: DropInfo) -> Bool {
        guard let id = drag.dragging, let task = store.task(id) else { return false }
        let drag = drag
        let drop = drop
        drag.hot = nil
        TaskDrop.confirm(info, title: task.title) {
            drag.dragging = nil
            drop(id)
        }
        return true
    }
}
