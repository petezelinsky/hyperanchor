import XCTest
@testable import Hyperanchor

/// The Day list's rows, as the web's DayView lays them out: what shows, in what order, with which words.
@MainActor
final class DayEntriesTests: XCTestCase {
    let today = DayKey("2026-11-13")!

    private func task(_ title: String, _ date: DayKey, done: Bool = false, minute: Int = 0, position: Double? = nil) -> TaskItem {
        let stamp = TaskItem.timestamp(date.date().addingTimeInterval(Double(8 * 3600 + minute * 60)))
        return TaskItem(id: title, date: date, title: title, notes: "", done: done, position: position, createdAt: stamp, updatedAt: stamp)
    }

    private func ids(_ rows: [DayEntry]) -> [String] { rows.map(\.id) }

    private func words(_ rows: [DayEntry]) -> String? {
        for row in rows { if case .cleared(let words) = row.kind { return words } }
        return nil
    }

    func testTodayListsWhatsLeftThenEarlierDaysThenDone() {
        let stored = [task("a", today, minute: 1), task("b", today, done: true, minute: 2), task("c", today, minute: 3)]
        let earlier = [task("old", today.adding(days: -2))]
        let rows = DayEntry.rows(.init(day: today, today: today, stored: stored, carried: earlier))
        XCTAssertEqual(ids(rows), ["new", "a", "c", "fold.earlier", "fold.done", "b"])
    }

    func testAFoldedDoneHidesItsTasksAndOpenEarlierDaysShowTheirs() {
        let stored = [task("a", today, done: true)]
        let earlier = (1...3).map { task("old\($0)", today.adding(days: -$0)) }
        let rows = DayEntry.rows(.init(day: today, today: today, stored: stored, carried: earlier, earlierOpen: true, doneOpen: false))
        XCTAssertEqual(ids(rows), ["new", "cleared", "fold.earlier", "earlier.head", "old1", "old2", "old3", "fold.done"])
        XCTAssertEqual(words(rows), "All done for today.")
    }

    func testEarlierDaysShowADozenThenOfferMore() {
        let earlier = (1...15).map { task("old\($0)", today.adding(days: -$0)) }
        let rows = DayEntry.rows(.init(day: today, today: today, stored: [], carried: earlier, earlierOpen: true))
        let lines = rows.filter { if case .earlier = $0.kind { true } else { false } }
        XCTAssertEqual(lines.count, 12)
        guard case .more(let n) = rows.last?.kind else { return XCTFail("no Show more") }
        XCTAssertEqual(n, 3)
        // The framed list: rounded at its ends; the fold's space goes under "Show more", not the last line.
        guard case .earlier(_, .first) = lines.first?.kind, case .earlier(_, .last) = lines.last?.kind else { return XCTFail("edges") }
        XCTAssertFalse(lines.last!.foot)
    }

    func testEarlierDaysAreMostRecentFirstAndInTheOrderAddedWithinADay() {
        let d1 = today.adding(days: -1), d3 = today.adding(days: -3)
        let open = [task("x3", d3, minute: 5), task("y1", d1, minute: 9), task("z1", d1, minute: 2)]
        let ticked = [task("t3", d3, done: true, minute: 1)]
        XCTAssertEqual(DayEntry.earlier(open: open, ticked: ticked).map(\.id), ["z1", "y1", "t3", "x3"])
    }

    func testOnlyTodayShowsEarlierDays() {
        let earlier = [task("old", today.adding(days: -2))]
        let tomorrow = DayEntry.rows(.init(day: today.adding(days: 1), today: today, stored: [], carried: earlier))
        XCTAssertFalse(ids(tomorrow).contains("fold.earlier"))
    }

    func testAPastDaySaysWhatWasLeftOpen() {
        let yesterday = today.adding(days: -1)
        let stored = [task("a", yesterday), task("b", yesterday, done: true)]
        let rows = DayEntry.rows(.init(day: yesterday, today: today, stored: stored))
        guard case .leftOpen(let open) = rows.first?.kind else { return XCTFail("no notice") }
        XCTAssertEqual(open.map(\.id), ["a"])
    }

