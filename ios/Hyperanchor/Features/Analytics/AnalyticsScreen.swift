import SwiftUI

/// Week / month / year: KPI tiles against the previous period, completed per day (or month), the year's
/// activity, the strongest weekday, what was left open, and every number as a table. Only elapsed days count.
struct AnalyticsScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(\.horizontalSizeClass) private var sizeClass

    private var today: DayKey { clock.today }

    var body: some View {
        @Bindable var router = router
        let period = router.period
        let offset = router.periodOffset
        let byDate = { (d: DayKey) in store.tasks(on: d) }
        let b = Stats.bounds(period, offset: offset, today: today)
        let days = Stats.dayStats(b, today: today, byDate: byDate)
        let sum = Stats.summarize(days)
        let prev = Stats.summarize(Stats.dayStats(Stats.bounds(period, offset: offset - 1, today: today), today: today, byDate: byDate))
        let current = offset == 0
        let model = ChartModel(period: period, days: days, bounds: b, today: today, sum: sum)
        let longest = Stats.longestStreak(days)
        let end = current ? today : b.end
        let recent = (0..<7).map { i in byDate(end.adding(days: i - 6)).contains(where: \.done) }
        let actions = TaskActions(store: store, toaster: toaster, today: today)

        NavigationStack {
            ScrollView {
                VStack(spacing: 12) {
                    controls(period: period, offset: offset, label: label(period, b))

                    Kpis(
                        sum: sum, prev: prev, period: period, current: current, spark: model.spark,
                        streak: current ? Stats.currentStreak(today: today, byDate: byDate) : longest,
                        longest: longest, recent: recent, columns: sizeClass == .regular ? 4 : 2
                    )

                    Card(title: period == .year ? "Completed per month" : "Completed per day") {
                        CompletionChart(model: model, pick: pick)
                        if sum.upcoming > 0 {
                            Text("\(sum.upcoming == 1 ? "1 more task is" : "\(sum.upcoming) more tasks are") planned for the rest of this \(period.rawValue).")
                                .font(.caption)
                                .foregroundStyle(.ink3)
                                .padding(.top, 10)
                        }
                    }

                    if period == .year {
                        Card(title: "Activity", aside: "Completed tasks per day") {
                            Heatmap(days: days) { router.open($0) }
                        }
                    }

                    let breakdown = Group {
                        if period != .week { WeekdayCard(days: days) }
                        LeftOpenCard(open: sum.open, actions: actions) { router.open($0) }
                    }
                    if sizeClass == .regular, period != .week {
                        HStack(alignment: .top, spacing: 12) { breakdown }
                    } else {
                        breakdown
                    }

                    HistoryCard(rows: model.history, unit: period == .year ? "months" : "days", pick: pick)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 24)
                .frame(maxWidth: 1240)
                .frame(maxWidth: .infinity)
            }
            .background(.canvas)
            .navigationTitle("Analytics")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { AccountMenu(user: user) }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Previous \(period.label)", systemImage: "chevron.left") { router.periodOffset -= 1 }
                    Button("Next \(period.label)", systemImage: "chevron.right") { router.periodOffset = min(0, router.periodOffset + 1) }
                        .disabled(current)
                }
            }
            .animation(.snappy(duration: 0.3), value: "\(period.rawValue)\(offset)")
            .toastHost()
        }
        .task(id: "\(period.rawValue)\(offset)\(today)") {
            await store.load(Stats.range(period, offset: offset, today: today))
        }
        .task(id: today) {
            // The current streak can reach further back than the period on screen.
            await store.load(today.adding(days: -365)...today)
        }
    }

    private func controls(period: Stats.Period, offset: Int, label: String) -> some View {
        @Bindable var router = router
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(.ink2)
                Spacer()
                if offset != 0 {
                    Button(["week": "This Week", "month": "This Month", "year": "This Year"][period.rawValue]!) {
                        router.periodOffset = 0
                    }
                    .buttonStyle(SecondaryButtonStyle(compact: true))
                }
            }
            Picker("Period", selection: Binding(get: { router.period }, set: { router.period = $0; router.periodOffset = 0 })) {
                ForEach(Stats.Period.allCases) { Text($0.label).tag($0) }
            }
            .pickerStyle(.segmented)
            .accessibilityIdentifier("analytics.period")
        }
        .padding(.bottom, 4)
    }

    private func label(_ period: Stats.Period, _ b: Stats.Bounds) -> String {
        switch period {
        case .week: Dates.range(b.start, b.end)
        case .month: "\(Dates.months[b.start.month - 1]) \(String(b.start.year))"
        case .year: String(b.start.year)
        }
    }

    /// A bar or history row: a day opens in Day; a month (year view) opens in Analytics.
    private func pick(_ target: ChartModel.Target) {
        switch target {
        case .day(let d): router.open(d)
        case .month(let offset):
            router.period = .month
            router.periodOffset = offset
        }
    }
}

