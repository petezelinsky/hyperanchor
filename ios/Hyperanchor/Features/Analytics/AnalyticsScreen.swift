import SwiftUI

/// Progress (AnalyticsView.tsx): the period on screen, a week, a month or a year, in panels across the whole work area.
/// The AI summary on top (where the server has the AI); then the four figures; the days (or months) as bars, with
/// what's left open (a week) or the weekdays beside them; the year's activity; what's left open and the history of
/// every day. The page's name, its dates, the period switch and the arrows are in the bar above.
struct AnalyticsScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var lens = LensDriver()
    @State private var viewport: CGSize = .zero
    /// Today's AI allowance and whether the server offers the summary (nil until it answers).
    @State private var usage: Usage?
    @State private var left: Int?

    var body: some View {
        let today = clock.today
        let period = router.period
        let offset = router.periodOffset
        let report = Stats.Report(period: period, offset: offset, today: today, firstDay: store.firstDay, byDate: store.progressTasks(on:))
        let layout = ProgressLayout(width: viewport.width, compact: sizeClass == .compact, typeSize: typeSize)

        ScrollView {
            Group {
                if report.empty {
                    EmptyNote(report: report, plan: { plan(period, today: today) }, back: { router.periodOffset = 0 })
                } else {
                    panels(report, layout: layout)
                }
            }
            .padding(.horizontal, layout.margin)
            .padding(.top, layout.phone ? 12 : 24)
            .padding(.bottom, 40)
            .frame(maxWidth: 1480)
            .frame(maxWidth: .infinity)
            .lensContent(lens)
        }
        // The page's gray, with the panels on it; the lens plays over all of it.
        .background(.canvas)
        .lensSurface(lens)
        .environment(\.progressLayout, layout)
        .onGeometryChange(for: CGSize.self) { $0.size } action: { viewport = $0 }
        .refreshable { await reload(period, offset, today: today) }
        .task(id: "\(period.rawValue) \(offset) \(today)") {
            await store.load(Stats.range(period, offset: offset, today: today))
        }
        .task(id: today) {
            // "Days with something done" counts the whole year so far, and the first task can be further back.
            await store.load(today.adding(days: -365)...today)
        }
        .task { await loadUsage() }
    }

    @ViewBuilder
    private func panels(_ r: Stats.Report, layout: ProgressLayout) -> some View {
        VStack(spacing: layout.gap) {
            if usage?.features?.summary ?? true {
                SummaryPanel(
                    input: r.summaryInput,
                    key: SummaryArchive.key(account: model.session.accountID ?? user.email, period: r.period, start: r.bounds.start),
                    noun: r.period.rawValue,
                    left: $left,
                    lens: lens
                )
            }
            Figures(figures: r.figures)
            if layout.wide {
                GridRow12(spans: [8, 4], gap: layout.gap) {
                    chart(r)
                    beside(r)
                }
            } else {
                chart(r)
                beside(r)
            }
            if r.period == .year {
                ActivityCard(days: r.days) { router.open($0) }
            }
            if r.period == .week {
                history(r)
            } else if layout.wide {
                GridRow12(spans: [5, 7], gap: layout.gap) {
                    OpenCard(open: r.open, today: r.today)
                    history(r)
                }
            } else {
                OpenCard(open: r.open, today: r.today)
                history(r)
            }
        }
    }

    private func chart(_ r: Stats.Report) -> some View {
        Card(title: r.chartTitle) {
            ChartLegend()
        } content: {
            BarChart(bars: r.bars, average: r.average, title: r.chartTitle, pick: pick)
                // Another period's bars grow in again.
                .id("\(r.period.rawValue) \(r.offset)")
        }
    }

    /// Beside the chart: what's left open (a week), or the weekdays (a month, a year).
    @ViewBuilder
    private func beside(_ r: Stats.Report) -> some View {
        if r.period == .week {
            OpenCard(open: r.open, today: r.today)
        } else {
            WeekdayCard(days: r.days)
        }
    }

    private func history(_ r: Stats.Report) -> some View {
        HistoryCard(rows: r.history, unit: r.period == .year ? .months : .days, pick: pick)
    }

    /// A bar or a row: a day opens in Day; a month (from a year) opens here.
    private func pick(_ target: Stats.Target) {
        switch target {
        case .day(let day):
            router.open(day)
        case .month(let offset):
            router.period = .month
            router.periodOffset = offset
        }
    }

    /// Goes to where this period gets planned (Week, or Month for a month or a year).
    private func plan(_ period: Stats.Period, today: DayKey) {
        router.goToToday(today)
        router.tab = period == .week ? .week : .month
    }

    private func reload(_ period: Stats.Period, _ offset: Int, today: DayKey) async {
        await store.load(Stats.range(period, offset: offset, today: today))
        await loadUsage()
    }

    private func loadUsage() async {
        guard let answer = try? await model.session.backend.usage() else { return }
        usage = answer
        left = answer.today.left
    }
}

/// Done · Open · Average, beside the chart's title.
private struct ChartLegend: View {
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 16) {
            swatch(palette.accent, "Done")
            swatch(palette.accentTrack, "Open")
            HStack(spacing: 6) {
                Rectangle()
                    .fill(.clear)
                    .frame(width: 14, height: 1)
                    .overlay {
                        Rectangle().stroke(Color.ink3, style: StrokeStyle(lineWidth: 1, dash: [3, 2]))
                            .frame(height: 0.5)
                    }
                Text("Average")
            }
        }
        .type(Tokens.Typography.caption)
        .foregroundStyle(.ink2)
        .lineLimit(1)
        .fixedSize()
        .accessibilityHidden(true)
    }

    private func swatch(_ color: Color, _ label: String) -> some View {
        HStack(spacing: 6) {
            RoundedRectangle(cornerRadius: Tokens.Radius.xs, style: .continuous).fill(color).frame(width: 10, height: 10)
            Text(label)
        }
    }
}

/// Nothing to measure yet: a sentence where the numbers go, with the way to plan (or back to now).
private struct EmptyNote: View {
    let report: Stats.Report
    let plan: () -> Void
    let back: () -> Void
    @Environment(\.progressLayout) private var layout

    var body: some View {
        let name = report.period.rawValue
        let sentence = report.current ? "Nothing planned this \(name) yet. " : "Nothing was planned in \(report.label). "
        let action = report.current ? (report.period == .week ? "Plan your week" : "Plan your month") : "Back to this \(name)"
        var link = AttributedString(action)
        link.link = URL(string: "hyperanchor-progress:action")
        link.underlineStyle = Text.LineStyle(pattern: .solid, color: .ink4)
        link.foregroundColor = .ink
        link.font = .token(Tokens.Typography.callout, weight: .medium)

        return Text(AttributedString(sentence) + link)
            .type(Tokens.Typography.callout)
            .foregroundStyle(.ink2)
            .tint(.ink)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(layout.padding)
            .progressPanel()
            .environment(\.openURL, OpenURLAction { _ in
                report.current ? plan() : back()
                return .handled
            })
    }
}

extension TaskStore {
    /// The earliest day with a task, of everything loaded (it reaches a year back): Progress starts counting there.
    var firstDay: DayKey? {
        index.lazy.filter { !$0.value.isEmpty }.map(\.key).min()
    }

    /// A day's tasks in the person's own order, as the web hands them to Progress.
    func progressTasks(on day: DayKey) -> [TaskItem] {
        let list = tasks(on: day)
        return list.contains { $0.position != nil } ? TaskSorting.sorted(list, by: .manual) : list
    }
}
