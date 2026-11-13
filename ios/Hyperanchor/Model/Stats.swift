import Foundation

/// Progress's calculations. The first part is ported one to one from src/lib/stats.ts (WebParityTests check it against
/// the web's own code); `Report` and what follows it are the page's own arithmetic from src/components/analytics/*.tsx.
/// Only elapsed days (up to and including today) count towards results.
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

    /// What Progress needs loaded: the previous period (for comparisons) through the end of this one.
    static func range(_ period: Period, offset: Int, today: DayKey) -> ClosedRange<DayKey> {
        bounds(period, offset: offset - 1, today: today).start...bounds(period, offset: offset, today: today).end
    }

    struct DayStat: Hashable, Sendable, Identifiable {
        let key: DayKey
        let tasks: [TaskItem]
        let done: Int
        let total: Int
        /// Counts towards results: up to and including today (and, on the page, from the person's first task on).
        var elapsed: Bool
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

    /// Per weekday (in week order, see `DayKey.weekday`) across the elapsed days of the period.
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

// MARK: - The page (AnalyticsView.tsx)

extension Stats {
    /// Days before the person's first task aren't theirs to be measured on: averages start when they started.
    static func fromStart(_ days: [DayStat], firstDay: DayKey?) -> [DayStat] {
        guard let firstDay else { return days }
        return days.map { d in
            var d = d
            if d.key < firstDay { d.elapsed = false }
            return d
        }
    }

    /// What a bar, a cell of the activity map or a row of History opens: a day, or a month of Progress (from a year).
    enum Target: Hashable, Sendable {
        case day(DayKey)
        case month(offset: Int)
    }

    /// A column of the chart: a day (week, month) or a month (year).
    struct Bar: Identifiable, Hashable, Sendable {
        let id: String
        let label: String
        /// Second label line (the date under the weekday).
        var sub: String?
        /// Labeled even when the axis is dense.
        var major = true
        /// "Thursday, November 12", "November 2026".
        let title: String
        let done: Int
        let total: Int
        let elapsed: Bool
        let current: Bool
        var tasks: [TaskItem] = []
        /// nil: nothing to open (a month without tasks).
        var target: Target?

        var open: Int { total - done }
        /// A day still ahead with nothing planned.
        var disabled: Bool { !elapsed && total == 0 }
    }

    /// A row of History: a day, or a month of the year.
    struct HistoryRow: Identifiable, Hashable, Sendable {
        let id: String
        /// Position in date order, oldest first.
        let order: Int
        let label: String
        let done: Int
        let planned: Int
        let rate: Double?
        /// The day's tasks (days); nil for months.
        var tasks: [TaskItem]?
        /// "13 of 13" (months).
        var activeDays: String?
        let target: Target
    }

    /// A signed change against the previous period, rounded and worded as the web does (`Delta` in parts.tsx).
    struct Delta: Hashable, Sendable {
        /// The change rounded to `digits` (the web's `Number(value.toFixed(digits))`).
        let value: Double
        let digits: Int
        /// " pts" after a non-zero change in completion.
        let suffix: String
        /// "vs last week"
        let vs: String

        init(_ change: Double, digits: Int, suffix: String = "", vs: String) {
            value = Double(JS.toFixed(change, digits)) ?? 0
            self.digits = digits
            self.suffix = suffix
            self.vs = vs
        }

        enum Direction: Sendable { case rise, drop, flat }
        var direction: Direction { value > 0 ? .rise : value < 0 ? .drop : .flat }

        /// "▼ 25 pts", "▲ 0.8", "= 0".
        var text: String {
            switch direction {
            case .rise: "▲ \(amount)\(suffix)"
            case .drop: "▼ \(amount)\(suffix)"
            case .flat: "= 0"
            }
        }

        private var amount: String {
            let s = JS.toFixed(abs(value), digits)
            return s.hasSuffix(".0") ? String(s.dropLast(2)) : s
        }

        /// For VoiceOver: "down 25 points vs last week".
        var spoken: String {
            let unit = suffix == " pts" ? " points" : ""
            return switch direction {
            case .rise: "up \(amount)\(unit) \(vs)"
            case .drop: "down \(amount)\(unit) \(vs)"
            case .flat: "no change \(vs)"
            }
        }
    }

    /// One of the four figures at the top: what it is, the number, and one line of context (`Figure` in parts.tsx).
    struct Figure: Hashable, Sendable, Identifiable {
        enum Foot: Hashable, Sendable {
            case text(String)
            case delta(Delta)
        }

        let id: String
        let label: String
        /// The number as shown ("67%", "2.4", "—").
        let value: String
        /// The number itself, for the counting transition (nil: "—").
        let amount: Double?
        /// "of 17"
        var unit: String?
        var foot: Foot?
        /// What the figure means, beyond its label.
        var tip: String?

        /// The figure as sentences, for VoiceOver: "Done so far: 10 of 17. 3 more planned this week."
        var spoken: String {
            var s = "\(label): \(amount == nil ? "none yet" : value)\(unit.map { " \($0)" } ?? "")."
            switch foot {
            case .text(let t): s += " \(t)."
            case .delta(let d): s += " \(d.spoken.prefix(1).uppercased())\(d.spoken.dropFirst())."
            case nil: break
            }
            return s
        }
    }

    /// Everything Progress shows for one period, worked out as AnalyticsView.tsx does: the period's days counted from
    /// the person's first task; a day still in progress left out of rates and averages, which are compared with the
    /// same stretch of the previous period; the chart's bars and average; History; what's left open; and what the AI
    /// summary is written from.
    struct Report: Sendable {
        let period: Period
        let offset: Int
        let today: DayKey
        let bounds: Bounds
        /// "Nov 9 – 15", "November 2026", "2026".
        let label: String
        /// The period running now.
        let current: Bool
        let days: [DayStat]
        let sum: Summary
        let prevDays: [DayStat]
        /// The period without today: a day still in progress isn't a result yet.
        let settled: Summary
        /// The same stretch of the previous period.
        let prevSettled: Summary
        /// Today falls in this period, so rates and averages stop at yesterday.
        let throughYesterday: Bool
        let bars: [Bar]
        /// Oldest first.
        let history: [HistoryRow]
        /// The chart's dashed line: finished days only (for a year, the months since the person started).
        let average: Double
        /// Days with something done this year so far (a count that only grows); for the current week and month only.
        let thisYear: Int?
        /// Nothing to measure: no tasks in this period or in the one before.
        let empty: Bool
        /// What was planned and not done, newest first (today's tasks aren't left open yet).
        let open: [OpenTask]

        init(period: Period, offset: Int, today: DayKey, firstDay: DayKey?, byDate: (DayKey) -> [TaskItem]) {
            self.period = period
            self.offset = offset
            self.today = today
            let b = Stats.bounds(period, offset: offset, today: today)
            bounds = b
            current = offset == 0
            let year = b.start.year
            label = switch period {
            case .week: Dates.shortRange(b.start, b.end, thisYear: today.year)
            case .month: "\(Dates.months[b.start.month - 1]) \(year)"
            case .year: String(year)
            }

            let days = Stats.fromStart(Stats.dayStats(b, today: today, byDate: byDate), firstDay: firstDay)
            self.days = days
            let sum = Stats.summarize(days)
            self.sum = sum
            let prevBounds = Stats.bounds(period, offset: offset - 1, today: today)
            let prevDays = Stats.fromStart(Stats.dayStats(prevBounds, today: today, byDate: byDate), firstDay: firstDay)
            self.prevDays = prevDays
            // A day still in progress isn't a result yet: rates and averages of the current period run through
            // yesterday, and are compared with the same stretch of the previous period.
            let todayIndex = days.firstIndex(where: \.isToday)
            let settledDays = todayIndex == nil ? days : days.map { d in
                var d = d
                if d.isToday { d.elapsed = false }
                return d
            }
            let settled = Stats.summarize(settledDays)
            self.settled = settled
            prevSettled = Stats.summarize(todayIndex.map { Array(prevDays.prefix($0)) } ?? prevDays)
            throughYesterday = todayIndex != nil

            if period == .year {
                let months = Stats.monthStats(days)
                let monthOffset = { (m: Int) in (year - today.year) * 12 + (m - (today.month - 1)) }
                let rows = months.filter { $0.planned > 0 }.map { m in
                    HistoryRow(id: "m\(m.month)", order: m.month, label: "\(Dates.months[m.month]) \(year)", done: m.done, planned: m.planned,
                               rate: m.rate, activeDays: "\(m.activeDays) of \(m.elapsedDays)", target: .month(offset: monthOffset(m.month)))
                }
                history = rows
                bars = months.map { m in
                    Bar(id: "m\(m.month)", label: Dates.monthsShort[m.month], title: "\(Dates.months[m.month]) \(year)", done: m.done,
                        total: m.planned, elapsed: m.elapsedDays > 0, current: year == today.year && m.month == today.month - 1,
                        target: rows.first { $0.id == "m\(m.month)" }?.target)
                }
            } else {
                bars = days.map { d in
                    Bar(id: d.key.description,
                        label: period == .week ? Dates.dayShort(d.key) : String(d.key.day),
                        sub: period == .week ? String(d.key.day) : nil,
                        major: d.key.day == 1 || d.key.day % 5 == 0,
                        title: Dates.long(d.key), done: d.done, total: d.total, elapsed: d.elapsed, current: d.isToday, tasks: d.tasks,
                        target: .day(d.key))
                }
                history = days.enumerated().filter { $0.element.elapsed && $0.element.total > 0 }.map { i, d in
                    HistoryRow(id: d.key.description, order: i, label: Dates.relative(d.key, today: today) ?? Dates.medium(d.key), done: d.done,
                               planned: d.total, rate: Double(d.done) / Double(d.total), tasks: d.tasks, target: .day(d.key))
                }
            }

            // The average line, like the figures, counts finished days only (and, for a year, the months since the
            // person started).
            let elapsedBars = bars.count(where: \.elapsed)
            if period == .year {
                let settledMonths = Stats.monthStats(settledDays).count { $0.elapsedDays > 0 }
                average = settledMonths > 0 ? Double(settled.completed) / Double(settledMonths)
                    : elapsedBars > 0 ? Double(sum.completed) / Double(elapsedBars) : 0
            } else {
                average = settled.elapsedDays > 0 ? settled.avg : sum.avg
            }

            // Days with something done this year so far: a count that only grows (nothing resets it).
            if current && period != .year {
                var n = 0
                var d = DayKey(year: today.year, month: 1, day: 1)
                while d <= today {
                    if byDate(d).contains(where: \.done) { n += 1 }
                    d = d.adding(days: 1)
                }
                thisYear = n
            } else {
                thisYear = nil
            }

            empty = sum.planned == 0 && sum.upcoming == 0 && !prevDays.contains { $0.total > 0 }
            open = throughYesterday ? sum.open.filter { !$0.day.isToday } : sum.open
        }

        /// Done so far · Completion · Per day · Days with something done (`Kpis` in parts.tsx).
        var figures: [Figure] {
            let name = period.rawValue
            let vs = "vs last \(name)"
            let prevHas = prevSettled.planned > 0
            // Today joins the count once something in it is done; until then it isn't held against anyone.
            let activeOf = settled.elapsedDays + (sum.activeDays - settled.activeDays)
            let suffix = throughYesterday ? ", through yesterday" : ""
            let none = "No last \(name) to compare with"
            // The first day of a period has nothing finished to count yet.
            let waiting: Figure.Foot? = throughYesterday && settled.elapsedDays == 0 ? .text("Counts finished days only") : nil

            let rateFoot: Figure.Foot
            if let rate = settled.rate {
                if prevHas, let prev = prevSettled.rate {
                    rateFoot = .delta(Delta((rate - prev) * 100, digits: 0, suffix: " pts", vs: vs))
                } else {
                    rateFoot = .text(none)
                }
            } else {
                rateFoot = .text("Nothing planned yet")
            }
            let doneFoot = sum.upcoming > 0 ? "\(sum.upcoming) more planned this \(name)"
                : sum.planned > 0 ? "\(sum.planned - sum.completed) left open" : "Nothing planned"

            return [
                Figure(id: "done", label: current ? "Done so far" : "Done", value: "\(sum.completed)", amount: Double(sum.completed),
                       unit: "of \(sum.planned)", foot: .text(doneFoot)),
                Figure(id: "rate", label: "Completion\(suffix)", value: settled.rate.map(Stats.pct) ?? "—",
                       amount: settled.rate.map { JS.round($0 * 100) }, foot: waiting ?? rateFoot),
                Figure(id: "avg", label: "Per day\(suffix)", value: settled.elapsedDays > 0 ? Stats.fmt1(settled.avg) : "—",
                       amount: settled.elapsedDays > 0 ? settled.avg : nil,
                       foot: waiting ?? (prevHas ? .delta(Delta(settled.avg - prevSettled.avg, digits: 1, vs: vs)) : .text(none))),
                Figure(id: "active", label: "Days with something done", value: "\(sum.activeDays)", amount: Double(sum.activeDays),
                       unit: "of \(activeOf)", foot: thisYear.map { .text("\($0) this year") },
                       tip: "A count that only grows: a day without anything done takes nothing away."),
            ]
        }

        /// What the summary is written from: the page's own numbers and the titles of what was done and what's still open.
        var summaryInput: SummaryInput {
            let prevSum = Stats.summarize(prevDays)
            let short = Dates.weekdayNames(.short)
            return SummaryInput(
                period: SummaryInput.Period(rawValue: period.rawValue) ?? .week,
                label: label,
                current: current,
                today: today,
                done: sum.completed,
                planned: sum.planned,
                upcoming: sum.upcoming,
                activeDays: sum.activeDays,
                elapsedDays: sum.elapsedDays,
                previous: prevSum.planned > 0 ? .init(done: prevSum.completed, planned: prevSum.planned) : nil,
                series: period == .year
                    ? Stats.monthStats(days).map { .init(label: Dates.monthsShort[$0.month], done: $0.done, planned: $0.planned) }
                    : days.map { .init(label: "\(Dates.dayShort($0.key)) \(Dates.short($0.key))\($0.isToday ? " (today)" : "")", done: $0.done, planned: $0.total) },
                weekdays: period == .week ? [] : Stats.weekdayStats(days).map { .init(day: short[$0.index], done: $0.done, planned: $0.planned) },
                doneTitles: Array(days.flatMap { d in d.tasks.filter(\.done).map(\.title) }.suffix(40)),
                openTitles: sum.open.prefix(25).map { .init(title: $0.task.title, date: Dates.short($0.day.key)) }
            )
        }

        /// "Done per day", or "Done per month" for a year.
        var chartTitle: String { period == .year ? "Done per month" : "Done per day" }
    }
}

// MARK: - The panels' own arithmetic

extension Stats {
    /// The weekday with the most done on average (the first of equals); nil while nothing is done (`WeekdayCard`).
    static func bestWeekday(_ stats: [WeekdayStat]) -> WeekdayStat? {
        guard let first = stats.first, stats.contains(where: { $0.avg > 0 }) else { return nil }
        return stats.dropFirst().reduce(first) { $1.avg > $0.avg ? $1 : $0 }
    }

    /// A day's shade in the activity map: 0 (nothing done) to 4, against the most done on one day (`Heatmap.tsx`).
    static func heatLevel(done: Int, most: Int) -> Int {
        guard done > 0 else { return 0 }
        return min(4, max(1, Int((Double(done) / Double(max(1, most)) * 4).rounded(.up))))
    }

    /// The activity map's layout: one column per week from the week the year starts in, and the column each month's
    /// first day falls in (where its label goes).
    static func heatmapWeeks(_ days: [DayStat]) -> (first: DayKey, weeks: Int, monthColumns: [Int]) {
        guard let firstDay = days.first, let lastDay = days.last else { return (DayKey(ordinal: 0), 0, []) }
        let first = firstDay.key.startOfWeek
        let weeks = Int((Double(lastDay.key.days(since: first) + 1) / 7).rounded(.up))
        let columns = (1...12).map { m in DayKey(year: firstDay.key.year, month: m, day: 1).days(since: first) / 7 }
        return (first, weeks, columns)
    }

    enum HistorySort: Hashable, Sendable { case date, done, rate }

    /// History in the order picked, by date, done or rate; equals latest first (`HistoryCard`).
    static func sortHistory(_ rows: [HistoryRow], by key: HistorySort, ascending: Bool) -> [HistoryRow] {
        let dir: Double = ascending ? 1 : -1
        return rows.sorted { a, b in
            let v: Double = switch key {
            case .date: Double(a.order - b.order)
            case .done: Double(a.done - b.done)
            case .rate: (a.rate ?? -1) - (b.rate ?? -1)
            }
            return v * dir != 0 ? v * dir < 0 : a.order > b.order
        }
    }

    /// A short, stable fingerprint of what a summary was written from: a new one means the page has changed since
    /// (`fingerprint` in AiSummary.tsx: djb2 over the UTF-16 text, in base 36).
    static func fingerprint(_ text: String) -> String {
        var h: Int32 = 5381
        for unit in text.utf16 { h = (h &<< 5) &+ h &+ Int32(unit) }
        return String(UInt32(bitPattern: h), radix: 36)
    }

    static func fingerprint(_ input: SummaryInput) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        let json = (try? encoder.encode(input)).flatMap { String(data: $0, encoding: .utf8) } ?? ""
        return fingerprint(json)
    }
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
