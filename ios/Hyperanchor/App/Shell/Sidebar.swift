import SwiftUI

/// iPad: the sidebar on the left for the whole height (`Sidebar` in Sidebar.tsx). It can be hidden, with its button or
/// `[`, and stays as it was left. The name on top; the pages (Home: the day, the week, the month; Progress; Goals and
/// Agent, coming); saving's status; and the account at the foot, which opens the account panel.
struct Sidebar: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 8) {
                Wordmark(size: 18)
                Spacer(minLength: 0)
                SidebarButton(hide: true)
            }
            .padding(.leading, 20)
            .padding(.trailing, 12)
            .frame(height: 56)
            .hairline(.bottom)

            VStack(spacing: 2) {
                ForEach(Router.Page.allCases) { page in
                    PageRow(page: page, current: router.page == page) { router.go(to: page, today: clock.today) }
                }
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 12)

            Spacer(minLength: 0)
            SyncStatus()
                .padding(.horizontal, 20)
                .padding(.bottom, 8)
            AccountRow(user: user)
                .padding(10)
        }
        .frame(width: 248)
        .frame(maxHeight: .infinity)
        .background(.canvas)
        .overlay(alignment: .trailing) { Rectangle().fill(.line).frame(width: 1) }
        // The keyboard comes up over the work area; the sidebar stays whole.
        .ignoresSafeArea(.keyboard, edges: .bottom)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Sidebar")
    }
}

/// A page in the sidebar: its icon and name, Soon when it isn't open yet, raised when it's the one on screen.
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
                    .frame(width: 16)
                Text(page.label)
                    .font(.token(Tokens.Typography.footnote, weight: current ? .semibold : .medium))
                    .foregroundStyle(.ink)
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
            .contentShape(TallerShape(by: 4))
        }
        .buttonStyle(RowPressStyle(radius: Tokens.Radius.sm, pressed: .line))
        .accessibilityLabel(page.soon ? "\(page.label), soon" : page.label)
        .accessibilityAddTraits(current ? .isSelected : [])
        .accessibilityIdentifier("page.\(page.rawValue)")
    }
}

/// The account at the sidebar's foot: avatar, name and email, and three dots, one above the other. Raised while its
/// panel is open.
private struct AccountRow: View {
    let user: AppUser
    @Environment(Router.self) private var router

    var body: some View {
        @Bindable var router = router
        let open = router.showAccount
        Button {
            router.showAccount = true
        } label: {
            HStack(spacing: 10) {
                Avatar(user: user, size: 32)
                VStack(alignment: .leading, spacing: 0) {
                    Text(user.name).font(.token(Tokens.Typography.footnote, weight: .semibold)).foregroundStyle(.ink)
                    Text(user.email).font(.token(Tokens.Typography.caption)).foregroundStyle(.ink3).truncationMode(.middle)
                }
                .lineLimit(1)
                Spacer(minLength: 4)
                Image(systemName: Icon.more)
                    .font(.system(size: 13, weight: .regular))
                    .rotationEffect(.degrees(90))
                    .foregroundStyle(open ? .ink : .ink3)
                    .frame(width: 16)
            }
            .padding(.horizontal, 10)
            .frame(minHeight: 48)
            .background {
                if open {
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(.surface)
                        .elevation(Tokens.Shadow.lift, cornerRadius: 10)
                }
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(RowPressStyle(radius: 10, pressed: .line))
        .accessibilityLabel("\(user.name): account")
        .accessibilityIdentifier("account")
        .popover(isPresented: $router.showAccount, arrowEdge: .bottom) {
            AccountPanel(user: user, phone: false)
        }
    }
}

/// A row that shows its press as a quiet rounded tile (the web's hover).
struct RowPressStyle: ButtonStyle {
    var radius: CGFloat = Tokens.Radius.sm
    var pressed: Color = .surface3

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .background(configuration.isPressed ? pressed : .clear, in: RoundedRectangle(cornerRadius: radius, style: .continuous))
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
    }
}

/// The account panel (`AccountPanel` in Sidebar.tsx): who is signed in; how many of today's AI tokens are left (only where
/// the server offers the AI); Settings and the keyboard shortcuts; signing out as the last line. iPhone, which has no
/// sidebar, finds the pages here too, the one on screen marked with a dot.
struct AccountPanel: View {
    let user: AppUser
    let phone: Bool
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(AppModel.self) private var model
    /// What a line asked for, done once the panel has gone (a window can't open while it is still leaving).
    @State private var then: (() -> Void)?
    private let offer = AIOffer.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            HStack(spacing: 12) {
                Avatar(user: user, size: 36)
                VStack(alignment: .leading, spacing: 0) {
                    Text(user.name).font(.token(Tokens.Typography.footnote, weight: .semibold)).foregroundStyle(.ink)
                    Text(user.email).font(.token(Tokens.Typography.caption)).foregroundStyle(.ink3).truncationMode(.middle)
                }
                .lineLimit(1)
            }
            .padding(.horizontal, 10)
            .padding(.top, 8)
            .padding(.bottom, 10)
            .accessibilityElement(children: .combine)

