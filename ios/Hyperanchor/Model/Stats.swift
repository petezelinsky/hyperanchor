import Foundation

/// Analytics calculations, ported one to one from src/lib/stats.ts. Only elapsed days (up to and
/// including today) count towards results.
enum Stats {
    enum Period: String, CaseIterable, Identifiable, Sendable {
        case week, month, year
        var id: String { rawValue }
        var label: String { rawValue.capitalized }
    }

    struct Bounds: Hashable, Sendable {
        let start: DayKey
        let end: DayKey
        let days: Int
    }

    /// The week/month/year `offset` periods away from today's (offset ≤ 0).
    static func bounds(_ period: Period, offset: Int, today: DayKey) -> Bounds {
        switch period {
        case .week:
            let start = today.startOfWeek.adding(days: offset * 7)
            return Bounds(start: start, end: start.adding(days: 6), days: 7)
        case .month:
            let start = today.addingMonths(offset)
            let days = DayKey.daysIn(year: start.year, month: start.month)
            return Bounds(start: start, end: start.adding(days: days - 1), days: days)
        case .year:
            let start = DayKey(year: today.year + offset, month: 1, day: 1)
            let end = DayKey(year: start.year, month: 12, day: 31)
            return Bounds(start: start, end: end, days: end.days(since: start) + 1)
        }
    }

    /// What analytics needs loaded: the previous period (for comparisons) through the end of this one.
    static func range(_ period: Period, offset: Int, today: DayKey) -> ClosedRange<DayKey> {
        bounds(period, offset: offset - 1, today: today).start...bounds(period, offset: offset, today: today).end
    }

    struct DayStat: Hashable, Sendable, Identifiable {
        let key: DayKey
        let tasks: [TaskItem]
        let done: Int
        let total: Int
        let elapsed: Bool
        let isToday: Bool
        var id: DayKey { key }
    }

    /// One entry per day of the period.
    static func dayStats(_ b: Bounds, today: DayKey, byDate: (DayKey) -> [TaskItem]) -> [DayStat] {
        (0..<b.days).map { i in
            let key = b.start.adding(days: i)
            let tasks = byDate(key)
            return DayStat(key: key, tasks: tasks, done: tasks.count { $0.done }, total: tasks.count, elapsed: key <= today, isToday: key == today)
        }
    }

    struct OpenTask: Hashable, Sendable, Identifiable {
        let task: TaskItem
        let day: DayStat
        var id: String { task.id }
    }

    struct Summary: Hashable, Sendable {
        let completed: Int
        let planned: Int
        let rate: Double?
        let elapsedDays: Int
        let activeDays: Int
        let avg: Double
        let best: DayStat?
        /// Newest first.
        let open: [OpenTask]
        let upcoming: Int
    }

    static func summarize(_ days: [DayStat]) -> Summary {
        let el = days.filter(\.elapsed)
        let completed = el.reduce(0) { $0 + $1.done }
        let planned = el.reduce(0) { $0 + $1.total }
        let best = el.reduce(nil as DayStat?) { b, d in d.done > (b?.done ?? 0) ? d : b }
        let open = el.flatMap { day in day.tasks.filter { !$0.done }.map { OpenTask(task: $0, day: day) } }.reversed()
        return Summary(
            completed: completed,
            planned: planned,
            rate: planned > 0 ? Double(completed) / Double(planned) : nil,
            elapsedDays: el.count,
            activeDays: el.count { $0.done > 0 },
            avg: el.isEmpty ? 0 : Double(completed) / Double(el.count),
            best: best,
            open: Array(open),
            upcoming: days.filter { !$0.elapsed }.reduce(0) { $0 + $1.total }
        )
    }

    struct WeekdayStat: Hashable, Sendable, Identifiable {
        let index: Int
        var done = 0
        var planned = 0
        var days = 0
        var avg: Double = 0
        var rate: Double?
        var id: Int { index }
    }

