import SwiftUI
import UniformTypeIdentifiers

/// Settings (SettingsSheet.tsx): a sheet on iPhone, a window on iPad. Sections are named, not painted: General
/// (appearance, accent, the first day of the week, the order of tasks, sounds, the app icon's badge, and the keyboard
/// shortcuts on iPad), Voice (the spoken language, where the server offers speaking tasks), Your data, and the account,
/// which opens one level down (deleting it lives there, at the very end). Privacy · Terms · Support and Sign out at the
/// foot. Every change applies at once. Opened on the keyboard shortcuts (`?`), that list is the first page.
struct SettingsView: View {
    let user: AppUser
    @Environment(Router.self) private var router
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        NavigationStack {
            page(router.settingsPage)
                .navigationDestination(for: Router.SettingsPage.self) { page($0) }
        }
        .environment(\.settingsMargin, sizeClass == .regular ? 24 : 16)
        .presentationBackground(.elevated)
        .tint(.ink)
    }

    @ViewBuilder
    private func page(_ page: Router.SettingsPage) -> some View {
        switch page {
        case .settings: GeneralSettings(user: user)
        case .account: AccountSettings(user: user)
        case .shortcuts: ShortcutsView()
        }
    }
}

/// The first page: General, Voice, Your data, Account; the foot.
private struct GeneralSettings: View {
    let user: AppUser
    @Environment(AppModel.self) private var model
    @Environment(Preferences.self) private var prefs
    @Environment(TaskStore.self) private var store
    @Environment(TodayClock.self) private var clock
    @Environment(Router.self) private var router
    @Environment(\.colorScheme) private var scheme
    @Environment(\.settingsMargin) private var margin
    @State private var legal: URL?
    @State private var exporting = false
    @State private var exported: CSVFile?
    @State private var exportNote: String?
    private let offer = AIOffer.shared
    private let isPad = UIDevice.current.userInterfaceIdiom == .pad

    var body: some View {
        @Bindable var prefs = prefs
        ScrollView {
            VStack(spacing: 0) {
                SettingsBand(title: "General")
                SettingsRow(title: "Appearance") {
                    // Until one is picked, the device's setting is the one shown.
                    SegmentedSwitch(label: "Appearance", options: [(Preferences.Appearance.light, "Light"), (.dark, "Dark")],
                                    selection: Binding(get: { prefs.appearance ?? (scheme == .dark ? .dark : .light) }, set: { prefs.appearance = $0 }),
                                    symbols: ["sun.max", "moon"], width: 176)
                        .accessibilityIdentifier("settings.appearance")
                }
                SettingsRow(title: "Accent", hint: "Today, progress and done tasks.") {
                    AccentSwatches(selection: $prefs.accent)
                        .accessibilityIdentifier("settings.accent")
                }
                SettingsRow(title: "Week starts on", hint: "In Week, Month and Progress.") {
                    SegmentedSwitch(label: "Week starts on", options: [(1, "Monday"), (0, "Sunday")], selection: $prefs.weekStart, width: 176)
                        .accessibilityIdentifier("settings.weekStart")
                }
                SettingsRow(title: "Task order", hint: prefs.sort == .manual ? "Yours: drag tasks to arrange them." : "Dragging is off while tasks are sorted.") {
                    SettingsPick(label: "Task order", options: TaskSort.options.map { ($0, $0.label) }, selection: $prefs.sort)
                        .accessibilityIdentifier("settings.order")
                }
                SettingsRow(title: "Sounds", hint: "A soft chime when the focus timer is up.") {
                    SegmentedSwitch(label: "Sounds", options: [(true, "On"), (false, "Off")], selection: $prefs.sounds, width: 176)
                        .accessibilityIdentifier("settings.sounds")
                }
                SettingsRow(title: "App icon badge", hint: "How many tasks are still open today.", last: !isPad) {
                    SegmentedSwitch(label: "App icon badge", options: [(true, "On"), (false, "Off")], selection: badge, width: 176)
                        .accessibilityIdentifier("settings.badge")
                }
                if isPad {
                    NavigationLink(value: Router.SettingsPage.shortcuts) {
                        SettingsGoRow(title: "Keyboard shortcuts")
                    }
                    .buttonStyle(RowPressStyle(radius: 0, pressed: .surface2))
                    .accessibilityIdentifier("settings.shortcuts")
                }

                if offer.voice == true {
                    SettingsBand(title: "Voice")
                    SettingsRow(title: "Spoken language", hint: languageHint, last: true) {
                        SettingsPick(label: "Spoken language",
                                     options: [(String?.none, offer.transcribe == true ? "Automatic" : "Automatic (\(SpokenLanguages.name(guess)))")]
                                        + SpokenLanguages.all().map { (Optional($0.tag), $0.name) },
                                     selection: $prefs.voiceLanguage,
                                     value: prefs.voiceLanguage.map(SpokenLanguages.name) ?? "Automatic",
                                     dividerAfterFirst: true)
                            .accessibilityIdentifier("settings.language")
                    }
                }

                SettingsBand(title: "Your data")
                SettingsRow(title: "Export tasks", hint: exportNote ?? "Every task, as a CSV file.", last: true) {
                    Button(action: export) {
                        Label(exporting ? "Preparing…" : "Download", systemImage: "arrow.down.to.line")
                    }
                    .buttonStyle(OutlineButtonStyle())
                    .disabled(exporting)
                    .accessibilityIdentifier("settings.export")
                }

                SettingsBand(title: "Account")
                NavigationLink(value: Router.SettingsPage.account) {
                    SettingsGoRow(title: user.name, hint: user.email, last: true) { Avatar(user: user, size: 36) }
                }
                .buttonStyle(RowPressStyle(radius: 0, pressed: .surface2))
                .accessibilityLabel("Account: \(user.name), \(user.email)")
                .accessibilityIdentifier("settings.account")

                Text(verbatim: "Hyperanchor \(Self.version)")
                    .font(.token(Tokens.Typography.caption))
                    .foregroundStyle(.ink3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, margin)
                    .padding(.top, 20)
                    .padding(.bottom, 12)
                    .accessibilityIdentifier("settings.version")
            }
        }
        .safeAreaInset(edge: .bottom, spacing: 0) { foot }
        .settingsChrome("Settings")
        .sheet(item: $legal) { SafariView(url: $0).ignoresSafeArea() }
        .fileExporter(isPresented: Binding(get: { exported != nil }, set: { if !$0 { exported = nil } }),
                      document: exported, contentType: .commaSeparatedText,
                      defaultFilename: "hyperanchor-tasks-\(clock.today.description)") { result in
            if case .failure = result { exportNote = "Couldn’t save the file. Try again." }
        }
    }

