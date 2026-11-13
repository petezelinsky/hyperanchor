import SwiftUI

/// iPad: the bar on top of the work area (`AppBar` in Sidebar.tsx), one row in three parts that never crowd each other.
/// On the left, what's on screen: the arrows, then its name and date (the arrows come first, so they stay put however
/// long the date is), and the way back to the present once away from it. In the middle, the switch (Day / Week / Month,
/// or Progress's periods). On the right, the day's count beside Focus. With the sidebar hidden, the button that brings
/// it back is the only thing before the arrows, and saving's status moves to the right.
struct AppBar: View {
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Preferences.self) private var prefs

    var body: some View {
        let bar = BarModel(router: router, today: clock.today)
        HStack(spacing: 16) {
            HStack(spacing: 8) {
                if prefs.sidebarHidden {
                    SidebarButton(hide: false)
                        .padding(.leading, -4)
                }
                BarLeading(bar: bar, wide: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            BarSwitch()
            HStack(spacing: 12) {
                if prefs.sidebarHidden { SyncStatus() }
                BarActions(wide: true)
            }
            .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 56)
        .background(.surface)
        .hairline(.bottom)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}

/// iPhone, the first row: the app's name, the switch and the account. It stays on top while the page scrolls and draws
/// its edge only once something is under it. Where the row is short of room (large text), the switch narrows, then the
/// name steps aside.
struct PhoneTopBar: View {
    let user: AppUser
    /// Something has scrolled under the row.
    let scrolled: Bool

    var body: some View {
        HStack(spacing: 12) {
            ViewThatFits(in: .horizontal) {
                row(name: true, compact: false)
                row(name: true, compact: true)
                row(name: false, compact: true)
            }
            AccountButton(user: user)
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 52)
        .background(.surface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(.line).frame(height: 1).opacity(scrolled ? 1 : 0)
        }
        .animation(.easeOut(duration: Tokens.Motion.fast), value: scrolled)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }

    private func row(name: Bool, compact: Bool) -> some View {
        HStack(spacing: 12) {
            if name { Wordmark(size: 17) }
            Spacer(minLength: 0)
            BarSwitch(compact: compact)
        }
    }
}

/// iPhone, the second row: the arrows, the page's name and date and the way back; saving, the day's count and Focus.
/// It scrolls away with the page (MainView slides it up under the first row).
struct PhoneDateBar: View {
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock

    var body: some View {
        let bar = BarModel(router: router, today: clock.today)
        HStack(spacing: 12) {
            BarLeading(bar: bar, wide: false)
                .frame(maxWidth: .infinity, alignment: .leading)
            HStack(spacing: 10) {
                SyncStatus(short: true)
                BarActions(wide: false)
            }
            .fixedSize()
        }
        .padding(.horizontal, 16)
        .frame(minHeight: 48)
        .background(.surface)
        .hairline(.bottom)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
    }
}

/// The arrows, the name and the date, and the way back to the present.
struct BarLeading: View {
    let bar: BarModel
    /// iPad: the date in full where it fits.
    let wide: Bool
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: 4) {
            if let nav = bar.nav {
                StepperArrows(prevLabel: nav.prev, nextLabel: nav.next, nextDisabled: nav.nextDisabled,
                              onPrev: { step(-1) }, onNext: { step(1) })
            }
            BarTitle(head: bar.head, wide: wide)
                .layoutPriority(1)
            if let back = bar.nav?.back {
                ReturnButton(label: back) {
                    withAnimation(Motion.choose(Motion.settle, reduceMotion: reduceMotion)) { router.goToToday(clock.today) }
                }
                // It pops in (just fades with Reduce Motion) and leaves in 110 ms.
                .transition(.asymmetric(insertion: reduceMotion ? .opacity.animation(Motion.reduced)
                                            : .opacity.combined(with: .scale(scale: 0.96)).animation(Motion.out(Tokens.Motion.fast)),
                                        removal: .opacity.animation(Motion.exit)))
            }
        }
        // Without arrows the name lines up with the edge.
        .padding(.leading, bar.nav == nil ? -8 : 0)
    }

    private func step(_ direction: Int) {
        router.selectedTask = nil
        router.step(direction)
    }
}

/// The page's name and the date beside it, on one baseline (Day: "Today  Friday, November 13"). Day's and Week's are a
/// button that opens the month to pick a day from. The date is given in full where there's room, else short, else cut.
struct BarTitle: View {
    let head: BarModel.Head
    let wide: Bool
    @Environment(Router.self) private var router

    var body: some View {
        if head.picksDay {
            Button {
                router.showDayPicker.toggle()
            } label: {
                words
                    .background(router.showDayPicker ? Color.surface3 : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                    .contentShape(TallerShape(by: 6))
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel(spoken)
            .accessibilityHint("Pick a day")
            .accessibilityIdentifier("bar.title")
            .popover(isPresented: Binding(get: { wide && router.showDayPicker }, set: { router.showDayPicker = $0 }), arrowEdge: .top) {
                DayPicker(large: false)
                    .frame(width: 284)
                    .presentationCompactAdaptation(.popover)
            }
        } else {
            words
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(spoken)
                .accessibilityAddTraits(.isHeader)
                .accessibilityIdentifier("bar.title")
        }
    }

    private var words: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(head.title)
                .font(.token(Tokens.Typography.headline, weight: .semibold))
                .tracking(-0.014 * 17)
                .foregroundStyle(.ink)
                .lineLimit(1)
                .fixedSize()
            if let soft = head.soft {
                ViewThatFits(in: .horizontal) {
                    if wide { date(soft) }
                    date(head.softShort ?? soft)
                    date(head.softShort ?? soft).truncationMode(.tail).frame(minWidth: 0)
                }
            }
        }
        .padding(.horizontal, 8)
        .frame(minHeight: 32)
    }