            if offer.voice != false {
                rule
                TokensLeft(usage: offer.usage)
            }

            rule
            if phone {
                ForEach(Router.Page.allCases) { page in
                    PanelRow(title: page.label, symbol: Icon.symbol(for: page), soon: page.soon, current: router.page == page) {
                        router.showAccount = false
                        router.go(to: page, today: clock.today)
                    }
                    .accessibilityIdentifier("page.\(page.rawValue)")
                }
            }
            PanelRow(title: "Settings", symbol: Icon.settings) { go { router.openSettings() } }
                .accessibilityIdentifier("settings")
            if !phone {
                PanelRow(title: "Keyboard shortcuts", symbol: Icon.keyboard) { go { router.openSettings(.shortcuts) } }
                    .accessibilityIdentifier("account.shortcuts")
            }
            rule
            PanelRow(title: "Sign out", symbol: Icon.signOut) { go { model.signOut() } }
                .accessibilityIdentifier("account.signOut")
        }
        .padding(6)
        .frame(width: 300)
        .presentationBackground(.elevated)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        .task { await offer.refresh(model.session.backend) }
        .onDisappear {
            then?()
            then = nil
        }
    }

    private var rule: some View {
        Rectangle().fill(.line).frame(height: 1).padding(.horizontal, -6).padding(.vertical, 6)
    }

    private func go(_ run: @escaping () -> Void) {
        then = run
        router.showAccount = false
    }
}

/// "Tokens left today" with today's allowance as a thin bar.
private struct TokensLeft: View {
    /// nil while it loads.
    let usage: Usage?

    var body: some View {
        let fraction = usage.map { $0.today.limit > 0 ? max(0, min(1, Double($0.today.left) / Double($0.today.limit))) : 0 } ?? 0
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline, spacing: 12) {
                Text("Tokens left today")
                Spacer(minLength: 0)
                Text(usage.map { Self.count($0.today.left) } ?? "–").monospacedDigit()
            }
            .font(.token(Tokens.Typography.footnote, weight: .medium))
            .foregroundStyle(.ink)
            Capsule()
                .fill(.line2)
                .frame(height: 3)
                .overlay(alignment: .leading) {
                    GeometryReader { g in
                        Capsule().fill(.ink).frame(width: g.size.width * fraction)
                    }
                }
                .animation(.easeOut(duration: Tokens.Motion.data), value: fraction)
        }
        .padding(.horizontal, 10)
        .padding(.top, 8)
        .padding(.bottom, 10)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(usage.map { "\(Self.count($0.today.left)) of \(Self.count($0.today.limit)) tokens left today" } ?? "Tokens left today: loading")
        .accessibilityIdentifier("account.tokens")
    }

    /// "8,160", as the web writes it.
    static func count(_ n: Int) -> String {
        n.formatted(.number.locale(Locale(identifier: "en_US")))
    }
}

/// A line in the account panel: its icon, its name, Soon, and a dot for the page on screen. 44 pt tall to tap.
private struct PanelRow: View {
    let title: String
    let symbol: String
    var soon = false
    var current = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: symbol)
                    .font(.system(size: 14, weight: .regular))
                    .foregroundStyle(.ink2)
                    .frame(width: 16)
                Text(title)
                    .font(.token(Tokens.Typography.footnote, weight: .medium))
                    .foregroundStyle(.ink)
                Spacer(minLength: 8)
                if soon { SoonTag() }
                if current {
                    Circle().fill(.ink).frame(width: 6, height: 6).accessibilityHidden(true)
                }
            }
            .padding(.horizontal, 10)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(RowPressStyle())
        .accessibilityLabel(soon ? "\(title), soon" : title)
        .accessibilityAddTraits(current ? .isSelected : [])
    }
}

