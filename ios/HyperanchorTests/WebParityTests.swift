import XCTest
@testable import Hyperanchor

/// The Swift ports of src/lib/dates.ts, tasks.ts and stats.ts must agree with the web exactly.
/// Expected values come from running the web code: `node scripts/ios-fixtures.mjs`.
final class WebParityTests: XCTestCase {
    struct Fixtures: Decodable {
        struct Scenario: Decodable {
            struct BoundsJSON: Decodable { let start: String; let end: String; let days: Int }
            struct SummaryJSON: Decodable {
                let completed: Int, planned: Int, rate: Double?, elapsedDays: Int, activeDays: Int, avg: Double
                let best: String?, open: [String], upcoming: Int
            }
            struct WeekdayJSON: Decodable { let index: Int, done: Int, planned: Int, days: Int, avg: Double, rate: Double? }
            struct MonthJSON: Decodable { let month: Int, done: Int, planned: Int, rate: Double?, activeDays: Int, elapsedDays: Int }
            struct Labels: Decodable { let avg: String; let rate: String? }
            let today: String, period: String, offset: Int
            let bounds: BoundsJSON
            let range: [String]
            let summary: SummaryJSON
            let weekday: [WeekdayJSON]
            let months: [MonthJSON]?
            let longest: Int, current: Int
            let labels: Labels
        }
        struct DateCase: Decodable {
            let key: String, startOfWeek: String, dow: Int, long: String, medium: String, short: String
            let relative: String?, plus40: String, minus400: String
        }
        struct Grid: Decodable { let year: Int, month: Int, start: String, rows: Int, end: String }
        struct RangeCase: Decodable { let start: String, end: String, label: String }
        struct Match: Decodable { let query: String; let ids: [String] }
        struct Numbers: Decodable {
            let niceMax: [[Double]]
            let fmt1: [[Value]]
            let pct: [[Value]]
            let toFixed0: [[Value]]
        }
        enum Value: Decodable {
            case number(Double), string(String)
            init(from decoder: Decoder) throws {
                let c = try decoder.singleValueContainer()
                if let d = try? c.decode(Double.self) { self = .number(d) } else { self = .string(try c.decode(String.self)) }
            }
            var number: Double { if case .number(let d) = self { d } else { .nan } }
            var string: String { if case .string(let s) = self { s } else { "" } }
        }
        let tasks: [TaskItem]
        let scenarios: [Scenario]
        let dates: [DateCase]
        let grids: [Grid]
        let ranges: [RangeCase]
        let sortSample: [TaskItem]
        let sorting: [String: [String]]
        let matching: [Match]
        let numbers: Numbers
    }

    private static let fixtures: Fixtures = {
        let url = Bundle(for: WebParityTests.self).url(forResource: "web-fixtures", withExtension: "json")!
        return try! JSONDecoder().decode(Fixtures.self, from: Data(contentsOf: url))
    }()

    private func key(_ s: String) -> DayKey { DayKey(s)! }

    func testDates() {
        let today = key("2026-10-22")
        for c in Self.fixtures.dates {
            let d = key(c.key)
            XCTAssertEqual(d.startOfWeek, key(c.startOfWeek), c.key)
            XCTAssertEqual(d.weekday, c.dow, c.key)
            XCTAssertEqual(Dates.long(d), c.long)
            XCTAssertEqual(Dates.medium(d), c.medium)
            XCTAssertEqual(Dates.short(d), c.short)
            XCTAssertEqual(Dates.relative(d, today: today), c.relative, c.key)
            XCTAssertEqual(d.adding(days: 40), key(c.plus40), c.key)
            XCTAssertEqual(d.adding(days: -400), key(c.minus400), c.key)
        }
        for g in Self.fixtures.grids {
            let grid = Dates.monthGrid(year: g.year, month: g.month)
            XCTAssertEqual(grid.start, key(g.start), "\(g.year)-\(g.month)")
            XCTAssertEqual(grid.rows, g.rows, "\(g.year)-\(g.month)")
            XCTAssertEqual(grid.end, key(g.end), "\(g.year)-\(g.month)")
        }
        for r in Self.fixtures.ranges {
            XCTAssertEqual(Dates.range(key(r.start), key(r.end)), r.label)
        }
    }

