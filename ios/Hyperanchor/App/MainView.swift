import SwiftUI
import WidgetKit

/// Edge to edge, as on the web: on iPad the sidebar on the left (it can be hidden) and the work area beside it with one
/// bar on top; on iPhone the bar's two rows on top — the first stays put, the second scrolls away with the page — and the
/// page under them. Focus, Speak, Search, Settings and the month to pick a day from open over it.
struct MainView: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(TaskStore.self) private var store
    @Environment(TodayClock.self) private var clock
    @Environment(Preferences.self) private var prefs
    @Environment(Toaster.self) private var toaster
    @Environment(AppModel.self) private var model
    @Environment(\.palette) private var palette
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @State private var sync = SyncState()
    /// iPhone: how far the page has scrolled; the bar's second row goes up with it.
    @State private var scrolled: CGFloat = 0
    @State private var dateBarHeight: CGFloat = 48
    @State private var askUndo = false

    var body: some View {
        @Bindable var router = router
        let wide = sizeClass == .regular
        HStack(spacing: 0) {
            if wide && !prefs.sidebarHidden {
                Sidebar(user: user)
                    .transition(reduceMotion ? .opacity : .move(edge: .leading))
            }
            VStack(spacing: 0) {
                if wide {
                    AppBar()
                }
                // iPhone: both rows sit on the page, so it scrolls on under them. The second slides up under the first;
                // where the first turns to glass (iOS 26), the second fades as it goes, so only the page shows through.
                let slide = min(max(scrolled, 0), dateBarHeight)
                let glass = PhoneTopBar.usesGlass(reduceTransparency: reduceTransparency)
                PageContent(user: user)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .safeAreaInset(edge: .top, spacing: 0) {
                        if !wide {
                            PhoneDateBar()
                                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { dateBarHeight = $0 }
                                .offset(y: -slide)
                                .opacity(glass ? 1 - slide / max(dateBarHeight, 1) : 1)
                        }
                    }
                    .safeAreaInset(edge: .top, spacing: 0) {
                        if !wide {
                            PhoneTopBar(user: user, scrolled: scrolled > 4)
                        }
                    }
                    .modifier(ScrollTracker(offset: $scrolled, enabled: !wide))
            }
            // iPhone's Day keeps New task and Speak in a bar at the bottom: toasts float above it.
            .toastHost(bottom: wide ? 24 : 20, lift: !wide && router.tab == .day ? 64 : 0)
        }
        .background(.surface)
        .tint(palette.accent)
        .environment(sync)
        .sheet(isPresented: $router.showSettings) {
            SettingsView(user: user)
        }
        .sheet(isPresented: $router.showSearch) {
            SearchView()
        }
        .sheet(isPresented: Binding(get: { !wide && router.showDayPicker }, set: { router.showDayPicker = $0 })) {
            DayPickerSheet()
        }
        .fullScreenCover(isPresented: $router.focus) {
            FocusView()
        }
        .fullScreenCover(isPresented: $router.showSpeak) {
            SpeakView()
        }
        // Shaking the iPhone takes back the last action, after asking (as iOS does everywhere).
        .alert("Undo the last action?", isPresented: $askUndo) {
            Button("Cancel", role: .cancel) {}
            Button("Undo") { model.keyboard.undo() }
        }
        .onReceive(NotificationCenter.default.publisher(for: .deviceDidShake)) { _ in
            guard store.undoCount > 0, !router.showSettings, !router.showSearch, !router.showDayPicker, !router.showAccount, !router.focus, !router.showSpeak else { return }
            askUndo = true
        }
        // The keyboard shortcut list now lives in Settings.
        .onChange(of: router.showShortcuts) { _, show in
            guard show else { return }
            router.showShortcuts = false
            router.openSettings(.shortcuts)
        }
        // A new page starts with its bar in place.
        .onChange(of: router.tab) { _, _ in scrolled = 0 }
        // An open Today follows midnight (and a change of time zone).
        .onChange(of: clock.today) { old, new in
            if router.selected == old { router.select(new) }
        }
        // Saving shows only when it takes a moment: quick saves don't flash "Saving…".
        .task(id: store.pendingCount > 0) {
            guard store.pendingCount > 0 else { sync.slow = false; return }
            try? await Task.sleep(for: .milliseconds(700))
            if !Task.isCancelled { sync.slow = store.pendingCount > 0 }
        }
        .task { await AIOffer.shared.refresh(model.session.backend) }
        .onDisappear { AIOffer.shared.reset() }
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

/// iPhone: follows how far the page on screen has scrolled (iOS 18 and later; before, the bar's second row stays).
private struct ScrollTracker: ViewModifier {
    @Binding var offset: CGFloat
    let enabled: Bool

    func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            // A sideways strip inside the page (wider than it is shown) doesn't move the bar.
            content.onScrollGeometryChange(for: CGFloat?.self) { g in
                g.contentSize.width > g.containerSize.width + 1 ? nil : g.contentOffset.y + g.contentInsets.top
            } action: { _, y in
                if enabled, let y { offset = y }
            }
        } else {
            content
        }
    }
}

/// iPhone: the month to pick a day from, in a sheet as tall as it is.
private struct DayPickerSheet: View {
    @State private var height: CGFloat = 360

    var body: some View {
        DayPicker(large: true)
            .padding(.horizontal, 12)
            .padding(.top, 14)
            .padding(.bottom, 8)
            .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
            .frame(maxHeight: .infinity, alignment: .top)
            .presentationDetents([.height(height)])
            .presentationBackground(.elevated)
            .presentationCornerRadius(Tokens.Radius.card + 8)
    }
}

extension View {
    /// Toasts show above the bottom edge of the area this is applied to (20 pt on iPhone, 24 on iPad, as on the web),
    /// lifted above a bar the page keeps at the bottom: by what the page says with `toastInset(_:)`, else by `lift`.
    func toastHost(bottom: CGFloat = 20, lift: CGFloat = 0) -> some View {
        overlayPreferenceValue(ToastInsetKey.self) { inset in
            ToastOverlay(bottom: bottom + (inset ?? lift))
        }
    }

    /// A page with a bar of its own at the bottom (iPhone's Day: New task and Speak) gives its height here, and toasts
    /// float that much higher.
    func toastInset(_ height: CGFloat) -> some View {
        preference(key: ToastInsetKey.self, value: height)
    }
}

/// How high a page's own bottom bar is (nil: it has none).
struct ToastInsetKey: PreferenceKey {
    static let defaultValue: CGFloat? = nil

    static func reduce(value: inout CGFloat?, nextValue: () -> CGFloat?) {
        if let next = nextValue() { value = max(value ?? 0, next) }
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
        case .goals: ComingSoon(page: .goals)
        case .agent: ComingSoon(page: .agent)
        }
    }
}