    private func date(_ text: String) -> some View {
        Text(text)
            .font(.token(Tokens.Typography.body))
            .monospacedDigit()
            .foregroundStyle(.ink3)
            .lineLimit(1)
    }

    private var spoken: String {
        head.soft.map { "\(head.title), \($0)" } ?? head.title
    }
}

/// The switch in the middle: Day / Week / Month, or Progress's periods. Nothing on Goals and Agent.
struct BarSwitch: View {
    var compact = false
    @Environment(Router.self) private var router

    var body: some View {
        if router.tab == .analytics {
            SegmentedSwitch(label: "Period", options: Stats.Period.allCases.map { ($0, $0.label) },
                            selection: Binding(get: { router.period }, set: { router.period = $0; router.periodOffset = 0 }),
                            compact: compact)
                .accessibilityIdentifier("periodSwitch")
        } else if router.tab.isPlanner {
            SegmentedSwitch(label: "View", options: Router.Tab.planner.map { ($0, $0.label) },
                            selection: Binding(get: { router.tab }, set: { router.show($0) }),
                            compact: compact)
                .accessibilityIdentifier("viewSwitch")
        }
    }
}

/// What the planner offers on the right: how much of the day on screen is done (Day), beside Focus.
struct BarActions: View {
    let wide: Bool
    @Environment(Router.self) private var router
    @Environment(TaskStore.self) private var store

    var body: some View {
        if router.tab.isPlanner {
            if router.tab == .day {
                let list = store.tasks(on: router.selected)
                DayCount(done: list.count { $0.done }, total: list.count)
                    .accessibilityIdentifier("bar.count")
            }
            FocusButton(wide: wide)
        }
    }
}

/// Focus: one task at a time, on the day picked (a plain outlined button; just the sign on iPhone). Off when the day has
/// nothing left to do.
struct FocusButton: View {
    let wide: Bool
    @Environment(Router.self) private var router
    @Environment(TaskStore.self) private var store

    var body: some View {
        let hasOpen = store.tasks(on: router.selected).contains { !$0.done }
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
        Button {
            router.startFocus(hasOpen: hasOpen)
        } label: {
            HStack(spacing: 6) {
                FocusGlyph(size: 15)
                if wide {
                    Text("Focus").font(.token(Tokens.Typography.footnote, weight: .medium))
                }
            }
            .foregroundStyle(.ink)
            .padding(.leading, wide ? 10 : 0)
            .padding(.trailing, wide ? 12 : 0)
            .frame(width: wide ? nil : 32, height: 32)
            .background(.surface, in: shape)
            .overlay(shape.strokeBorder(.line2, lineWidth: 1))
            .opacity(hasOpen ? 1 : 0.4)
            .tapArea()
        }
        .buttonStyle(PressableStyle())
        .disabled(!hasOpen)
        .accessibilityLabel("Focus")
        .accessibilityHint("One task at a time")
        .accessibilityIdentifier("focus")
    }
}

/// The avatar (iPhone, top right): opens the account panel. Ringed while the panel is open.
struct AccountButton: View {
    let user: AppUser
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        Button {
            router.showAccount = true
        } label: {
            Avatar(user: user, size: 30)
                .padding(3.5)
                .overlay {
                    Circle().strokeBorder(.ink, lineWidth: 1.5).opacity(router.showAccount ? 1 : 0)
                }
                .padding(-3.5)
                .contentShape(Circle().inset(by: -7))
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("\(user.name): account")
        .accessibilityIdentifier("account")
        .popover(isPresented: $router.showAccount, arrowEdge: .top) {
            AccountPanel(user: user, phone: true)
                .presentationCompactAdaptation(.popover)
        }
    }
}

/// Shows or hides the sidebar (iPad); `[` does the same.
struct SidebarButton: View {
    /// In the sidebar's head (it hides it); otherwise in the bar (it brings it back).
    let hide: Bool
    @Environment(Preferences.self) private var prefs
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button {
            withAnimation(Motion.choose(Motion.out(), reduceMotion: reduceMotion)) { prefs.sidebarHidden.toggle() }
        } label: {
            Image(systemName: Icon.sidebar)
                .font(.system(size: 15, weight: .regular))
                .foregroundStyle(hide ? .ink3 : .ink2)
                .frame(width: hide ? 28 : 32, height: hide ? 28 : 32)
                .tapArea(hide ? 8 : 6)
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(hide ? "Hide sidebar" : "Show sidebar")
        .accessibilityIdentifier(hide ? "sidebar.hide" : "sidebar.show")
    }
}

extension Router {
    /// The switch and D / W / M (`showView` on the web): a planner view, picking no task; Month shows the picked day's month.
    func show(_ view: Tab) {
        selectedTask = nil
        if view != .day { focus = false }
        if view == .month { month = selected.startOfMonth }
        tab = view
    }

    /// Home (sidebar, account panel): from another page, the planner view last on screen; from Home itself, today.
    func goHome(today: DayKey) {
        focus = false
        if page == .home {
            goToToday(today)
            show(.day)
        } else {
            open(.home)
        }
    }

    /// Focus, from the bar or `F`: on the day picked, when there's something left to do.
    func startFocus(hasOpen: Bool) {
        if tab != .day { show(.day) }
        if hasOpen { focus = true }
    }
}
