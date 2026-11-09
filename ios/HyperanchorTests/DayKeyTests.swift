import XCTest
@testable import Hyperanchor

final class DayKeyTests: XCTestCase {
    func testParsing() {
        XCTAssertEqual(DayKey("2026-10-22")?.description, "2026-10-22")
        XCTAssertEqual(DayKey("2024-02-29")?.description, "2024-02-29")
        XCTAssertNil(DayKey("2026-02-29"))
        XCTAssertNil(DayKey("2026-13-01"))
        XCTAssertNil(DayKey("2026-1-01"))
        XCTAssertNil(DayKey("tomorrow"))
    }

    func testOrderingMatchesTheStringOrder() {
        let keys = ["2025-12-31", "2026-01-01", "2026-10-09", "2026-10-10"].compactMap(DayKey.init)
        XCTAssertEqual(keys, keys.sorted())
        XCTAssertEqual(keys.map(\.description), keys.map(\.description).sorted())
    }

    func testArithmeticAcrossBoundaries() {
        let d = DayKey("2026-03-28")!
        XCTAssertEqual(d.adding(days: 1).description, "2026-03-29") // DST change in Europe
        XCTAssertEqual(d.adding(days: 4).description, "2026-04-01")
        XCTAssertEqual(DayKey("2026-12-31")!.adding(days: 1).description, "2027-01-01")
        XCTAssertEqual(DayKey("2026-10-22")!.days(since: DayKey("2025-10-22")!), 365)
        XCTAssertEqual(DayKey("2026-10-22")!.weekday, 3) // Thursday
        XCTAssertEqual(DayKey("2026-10-22")!.startOfWeek.description, "2026-10-19")
        XCTAssertEqual(DayKey("2026-10-25")!.startOfWeek.description, "2026-10-19") // Sunday belongs to the week before
    }

    func testMonthArithmetic() {
        let d = DayKey("2026-01-31")!
        XCTAssertEqual(d.addingMonths(1).description, "2026-02-01")
        XCTAssertEqual(d.addingMonths(-1).description, "2025-12-01")
        XCTAssertEqual(d.addingMonths(-13).description, "2024-12-01")
        XCTAssertEqual(d.addingMonths(23).description, "2027-12-01")
    }

    func testFromDateUsesTheLocalCalendar() {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Pacific/Auckland")!
        let lateEvening = calendar.date(from: DateComponents(year: 2026, month: 10, day: 22, hour: 23, minute: 30))!
        XCTAssertEqual(DayKey(lateEvening, calendar: calendar).description, "2026-10-22")
        XCTAssertEqual(DayKey("2026-10-22")!.date(calendar: calendar), calendar.date(from: DateComponents(year: 2026, month: 10, day: 22)))
    }

    func testCodable() throws {
        let task = TaskItem(id: "x", date: DayKey("2026-10-22")!, title: "Hi", notes: "n", done: true, createdAt: "a", updatedAt: "b")
        let json = String(decoding: try JSONEncoder().encode(task), as: UTF8.self)
        XCTAssertTrue(json.contains(#""date":"2026-10-22""#))
        XCTAssertTrue(json.contains(#""description":"n""#))
        XCTAssertEqual(try JSONDecoder().decode(TaskItem.self, from: Data(json.utf8)), task)
    }

    func testTimestampFormatMatchesTheServer() {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let date = utc.date(from: DateComponents(year: 2026, month: 10, day: 21, hour: 9, minute: 41, second: 7, nanosecond: 250_000_000))!
        XCTAssertEqual(TaskItem.timestamp(date), "2026-10-21T09:41:07.250Z")
    }
}
