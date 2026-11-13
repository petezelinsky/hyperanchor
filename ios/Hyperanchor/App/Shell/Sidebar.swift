import SwiftUI

/// iPad: the sidebar on the left for the whole height, and it can be hidden. The name on top, the pages (Home: the day,
/// the week, the month; Progress; Goals and Agent, coming), and the account at the foot (`Sidebar` in Sidebar.tsx).
struct Sidebar: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(Preferences.self) private var prefs
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var account = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Wordmark()
                Spacer()
                Button {
                    withAnimation(Motion.choose(Motion.out(), reduceMotion: reduceMotion)) { prefs.sidebarHidden = true }
                } label: {
                    Image(systemName: Icon.sidebar).font(.system(size: 15)).foregroundStyle(.ink3).tapTarget(36)
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Hide sidebar")
            }
            .padding(.leading, 18)
            .padding(.trailing, 8)
            .frame(height: 56)

            VStack(spacing: 2) {
                ForEach(Router.Page.allCases) { page in
                    PageRow(page: page, current: router.page == page) {
                        router.focus = false
                        router.open(page)
                    }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 12)

            Spacer(minLength: 0)
            SyncStatus().padding(.horizontal, 18).padding(.bottom, 6)

            Button { account = true } label: {
                HStack(spacing: 10) {
                    Avatar(user: user, size: 30)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(user.name).font(.footnote.weight(.semibold)).foregroundStyle(.ink).lineLimit(1)
                        Text(user.email).font(.caption).foregroundStyle(.ink3).lineLimit(1).truncationMode(.middle)
                    }
                    Spacer(minLength: 4)
                    Image(systemName: "ellipsis").rotationEffect(.degrees(90)).font(.system(size: 13)).foregroundStyle(.ink3)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
                .background(account ? Color.surface3 : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .padding(.horizontal, 8)
            .padding(.bottom, 10)
            .accessibilityLabel("\(user.name): account")
            .accessibilityIdentifier("account")
            .popover(isPresented: $account, arrowEdge: .leading) {
                AccountPanel(user: user, phone: false)
            }
        }
        .frame(width: 248)
        .frame(maxHeight: .infinity)
        .background(.canvas)
        .overlay(alignment: .trailing) { Rectangle().fill(.line).frame(width: 1) }
    }
}

/// A page in the sidebar or the account panel: its icon and name, Soon when it isn't built, raised when current.
struct PageRow: View {
    let page: Router.Page
    let current: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: Icon.symbol(for: page))
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(current ? .ink : .ink2)
                    .frame(width: 18)
                Text(page.label)
                    .font(.subheadline.weight(current ? .semibold : .regular))
                    .foregroundStyle(current ? .ink : .ink2)
                Spacer(minLength: 4)
                if page.soon { SoonTag() }
            }
            .padding(.horizontal, 10)
            .frame(minHeight: 36)
            .background {
                if current {
                    RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
                        .fill(.surface)
                        .elevation(Tokens.Shadow.lift, cornerRadius: Tokens.Radius.sm)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .accessibilityAddTraits(current ? .isSelected : [])
        .accessibilityLabel(page.soon ? "\(page.label), soon" : page.label)
    }
}

/// The account's panel: who is signed in; how many tokens of the day's AI allowance are left; Settings and the keyboard
/// shortcuts; and signing out as the last line. iPhone, which has no sidebar, also finds the pages here.
struct AccountPanel: View {
    let user: AppUser
    let phone: Bool
    @Environment(Router.self) private var router
    @Environment(AppModel.self) private var model
    @Environment(\.dismiss) private var dismiss
    @State private var usage: Usage?
    @State private var usageLoaded = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Avatar(user: user, size: 36)
                VStack(alignment: .leading, spacing: 1) {
                    Text(user.name).font(.footnote.weight(.semibold)).foregroundStyle(.ink).lineLimit(1)
                    Text(user.email).font(.caption).foregroundStyle(.ink3).lineLimit(1).truncationMode(.middle)
                }
            }
            .padding(.horizontal, 10)
            .padding(.top, 8)
            .padding(.bottom, 10)

            if usage?.features?.voice ?? true, usageLoaded || usage != nil {
                rule
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text("Tokens left today").font(.footnote.weight(.medium)).foregroundStyle(.ink)
                        Spacer()
                        Text(usage.map { $0.today.left.formatted() } ?? "–").font(.footnote.weight(.medium)).monospacedDigit().foregroundStyle(.ink)
                    }
                    GeometryReader { g in
                        Capsule().fill(.line2)
                            .overlay(alignment: .leading) {
                                Capsule().fill(.ink)
                                    .frame(width: g.size.width * CGFloat(usage.map { $0.today.limit > 0 ? Double($0.today.left) / Double($0.today.limit) : 0 } ?? 0))
                            }
                    }
                    .frame(height: 3)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 10)
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(usage.map { "\($0.today.left.formatted()) of \($0.today.limit.formatted()) tokens left today" } ?? "Loading")
            }

            rule
            if phone {
                ForEach(Router.Page.allCases) { page in
                    PageRow(page: page, current: router.page == page) { go { router.open(page) } }
                }
            }
            row("Settings", Icon.settings) { go { router.openSettings() } }
                .accessibilityIdentifier("settings")
            if !phone {
                row("Keyboard shortcuts", Icon.keyboard) { go { router.openSettings(.shortcuts) } }
            }
            rule
            row("Sign out", Icon.signOut) { go { model.signOut() } }
        }
        .padding(6)
        .frame(width: 300)
        .background(.elevated)
        .task {
            usage = try? await model.session.backend.usage()
            usageLoaded = true
        }
    }

    private var rule: some View {
        Rectangle().fill(.line).frame(height: 1).padding(.horizontal, -6).padding(.vertical, 6)
    }

    private func go(_ run: @escaping () -> Void) {
        router.showAccount = false
        dismiss()
        run()
    }

    private func row(_ title: String, _ symbol: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: symbol).font(.system(size: 14)).foregroundStyle(.ink2).frame(width: 18)
                Text(title).font(.subheadline).foregroundStyle(.ink)
                Spacer()
            }
            .padding(.horizontal, 10)
            .frame(minHeight: 40)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
    }
}