/// The period's numbers, arranged for the chart, the sparkline and the history table.
struct ChartModel {
    enum Target: Hashable { case day(DayKey), month(offset: Int) }

    struct Bar: Identifiable, Hashable {
        let id: String
        let label: String
        /// Second label line (the date under the weekday).
        var sub: String?
        /// Labeled even when the axis is dense.
        var major = true
        let title: String
        let done: Int
        let total: Int
        let elapsed: Bool
        let current: Bool
        var tasks: [TaskItem] = []
        let target: Target
    }

    struct Row: Identifiable, Hashable {
        let id: String
        let order: Int
        let label: String
        let done: Int
        let planned: Int
        let rate: Double?
        var tasks: [TaskItem]?
        var activeDays: String?
        let target: Target
    }

    let bars: [Bar]
    let spark: [SparkPoint]
    let history: [Row]
    let average: Double

    init(period: Stats.Period, days: [Stats.DayStat], bounds b: Stats.Bounds, today: DayKey, sum: Stats.Summary) {
        if period == .year {
            let months = Stats.monthStats(days)
            let year = b.start.year
            let monthOffset = { (m: Int) in (year - today.year) * 12 + (m + 1 - today.month) }
            let isNow = { (m: Int) in year == today.year && m + 1 == today.month }
            bars = months.map { m in
                Bar(id: "m\(m.month)", label: Dates.monthsShort[m.month], title: "\(Dates.months[m.month]) \(year)", done: m.done, total: m.planned,
                    elapsed: m.elapsedDays > 0, current: isNow(m.month), target: .month(offset: monthOffset(m.month)))
            }
            spark = months.map { SparkPoint(value: $0.done, current: isNow($0.month), elapsed: $0.elapsedDays > 0) }
            history = months.filter { $0.planned > 0 }.map { m in
                Row(id: "m\(m.month)", order: m.month, label: "\(Dates.months[m.month]) \(year)", done: m.done, planned: m.planned, rate: m.rate,
                    activeDays: "\(m.activeDays) of \(m.elapsedDays)", target: .month(offset: monthOffset(m.month)))
            }
            let elapsedBars = bars.count(where: \.elapsed)
            average = elapsedBars > 0 ? Double(sum.completed) / Double(elapsedBars) : 0
        } else {
            bars = days.map { d in
                Bar(id: d.key.description,
                    label: period == .week ? Dates.dowShort[d.key.weekday] : String(d.key.day),
                    sub: period == .week ? String(d.key.day) : nil,
                    major: d.key.day == 1 || d.key.day % 5 == 0,
                    title: Dates.long(d.key), done: d.done, total: d.total, elapsed: d.elapsed, current: d.isToday, tasks: d.tasks, target: .day(d.key))
            }
            spark = days.map { SparkPoint(value: $0.done, current: $0.isToday, elapsed: $0.elapsed) }
            history = days.enumerated().filter { $0.element.elapsed && $0.element.total > 0 }.map { i, d in
                Row(id: d.key.description, order: i, label: Dates.relative(d.key, today: today) ?? Dates.medium(d.key), done: d.done, planned: d.total,
                    rate: Double(d.done) / Double(d.total), tasks: d.tasks, target: .day(d.key))
            }
            average = sum.avg
        }
    }
}

struct SparkPoint: Hashable {
    let value: Int
    let current: Bool
    let elapsed: Bool
}

/// A white card on the canvas: a title, an optional note on the right, content.
struct Card<Content: View>: View {
    let title: String
    var aside: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(.headline)
                    .tracking(-0.2)
                    .accessibilityAddTraits(.isHeader)
                Spacer()
                if let aside {
                    Text(aside).font(.caption).foregroundStyle(.ink3).multilineTextAlignment(.trailing)
                }
            }
            content
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
        .elevation(Tokens.Shadow.lift, cornerRadius: Tokens.Radius.card)
    }
}

/// A ratio against its limit: accent fill on a lighter accent track.
struct Meter: View {
    let value: Double?
    var height: CGFloat = 6
    @Environment(\.palette) private var palette

    var body: some View {
        GeometryReader { g in
            Capsule().fill(palette.accentTrack)
                .overlay(alignment: .leading) {
                    Capsule().fill(palette.accent).frame(width: g.size.width * max(0, min(1, value ?? 0)))
                }
        }
        .frame(height: height)
        .animation(.easeOut(duration: 0.7), value: value)
        .accessibilityHidden(true)
    }
}
