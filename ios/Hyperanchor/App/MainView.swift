import SwiftUI
import WidgetKit

/// The four views — Day · Week · Month · Analytics — plus Settings, Focus and the toasts.
struct MainView: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(TaskStore.self) private var store
    @Environment(TodayClock.self) private var clock
    @Environment(Preferences.self) private var prefs
    @Environment(\.palette) private var palette

    var body: some View {
        @Bindable var router = router
        TabView(selection: $router.tab) {
            DayScreen(user: user)
                .tint(.ink)
                .tabItem { Label(Router.Tab.day.label, systemImage: Router.Tab.day.symbol) }
                .tag(Router.Tab.day)
                .accessibilityIdentifier("tab.day")
            WeekScreen(user: user)
                .tint(.ink)
                .tabItem { Label(Router.Tab.week.label, systemImage: Router.Tab.week.symbol) }
                .tag(Router.Tab.week)
            MonthScreen(user: user)
                .tint(.ink)
                .tabItem { Label(Router.Tab.month.label, systemImage: Router.Tab.month.symbol) }
                .tag(Router.Tab.month)
            AnalyticsScreen(user: user)
                .tint(.ink)
                .tabItem { Label(Router.Tab.analytics.label, systemImage: Router.Tab.analytics.symbol) }
                .tag(Router.Tab.analytics)
        }
        .tint(palette.accent)
        .sheet(isPresented: $router.showSettings) {
            SettingsView(user: user)
        }
        .sheet(isPresented: $router.showShortcuts) {
            ShortcutsView()
        }
        .fullScreenCover(isPresented: $router.focus) {
            FocusView()
        }
        .onChange(of: router.tab) { _, _ in router.query = "" }
        .task(id: widgetSnapshot) {
            widgetSnapshot.save()
            WidgetCenter.shared.reloadAllTimelines()
        }
        .task(id: BadgeState(count: store.tasks(on: clock.today).count { !$0.done }, enabled: prefs.showBadge)) {
            AppBadge.set(prefs.showBadge ? store.tasks(on: clock.today).count { !$0.done } : 0)
        }
    }

    /// What the Today widget shows; rewritten (and the widget reloaded) when it changes.
    private var widgetSnapshot: WidgetSnapshot {
        let palette = prefs.accent.palette
        let hex = { (c: RGBA) in UInt32((c.red * 255).rounded()) << 16 | UInt32((c.green * 255).rounded()) << 8 | UInt32((c.blue * 255).rounded()) }
        return WidgetSnapshot(
            day: clock.today.description,
            tasks: store.tasks(on: clock.today).map { WidgetSnapshot.Item(title: $0.title, done: $0.done) },
            signedIn: true,
            accent: [hex(palette.accent.light), hex(palette.accent.dark)],
            track: [hex(palette.accentTrack.light), hex(palette.accentTrack.dark)]
        )
    }

    private struct BadgeState: Hashable {
        let count: Int
        let enabled: Bool
    }
}

extension View {
    /// Each tab shows toasts above its own bottom edge (so above the tab bar).
    func toastHost() -> some View {
        overlay(alignment: .bottom) { ToastOverlay() }
    }
}

/// The avatar in the navigation bar; opens the account menu.
struct AccountMenu: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(AppModel.self) private var model
    @State private var legal: URL?

    var body: some View {
        Menu {
            Section(user.email) {
                Button("Settings", systemImage: "gearshape") { router.showSettings = true }
                if UIDevice.current.userInterfaceIdiom == .pad {
                    Button("Keyboard Shortcuts", systemImage: "keyboard") { router.showShortcuts = true }
                }
            }
            Section {
                Button("Privacy Policy", systemImage: "hand.raised") { legal = AppConfig.privacyURL }
                Button("Terms of Service", systemImage: "doc.text") { legal = AppConfig.termsURL }
            }
            Section {
                Button("Sign Out", systemImage: "rectangle.portrait.and.arrow.right") { model.signOut() }
            }
        } label: {
            Avatar(user: user, size: 30)
        }
        .accessibilityLabel("Account")
        .accessibilityIdentifier("account")
        .sheet(item: $legal) { SafariView(url: $0).ignoresSafeArea() }
    }
}
