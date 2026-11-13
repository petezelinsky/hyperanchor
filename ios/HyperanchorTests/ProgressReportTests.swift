import XCTest
@testable import Hyperanchor

/// Progress's own arithmetic (AnalyticsView.tsx, parts.tsx, Breakdown.tsx, Heatmap.tsx, History.tsx, AiSummary.tsx),
/// which WebParityTests can't run. The expectations are what the web shows for the same demo tasks (the web demo is
/// seeded like `DemoBackend.sample`) on Friday, November 13, 2026, read off the live page.
@MainActor
final class ProgressReportTests: XCTestCase {
    private let today = DayKey("2026-11-13")!

    override func tearDown() {
        DayKey.weekStart = 1
        super.tearDown()
    }

    private func report(_ period: Stats.Period, _ offset: Int = 0, today: DayKey? = nil) -> Stats.Report {
        let today = today ?? self.today
        let tasks = DemoBackend.sample(today: today)
        let byDate = Dictionary(grouping: tasks, by: \.date).mapValues { TaskSorting.sorted($0, by: .manual) }
        return Stats.Report(period: period, offset: offset, today: today, firstDay: byDate.keys.min()) { byDate[$0] ?? [] }
    }

    /// The four figures as the page writes them: label, value, unit and the line under it.
    private func figures(_ r: Stats.Report) -> [[String]] {
        r.figures.map { f in
            let foot: String = switch f.foot {
            case .text(let t): t
            case .delta(let d): "\(d.text) \(d.vs)"
            case nil: ""
            }
            return [f.label, f.value, f.unit ?? "", foot]
        }
    }

