import SwiftUI

/// Average done per weekday (Breakdown.tsx): the best day in the accent, the rest quiet.
struct WeekdayCard: View {
    let days: [Stats.DayStat]

    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .footnote) private var nameWidth: CGFloat = 34
    @ScaledMetric(relativeTo: .footnote) private var valueWidth: CGFloat = 76

    var body: some View {
        let stats = Stats.weekdayStats(days)
        let most = stats.map(\.avg).max() ?? 0
        let best = Stats.bestWeekday(stats)
        let short = Dates.weekdayNames(.short)
        let full = Dates.weekdayNames(.full)

        Card(title: "By weekday") {
            AsideNote(text: "Average done per day")
        } content: {
            VStack(alignment: .leading, spacing: 0) {
                VStack(spacing: 8) {
                    ForEach(stats) { w in
                        let top = best?.index == w.index
                        HStack(spacing: 12) {
                            Text(short[w.index])
                                .type(Tokens.Typography.footnote, weight: top ? .semibold : .regular)
                                .foregroundStyle(top ? .ink : .ink2)
                                .lineLimit(1)
                                .frame(width: nameWidth, alignment: .leading)
                            Capsule()
                                .fill(.surface3)
                                .frame(height: 8)
                                .overlay(alignment: .leading) {
                                    GeometryReader { g in
                                        Capsule()
                                            .fill(top ? palette.accent : .ink4)
                                            .frame(width: most > 0 ? g.size.width * w.avg / most : 0)
                                    }
                                }
                                .animation(Motion.choose(Motion.out(Tokens.Motion.data), reduceMotion: reduceMotion), value: w.avg)
                            HStack(spacing: 6) {
                                Text(Stats.fmt1(w.avg)).foregroundStyle(.ink)
                                Text(w.rate.map(Stats.pct) ?? "—").foregroundStyle(.ink3)
                            }
                            .type(Tokens.Typography.footnote)
                            .monospacedDigit()
                            .lineLimit(1)
                            .frame(minWidth: valueWidth, alignment: .trailing)
                        }
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(full[w.index]): \(Stats.fmt1(w.avg)) done a day, \(w.rate.map { "\(Stats.pct($0)) of what was planned" } ?? "nothing planned")")
                    }
                }
                Group {
                    if let best {
                        Text("You get the most done on ") + Text("\(full[best.index])s").fontWeight(.semibold).foregroundStyle(.ink) + Text(".")
                    } else {
                        Text("Not enough done yet to compare.")
                    }
                }
                .type(Tokens.Typography.footnote)
                .foregroundStyle(.ink2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 16)
            }
        }
    }
}

/// What was planned on an earlier day and isn't done, newest first (Breakdown.tsx `OpenCard`): tick it off, or move it
/// to today. A tick shows, then the row folds away; a move slides it out, with Undo in the toast.
struct OpenCard: View {
    let open: [Stats.OpenTask]
    let today: DayKey

