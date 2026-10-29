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

/// Appearance, remembered on this device (as on the web).
@MainActor
@Observable
final class Preferences {
    enum Appearance: String, CaseIterable, Identifiable {
        case light, system, dark
        var id: String { rawValue }
        var label: String {
            switch self {
            case .light: "Light"
            case .system: "Auto"
            case .dark: "Dark"
            }
        }
    }

    var appearance: Appearance {
        didSet { defaults.set(appearance.rawValue, forKey: "appearance") }
    }

    var accent: AccentChoice {
        didSet { defaults.set(accent.rawValue, forKey: "accent") }
    }

    /// Whether the Day view's Completed group is expanded.
    var completedExpanded: Bool {
        didSet { defaults.set(completedExpanded, forKey: "completedExpanded") }
    }

    /// Today's open tasks as a badge on the app icon (like the web's tab title).
    var showBadge: Bool {
        didSet { defaults.set(showBadge, forKey: "showBadge") }
    }

    @ObservationIgnored private let defaults: UserDefaults

    init(defaults: UserDefaults = .standard) {
        self.defaults = defaults
        appearance = Appearance(rawValue: defaults.string(forKey: "appearance") ?? "") ?? .system
        accent = AccentChoice(rawValue: defaults.string(forKey: "accent") ?? "") ?? .default
        completedExpanded = defaults.object(forKey: "completedExpanded") as? Bool ?? true
        showBadge = defaults.bool(forKey: "showBadge")
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