/// The month to pick a day from, opened from the title (the web's MiniMonth): plain numbers, no dots. Today is the filled
/// tile, the picked day is outlined; days with something still to do are dark, the rest quiet. iPhone (`large`): bigger
/// days, in a sheet; iPad: a popover. Picking a day closes it.
struct DayPicker: View {
    var large = false
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(TaskStore.self) private var store
    @Environment(\.palette) private var palette
    @State private var month: DayKey?

    var body: some View {
        let shown = month ?? router.selected.startOfMonth
        let grid = Dates.monthGrid(year: shown.year, month: shown.month)
        let letters = Dates.weekdayNames(.letter)
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                (Text(Dates.months[shown.month - 1]).fontWeight(.semibold) + Text(" \(String(shown.year))").foregroundStyle(.ink3))
                    .font(.token(large ? Tokens.Typography.body : Tokens.Typography.footnote))
                    .foregroundStyle(.ink)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 0)
                StepperArrows(prevLabel: "Previous month", nextLabel: "Next month",
                              onPrev: { month = shown.addingMonths(-1) }, onNext: { month = shown.addingMonths(1) })
            }
            .padding(.leading, 10)
            .frame(minHeight: 32)

            HStack(spacing: 0) {
                ForEach(letters.indices, id: \.self) { i in
                    Text(letters[i])
                        .font(.token(Tokens.Typography.caption2, weight: .medium))
                        .tracking(0.22)
                        .foregroundStyle(.ink3)
                        .frame(maxWidth: .infinity, minHeight: 24)
                }
            }
            .padding(.top, 6)
            .accessibilityHidden(true)

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 0), count: 7), spacing: 0) {
                ForEach(0..<(grid.rows * 7), id: \.self) { i in
                    day(grid.start.adding(days: i), inMonth: grid.start.adding(days: i).month == shown.month)
                }
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .task(id: shown) { await store.load(grid.start...grid.end) }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Pick a day")
        .accessibilityIdentifier("dayPicker")
    }

    private func day(_ day: DayKey, inMonth: Bool) -> some View {
        let isToday = day == clock.today
        let picked = day == router.selected
        let busy = store.tasks(on: day).contains { !$0.done }
        let tile: CGFloat = large ? 40 : 32
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
        return Button {
            router.select(day)
            router.showDayPicker = false
        } label: {
            Text(verbatim: "\(day.day)")
                .font(.token(large ? Tokens.Typography.callout : Tokens.Typography.footnote,
                             weight: isToday || picked ? .semibold : busy && inMonth ? .medium : .regular))
                .monospacedDigit()
                .foregroundStyle(isToday ? palette.onAccent : picked ? Color.ink : !inMonth ? .ink4 : busy ? .ink : .ink3)
                .frame(width: tile, height: tile)
                .background {
                    if isToday {
                        shape.fill(palette.accentSolid)
                    } else if picked {
                        shape.fill(.surface).overlay(shape.strokeBorder(.ink, lineWidth: 1.5))
                    }
                }
                .frame(maxWidth: .infinity, minHeight: large ? 44 : 36)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(isToday ? "Today, \(Dates.long(day))" : Dates.long(day))
        .accessibilityValue(busy ? "Tasks left" : "")
        .accessibilityAddTraits(picked ? .isSelected : [])
        .accessibilityIdentifier("day.\(day.description)")
    }
}

/// What the server offers of the AI (speaking tasks, the summary) and how many of today's tokens are left, as
/// `GET /api/usage` last said: asked when the app opens and each time the account panel opens.
@MainActor
@Observable
final class AIOffer {
    static let shared = AIOffer()
    private(set) var usage: Usage?

    /// Speaking tasks; nil until the server has answered (servers that don't say offer everything).
    var voice: Bool? { usage.map { $0.features?.voice ?? true } }
    /// Speech written down on the server (any language, worked out from the voice).
    var transcribe: Bool? { usage.map { $0.features?.transcribe ?? true } }

    func refresh(_ backend: Backend) async {
        if let usage = try? await backend.usage() { self.usage = usage }
    }

    /// Signed out: the next account has its own allowance.
    func reset() {
        usage = nil
    }
}

extension Router {
    /// A page from the sidebar or the account panel.
    func go(to page: Page, today: DayKey) {
        selectedTask = nil
        if page == .home {
            goHome(today: today)
        } else {
            focus = false
            open(page)
        }
    }
}
