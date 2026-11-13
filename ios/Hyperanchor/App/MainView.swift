import SwiftUI
import WidgetKit

/// Edge to edge, as on the web: on iPad the sidebar on the left (it can be hidden) and the work area beside it with
/// its bar on top; on iPhone the bar's two rows on top and the page under them. Focus, Speak, Search and Settings
/// open over it.
struct MainView: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(TaskStore.self) private var store
    @Environment(TodayClock.self) private var clock
    @Environment(Preferences.self) private var prefs
    @Environment(\.palette) private var palette
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        @Bindable var router = router
        let wide = sizeClass == .regular
        HStack(spacing: 0) {
            if wide && !prefs.sidebarHidden {
                Sidebar(user: user)
                    .transition(.move(edge: .leading))
            }
            VStack(spacing: 0) {
                AppBar(user: user, wide: wide)
                PageContent(user: user)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .toastHost()
        }
        .background(.surface)
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
        .fullScreenCover(isPresented: $router.showSpeak) {
            SpeakView()
        }
        // An open Today follows midnight (and a change of time zone).
        .onChange(of: clock.today) { old, new in
            if router.selected == old { router.select(new) }
        }
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
    /// Toasts show above the bottom edge of the work area.
    func toastHost() -> some View {
        overlay(alignment: .bottom) { ToastOverlay() }
    }
}

/// The page on screen: Home's day, week or month; Progress; Goals and Agent (coming).
struct PageContent: View {
    let user: AppUser
    @Environment(Router.self) private var router

    var body: some View {
        switch router.tab {
        case .day: DayScreen(user: user)
        case .week: WeekScreen(user: user)
        case .month: MonthScreen(user: user)
        case .analytics: AnalyticsScreen(user: user)
        case .goals: SoonPage(page: .goals)
        case .agent: SoonPage(page: .agent)
        }
    }
}
