import SwiftUI

/// Settings → Account, one level down: who is signed in and with what; then deleting the account, at the very end,
/// which takes a second, deliberate step (the web's DeleteAccount). For Apple accounts the deletion asks to confirm the
/// sign-in first, so the server can revoke the app's access (App Store 5.1.1(v)).
struct AccountSettings: View {
    let user: AppUser
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(\.settingsMargin) private var margin
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var asking = false
    @State private var deleting = false
    @State private var failed = false
    @AccessibilityFocusState private var questionFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Color.clear.frame(height: 6)
                SettingsRow(title: "Name") { value(user.name) }
                SettingsRow(title: "Email", last: provider == nil) { value(user.email) }
                if let provider {
                    SettingsRow(title: "Signed in with", last: true) { value(provider) }
                }
                Text("Appearance, the accent and the first day of the week are saved on this device.")
                    .font(.token(Tokens.Typography.caption))
                    .foregroundStyle(.ink3)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.horizontal, margin)
                    .padding(.top, 4)
                    .padding(.bottom, 8)

                SettingsBand(title: "Delete account")
                if asking { question } else { intro }
            }
        }
        .settingsChrome("Account")
        .animation(Motion.choose(Motion.out(Tokens.Motion.fast), reduceMotion: reduceMotion), value: asking)
    }

    /// Apple or Google (nothing for the demo account).
    private var provider: String? {
        switch model.session.provider {
        case .apple: "Apple"
        case .google: "Google"
        case nil: nil
        }
    }

    private func value(_ text: String) -> some View {
        Text(text)
            .font(.token(Tokens.Typography.body))
            .foregroundStyle(.ink3)
            .lineLimit(1)
            .truncationMode(.middle)
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("This erases every task and the account itself, for good. Nothing can bring them back, so export your tasks first if you might want them.")
                .font(.token(Tokens.Typography.body))
                .foregroundStyle(.ink2)
                .fixedSize(horizontal: false, vertical: true)
                .frame(maxWidth: 440, alignment: .leading)
            Button("Delete account…") { asking = true }
            .buttonStyle(OutlineButtonStyle(tone: .danger))
            .accessibilityIdentifier("settings.delete")
        }
        .padding(.horizontal, margin)
        .padding(.top, 4)
        .padding(.bottom, 20)
        .transition(.opacity)
    }

    private var question: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Delete your account?")
                .font(.token(Tokens.Typography.body, weight: .semibold))
                .foregroundStyle(.redInk)
                .accessibilityAddTraits(.isHeader)
                .accessibilityFocused($questionFocused)
            Text("Every task is erased right away, here and on the website, and you’re signed out. This can’t be undone, so export your tasks first if you might want them.")
                .font(.token(Tokens.Typography.footnote))
                .foregroundStyle(.ink2)
                .fixedSize(horizontal: false, vertical: true)
            if failed {
                Text("Couldn’t delete your account. Check your connection and try again.")
                    .font(.token(Tokens.Typography.footnote, weight: .medium))
                    .foregroundStyle(.redInk)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 4)
                    .accessibilityIdentifier("settings.delete.error")
            }
            HStack(spacing: 8) {
                Spacer(minLength: 0)
                Button("Cancel") {
                    asking = false
                    failed = false
                }
                .buttonStyle(OutlineButtonStyle())
                .accessibilityIdentifier("settings.delete.cancel")
                Button(deleting ? "Deleting…" : "Delete for good") {
                    Task { await deleteAccount() }
                }
                .buttonStyle(OutlineButtonStyle(tone: .destructive))
                .accessibilityIdentifier("settings.delete.confirm")
            }
            .disabled(deleting)
            .padding(.top, 6)
        }
        .padding(16)
        .background(.redSoft, in: RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
        .padding(.horizontal, margin)
        .padding(.top, 4)
        .padding(.bottom, 20)
        .transition(.opacity)
        .accessibilityElement(children: .contain)
        // VoiceOver goes to the question as it appears.
        .onAppear { questionFocused = true }
    }

    private func deleteAccount() async {
        deleting = true
        failed = false
        defer { deleting = false }
        do {
            var code: String?
            if model.session.provider == .apple, !model.launch.demo {
                // Apple asks apps to revoke their access; that needs a fresh authorization.
                code = try await AppleReauthentication().run().authorizationCode
            }
            try await model.session.deleteAccount(appleAuthorizationCode: code)
            router.showSettings = false
            model.store?.reset()
            model.accountChanged()
            model.session.notice = nil
        } catch is APIError {
            failed = true
        } catch {
            // Closed Apple's confirmation: nothing happened.
        }
    }
}
