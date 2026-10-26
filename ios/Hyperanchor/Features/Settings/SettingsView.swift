import SwiftUI

/// Appearance (applied at once, remembered on this device) and the account.
struct SettingsView: View {
    let user: AppUser
    @Environment(AppModel.self) private var model
    @Environment(Preferences.self) private var prefs
    @Environment(\.dismiss) private var dismiss
    @State private var confirmDelete = false
    @State private var deleting = false
    @State private var deleteError: String?
    @State private var legal: URL?

    var body: some View {
        @Bindable var prefs = prefs
        NavigationStack {
            Form {
                Section {
                    Picker("Appearance", selection: $prefs.appearance) {
                        ForEach(Preferences.Appearance.allCases) { Text($0.label).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets())
                    .accessibilityIdentifier("settings.appearance")
                } header: {
                    Text("Appearance")
                } footer: {
                    Text("Auto follows your device’s light or dark setting.")
                }

                Section {
                    Picker("Accent color", selection: $prefs.accent) {
                        ForEach(AccentChoice.allCases) { accent in
                            Label {
                                Text(accent.label)
                            } icon: {
                                Circle().fill(Color(uiColor: accent.swatch.uiColor)).frame(width: 18, height: 18)
                            }
                            .tag(accent)
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } header: {
                    Text("Accent color")
                } footer: {
                    Text("Used for today, progress and finished tasks. Appearance is saved on this device.")
                }

                Section("Account") {
                    LabeledContent(model.session.provider == .apple ? "Apple" : model.session.provider == .google ? "Google" : "Signed in as") {
                        Text(user.email).foregroundStyle(.ink2).lineLimit(1).truncationMode(.middle)
                    }
                    Button("Sign Out") {
                        dismiss()
                        model.signOut()
                    }
                    .foregroundStyle(.ink)
                    Button(role: .destructive) {
                        confirmDelete = true
                    } label: {
                        HStack {
                            Text("Delete Account…")
                            if deleting { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(deleting)
                    .accessibilityIdentifier("settings.delete")
                }

                Section {
                    Button("Privacy Policy") { legal = AppConfig.privacyURL }
                    Button("Terms of Service") { legal = AppConfig.termsURL }
                } footer: {
                    Text("Hyperanchor \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "")")
                        .frame(maxWidth: .infinity)
                        .padding(.top, 8)
                }
                .foregroundStyle(.ink)
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }.fontWeight(.semibold)
                }
            }
            .confirmationDialog("Delete your account and all of your tasks?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete Account", role: .destructive) { Task { await deleteAccount() } }
            } message: {
                Text("This can’t be undone. It applies to the website too.")
            }
            .alert("Couldn’t delete the account", isPresented: .constant(deleteError != nil)) {
                Button("OK") { deleteError = nil }
            } message: {
                Text(deleteError ?? "")
            }
            .sheet(item: $legal) { SafariView(url: $0).ignoresSafeArea() }
        }
        .tint(.ink)
    }

    private func deleteAccount() async {
        deleting = true
        defer { deleting = false }
        do {
            var code: String?
            if model.session.provider == .apple, !model.launch.demo {
                // Apple asks us to revoke the app's access; that needs a fresh authorization.
                code = try await AppleReauthentication().run().authorizationCode
            }
            try await model.session.deleteAccount(appleAuthorizationCode: code)
            model.store?.reset()
            model.accountChanged()
            model.session.notice = nil
            dismiss()
        } catch let e as APIError {
            deleteError = e == .offline ? "You’re offline. Connect to the internet and try again." : (e.errorDescription ?? "Please try again.")
        } catch {
            // Cancelled the Apple confirmation: nothing happened.
        }
    }
}