    /// Privacy · Terms · Support, and Sign out.
    private var foot: some View {
        HStack(spacing: 12) {
            HStack(spacing: 14) {
                link("Privacy", AppConfig.privacyURL)
                link("Terms", AppConfig.termsURL)
                link("Support", AppConfig.supportURL)
            }
            Spacer(minLength: 0)
            Button {
                router.showSettings = false
                model.signOut()
            } label: {
                Label("Sign out", systemImage: Icon.signOut)
            }
            .buttonStyle(OutlineButtonStyle())
            .accessibilityIdentifier("settings.signOut")
        }
        .padding(.horizontal, margin)
        .padding(.vertical, 6)
        .background(.elevated)
        .hairline(.top)
    }

    private func link(_ title: String, _ url: URL) -> some View {
        Button(title) { legal = url }
            .font(.token(Tokens.Typography.caption))
            .foregroundStyle(.ink3)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
            .buttonStyle(PressableStyle())
            .accessibilityIdentifier("settings.\(title.lowercased())")
    }

    /// On asks for permission first (and stays off if it isn't given).
    private var badge: Binding<Bool> {
        Binding(get: { prefs.showBadge }, set: { on in
            if on {
                Task { prefs.showBadge = await AppBadge.requestPermission() }
            } else {
                prefs.showBadge = false
                AppBadge.set(0)
            }
        })
    }

    /// The language a guess would pick: the script of the latest tasks among the device's languages.
    private var guess: String {
        SpokenLanguages.guess(store.tasks.values.sorted { $0.updatedAt > $1.updatedAt }.prefix(40).map(\.title))
    }

    private var languageHint: String {
        if prefs.voiceLanguage != nil { return "Always listens in this language." }
        if offer.transcribe == true { return "Worked out from what you say, mixed languages too." }
        return "Worked out from your tasks and your device: \(SpokenLanguages.name(guess)) right now."
    }

    private func export() {
        exporting = true
        exportNote = nil
        Task {
            defer { exporting = false }
            do {
                exported = CSVFile(data: try await model.session.backend.exportCSV())
            } catch APIError.offline {
                exportNote = "You’re offline. Export works when you’re back."
            } catch {
                exportNote = "Couldn’t export just now. Try again in a moment."
            }
        }
    }

    static var version: String {
        let info = Bundle.main.infoDictionary ?? [:]
        let short = info["CFBundleShortVersionString"] as? String ?? ""
        let build = info["CFBundleVersion"] as? String ?? ""
        return build.isEmpty || build == short ? short : "\(short) (\(build))"
    }
}

/// The CSV the server makes of every task, as a file to save.
struct CSVFile: FileDocument {
    static let readableContentTypes: [UTType] = [.commaSeparatedText]
    let data: Data

    init(data: Data) {
        self.data = data
    }

    init(configuration: ReadConfiguration) throws {
        data = configuration.file.regularFileContents ?? Data()
    }

    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper {
        FileWrapper(regularFileWithContents: data)
    }
}

extension View {
    /// A Settings page: its name in the bar, a way to close, the window's color.
    func settingsChrome(_ title: String) -> some View {
        modifier(SettingsChrome(title: title))
    }
}

private struct SettingsChrome: ViewModifier {
    let title: String
    @Environment(Router.self) private var router

    func body(content: Content) -> some View {
        content
            .background(.elevated)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        router.showSettings = false
                    } label: {
                        Image(systemName: Icon.close)
                    }
                    .keyboardShortcut(.cancelAction)
                    .accessibilityLabel("Close")
                    .accessibilityIdentifier("settings.close")
                }
            }
    }
}
