import SwiftUI

/// The four views — Day · Week · Month · Analytics — plus Settings, Focus and the toasts.
struct MainView: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(TaskStore.self) private var store
    @Environment(TodayClock.self) private var clock
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
