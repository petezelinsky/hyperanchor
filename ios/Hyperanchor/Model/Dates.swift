import Foundation

/// Date labels, word for word as on the web (src/lib/dates.ts). The interface is in English.
enum Dates {
    /// Weekday names by `DayKey.dayOfWeek` (0 = Sunday).
    private static let dayFull = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    static let months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
    static let monthsShort = months.map { String($0.prefix(3)) }

    enum WeekdayForm { case full, short, letter }

    /// Weekday names in week order (from `DayKey.weekStart`): "Monday" / "Mon" / "M", …
    static func weekdayNames(_ form: WeekdayForm) -> [String] {
        (0..<7).map { i in
            let name = dayFull[(i + DayKey.weekStart) % 7]
            switch form {
            case .full: return name
            case .short: return String(name.prefix(3))
            case .letter: return String(name.prefix(1))
            }
        }
    }

    /// "Thursday"
    static func dayName(_ d: DayKey) -> String { dayFull[d.dayOfWeek] }
    /// "Thu"
    static func dayShort(_ d: DayKey) -> String { String(dayFull[d.dayOfWeek].prefix(3)) }

    /// "Thursday, October 23"
    static func long(_ d: DayKey) -> String { "\(dayName(d)), \(months[d.month - 1]) \(d.day)" }
    /// "Thu, Oct 23"
    static func medium(_ d: DayKey) -> String { "\(dayShort(d)), \(monthsShort[d.month - 1]) \(d.day)" }
    /// "Oct 23"
    static func short(_ d: DayKey) -> String { "\(monthsShort[d.month - 1]) \(d.day)" }

    /// "Today" / "Tomorrow" / "Yesterday", otherwise nil.
    static func relative(_ key: DayKey, today: DayKey) -> String? {
        switch key.days(since: today) {
        case 0: "Today"
        case 1: "Tomorrow"
        case -1: "Yesterday"
        default: nil
        }
    }

    /// "October 20 – 26, 2026", "Sep 29 – Oct 5, 2026" or "Dec 29, 2025 – Jan 4, 2026".
    static func range(_ start: DayKey, _ end: DayKey) -> String {
        if start.year != end.year { return "\(short(start)), \(start.year) – \(short(end)), \(end.year)" }
        if start.month != end.month { return "\(short(start)) – \(short(end)), \(end.year)" }
        return "\(months[start.month - 1]) \(start.day) – \(end.day), \(end.year)"
    }

    /// First and last visible day of the month grid (whole weeks, from the first day of the week) for a month (1…12),
    /// and its number of rows.
    static func monthGrid(year: Int, month: Int) -> (start: DayKey, rows: Int, end: DayKey) {
        let first = DayKey(year: year, month: month, day: 1)
        let last = DayKey(year: year, month: month, day: DayKey.daysIn(year: year, month: month))
        let start = first.startOfWeek
        let rows = Int((Double(last.days(since: start) + 1) / 7).rounded(.up))
        return (start, rows, start.adding(days: rows * 7 - 1))
    }

    /// "Nov 9 – 15", "Oct 26 – Nov 1", with ", 2027" when the week ends in another year than `thisYear`
    /// (`shortRange` on the web).
    static func shortRange(_ start: DayKey, _ end: DayKey, thisYear: Int) -> String {
        let span = start.month == end.month ? "\(monthsShort[start.month - 1]) \(start.day) – \(end.day)" : "\(short(start)) – \(short(end))"
        return end.year != thisYear ? "\(span), \(end.year)" : span
    }

    /// "1 task", "3 tasks"
    static func plural(_ n: Int, _ word: String) -> String { "\(n) \(n == 1 ? word : word + "s")" }
}
