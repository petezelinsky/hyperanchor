import XCTest
@testable import Hyperanchor

/// Week and Month: how a week is laid out, where a task dragged in the list of days lands, and how long words break.
@MainActor
final class WeekMonthTests: XCTestCase {
    private let monday = DayKey(year: 2026, month: 11, day: 9)
    private var tuesday: DayKey { monday.adding(days: 1) }
    private var wednesday: DayKey { monday.adding(days: 2) }

    private func task(_ id: String, on day: DayKey, done: Bool = false) -> TaskItem {
        TaskItem(id: id, date: day, title: id, notes: "", done: done, createdAt: "2026-11-01T08:00:00.000Z", updatedAt: "2026-11-01T08:00:00.000Z")
    }

    func testAWeekListsWhatIsLeftThenWhatIsDoneAndKeepsATickInPlace() {
        let store = TaskStore(backend: RecordingBackend(), cache: nil)
        let a = store.create(title: "A", date: monday)
        let b = store.create(title: "B", date: monday, done: true)
        let c = store.create(title: "C", date: monday)
        store.create(title: "D", date: wednesday)

        let week = WeekDay.week(from: monday, store: store, sort: .manual, settling: [])
        XCTAssertEqual(week.count, 7)
        XCTAssertEqual(week[0].open.map(\.id), [a.id, c.id])
        XCTAssertEqual(week[0].done.map(\.id), [b.id])
        XCTAssertEqual(week[0].finished, 1)
        XCTAssertEqual(week[0].total, 3)
        XCTAssertEqual(week[2].open.count, 1)
        XCTAssertEqual(week[6].day, monday.adding(days: 6))

        // Just ticked: it stays among the open tasks (counted as done) until its tick has played.
        store.toggle(a.id)
        let settling = WeekDay.week(from: monday, store: store, sort: .manual, settling: [a.id])
        XCTAssertEqual(settling[0].open.map(\.id), [a.id, c.id])
        XCTAssertEqual(settling[0].finished, 2)
        let settled = WeekDay.week(from: monday, store: store, sort: .manual, settling: [])
        XCTAssertEqual(settled[0].open.map(\.id), [c.id])
        XCTAssertEqual(Set(settled[0].done.map(\.id)), [a.id, b.id])
    }

    func testATaskDroppedInTheListLandsUnderTheBandAbove() {
        let a = task("a", on: monday), b = task("b", on: monday), c = task("c", on: monday, done: true), d = task("d", on: tuesday)
        let days = [WeekDay(day: monday, open: [a, b], done: [c]), WeekDay(day: tuesday, open: [d], done: []), WeekDay(day: wednesday, open: [], done: [])]
        let rows = WeekListRow.rows(days, composerDay: nil)
        // Monday, a, b, c, Tuesday, d, Wednesday
        XCTAssertEqual(rows.map(\.id), ["day-\(monday.ordinal)", "a", "b", "c", "day-\(tuesday.ordinal)", "d", "day-\(wednesday.ordinal)"])

        func landing(_ source: Int, _ to: Int) -> (String, DayKey, Int)? {
            WeekListRow.destination(of: source, to: to, in: rows).map { ($0.task, $0.day, $0.index) }
        }
        // To Tuesday, under d.
        XCTAssertTrue(landing(1, 6)! == ("a", tuesday, 1))
        // To the empty Wednesday, past the end of the list.
        XCTAssertTrue(landing(1, 7)! == ("a", wednesday, 0))
        // Up to the top of Monday, above a.
        XCTAssertTrue(landing(5, 1)! == ("d", monday, 0))
        // Above the first band still means the top of the first day.
        XCTAssertTrue(landing(2, 0)! == ("b", monday, 0))
        // Within Monday, below the done task: after the open ones (a done task takes no place in the order).
        XCTAssertTrue(landing(1, 4)! == ("a", monday, 1))
        // Bands don't move.
        XCTAssertNil(landing(0, 3))
    }

    func testABandHasALineAboveItOnlyAfterADayWithTasks() {
        let a = task("a", on: monday)
        let days = [WeekDay(day: monday, open: [a], done: []), WeekDay(day: tuesday, open: [], done: []), WeekDay(day: wednesday, open: [], done: [])]
        let lines = WeekListRow.rows(days, composerDay: nil).compactMap { row -> Bool? in
            if case .header(_, let lineAbove) = row.kind { return lineAbove }
            return nil
        }
        XCTAssertEqual(lines, [false, true, false])
    }

    func testOnlyLongWordsBreakAndNeverNearTheirEnds() {
        // Short words are never broken ("den-tist").
        XCTAssertEqual(CalmHyphens.apply("Call the dentist"), "Call the dentist")
        XCTAssertEqual(CalmHyphens.apply("Review Q4 roadmap draft"), "Review Q4 roadmap draft")
        // A long word gets soft hyphens, at least four letters from either end; the words read the same.
        let title = "Pay the electricity bill and the subscriptions"
        let broken = CalmHyphens.apply(title)
        XCTAssertEqual(broken.replacingOccurrences(of: "\u{AD}", with: ""), title)
        XCTAssertTrue(broken.contains("\u{AD}"))
        for word in broken.split(separator: " ") where word.contains("\u{AD}") {
            let parts = word.split(separator: "\u{AD}")
            XCTAssertGreaterThanOrEqual(parts.first!.count, 4)
            XCTAssertGreaterThanOrEqual(parts.last!.count, 4)
        }
    }
}