    func testThisWeekCountsThroughYesterday() {
        let r = report(.week)
        XCTAssertEqual(r.label, "Nov 9 – 15")
        XCTAssertTrue(r.throughYesterday)
        XCTAssertEqual(figures(r), [
            ["Done so far", "10", "of 17", "3 more planned this week"],
            ["Completion, through yesterday", "67%", "", "▼ 25 pts vs last week"],
            ["Per day, through yesterday", "2", "", "▼ 0.8 vs last week"],
            ["Days with something done", "5", "of 5", "28 this year"],
        ])
        XCTAssertEqual(Stats.fmt1(r.average), "2")
        XCTAssertEqual(Stats.niceMax(Double(r.bars.map(\.total).max() ?? 0)), 6)
        XCTAssertEqual(r.bars.map(\.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        XCTAssertEqual(r.bars.map(\.sub), ["9", "10", "11", "12", "13", "14", "15"])
        XCTAssertEqual(r.bars.map(\.current), [false, false, false, false, true, false, false])
        XCTAssertEqual(r.bars[4].title, "Friday, November 13")
        // Today isn't left open yet; the newest first.
        XCTAssertEqual(r.open.map(\.task.title), ["Reply to Sam about the offsite", "Gym — upper body", "Book flights for March", "Pay the electricity bill"])
        XCTAssertEqual(r.open.map { Dates.short($0.day.key) }, ["Nov 11", "Nov 11", "Nov 9", "Nov 9"])
        let history = Stats.sortHistory(r.history, by: .date, ascending: false)
        XCTAssertEqual(history.map(\.label), ["Today", "Yesterday", "Wed, Nov 11", "Tue, Nov 10", "Mon, Nov 9"])
        XCTAssertEqual(history.map(\.done), [2, 3, 1, 2, 2])
        XCTAssertEqual(history.map(\.planned), [5, 3, 3, 2, 4])
        XCTAssertEqual(history.map { $0.rate.map(Stats.pct) }, ["40%", "100%", "33%", "100%", "50%"])
        XCTAssertFalse(r.empty)
    }

    func testPastWeeksCompareWholeWeeks() {
        let last = report(.week, -1)
        XCTAssertEqual(last.label, "Nov 2 – 8")
        XCTAssertFalse(last.throughYesterday)
        XCTAssertEqual(figures(last), [
            ["Done", "18", "of 19", "1 left open"],
            ["Completion", "95%", "", "▲ 7 pts vs last week"],
            ["Per day", "2.6", "", "▲ 0.4 vs last week"],
            ["Days with something done", "7", "of 7", ""],
        ])
        XCTAssertEqual(Stats.fmt1(last.average), "2.6")
        XCTAssertEqual(Stats.niceMax(Double(last.bars.map(\.total).max() ?? 0)), 4)
        XCTAssertEqual(last.open.map(\.task.title), ["Send the invoice to Northwind"])
        XCTAssertEqual(last.history.count, 7)

        let before = report(.week, -2)
        XCTAssertEqual(before.label, "Oct 26 – Nov 1")
        XCTAssertEqual(figures(before), [
            ["Done", "15", "of 17", "2 left open"],
            ["Completion", "88%", "", "▼ 2 pts vs last week"],
            ["Per day", "2.1", "", "▼ 0.4 vs last week"],
            ["Days with something done", "7", "of 7", ""],
        ])
        XCTAssertEqual(before.open.map(\.task.title), ["Prepare slides for Monday", "Water the plants"])
    }

    func testMonthsStartCountingAtTheFirstTask() {
        let r = report(.month)
        XCTAssertEqual(r.label, "November 2026")
        XCTAssertEqual(figures(r), [
            ["Done so far", "31", "of 39", "5 more planned this month"],
            ["Completion, through yesterday", "85%", "", "No last month to compare with"],
            ["Per day, through yesterday", "2.4", "", "No last month to compare with"],
            ["Days with something done", "13", "of 13", "28 this year"],
        ])
        XCTAssertEqual(Stats.fmt1(r.average), "2.4")
        XCTAssertEqual(r.bars.count, 30)
        XCTAssertEqual(r.bars.filter { $0.major }.map(\.label), ["1", "5", "10", "15", "20", "25", "30"])
        let ws = Stats.weekdayStats(r.days)
        XCTAssertEqual(ws.map { "\(Stats.fmt1($0.avg)) \($0.rate.map(Stats.pct) ?? "—")" }, ["2 57%", "2.5 100%", "2.5 71%", "2.5 100%", "1.5 50%", "3 100%", "3 100%"])
        // Saturday and Sunday tie: the first of them in the week wins.
        XCTAssertEqual(Stats.bestWeekday(ws).map { Dates.weekdayNames(.full)[$0.index] }, "Saturday")
        XCTAssertEqual(r.open.count, 5)
        XCTAssertEqual(r.history.count, 13)

        // October: the first task is on the 17th, so the days before it aren't held against anyone.
        let october = report(.month, -1)
        XCTAssertEqual(figures(october), [
            ["Done", "35", "of 40", "5 left open"],
            ["Completion", "88%", "", "No last month to compare with"],
            ["Per day", "2.3", "", "No last month to compare with"],
            ["Days with something done", "15", "of 15", ""],
        ])
        let octoberWeekdays = Stats.weekdayStats(october.days)
        XCTAssertEqual(octoberWeekdays.map { "\(Stats.fmt1($0.avg)) \($0.rate.map(Stats.pct) ?? "—")" }, ["2.5 100%", "3 86%", "2.5 100%", "2 67%", "1 100%", "2.3 88%", "3 86%"])
        XCTAssertEqual(Stats.bestWeekday(octoberWeekdays)?.index, 1)
        XCTAssertEqual(october.open.map(\.task.title), ["Prepare slides for Monday", "Water the plants", "Plan the week", "Pay the electricity bill", "Read 20 pages"])
        XCTAssertEqual(october.history.count, 15)
    }

    func testTheYearInMonths() {
        let r = report(.year)
        XCTAssertEqual(r.label, "2026")
        XCTAssertEqual(figures(r), [
            ["Done so far", "66", "of 79", "5 more planned this year"],
            ["Completion, through yesterday", "86%", "", "No last year to compare with"],
            ["Per day, through yesterday", "2.4", "", "No last year to compare with"],
            ["Days with something done", "28", "of 28", ""],
        ])
        XCTAssertEqual(r.chartTitle, "Done per month")
        XCTAssertEqual(Stats.fmt1(r.average), "32")
        XCTAssertEqual(r.bars.map(\.label), Dates.monthsShort)
        XCTAssertEqual(r.bars.filter(\.current).map(\.label), ["Nov"])
        // Only months with tasks open anything; a month opens in Progress.
        XCTAssertEqual(r.bars.compactMap(\.target), [.month(offset: -1), .month(offset: 0)])
        let history = Stats.sortHistory(r.history, by: .date, ascending: false)
        XCTAssertEqual(history.map(\.label), ["November 2026", "October 2026"])
        XCTAssertEqual(history.map { "\($0.done) \($0.planned) \($0.rate.map(Stats.pct) ?? "") \($0.activeDays ?? "")" }, ["31 39 79% 13 of 13", "35 40 88% 15 of 15"])
        XCTAssertEqual(r.open.count, 10)
        XCTAssertEqual(Stats.bestWeekday(Stats.weekdayStats(r.days)).map { Dates.weekdayNames(.full)[$0.index] }, "Sunday")
        XCTAssertNil(r.thisYear)
    }

    func testNothingToMeasure() {
        let september = report(.month, -2)
        XCTAssertTrue(september.empty)
        XCTAssertEqual(september.label, "September 2026")
        XCTAssertTrue(report(.year, -1).empty)
        // October has tasks, so November's previous month isn't empty, and neither is October itself.
        XCTAssertFalse(report(.month, -1).empty)
    }

    func testTheFirstDayOfAPeriodHasNothingFinishedYet() {
        let monday = DayKey("2026-11-16")!
        let r = report(.week, today: monday)
        XCTAssertTrue(r.throughYesterday)
        XCTAssertEqual(r.settled.elapsedDays, 0)
        let f = figures(r)
        XCTAssertEqual(f[1], ["Completion, through yesterday", "—", "", "Counts finished days only"])
        XCTAssertEqual(f[2], ["Per day, through yesterday", "—", "", "Counts finished days only"])
        // Today joins "days with something done" once something in it is done.
        XCTAssertEqual(f[3][1...2], ["1", "of 1"])
    }

    func testWeeksStartingOnSunday() {
        DayKey.weekStart = 0
        let r = report(.week)
        XCTAssertEqual(r.label, "Nov 8 – 14")
        XCTAssertEqual(figures(r), [
            ["Done so far", "13", "of 20", "2 more planned this week"],
            ["Completion, through yesterday", "73%", "", "▼ 20 pts vs last week"],
            ["Per day, through yesterday", "2.2", "", "▼ 0.6 vs last week"],
            ["Days with something done", "6", "of 6", "28 this year"],
        ])
        XCTAssertEqual(r.bars.map(\.label), ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"])
        XCTAssertEqual(r.history.count, 6)

        let month = report(.month)
        let ws = Stats.weekdayStats(month.days)
        XCTAssertEqual(ws.map { "\(Stats.fmt1($0.avg)) \($0.rate.map(Stats.pct) ?? "—")" }, ["3 100%", "2 57%", "2.5 100%", "2.5 71%", "2.5 100%", "1.5 50%", "3 100%"])
        XCTAssertEqual(Stats.bestWeekday(ws).map { Dates.weekdayNames(.full)[$0.index] }, "Sunday")
    }

    func testDeltasRoundAndReadLikeTheWeb() {
        XCTAssertEqual(Stats.Delta(-25.0000001, digits: 0, suffix: " pts", vs: "vs last week").text, "▼ 25 pts")
        XCTAssertEqual(Stats.Delta(0.75, digits: 1, vs: "vs last week").text, "▲ 0.8")
        XCTAssertEqual(Stats.Delta(1.0, digits: 1, vs: "vs last week").text, "▲ 1")
        // A change that rounds to nothing is no change, without a suffix.
        XCTAssertEqual(Stats.Delta(-0.04, digits: 1, vs: "vs last week").text, "= 0")
        XCTAssertEqual(Stats.Delta(0.4, digits: 0, suffix: " pts", vs: "vs last week").text, "= 0")
        XCTAssertEqual(Stats.Delta(-25, digits: 0, suffix: " pts", vs: "vs last week").spoken, "down 25 points vs last week")
        XCTAssertEqual(Stats.Delta(0.4, digits: 1, vs: "vs last month").spoken, "up 0.4 vs last month")
        XCTAssertEqual(report(.week).figures[1].spoken, "Completion, through yesterday: 67%. Down 25 points vs last week.")
        XCTAssertEqual(report(.week).figures[0].spoken, "Done so far: 10 of 17. 3 more planned this week.")
    }

    func testHistorySortsLikeTheTable() {
        let rows = report(.week).history // oldest first: Mon … Fri
        XCTAssertEqual(Stats.sortHistory(rows, by: .date, ascending: true).map(\.label), ["Mon, Nov 9", "Tue, Nov 10", "Wed, Nov 11", "Yesterday", "Today"])
        // Equals: the latest first.
        XCTAssertEqual(Stats.sortHistory(rows, by: .done, ascending: false).map(\.label), ["Yesterday", "Today", "Tue, Nov 10", "Mon, Nov 9", "Wed, Nov 11"])
        XCTAssertEqual(Stats.sortHistory(rows, by: .rate, ascending: false).map(\.label), ["Yesterday", "Tue, Nov 10", "Mon, Nov 9", "Today", "Wed, Nov 11"])
        XCTAssertEqual(Stats.sortHistory(rows, by: .rate, ascending: true).map(\.label), ["Wed, Nov 11", "Today", "Mon, Nov 9", "Yesterday", "Tue, Nov 10"])
    }

    func testTheActivityMap() {
        XCTAssertEqual(Stats.heatLevel(done: 0, most: 5), 0)
        XCTAssertEqual(Stats.heatLevel(done: 1, most: 5), 1)
        XCTAssertEqual(Stats.heatLevel(done: 3, most: 5), 3)
        XCTAssertEqual(Stats.heatLevel(done: 5, most: 5), 4)
        XCTAssertEqual(Stats.heatLevel(done: 2, most: 0), 4)
        let year = report(.year)
        let map = Stats.heatmapWeeks(year.days)
        XCTAssertEqual(map.first, DayKey("2025-12-29")!) // the Monday of the week January 1 falls in
        XCTAssertEqual(map.weeks, 53)
        XCTAssertEqual(map.monthColumns.first, 0)
        XCTAssertEqual(map.monthColumns.last, 48) // December 1 is in the 49th week
    }

    func testWhatTheSummaryIsWrittenFrom() {
        let input = report(.week).summaryInput
        XCTAssertEqual(input.period, .week)
        XCTAssertEqual(input.label, "Nov 9 – 15")
        XCTAssertTrue(input.current)
        XCTAssertEqual([input.done, input.planned, input.upcoming, input.activeDays, input.elapsedDays], [10, 17, 3, 5, 5])
        XCTAssertEqual(input.previous, .init(done: 18, planned: 19))
        XCTAssertEqual(input.series.map(\.label), ["Mon Nov 9", "Tue Nov 10", "Wed Nov 11", "Thu Nov 12", "Fri Nov 13 (today)", "Sat Nov 14", "Sun Nov 15"])
        XCTAssertEqual(input.series.map(\.planned), [4, 2, 3, 3, 5, 2, 1])
        XCTAssertEqual(input.weekdays, [])
        XCTAssertEqual(input.doneTitles.count, 10)
        // Today's open tasks are in the summary's list (it lists everything open, today included).
        XCTAssertEqual(input.openTitles.first?.title, "30-minute walk")
        XCTAssertEqual(input.openTitles.first?.date, "Nov 13")

        let year = report(.year).summaryInput
        XCTAssertEqual(year.series.map(\.label), Dates.monthsShort)
        XCTAssertEqual(year.weekdays.map(\.day), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"])
        XCTAssertNil(year.previous)
    }

    func testFingerprintsMatchTheWeb() {
        // Values from the web's own `fingerprint` (AiSummary.tsx) in Node.
        XCTAssertEqual(Stats.fingerprint(""), "45h")
        XCTAssertEqual(Stats.fingerprint("hello"), "4bj995")
        XCTAssertEqual(Stats.fingerprint("{\"period\":\"week\"}"), "17qrocu")
        XCTAssertEqual(Stats.fingerprint("Café — “quoted” 🙂"), "1uke9me")
        XCTAssertEqual(Stats.fingerprint(String(repeating: "a", count: 1000)), "1m20i99")
        // The same data gives the same fingerprint; a ticked task gives a new one.
        let a = report(.week).summaryInput
        XCTAssertEqual(Stats.fingerprint(a), Stats.fingerprint(report(.week).summaryInput))
        var b = a
        b.done += 1
        XCTAssertNotEqual(Stats.fingerprint(a), Stats.fingerprint(b))
    }
}
