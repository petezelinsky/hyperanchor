import Foundation

/// A local calendar day — the app's unit of planning. Serialized as "YYYY-MM-DD", like the web and the API.
///
/// Stored as a day number (days since 1970-01-01), so arithmetic and comparisons never touch time zones
/// or daylight saving. Weeks start on Monday.
struct DayKey: Hashable, Comparable, Sendable {
    /// Days since 1970-01-01.
    let ordinal: Int

    init(ordinal: Int) {
        self.ordinal = ordinal
    }

    init(year: Int, month: Int, day: Int) {
        ordinal = Self.daysFromCivil(year, month, day)
    }

    /// Parses "YYYY-MM-DD"; nil for anything else, including impossible dates.
    init?(_ string: String) {
        let parts = string.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 3, parts[0].count == 4, parts[1].count == 2, parts[2].count == 2,
              let y = Int(parts[0]), let m = Int(parts[1]), let d = Int(parts[2]),
              (1...12).contains(m), (1...Self.daysIn(year: y, month: m)).contains(d)
        else { return nil }
        self.init(year: y, month: m, day: d)
    }

    /// The day `date` falls on in `calendar`'s time zone (the device's, by default).
    init(_ date: Date, calendar: Calendar = .current) {
        let c = calendar.dateComponents([.year, .month, .day], from: date)
        self.init(year: c.year!, month: c.month!, day: c.day!)
    }

    static func today(_ now: Date = .now) -> DayKey { DayKey(now) }

    // MARK: Components

    var year: Int { Self.civilFromDays(ordinal).year }
    /// 1…12
    var month: Int { Self.civilFromDays(ordinal).month }
    /// 1…31
    var day: Int { Self.civilFromDays(ordinal).day }

    /// Monday-first weekday, 0…6 (1970-01-01 was a Thursday).
    var weekday: Int { ((ordinal + 3) % 7 + 7) % 7 }

    /// Local midnight of this day.
    func date(calendar: Calendar = .current) -> Date {
        let c = Self.civilFromDays(ordinal)
        return calendar.date(from: DateComponents(year: c.year, month: c.month, day: c.day))!
    }

    // MARK: Arithmetic

    func adding(days n: Int) -> DayKey { DayKey(ordinal: ordinal + n) }

    /// Whole days from `other` to `self` (positive when `self` is later).
    func days(since other: DayKey) -> Int { ordinal - other.ordinal }

    /// Monday of this day's week.
    var startOfWeek: DayKey { adding(days: -weekday) }

    /// First day of this day's month.
    var startOfMonth: DayKey { DayKey(year: year, month: month, day: 1) }

    /// The first day of the month `n` months away (normalizing like JavaScript's `new Date(y, m + n, 1)`).
    func addingMonths(_ n: Int) -> DayKey {
        let total = year * 12 + (month - 1) + n
        let y = Int((Double(total) / 12).rounded(.down))
        return DayKey(year: y, month: total - y * 12 + 1, day: 1)
    }

    static func < (a: DayKey, b: DayKey) -> Bool { a.ordinal < b.ordinal }

    // MARK: Calendar math (Howard Hinnant's civil-from-days algorithms)

    static func daysIn(year: Int, month: Int) -> Int {
        switch month {
        case 2: (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 ? 29 : 28
        case 4, 6, 9, 11: 30
        default: 31
        }
    }

    private static func daysFromCivil(_ y0: Int, _ m: Int, _ d: Int) -> Int {
        let y = m <= 2 ? y0 - 1 : y0
        let era = (y >= 0 ? y : y - 399) / 400
        let yoe = y - era * 400
        let doy = (153 * (m + (m > 2 ? -3 : 9)) + 2) / 5 + d - 1
        let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy
        return era * 146_097 + doe - 719_468
    }

    private static func civilFromDays(_ z0: Int) -> (year: Int, month: Int, day: Int) {
        let z = z0 + 719_468
        let era = (z >= 0 ? z : z - 146_096) / 146_097
        let doe = z - era * 146_097
        let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365
        let doy = doe - (365 * yoe + yoe / 4 - yoe / 100)
        let mp = (5 * doy + 2) / 153
        let d = doy - (153 * mp + 2) / 5 + 1
        let m = mp < 10 ? mp + 3 : mp - 9
        return (yoe + era * 400 + (m <= 2 ? 1 : 0), m, d)
    }
}

extension DayKey: CustomStringConvertible, Codable {
    /// "YYYY-MM-DD"
    var description: String {
        let c = Self.civilFromDays(ordinal)
        return String(format: "%04d-%02d-%02d", c.year, c.month, c.day)
    }

    var rawValue: String { description }

    init(from decoder: Decoder) throws {
        let string = try decoder.singleValueContainer().decode(String.self)
        guard let key = DayKey(string) else {
            throw DecodingError.dataCorrupted(.init(codingPath: decoder.codingPath, debugDescription: "Invalid date \(string)"))
        }
        self = key
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        try c.encode(description)
    }
}