    func testOneQuietSentenceWhereNothingIsLeft() {
        let monday = DayKey("2026-11-16")!
        XCTAssertEqual(words(DayEntry.rows(.init(day: today, today: today, stored: []))), "Nothing planned yet.")
        XCTAssertEqual(words(DayEntry.rows(.init(day: monday, today: today, stored: []))), "Nothing planned for Monday yet.")
        XCTAssertEqual(words(DayEntry.rows(.init(day: today.adding(days: -1), today: today, stored: []))), "Nothing was planned.")
        let done = [task("a", monday, done: true)]
        XCTAssertEqual(words(DayEntry.rows(.init(day: monday, today: today, stored: done))), "Everything on this day is done.")
        // While a new task is being written, the sentence steps aside.
        XCTAssertNil(words(DayEntry.rows(.init(day: today, today: today, stored: [], composing: true))))
    }

    func testATickedTaskStaysWithWhatsLeftWhileItsTickPlays() {
        let stored = [task("a", today, done: true, minute: 1), task("b", today, minute: 2)]
        let rows = DayEntry.rows(.init(day: today, today: today, stored: stored, settling: ["a"]))
        XCTAssertEqual(ids(rows), ["new", "a", "b"])
        // It can't be moved up or down meanwhile; the others can.
        guard case .task(_, let order) = rows[1].kind, case .task(_, let other) = rows[2].kind else { return XCTFail("rows") }
        XCTAssertNil(order)
        XCTAssertEqual(other?.up, false)
        XCTAssertEqual(other?.down, false)
    }

    func testMoveUpAndDownFollowMyOrderOnly() {
        let stored = [task("a", today, position: 1), task("b", today, position: 2), task("c", today, position: 3)]
        let rows = DayEntry.rows(.init(day: today, today: today, stored: stored))
        let orders = rows.compactMap { row -> DayEntry.Order? in if case .task(_, let o) = row.kind { o } else { nil } }
        XCTAssertEqual(orders.map(\.up), [false, true, true])
        XCTAssertEqual(orders.map(\.down), [true, true, false])
        let byName = DayEntry.rows(.init(day: today, today: today, stored: stored, sort: .nameDescending))
        XCTAssertEqual(ids(byName), ["new", "c", "b", "a"])
        XCTAssertTrue(byName.allSatisfy { if case .task(_, let o) = $0.kind { o == nil && !$0.draggable } else { true } })
    }

    func testAPickedRowsEdgeTakesThePlaceOfTheHairlineAboveIt() {
        let stored = [task("a", today, minute: 1), task("b", today, minute: 2)]
        let rows = DayEntry.rows(.init(day: today, today: today, stored: stored, picked: ["b"]))
        XCTAssertEqual(rows.map(\.hairline), [true, false, true])
        let first = DayEntry.rows(.init(day: today, today: today, stored: stored, picked: ["a"]))
        XCTAssertEqual(first.map(\.hairline), [false, true, true])
    }

    func testOnIPhoneNewTasksAreWrittenAtTheBottomSoTheListHasNoNewTaskRow() {
        let rows = DayEntry.rows(.init(day: today, today: today, stored: [task("a", today)], newTaskRow: false))
        XCTAssertEqual(ids(rows), ["a"])
        XCTAssertEqual(words(DayEntry.rows(.init(day: today, today: today, stored: [], newTaskRow: false))), "Nothing planned yet.")
    }

    func testATaskOnItsWayElsewhereStaysWhereItWasForAMoment() {
        let stored = [task("a", today, position: 1), task("c", today, position: 3)]
        let leaving = [task("b", today, position: 2)]
        let rows = DayEntry.rows(.init(day: today, today: today, stored: stored, leaving: leaving))
        XCTAssertEqual(ids(rows), ["new", "a", "b", "c"])
    }
}
