import SwiftUI

/// What the bar on top says for the page on screen, and where its arrows lead (`head` and `nav` in TaskApp.tsx).
@MainActor
struct BarModel {
    struct Head {
        var title: String
        /// The quiet part beside the title: the date in full, a range, the year.
        var soft: String?
        /// The same for phones ("Fri, Nov 13").
        var softShort: String?
        /// The title opens the month to pick a day from (Day and Week).
        var picksDay = false
    }

    struct Nav {
        var prev: String
        var next: String
        var nextDisabled = false
        /// Away from the present: the way back to it.
        var back: String?
    }

    let head: Head
    let nav: Nav?

    init(router: Router, today: DayKey) {
        let year = { (d: DayKey) in d.year != today.year ? ", \(d.year)" : "" }
        switch router.tab {
        case .day:
            let sel = router.selected
            let relative = Dates.relative(sel, today: today)
            head = Head(
                title: relative ?? Dates.dayName(sel),
                soft: (relative != nil ? Dates.long(sel) : "\(Dates.months[sel.month - 1]) \(sel.day)") + year(sel),
                softShort: (relative != nil ? Dates.medium(sel) : Dates.short(sel)) + year(sel),
                picksDay: true
            )
            nav = Nav(prev: "Previous day", next: "Next day", back: sel != today ? "Back to today" : nil)
        case .week:
            let start = router.selected.startOfWeek
            let weeks = start.days(since: today.startOfWeek) / 7
            head = Head(
                title: weeks == 0 ? "This week" : weeks == -1 ? "Last week" : weeks == 1 ? "Next week" : "Week of \(Dates.short(start))",
                soft: Dates.shortRange(start, start.adding(days: 6), thisYear: today.year),
                picksDay: true
            )
            nav = Nav(prev: "Previous week", next: "Next week", back: weeks != 0 ? "Back to this week" : nil)
        case .month:
            let m = router.month
            head = Head(title: Dates.months[m.month - 1], soft: String(m.year))
            nav = Nav(prev: "Previous month", next: "Next month", back: m != today.startOfMonth ? "Back to this month" : nil)
        case .analytics:
            let b = Stats.bounds(router.period, offset: router.periodOffset, today: today)
            let soft = switch router.period {
            case .week: Dates.shortRange(b.start, b.end, thisYear: today.year)
            case .month: "\(Dates.months[b.start.month - 1]) \(b.start.year)"
            case .year: String(b.start.year)
            }
            head = Head(title: "Progress", soft: soft)
            let name = router.period.rawValue
            nav = Nav(prev: "Previous \(name)", next: "Next \(name)", nextDisabled: router.periodOffset == 0,
                      back: router.periodOffset != 0 ? "Back to this \(name)" : nil)
        case .timeline:
            head = Head(title: "Timeline")
            nav = nil
        case .goals:
            head = Head(title: "Goals")
            nav = nil
        case .agent:
            head = Head(title: "Agent")
            nav = nil
        }
    }
}
