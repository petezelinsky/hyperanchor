import Foundation
import Observation

/// Where the person is in the app, as the web's address keeps it: the screen (Day · Week · Month are Home; then
/// Progress, Goals and Agent), the day on screen, the month and Progress's period, and what is open over the page.
/// The keyboard shortcuts drive the same state.
@MainActor
@Observable
final class Router {
    /// The web's `View`: Home's three views, then the other pages.
    enum Tab: String, Hashable, CaseIterable {
        case day, week, month, analytics, goals, agent

        var label: String {
            switch self {
            case .day: "Day"
            case .week: "Week"
            case .month: "Month"
            case .analytics: "Progress"
            case .goals: "Goals"
            case .agent: "Agent"
            }
        }

        /// Day, Week or Month: the planner (Home).
        var isPlanner: Bool { self == .day || self == .week || self == .month }
        var page: Page { isPlanner ? .home : self == .analytics ? .progress : self == .goals ? .goals : .agent }

        /// The planner's switch.
        static let planner: [Tab] = [.day, .week, .month]
    }

    /// The sidebar's pages (and, on iPhone, the account panel's).
    enum Page: String, Hashable, CaseIterable, Identifiable {
        case home, progress, goals, agent
        var id: String { rawValue }

        var label: String {
            switch self {
            case .home: "Home"
            case .progress: "Progress"
            case .goals: "Goals"
            case .agent: "Agent"
            }
        }

        /// Not built yet: marked Soon.
        var soon: Bool { self == .goals || self == .agent }
    }

    /// Settings' own pages.
    enum SettingsPage: Hashable { case settings, account, shortcuts }

    var tab: Tab {
        didSet { if tab.isPlanner { lastPlanner = tab } }
    }
    /// The planner view Home goes back to.
    private(set) var lastPlanner: Tab = .day
    var page: Page { tab.page }

    /// The day shown by Day (and whose week Week shows).
    var selected: DayKey
    /// The first day of the month Month shows.
    var month: DayKey
    var period: Stats.Period = .week
    /// 0 = the current period; never positive.
    var periodOffset = 0

    /// The old in-list filter (the web has none: Search finds tasks everywhere). Kept until Day and Week drop it.
    var query = ""

    var focus = false
    var showSettings = false
    var showShortcuts = false
    /// The page Settings opens on.
    var settingsPage: SettingsPage = .settings
    var showSearch = false
    var showSpeak = false
    /// The month to pick a day from (from the title).
    var showDayPicker = false
    var showAccount = false
    /// Set to open the new-task row on the Day view (the value changes each time).
    var composeRequest: UUID?

    // Keyboard: the selected row and requests the visible list carries out.
    var selectedTask: String?
    /// The open list's task ids, in screen order (for ↑ ↓).
    var visibleTaskIDs: [String] = []
    var toggleRequest: TaskRequest?
    var editRequest: TaskRequest?
    var focusCompleteRequest: UUID?
    var focusCaptureRequest: UUID?

    init(today: DayKey, tab: Tab = .day) {
        self.tab = tab
        if tab.isPlanner { lastPlanner = tab }
        selected = today
        month = today.startOfMonth
    }

    func reset(today: DayKey) {
        selectedTask = nil
        selected = today
        month = today.startOfMonth
        period = .week
        periodOffset = 0
        focus = false
        showSearch = false
        showSpeak = false
        showDayPicker = false
        showAccount = false
    }

    /// Opens a page (Home: the planner view last on screen).
    func open(_ page: Page) {
        switch page {
        case .home: tab = lastPlanner
        case .progress: tab = .analytics
        case .goals: tab = .goals
        case .agent: tab = .agent
        }
    }

    /// Opens a day in the Day view.
    func open(_ day: DayKey) {
        selected = day
        month = day.startOfMonth
        focus = false
        tab = .day
    }

    /// Picks a day without leaving the view (the month picker, the week strip).
    func select(_ day: DayKey) {
        selected = day
        month = day.startOfMonth
        selectedTask = nil
    }

    func goToToday(_ today: DayKey) {
        selected = today
        month = today.startOfMonth
        periodOffset = 0
    }

    /// Whether the screen shows the present (today, this week, this month, the current period).
    func showsPresent(_ today: DayKey) -> Bool {
        switch tab {
        case .day: selected == today
        case .week: selected.startOfWeek == today.startOfWeek
        case .month: month == today.startOfMonth
        case .analytics: periodOffset == 0
        case .goals, .agent: true
        }
    }

    /// ← / →: the previous or next day, week, month or Progress period.
    func step(_ direction: Int) {
        switch tab {
        case .day: selected = selected.adding(days: direction)
        case .week: selected = selected.adding(days: 7 * direction)
        case .month: month = month.addingMonths(direction)
        case .analytics: periodOffset = min(0, periodOffset + direction)
        case .goals, .agent: break
        }
        if tab == .day || tab == .week { month = selected.startOfMonth }
    }

    func newTask() {
        if tab != .day && tab != .week { tab = .day }
        composeRequest = UUID()
    }

    func openSettings(_ page: SettingsPage = .settings) {
        settingsPage = page
        showSettings = true
    }

    /// ⌥↑ / ⌥↓: move the picked task one place up or down its day (the visible list carries it out).
    var nudgeRequest: NudgeRequest?
}

/// "Do this to that task" — each request is new, even for the same task.
struct TaskRequest: Equatable {
    let id: String
    let nonce = UUID()
}

/// "Move that task one place up (-1) or down (+1)" — each request is new, even for the same task.
struct NudgeRequest: Equatable {
    let id: String
    let direction: Int
    let nonce = UUID()
}