    @Environment(TaskStore.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var all = false
    /// Ticked just now: shown done while the tick plays, before the row leaves.
    @State private var ticked: Set<String> = []
    /// On their way to today: they slide out.
    @State private var moving: Set<String> = []
    @State private var ticks = 0

    var body: some View {
        Card(title: "Left open", count: open.count) {
            if open.isEmpty {
                Text("Nothing from earlier days is waiting.")
                    .type(Tokens.Typography.footnote)
                    .foregroundStyle(.ink3)
                    .padding(.bottom, 8)
                    .transition(.opacity)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    let shown = all ? open : Array(open.prefix(6))
                    VStack(spacing: 0) {
                        ForEach(shown) { item in
                            row(item, last: item.id == shown.last?.id)
                                .transition(moving.contains(item.id)
                                    ? .asymmetric(insertion: .opacity, removal: .offset(x: 24).combined(with: .opacity))
                                    : .opacity)
                        }
                    }
                    if open.count > 6 {
                        ShowAllToggle(count: open.count, all: $all)
                    }
                }
            }
        }
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.8), trigger: ticks)
    }

    private func row(_ item: Stats.OpenTask, last: Bool) -> some View {
        let title = item.task.title
        return HStack(spacing: 12) {
            Button { tick(item) } label: {
                CheckCircle(checked: ticked.contains(item.id), size: 18)
            }
            .buttonStyle(.plain)
            .modifier(WideHitArea())
            .accessibilityLabel("Mark “\(title)” as done")
            Text(title)
                .type(Tokens.Typography.body)
                .foregroundStyle(.ink)
                .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
                .frame(maxWidth: .infinity, alignment: .leading)
            Text(Dates.short(item.day.key))
                .type(Tokens.Typography.caption)
                .foregroundStyle(.ink3)
                .monospacedDigit()
                .fixedSize()
            Button { moveToToday(item) } label: {
                HStack(spacing: 4) {
                    Text("Today")
                    Image(systemName: "arrow.right")
                        .font(.system(size: 11, weight: .semibold))
                        .accessibilityHidden(true)
                }
                .type(Tokens.Typography.footnote, weight: .medium)
                .foregroundStyle(.ink)
            }
            .buttonStyle(TodayButtonStyle())
            .modifier(WideHitArea(horizontal: 4, vertical: 8))
            .accessibilityLabel("Move “\(title)” to today")
        }
        .padding(.vertical, 8)
        .frame(minHeight: 44)
        .overlay(alignment: .bottom) {
            if !last { Rectangle().fill(.line).frame(height: 1) }
        }
    }

    /// The box fills, and after a beat the task leaves the list (it's done).
    private func tick(_ item: Stats.OpenTask) {
        guard !ticked.contains(item.id) else { return }
        ticked.insert(item.id)
        ticks += 1
        Task {
            try? await Task.sleep(for: .milliseconds(reduceMotion ? 120 : 240))
            withAnimation(Motion.choose(Motion.settle, reduceMotion: reduceMotion)) {
                store.toggle(item.task.id)
            }
            ticked.remove(item.id)
        }
    }

    private func moveToToday(_ item: Stats.OpenTask) {
        guard !moving.contains(item.id) else { return }
        // The row learns it is leaving sideways first (a frame), then the task moves and the row slides out.
        moving.insert(item.id)
        Task {
            try? await Task.sleep(for: .milliseconds(16))
            withAnimation(Motion.choose(Motion.exit, reduceMotion: reduceMotion)) {
                guard let notice = store.moveTo(item.task.id, today, today: today) else { return }
                if let step = notice.undo {
                    toaster.show(notice.message, action: "Undo") { _ = store.undo(step) }
                } else {
                    toaster.show(notice.message)
                }
            }
            try? await Task.sleep(for: .milliseconds(400))
            moving.remove(item.id)
        }
    }
}

/// The web's small plain button: a quiet box under the finger.
struct TodayButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .padding(.horizontal, 10)
            .frame(minHeight: 28)
            .background(configuration.isPressed ? Color.surface3 : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
    }
}

/// A year of days, one column per week (its first day on top), shaded by how many tasks were done (Heatmap.tsx). A day
/// opens in Day. On a phone the map is wider than the panel and scrolls sideways, starting at the weeks around today.
struct ActivityCard: View {
    let days: [Stats.DayStat]
    let open: (DayKey) -> Void

    @Environment(\.palette) private var palette
    @State private var width: CGFloat = 0

    private let gap: CGFloat = 3
    /// The map's least width, its weekday labels included; narrower panels scroll.
    private let least: CGFloat = 620