    func testSortingAndFilter() {
        let sample = Self.fixtures.sortSample
        for option in SortOption.allCases {
            XCTAssertEqual(TaskSorting.sorted(sample, by: option).map(\.id), Self.fixtures.sorting[option.rawValue], option.label)
        }
        for m in Self.fixtures.matching {
            XCTAssertEqual(sample.filter { TaskSorting.matches($0, query: m.query) }.map(\.id), m.ids, "query “\(m.query)”")
        }
    }

    func testAnalyticsMatchTheWeb() {
        let byDateMap = Dictionary(grouping: TaskSorting.sorted(Self.fixtures.tasks, by: .orderAdded), by: \.date)
        let byDate = { (d: DayKey) in byDateMap[d] ?? [] }
        XCTAssertFalse(Self.fixtures.scenarios.isEmpty)
        for s in Self.fixtures.scenarios {
            let name = "\(s.period) \(s.offset) @ \(s.today)"
            let period = Stats.Period(rawValue: s.period)!
            let today = key(s.today)
            let b = Stats.bounds(period, offset: s.offset, today: today)
            XCTAssertEqual(b, Stats.Bounds(start: key(s.bounds.start), end: key(s.bounds.end), days: s.bounds.days), name)
            let range = Stats.range(period, offset: s.offset, today: today)
            XCTAssertEqual([range.lowerBound.description, range.upperBound.description], s.range, name)

            let days = Stats.dayStats(b, today: today, byDate: byDate)
            let sum = Stats.summarize(days)
            XCTAssertEqual(sum.completed, s.summary.completed, name)
            XCTAssertEqual(sum.planned, s.summary.planned, name)
            XCTAssertEqual(sum.rate, s.summary.rate, name)
            XCTAssertEqual(sum.elapsedDays, s.summary.elapsedDays, name)
            XCTAssertEqual(sum.activeDays, s.summary.activeDays, name)
            XCTAssertEqual(sum.avg, s.summary.avg, accuracy: 1e-12, name)
            XCTAssertEqual(sum.best?.key.description, s.summary.best, name)
            XCTAssertEqual(sum.open.map(\.task.id), s.summary.open, name)
            XCTAssertEqual(sum.upcoming, s.summary.upcoming, name)

            for (w, e) in zip(Stats.weekdayStats(days), s.weekday) {
                XCTAssertEqual([w.index, w.done, w.planned, w.days], [e.index, e.done, e.planned, e.days], name)
                XCTAssertEqual(w.avg, e.avg, accuracy: 1e-12, name)
                XCTAssertEqual(w.rate, e.rate, name)
            }
            if let months = s.months {
                for (m, e) in zip(Stats.monthStats(days), months) {
                    XCTAssertEqual([m.month, m.done, m.planned, m.activeDays, m.elapsedDays], [e.month, e.done, e.planned, e.activeDays, e.elapsedDays], name)
                    XCTAssertEqual(m.rate, e.rate, name)
                }
            }
            XCTAssertEqual(Stats.longestStreak(days), s.longest, name)
            XCTAssertEqual(Stats.currentStreak(today: today, byDate: byDate), s.current, name)
            XCTAssertEqual(Stats.fmt1(sum.avg), s.labels.avg, name)
            XCTAssertEqual(sum.rate.map(Stats.pct), s.labels.rate, name)
        }
    }

    func testNumberFormatting() {
        let n = Self.fixtures.numbers
        for pair in n.niceMax { XCTAssertEqual(Stats.niceMax(pair[0]), pair[1], "niceMax \(pair[0])") }
        for pair in n.fmt1 { XCTAssertEqual(Stats.fmt1(pair[0].number), pair[1].string, "fmt1 \(pair[0].number)") }
        for pair in n.pct { XCTAssertEqual(Stats.pct(pair[0].number), pair[1].string, "pct \(pair[0].number)") }
        for pair in n.toFixed0 { XCTAssertEqual(JS.toFixed(pair[0].number, 0), pair[1].string, "toFixed \(pair[0].number)") }
    }
}
