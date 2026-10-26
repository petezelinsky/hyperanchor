import Foundation
import Observation

/// Where the person is in the app: the tab, the selected day, the month and analytics period on screen,
/// and the sheets that are open. The keyboard shortcuts drive the same state.
@MainActor
@Observable
final class Router {
    enum Tab: String, Hashable, CaseIterable {
        case day, week, month, analytics

        var label: String { rawValue.capitalized }

        var symbol: String {
            switch self {
            case .day: "sun.max"
            case .week: "rectangle.split.3x1"
            case .month: "calendar"
            case .analytics: "chart.bar"
            }
        }
    }

    var tab: Tab
    /// The day shown by Day (and whose week Week shows).
    var selected: DayKey
    /// The first day of the month Month shows.
    var month: DayKey
    var period: Stats.Period = .week
    /// 0 = the current period; never positive.
    var periodOffset = 0
    var sort: SortOption = .orderAdded
    var query = ""

    var focus = false
    var showSettings = false
    var showShortcuts = false
    /// Set to open the quick-add row on the Day view (the value changes each time).
    var composeRequest: UUID?

    init(today: DayKey, tab: Tab = .day) {
        self.tab = tab
        selected = today
        month = today.startOfMonth
    }

    func reset(today: DayKey) {
        selected = today
        month = today.startOfMonth
        period = .week
        periodOffset = 0
        query = ""
        focus = false
    }

    /// Opens a day in the Day tab.
    func open(_ day: DayKey) {
        selected = day
        focus = false
        tab = .day
    }

    func goToToday(_ today: DayKey) {
        selected = today
        month = today.startOfMonth
        periodOffset = 0
    }

    /// ← / →: the previous or next day, week, month or analytics period.
    func step(_ direction: Int) {
        switch tab {
        case .day: selected = selected.adding(days: direction)
        case .week: selected = selected.adding(days: 7 * direction)
        case .month: month = month.addingMonths(direction)
        case .analytics: periodOffset = min(0, periodOffset + direction)
        }
    }

    func newTask() {
        if tab != .day && tab != .week { tab = .day }
        composeRequest = UUID()
    }
}
