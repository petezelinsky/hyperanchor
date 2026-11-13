import SwiftUI

/// The bar on top of the work area (`AppBar` in Sidebar.tsx). iPad: one row in three parts that never crowd each
/// other — the arrows, the page's name and date and the way back to the present; the switch in the middle; the day's
/// count and Focus on the right. iPhone: two rows — the name of the app, the switch and the account; then the arrows,
/// the date and the page's actions.
struct AppBar: View {
    let user: AppUser
    let wide: Bool
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(TaskStore.self) private var store
    @Environment(Preferences.self) private var prefs
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let bar = BarModel(router: router, today: clock.today)
        if wide {
            HStack(spacing: 16) {
                HStack(spacing: 8) {
                    if prefs.sidebarHidden {
                        Button {
                            withAnimation(Motion.choose(Motion.out(), reduceMotion: reduceMotion)) { prefs.sidebarHidden = false }
                        } label: {
                            Image(systemName: Icon.sidebar).font(.system(size: 15)).foregroundStyle(.ink2).tapTarget(36)
                        }
                        .buttonStyle(PressableStyle())
                        .accessibilityLabel("Show sidebar")
                    }
                    left(bar, short: false)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                center
                HStack(spacing: 12) {
                    if prefs.sidebarHidden { SyncStatus() }
                    actions(wide: true)
                }
                .frame(maxWidth: .infinity, alignment: .trailing)
            }
            .padding(.horizontal, 16)
            .frame(height: 56)
            .background(.surface)
            .hairline(.bottom)
        } else {
            VStack(spacing: 0) {
                HStack(spacing: 12) {
                    Wordmark()
                    Spacer(minLength: 8)
                    center
                    AccountButton(user: user)
                }
                .padding(.horizontal, 16)
                .frame(height: 52)
                HStack(spacing: 12) {
                    left(bar, short: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                    HStack(spacing: 10) {
                        SyncStatus(short: true)
                        actions(wide: false)
                    }
                    .fixedSize()
                }
                .padding(.horizontal, 16)
                .frame(height: 48)
                .hairline(.bottom)
            }
            .background(.surface)
        }
    }

    /// The arrows, then the name and the date (the arrows first, so they stay put however long the date is), and the
    /// way back to the present.
    private func left(_ bar: BarModel, short: Bool) -> some View {
        HStack(spacing: 4) {
            if let nav = bar.nav {
                StepperArrows(prevLabel: nav.prev, nextLabel: nav.next, nextDisabled: nav.nextDisabled,
                              onPrev: { step(-1) }, onNext: { step(1) })
                    .padding(.trailing, 4)
            }
            title(bar.head, short: short)
            if let back = bar.nav?.back {
                Button {
                    withAnimation(Motion.choose(Motion.settle, reduceMotion: reduceMotion)) { router.goToToday(clock.today) }
                } label: {
                    Image(systemName: Icon.back)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.ink2)
                        .frame(width: 28, height: 28)
                        .tapTarget()
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel(back)
                .transition(.opacity)
            }
        }
    }

    @ViewBuilder
    private func title(_ head: BarModel.Head, short: Bool) -> some View {
        let words = HStack(alignment: .firstTextBaseline, spacing: 8) {
            Text(head.title)
                .font(.system(.headline, weight: .semibold))
                .tracking(-0.24)
                .foregroundStyle(.ink)
                .lineLimit(1)
                .fixedSize()
            if let soft = short ? (head.softShort ?? head.soft) : head.soft {
                Text(soft)
                    .font(.subheadline)
                    .monospacedDigit()
                    .foregroundStyle(.ink3)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
        }
        .padding(.horizontal, 8)
        .frame(height: 32)

        if head.picksDay {
            Button {
                router.showDayPicker.toggle()
            } label: {
                words
                    .background(router.showDayPicker ? Color.surface3 : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                    .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityHint("Pick a day")
            .popover(isPresented: Binding(get: { router.showDayPicker }, set: { router.showDayPicker = $0 }), arrowEdge: .top) {
                DayPicker()
                    .presentationCompactAdaptation(.popover)
            }
        } else {
            words
        }
    }

    @ViewBuilder
    private var center: some View {
        if router.tab == .analytics {
            SegmentedSwitch(label: "Period", options: Stats.Period.allCases.map { ($0, $0.label) },
                            selection: Binding(get: { router.period }, set: { router.period = $0; router.periodOffset = 0 }),
                            compact: !wide)
        } else if router.tab.isPlanner {
            SegmentedSwitch(label: "View", options: Router.Tab.planner.map { ($0, $0.label) },
                            selection: Binding(get: { router.tab }, set: { show($0) }),
                            compact: !wide)
                .accessibilityIdentifier("viewSwitch")
        }
    }

    /// The page's own actions, on the right: how much of the day is done, beside Focus.
    @ViewBuilder
    private func actions(wide: Bool) -> some View {
        if router.tab.isPlanner {
            if router.tab == .day {
                let list = store.tasks(on: router.selected)
                DayCount(done: list.count { $0.done }, total: list.count)
            }
            let hasOpen = store.tasks(on: router.tab == .day ? router.selected : clock.today).contains { !$0.done }
            Button {
                if router.tab != .day { router.tab = .day }
                router.focus = true
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: Icon.focus).font(.system(size: 13, weight: .regular))
                    if wide { Text("Focus").font(.footnote.weight(.medium)) }
                }
                .foregroundStyle(hasOpen ? .ink : .ink4)
                .padding(.horizontal, wide ? 10 : 0)
                .frame(width: wide ? nil : 32, height: 32)
                .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1))
                .tapTarget()
            }
            .buttonStyle(PressableStyle())
            .disabled(!hasOpen)
            .accessibilityLabel("Focus")
            .accessibilityHint("One task at a time")
            .accessibilityIdentifier("focus")
        }
    }

    private func step(_ direction: Int) {
        withAnimation(Motion.choose(Motion.settle, reduceMotion: reduceMotion)) { router.step(direction) }
    }

    private func show(_ tab: Router.Tab) {
        router.selectedTask = nil
        if tab == .month { router.month = router.selected.startOfMonth }
        router.tab = tab
    }
}

/// The avatar (iPhone, top right); opens the account panel.
struct AccountButton: View {
    let user: AppUser
    @Environment(Router.self) private var router

    var body: some View {
        Button {
            router.showAccount = true
        } label: {
            Avatar(user: user, size: 30)
                .tapTarget()
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("\(user.name): account")
        .accessibilityIdentifier("account")
        .popover(isPresented: Binding(get: { router.showAccount }, set: { router.showAccount = $0 }), arrowEdge: .top) {
            AccountPanel(user: user, phone: true)
                .presentationCompactAdaptation(.popover)
        }
    }
}
