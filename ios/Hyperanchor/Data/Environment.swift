import Foundation
import Network
import Observation
import UIKit
import UserNotifications

/// Today's date, kept current: on returning to the app, at midnight and when the clock or time zone changes.
@MainActor
@Observable
final class TodayClock {
    private(set) var today: DayKey
    @ObservationIgnored private var midnight: Task<Void, Never>?
    @ObservationIgnored private var observers: [NSObjectProtocol] = []
    @ObservationIgnored private let fixed: Bool

    /// `fixed` pins the date (UI tests and screenshots).
    init(fixed: DayKey? = nil) {
        today = fixed ?? .today()
        self.fixed = fixed != nil
        guard !self.fixed else { return }
        for name in [UIApplication.significantTimeChangeNotification, Notification.Name.NSSystemTimeZoneDidChange, Notification.Name.NSCalendarDayChanged] {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.refresh() }
            })
        }
        scheduleMidnight()
    }

    func refresh() {
        guard !fixed else { return }
        let now = DayKey.today()
        if now != today { today = now }
        scheduleMidnight()
    }

    private func scheduleMidnight() {
        midnight?.cancel()
        let next = today.adding(days: 1).date()
        midnight = Task { [weak self] in
            try? await Task.sleep(for: .seconds(max(1, next.timeIntervalSinceNow + 1)))
            guard !Task.isCancelled else { return }
            self?.refresh()
        }
    }
}

/// Reports when the device gains or loses a network connection.
final class NetworkMonitor: Sendable {
    private let monitor = NWPathMonitor()

    init(onChange: @escaping @MainActor @Sendable (Bool) -> Void) {
        monitor.pathUpdateHandler = { path in
            let available = path.status == .satisfied
            Task { @MainActor in onChange(available) }
        }
        monitor.start(queue: DispatchQueue(label: "app.hyperanchor.network"))
    }

    deinit { monitor.cancel() }
}

/// A short message at the bottom of the screen, optionally with Undo.
@MainActor
@Observable
final class Toaster {
    struct Toast: Identifiable, Equatable {
        let id = UUID()
        let message: String
        let actionLabel: String?
        let action: (@MainActor () -> Void)?

        static func == (a: Toast, b: Toast) -> Bool { a.id == b.id }
    }

    private(set) var current: Toast?
    @ObservationIgnored private var hide: Task<Void, Never>?

    func show(_ message: String, action: String? = nil, perform: (@MainActor () -> Void)? = nil) {
        let toast = Toast(message: message, actionLabel: action, action: perform)
        current = toast
        UIAccessibility.post(notification: .announcement, argument: action == nil ? message : "\(message). \(action!) available.")
        hide?.cancel()
        hide = Task { [weak self] in
            try? await Task.sleep(for: .seconds(perform == nil ? 4 : 6))
            guard !Task.isCancelled, self?.current?.id == toast.id else { return }
            self?.current = nil
        }
    }

    func runAction() {
        current?.action?()
        dismiss()
    }

    func dismiss() {
        hide?.cancel()
        current = nil
    }
}

/// Settings remembered on this device (as the web keeps them in localStorage): appearance, accent, the first day of
/// the week, the task order, the focus timer, sounds, the spoken language, the sidebar on iPad.
@MainActor
@Observable
final class Preferences {
    enum Appearance: String, CaseIterable, Identifiable {
        case light, dark
        var id: String { rawValue }
        var label: String { self == .light ? "Light" : "Dark" }
    }

    /// Light or Dark, once picked; until then (nil) the device's setting, as on the web.
    var appearance: Appearance? {
        didSet { defaults.set(appearance?.rawValue, forKey: "appearance") }
    }

    var accent: AccentChoice {
        didSet { defaults.set(accent.rawValue, forKey: "accent") }
    }

    /// Whether the Day view's Done fold is open.
    var completedExpanded: Bool {
        didSet { defaults.set(completedExpanded, forKey: "completedExpanded") }
    }

    /// The first day of the week: 1 = Monday (the default), 0 = Sunday. In Week, Month and Progress.
    var weekStart: Int {
        didSet {
            defaults.set(weekStart, forKey: "weekStart")
            DayKey.weekStart = weekStart
        }
    }

    /// How a day's tasks are ordered (Settings → Task order): the person's own order by default.
    var sort: TaskSort {
        didSet { defaults.set(try? JSONEncoder().encode(sort), forKey: "sort") }
    }

    /// The focus timer's length in minutes (5…60, 25 by default), remembered once chosen.
    var focusMinutes: Int {
        didSet { defaults.set(focusMinutes, forKey: "focusMinutes") }
    }

    /// A soft chime when the focus timer is up.
    var sounds: Bool {
        didSet { defaults.set(sounds, forKey: "sounds") }
    }

    /// The language speech is heard in ("ru"); nil: worked out from the person's tasks and the device.
    var voiceLanguage: String? {
        didSet { defaults.set(voiceLanguage, forKey: "voiceLanguage") }
    }

    /// iPad: the sidebar is hidden (its button or `[` brings it back).
    var sidebarHidden: Bool {
        didSet { defaults.set(sidebarHidden, forKey: "sidebarHidden") }
    }

    /// The first-run note with examples has been seen (or dismissed).
    var welcomed: Bool {
        didSet { defaults.set(welcomed, forKey: "welcomed") }
    }

    /// Today's open tasks as a badge on the app icon (like the web's tab title).
    var showBadge: Bool {
        didSet { defaults.set(showBadge, forKey: "showBadge") }
    }

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        appearance = Appearance(rawValue: defaults.string(forKey: "appearance") ?? "")
        accent = AccentChoice(rawValue: defaults.string(forKey: "accent") ?? "") ?? .default
        completedExpanded = defaults.object(forKey: "completedExpanded") as? Bool ?? true
        showBadge = defaults.bool(forKey: "showBadge")
        weekStart = defaults.object(forKey: "weekStart") as? Int == 0 ? 0 : 1
        sort = defaults.data(forKey: "sort").flatMap { try? JSONDecoder().decode(TaskSort.self, from: $0) } ?? .manual
        focusMinutes = min(60, max(5, defaults.object(forKey: "focusMinutes") as? Int ?? 25))
        sounds = defaults.object(forKey: "sounds") as? Bool ?? true
        voiceLanguage = defaults.string(forKey: "voiceLanguage")
        sidebarHidden = defaults.bool(forKey: "sidebarHidden")
        welcomed = defaults.bool(forKey: "welcomed")
        DayKey.weekStart = weekStart
    }
}

/// The app icon's badge: how many tasks are still open today.
@MainActor
enum AppBadge {
    /// Asks for permission to badge the icon; false if the person declined.
    static func requestPermission() async -> Bool {
        (try? await UNUserNotificationCenter.current().requestAuthorization(options: [.badge])) ?? false
    }

    static func set(_ count: Int) {
        UNUserNotificationCenter.current().setBadgeCount(count)
    }
}