    var body: some View {
        Card(title: "Activity") {
            AsideNote(text: "Tasks done per day")
        } content: {
            VStack(alignment: .trailing, spacing: 12) {
                Group {
                    if width >= least {
                        map(width: width)
                    } else {
                        ScrollViewReader { proxy in
                            ScrollView(.horizontal) {
                                map(width: least)
                                    .padding(.vertical, 2)
                            }
                            .scrollIndicators(.hidden)
                            .onAppear { proxy.scrollTo(focusWeek, anchor: .trailing) }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
                legend
            }
        }
    }

    /// The week the map shows first when it scrolls: this week, or a past year's last.
    private var focusWeek: Int {
        let layout = Stats.heatmapWeeks(days)
        return days.first(where: \.isToday).map { $0.key.days(since: layout.first) / 7 } ?? layout.weeks - 1
    }

    private func map(width: CGFloat) -> some View {
        let layout = Stats.heatmapWeeks(days)
        let byKey = Dictionary(uniqueKeysWithValues: days.map { ($0.key, $0) })
        let most = max(1, days.map(\.done).max() ?? 1)
        let weeks = max(1, layout.weeks)
        let cell = max(4, (width - 32 - CGFloat(weeks - 1) * gap) / CGFloat(weeks))
        let names = Dates.weekdayNames(.short)

        return VStack(alignment: .leading, spacing: 4) {
            // Month labels above the week each month starts in.
            ZStack(alignment: .topLeading) {
                ForEach(Array(layout.monthColumns.enumerated()), id: \.offset) { m, column in
                    Text(Dates.monthsShort[m])
                        .type(Tokens.Typography.caption2)
                        .foregroundStyle(.ink3)
                        .fixedSize()
                        .offset(x: CGFloat(column) * (cell + gap))
                }
            }
            .frame(height: 16, alignment: .topLeading)
            .padding(.leading, 32)
            .accessibilityHidden(true)
            HStack(alignment: .top, spacing: 8) {
                VStack(alignment: .leading, spacing: gap) {
                    ForEach(0..<7, id: \.self) { i in
                        Text(["Mon", "Wed", "Fri"].contains(names[i]) ? names[i] : "")
                            .type(Tokens.Typography.caption2)
                            .foregroundStyle(.ink3)
                            .lineLimit(1)
                            .fixedSize()
                            .frame(width: 24, height: cell, alignment: .leading)
                    }
                }
                .accessibilityHidden(true)
                HStack(alignment: .top, spacing: gap) {
                    ForEach(0..<weeks, id: \.self) { w in
                        VStack(spacing: gap) {
                            ForEach(0..<7, id: \.self) { i in
                                let key = layout.first.adding(days: w * 7 + i)
                                if let d = byKey[key] {
                                    cellButton(d, size: cell, most: most)
                                } else {
                                    Color.clear.frame(width: cell, height: cell)
                                }
                            }
                        }
                        .id(w)
                    }
                }
            }
        }
        .frame(width: width, alignment: .leading)
    }

    private func cellButton(_ d: Stats.DayStat, size: CGFloat, most: Int) -> some View {
        let shape = RoundedRectangle(cornerRadius: min(Tokens.Radius.xs, size * 0.3), style: .continuous)
        let done = d.total > 0 ? "\(d.done) of \(d.total) done" : "no tasks"
        return Button { open(d.key) } label: {
            shape
                .fill(d.elapsed ? palette.heat[Stats.heatLevel(done: d.done, most: most)] : Color.surface2)
                .frame(width: size, height: size)
                .overlay {
                    if d.isToday {
                        RoundedRectangle(cornerRadius: min(Tokens.Radius.xs, size * 0.3) + 1, style: .continuous)
                            .strokeBorder(Color.ink2, lineWidth: 1.5)
                            .padding(-2.5)
                    }
                }
        }
        .buttonStyle(PressableStyle())
        .help("\(Dates.medium(d.key)) — \(done)")
        .accessibilityLabel("\(Dates.medium(d.key)): \(d.done) of \(d.total) done")
        .accessibilityHint("Opens the day")
    }

    private var legend: some View {
        HStack(spacing: 6) {
            Text("Less")
            ForEach(0..<5, id: \.self) { i in
                RoundedRectangle(cornerRadius: Tokens.Radius.xs, style: .continuous).fill(palette.heat[i]).frame(width: 12, height: 12)
            }
            Text("More")
        }
        .type(Tokens.Typography.caption2)
        .foregroundStyle(.ink3)
        .accessibilityHidden(true)
    }
}

/// Every number behind the charts, as a table to sort (History.tsx): a day or a month per row, latest first. A row opens
/// its day (or, in a year, its month). Phones show Date, Done and Rate.
struct HistoryCard: View {
    enum Unit: String { case days, months }

    let rows: [Stats.HistoryRow]
    let unit: Unit
    let pick: (Stats.Target) -> Void

    @Environment(\.progressLayout) private var layout
    @State private var sort: Stats.HistorySort = .date
    @State private var ascending = false
    @State private var all = false
    @State private var hovered: String?
    @ScaledMetric(relativeTo: .footnote) private var numberWidth: CGFloat = 52
    @ScaledMetric(relativeTo: .footnote) private var labelWidth: CGFloat = 132

    private static let limit = 10

    var body: some View {
        let ordered = Stats.sortHistory(rows, by: sort, ascending: ascending)
        let shown = all ? ordered : Array(ordered.prefix(Self.limit))
        Card(title: "History") {
            AsideNote(text: rows.isEmpty ? "" : "\(rows.count) \(unit.rawValue) with tasks")
        } content: {
            if rows.isEmpty {
                Text("No tasks in this period yet.")
                    .type(Tokens.Typography.footnote)
                    .foregroundStyle(.ink2)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 24)
            } else {
                VStack(alignment: .leading, spacing: 0) {
                    header
                    ForEach(shown) { r in
                        row(r, last: r.id == shown.last?.id)
                    }
                    if rows.count > Self.limit {
                        ShowAllToggle(count: rows.count, all: $all)
                    }
                }
            }
        }
    }

    /// The table's columns: the date and the numbers on the left half, the tasks (or active days) on the right half, as
    /// the web gives them half the table.
    private func columns(_ date: some View, _ done: some View, _ planned: some View, _ rate: some View, _ detail: some View) -> some View {
        HStack(spacing: 0) {
            HStack(spacing: 0) {
                date.frame(maxWidth: .infinity, alignment: .leading)
                done.frame(width: numberWidth, alignment: .trailing)
                if layout.fullTable {
                    planned.frame(width: numberWidth + 16, alignment: .trailing)
                }
                rate.frame(width: numberWidth + 20, alignment: .trailing)
            }
            .frame(minWidth: layout.fullTable ? labelWidth + 3 * numberWidth + 36 : nil, maxWidth: .infinity)
            if layout.fullTable {
                detail
                    .padding(.leading, 24)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
    }

    private var header: some View {
        columns(
            sortButton(unit == .days ? "Date" : "Month", .date),
            sortButton("Done", .done),
            Text("Planned"),
            sortButton("Rate", .rate),
            Text(unit == .days ? "Tasks" : "Active days")
        )
        .type(Tokens.Typography.caption, weight: .medium)
        .foregroundStyle(.ink3)
        .lineLimit(1)
        .padding(.vertical, 8)
        .hairline()
    }

    private func sortButton(_ label: String, _ key: Stats.HistorySort) -> some View {
        let on = sort == key
        return Button {
            if on { ascending.toggle() } else { sort = key; ascending = false }
        } label: {
            HStack(spacing: 4) {
                Text(label)
                if on {
                    Image(systemName: ascending ? "chevron.up" : "chevron.down")
                        .font(.system(size: 9, weight: .semibold))
                        .accessibilityHidden(true)
                }
            }
            .foregroundStyle(on ? .ink : .ink3)
            .modifier(WideHitArea(horizontal: 6, vertical: 13))
        }
        .buttonStyle(PressableStyle())
        .sensoryFeedback(.selection, trigger: on ? (ascending ? 1 : 2) : 0)
        .accessibilityLabel(label)
        .accessibilityValue(on ? (ascending ? "Sorted ascending" : "Sorted descending") : "")
        .accessibilityHint("Sorts History")
    }

    private func row(_ r: Stats.HistoryRow, last: Bool) -> some View {
        Button { pick(r.target) } label: {
            columns(
                Text(r.label)
                    .fontWeight(.medium)
                    .foregroundStyle(.ink)
                    .underline(hovered == r.id, color: .ink4)
                    .lineLimit(1),
                Text("\(r.done)").foregroundStyle(.ink),
                Text("\(r.planned)").foregroundStyle(.ink2),
                Text(r.rate.map(Stats.pct) ?? "—")
                    .fontWeight(r.rate == 1 ? .medium : .regular)
                    .foregroundStyle(r.rate == 1 ? .ink : .ink2),
                detail(r).lineLimit(1)
            )
            .type(Tokens.Typography.footnote)
            .monospacedDigit()
            .padding(.vertical, 10)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .onHover { inside in
            if inside { hovered = r.id } else if hovered == r.id { hovered = nil }
        }
        .overlay(alignment: .bottom) {
            if !last { Rectangle().fill(.line).frame(height: 1) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(spoken(r))
        .accessibilityAddTraits(.isButton)
        .accessibilityHint(unit == .days ? "Opens the day" : "Opens the month")
    }

    /// The day's tasks, done first (done in ink, the rest quiet), or a month's active days.
    private func detail(_ r: Stats.HistoryRow) -> Text {
        if let tasks = r.tasks {
            return tasks.sorted { $0.done && !$1.done }.enumerated().reduce(Text(verbatim: "")) { text, item in
                text + Text(verbatim: item.offset > 0 ? ", " : "").foregroundStyle(.ink3)
                    + Text(item.element.title).foregroundStyle(item.element.done ? .ink : .ink3)
            }
        }
        return Text(r.activeDays ?? "").foregroundStyle(.ink2)
    }

    private func spoken(_ r: Stats.HistoryRow) -> String {
        var s = "\(r.label): \(r.done) of \(r.planned) done"
        if let rate = r.rate { s += ", \(Stats.pct(rate))" }
        if let active = r.activeDays { s += ", active days \(active)" }
        return s
    }
}
