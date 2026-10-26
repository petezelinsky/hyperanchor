import SwiftUI

/// The week around the selected day: weekday, date and a dot for how the day went. Swipe for the
/// neighboring week. Today is the accent; another selected day is black, as in Calendar.
struct WeekStrip: View {
    let selected: DayKey
    let today: DayKey
    let select: (DayKey) -> Void

    @State private var position: Int?
    @ScaledMetric(relativeTo: .subheadline) private var scaledHeight: CGFloat = 54
    @Environment(\.dynamicTypeSize) private var typeSize

    /// Grows with the text, up to the cap the strip uses.
    private var height: CGFloat { typeSize > .xxLarge ? 70 : scaledHeight }

    private var week: Int { selected.startOfWeek.ordinal }

    var body: some View {
        // A year either side, recentered as the selection moves.
        let weeks = Array(stride(from: week - 52 * 7, through: week + 52 * 7, by: 7))
        ScrollView(.horizontal) {
            LazyHStack(spacing: 0) {
                ForEach(weeks, id: \.self) { start in
                    WeekPage(start: DayKey(ordinal: start), selected: selected, today: today, select: select)
                        .containerRelativeFrame(.horizontal)
                }
            }
            .scrollTargetLayout()
        }
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $position)
        .scrollIndicators(.hidden)
        .frame(height: height)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        .onAppear { position = week }
        .onChange(of: week) { _, w in
            if position != w { withAnimation(.snappy) { position = w } }
        }
        .onChange(of: position) { _, p in
            // Swiped to another week: the same weekday there.
            guard let p, p != week else { return }
            select(DayKey(ordinal: p).adding(days: selected.weekday))
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Week")
        .accessibilityAction(named: "Previous week") { select(selected.adding(days: -7)) }
        .accessibilityAction(named: "Next week") { select(selected.adding(days: 7)) }
    }
}

private struct WeekPage: View {
    let start: DayKey
    let selected: DayKey
    let today: DayKey
    let select: (DayKey) -> Void

    @Environment(TaskStore.self) private var store
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 2) {
            ForEach(0..<7, id: \.self) { i in
                pill(start.adding(days: i))
            }
        }
    }

    private func pill(_ day: DayKey) -> some View {
        let on = day == selected
        let isToday = day == today
        let tasks = store.tasks(on: day)
        let done = tasks.count(where: \.done)
        let dot: Color? = tasks.isEmpty ? nil : done == tasks.count ? palette.accent : .ink4
        return Button { select(day) } label: {
            VStack(spacing: 1) {
                Text(Dates.dowShort[day.weekday])
                    .font(.caption2.weight(.medium))
                    .foregroundStyle(on ? AnyShapeStyle(.opacity(0.75)) : isToday ? AnyShapeStyle(palette.accentInk) : AnyShapeStyle(.ink3))
                Text("\(day.day)")
                    .font(.system(.subheadline, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(on ? AnyShapeStyle(.foreground) : isToday ? AnyShapeStyle(palette.accentInk) : day < today ? AnyShapeStyle(.ink2) : AnyShapeStyle(.ink))
                Circle()
                    .fill(dot.map { on ? AnyShapeStyle(.opacity(0.6)) : AnyShapeStyle($0) } ?? AnyShapeStyle(.clear))
                    .frame(width: 4, height: 4)
                    .padding(.top, 1)
            }
            .foregroundStyle(on ? (isToday ? Color.onAccent : Color.onPrimary) : Color.ink)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background {
                if on {
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(isToday ? palette.accent : Color.primaryFill)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.2), value: on)
        .accessibilityLabel("\(Dates.long(day)): \(tasks.isEmpty ? "no tasks" : "\(done) of \(tasks.count) done")")
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}
