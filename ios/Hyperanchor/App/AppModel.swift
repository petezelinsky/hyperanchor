import Foundation
import Observation
import UIKit
import WidgetKit

/// Build settings from Info.plist (see Config/App.xcconfig).
enum AppConfig {
    static var apiBaseURL: URL {
        let raw = Bundle.main.object(forInfoDictionaryKey: "HAAPIBaseURL") as? String ?? ""
        return URL(string: raw).flatMap { $0.scheme == nil ? nil : $0 } ?? URL(string: "https://hyperanchor.app")!
    }

    /// Empty until a Google OAuth client of type iOS is configured.
    static var googleClientID: String {
        (Bundle.main.object(forInfoDictionaryKey: "HAGoogleClientID") as? String ?? "").trimmingCharacters(in: .whitespaces)
    }

    static let privacyURL = URL(string: "https://hyperanchor.app/privacy")!
    static let termsURL = URL(string: "https://hyperanchor.app/terms")!
}

/// Launch arguments for working without a server: `-demo` (sample data, signed in), `-uitest` (the same,
/// with fresh preferences), plus `-signedOut`, `-offline`, `-today YYYY-MM-DD`, `-appearance light|dark`,
/// `-accent blue|orange|green` and `-tab day|week|month|analytics` for tests and screenshots.
struct LaunchOptions {
    let demo: Bool
    let uiTest: Bool
    let signedOut: Bool
    let offline: Bool
    let today: DayKey?
    let appearance: Preferences.Appearance?
    let accent: AccentChoice?
    let tab: Router.Tab?

    init(_ arguments: [String]) {
        func value(_ name: String) -> String? {
            guard let i = arguments.firstIndex(of: name), i + 1 < arguments.count else { return nil }
            return arguments[i + 1]
        }
        uiTest = arguments.contains("-uitest")
        demo = uiTest || arguments.contains("-demo")
        signedOut = arguments.contains("-signedOut")
        offline = arguments.contains("-offline")
        today = value("-today").flatMap(DayKey.init)
        appearance = value("-appearance").flatMap(Preferences.Appearance.init)
        accent = value("-accent").flatMap(AccentChoice.init)
        tab = value("-tab").flatMap(Router.Tab.init)
    }
}

/// Owns the app's state objects and swaps the task store when the account changes.
@MainActor
@Observable
final class AppModel {
    let launch: LaunchOptions
    let session: Session
    let clock: TodayClock
    let prefs: Preferences
    let toaster = Toaster()
    let router: Router
    /// The signed-in account's tasks; nil while signed out.
    private(set) var store: TaskStore?

    @ObservationIgnored private var account: String?
    @ObservationIgnored private var network: NetworkMonitor?

    init(launch: LaunchOptions = LaunchOptions(ProcessInfo.processInfo.arguments)) {
        self.launch = launch
        clock = TodayClock(fixed: launch.today)
        let backend: Backend = launch.demo
            ? DemoBackend(today: clock.today, latency: launch.uiTest ? .milliseconds(30) : .milliseconds(150), offline: launch.offline)
            : HTTPBackend(baseURL: AppConfig.apiBaseURL)
        session = Session(backend: backend, keychain: launch.demo ? nil : Keychain(), signedIn: launch.demo && !launch.signedOut ? DemoBackend.user : nil)

        let defaults: UserDefaults
        if launch.uiTest {
            defaults = UserDefaults(suiteName: "app.hyperanchor.uitest")!
            defaults.removePersistentDomain(forName: "app.hyperanchor.uitest")
        } else {
            defaults = .standard
        }
        prefs = Preferences(defaults: defaults)
        if let a = launch.appearance { prefs.appearance = a }
        if let a = launch.accent { prefs.accent = a }
        router = Router(today: clock.today, tab: launch.tab ?? .day)

        accountChanged()
        network = NetworkMonitor { [weak self] available in
            guard self?.launch.demo == false else { return }
            self?.store?.networkChanged(available: available)
        }
    }

    /// Call after signing in or out.
    func accountChanged() {
        guard session.accountID != account else { return }
        account = session.accountID
        if session.accountID == nil { clearWidget() }
        store = session.accountID.map { id in
            let cache = launch.demo ? nil : TaskCache(directory: TaskCache.defaultDirectory, account: id)
            let store = TaskStore(backend: session.backend, cache: cache)
            store.onError = { [toaster] message in toaster.show(message) }
            store.onUnauthorized = { [weak self] in
                // Keep the cache: unsent changes go out if the same account signs back in.
                self?.session.expired()
                self?.accountChanged()
            }
            return store
        }
        router.reset(today: clock.today)
    }

    func signOut() {
        store?.reset()
        session.signOut()
        accountChanged()
    }

    /// Signed out (or the session ended): the widget stops showing tasks.
    private func clearWidget() {
        guard !launch.demo else { return }
        WidgetSnapshot(day: "", tasks: [], signedIn: false, accent: [], track: []).save()
        WidgetCenter.shared.reloadAllTimelines()
        AppBadge.set(0)
    }

    /// Back in the foreground: a new day may have started, and the server may have news.
    func becameActive() {
        clock.refresh()
        guard let store else { return }
        Task { await store.refresh() }
    }

    func movedToBackground() {
        store?.flushAll()
    }
}