    /// Per weekday (Mon…Sun) across the elapsed days of the period.
    static func weekdayStats(_ days: [DayStat]) -> [WeekdayStat] {
        var out = (0..<7).map { WeekdayStat(index: $0) }
        for d in days where d.elapsed {
            out[d.key.weekday].done += d.done
            out[d.key.weekday].planned += d.total
            out[d.key.weekday].days += 1
        }
        for i in out.indices {
            out[i].avg = out[i].days > 0 ? Double(out[i].done) / Double(out[i].days) : 0
            out[i].rate = out[i].planned > 0 ? Double(out[i].done) / Double(out[i].planned) : nil
        }
        return out
    }

    struct MonthStat: Hashable, Sendable, Identifiable {
        /// 0…11, as on the web.
        let month: Int
        var done = 0
        var planned = 0
        var rate: Double?
        var activeDays = 0
        var elapsedDays = 0
        var days: [DayStat] = []
        var id: Int { month }
    }

    /// Per month, for the year view.
    static func monthStats(_ days: [DayStat]) -> [MonthStat] {
        var out = (0..<12).map { MonthStat(month: $0) }
        for d in days {
            let m = d.key.month - 1
            out[m].days.append(d)
            guard d.elapsed else { continue }
            out[m].done += d.done
            out[m].planned += d.total
            out[m].elapsedDays += 1
            if d.done > 0 { out[m].activeDays += 1 }
        }
        for i in out.indices { out[i].rate = out[i].planned > 0 ? Double(out[i].done) / Double(out[i].planned) : nil }
        return out
    }

    /// Consecutive days with at least one completed task, ending today — or yesterday while today
    /// has nothing done yet, so a streak doesn't read as broken in the morning.
    static func currentStreak(today: DayKey, byDate: (DayKey) -> [TaskItem], limit: Int = 366) -> Int {
        func doneOn(_ d: DayKey) -> Bool { byDate(d).contains { $0.done } }
        var d = today
        if !doneOn(d) { d = d.adding(days: -1) }
        var n = 0
        while n < limit, doneOn(d) {
            n += 1
            d = d.adding(days: -1)
        }
        return n
    }

    /// The longest run of consecutive elapsed days with at least one completed task.
    static func longestStreak(_ days: [DayStat]) -> Int {
        var best = 0
        var run = 0
        for d in days {
            if !d.elapsed { break }
            run = d.done > 0 ? run + 1 : 0
            best = max(best, run)
        }
        return best
    }

    /// A round axis maximum ≥ v (at least 4).
    static func niceMax(_ v: Double) -> Double {
        if v <= 4 { return 4 }
        let step: Double = v <= 10 ? 2 : v <= 50 ? 5 : v <= 100 ? 10 : 50
        return (v / step).rounded(.up) * step
    }

    /// "1.5" → "1.5", "2.0" → "2".
    static func fmt1(_ n: Double) -> String {
        let s = JS.toFixed(n, 1)
        return s.hasSuffix(".0") ? String(s.dropLast(2)) : s
    }

    /// "42%"
    static func pct(_ r: Double) -> String { "\(Int(JS.round(r * 100)))%" }
}

/// JavaScript's number formatting, so figures match the web digit for digit.
enum JS {
    /// `Number.prototype.toFixed`: rounds the exact binary value of `x`, and an exact tie goes up.
    static func toFixed(_ x: Double, _ digits: Int) -> String {
        // printf's long expansion is exact; rounding it by hand avoids printf's ties-to-even.
        let exact = String(format: "%.60f", abs(x))
        let parts = exact.split(separator: ".")
        let whole = String(parts[0])
        let fraction = Array(parts[1])
        var kept = Array(whole + String(fraction.prefix(digits)))
        if fraction[digits] >= "5" {
            // Add one to the last kept digit, carrying.
            var i = kept.count - 1
            while i >= 0 {
                if kept[i] == "9" {
                    kept[i] = "0"
                    i -= 1
                } else {
                    kept[i] = Character(String(kept[i].wholeNumberValue! + 1))
                    break
                }
            }
            if i < 0 { kept.insert("1", at: 0) }
        }
        let intDigits = kept.count - digits
        let s = digits > 0 ? String(kept.prefix(intDigits)) + "." + String(kept.suffix(digits)) : String(kept)
        return x < 0 ? "-" + s : s
    }

    /// `Math.round`: halves round up (towards +∞).
    static func round(_ x: Double) -> Double { (x + 0.5).rounded(.down) }
}