/// The month to pick a day from, opened from the title (the web's MiniMonth): today a filled tile, the picked day
/// outlined, days with something left dark.
struct DayPicker: View {
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(TaskStore.self) private var store
    @Environment(\.palette) private var palette
    @State private var month: DayKey?

    var body: some View {
        let shown = month ?? router.selected.startOfMonth
        let grid = Dates.monthGrid(year: shown.year, month: shown.month)
        VStack(spacing: 10) {
            HStack {
                Text(Dates.months[shown.month - 1]).font(.subheadline.weight(.semibold))
                    + Text(" \(String(shown.year))").font(.subheadline).foregroundStyle(.ink3)
                Spacer()
                StepperArrows(prevLabel: "Previous month", nextLabel: "Next month",
                              onPrev: { month = shown.addingMonths(-1) }, onNext: { month = shown.addingMonths(1) })
            }
            HStack(spacing: 0) {
                ForEach(Dates.weekdayNames(.letter).indices, id: \.self) { i in
                    Text(Dates.weekdayNames(.letter)[i]).font(.caption2.weight(.medium)).foregroundStyle(.ink3).frame(maxWidth: .infinity)
                }
            }
            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 2), count: 7), spacing: 2) {
                ForEach(0..<(grid.rows * 7), id: \.self) { i in
                    let day = grid.start.adding(days: i)
                    let inMonth = day.month == shown.month
                    let isToday = day == clock.today
                    let picked = day == router.selected
                    let hasOpen = store.tasks(on: day).contains { !$0.done }
                    Button {
                        router.select(day)
                        router.showDayPicker = false
                    } label: {
                        Text("\(day.day)")
                            .font(.footnote.weight(hasOpen || isToday ? .semibold : .regular))
                            .monospacedDigit()
                            .foregroundStyle(isToday ? palette.onAccent : inMonth ? (hasOpen ? Color.ink : .ink3) : .ink4)
                            .frame(maxWidth: .infinity, minHeight: 36)
                            .background {
                                if isToday {
                                    RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).fill(palette.accentSolid)
                                } else if picked {
                                    RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.ink, lineWidth: 1.5)
                                }
                            }
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(Dates.long(day))
                    .accessibilityAddTraits(picked ? .isSelected : [])
                }
            }
        }
        .padding(14)
        .frame(width: 300)
        .task(id: shown) {
            let g = Dates.monthGrid(year: shown.year, month: shown.month)
            await store.load(g.start...g.end)
        }
    }
}

/// Goals and Agent until they're built: what they will be, marked Soon.
struct SoonPage: View {
    let page: Router.Page

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                SoonTag()
                Text(page == .goals ? "Goals, step by step." : "Nothing needs you.")
                    .font(.system(.title, weight: .semibold))
                    .tracking(-0.5)
                    .foregroundStyle(.ink)
                Text(page == .goals
                     ? "A goal is a card with steps. Tap a step and it becomes a task. A task done ticks the step, and once a week there is a check-in."
                     : "An AI agent that leads your life and makes it better.")
                    .font(.callout)
                    .foregroundStyle(.ink2)
            }
            .padding(24)
            .frame(maxWidth: 560, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .background(.surface)
    }
}
