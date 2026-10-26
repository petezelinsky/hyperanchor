import AuthenticationServices
import SwiftUI

/// Sign in with Apple (the system button) or Google (a button in the same style), with the landing page's words.
struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuthentication
    @Environment(\.colorScheme) private var scheme
    @Environment(\.horizontalSizeClass) private var sizeClass
    @State private var working: SignInProvider?
    @State private var error: String?
    @State private var appleNonce = Nonce.make()
    @State private var legal: URL?

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Wordmark(size: 22)
                    .padding(.top, 12)

                VStack(spacing: 18) {
                    Headline()
                    Text("Hyperanchor is a calm, fast planner. Capture tasks in a blink, focus on one thing at a time, and see your week at a glance.")
                        .font(.body)
                        .foregroundStyle(.ink2)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(.top, sizeClass == .regular ? 72 : 40)

                HeroCard()
                    .padding(.top, 32)
                    .padding(.bottom, 24)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 480)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
        .background(.surface)
        .safeAreaInset(edge: .bottom) { actions }
        .sheet(item: $legal) { SafariView(url: $0).ignoresSafeArea() }
    }

    private var actions: some View {
        VStack(spacing: 12) {
            if let message = error ?? model.session.notice {
                Text(message)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.redInk)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(.redSoft, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .multilineTextAlignment(.center)
                    .accessibilityIdentifier("signin.error")
            }
            appleButton
            googleButton
            Text("Free forever. By continuing, you agree to the [Terms of Service](https://hyperanchor.app/terms) and [Privacy Policy](https://hyperanchor.app/privacy).")
                .font(.caption)
                .foregroundStyle(.ink3)
                .tint(.ink2)
                .multilineTextAlignment(.center)
                .environment(\.openURL, OpenURLAction { url in
                    legal = url
                    return .handled
                })
                .padding(.top, 2)
        }
        .padding(.horizontal, 24)
        .padding(.top, 12)
        .padding(.bottom, 8)
        .frame(maxWidth: 480)
        .frame(maxWidth: .infinity)
        .background(.bar)
        .dynamicTypeSize(...DynamicTypeSize.accessibility1)
        .disabled(working != nil)
    }

    @ViewBuilder
    private var appleButton: some View {
        if model.launch.demo {
            // UI tests and demos can't drive the system sheet: a stand-in that signs in to the demo account.
            Button { Task { await signInStub(.apple) } } label: {
                Label("Continue with Apple", systemImage: "apple.logo").frame(maxWidth: .infinity)
            }
            .buttonStyle(ProviderButtonStyle())
            .accessibilityIdentifier("signin.apple")
        } else {
            SignInWithAppleButton(.continue) { request in
                appleNonce = Nonce.make()
                request.requestedScopes = [.fullName, .email]
                request.nonce = Nonce.sha256(appleNonce)
            } onCompletion: { result in
                Task { await finishApple(result) }
            }
            .signInWithAppleButtonStyle(scheme == .dark ? .white : .black)
            .frame(height: 52)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .accessibilityIdentifier("signin.apple")
        }
    }

    private var googleButton: some View {
        Button { Task { await signInWithGoogle() } } label: {
            HStack(spacing: 8) {
                if working == .google {
                    ProgressView().tint(.onPrimary)
                } else {
                    Image("GoogleG").resizable().frame(width: 17, height: 17)
                }
                Text(working == .google ? "Signing in…" : "Continue with Google")
            }
            .frame(maxWidth: .infinity)
        }
        .buttonStyle(ProviderButtonStyle())
        .accessibilityIdentifier("signin.google")
    }

    // MARK: Flows

    private func finishApple(_ result: Result<ASAuthorization, Error>) async {
        switch result {
        case .success(let authorization):
            guard let credential = AppleCredential(authorization) else { return fail("Sign-in didn’t work. Please try again.") }
            await complete(.apple) {
                try await model.session.signIn(provider: .apple, idToken: credential.identityToken, nonce: appleNonce, name: credential.name)
            }
        case .failure(let e):
            if (e as? ASAuthorizationError)?.code != .canceled { fail("Sign-in didn’t work. Please try again.") }
        }
    }

    private func signInWithGoogle() async {
        if model.launch.demo { return await signInStub(.google) }
        let oauth = GoogleOAuth(clientID: AppConfig.googleClientID)
        guard !oauth.clientID.isEmpty else { return fail(GoogleOAuth.Failure.notConfigured.errorDescription!) }
        await complete(.google) {
            let callback = try await webAuthentication.authenticate(using: oauth.authorizationURL, callbackURLScheme: oauth.callbackScheme, preferredBrowserSession: .shared)
            let idToken = try await oauth.idToken(from: callback)
            try await model.session.signIn(provider: .google, idToken: idToken, nonce: oauth.nonce, name: nil)
        }
    }

    private func signInStub(_ provider: SignInProvider) async {
        await complete(provider) {
            try await model.session.signIn(provider: provider, idToken: "demo", nonce: nil, name: nil)
        }
    }

    private func complete(_ provider: SignInProvider, _ run: () async throws -> Void) async {
        working = provider
        error = nil
        defer { working = nil }
        do {
            try await run()
            model.accountChanged()
        } catch ASWebAuthenticationSessionError.canceledLogin {
            // Closed the sheet.
        } catch let e as APIError {
            fail(e == .offline ? "You’re offline. Connect to the internet to sign in." : "Sign-in didn’t work. Please try again.")
        } catch {
            fail((error as? LocalizedError)?.errorDescription ?? "Sign-in didn’t work. Please try again.")
        }
    }

    private func fail(_ message: String) {
        error = message
    }
}

/// "Continue with Google", matching Apple's button: black (white in dark mode), 52 points, rounded.
struct ProviderButtonStyle: ButtonStyle {
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 19, weight: .medium))
            .foregroundStyle(scheme == .dark ? Color.black : Color.white)
            .frame(height: 52)
            .frame(maxWidth: .infinity)
            .background(scheme == .dark ? Color.white : Color.black, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .opacity(configuration.isPressed ? 0.8 : 1)
    }
}

/// "Own your day. / week. / month." — the second line cycles, sliding up.
private struct Headline: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var index = 0
    private let words = ["day.", "week.", "month."]

    var body: some View {
        VStack(spacing: -4) {
            Text("Own your").foregroundStyle(.ink3)
            Text(words[index])
                .foregroundStyle(.ink)
                .contentTransition(.numericText())
                .id(index)
                .transition(reduceMotion ? .opacity : .asymmetric(insertion: .move(edge: .bottom).combined(with: .opacity), removal: .move(edge: .top).combined(with: .opacity)))
        }
        .font(.system(size: 52, weight: .bold))
        .tracking(-2.2)
        .minimumScaleFactor(0.6)
        .lineLimit(1)
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Own your day, week and month.")
        .accessibilityAddTraits(.isHeader)
        .task {
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2.6))
                withAnimation(.timingCurve(0.7, 0, 0.2, 1, duration: 0.6)) { index = (index + 1) % words.count }
            }
        }
    }
}

/// The landing illustration: a day's list that checks itself off, then starts over. Not interactive.
private struct HeroCard: View {
    private let tasks: [(String, String)] = [
        ("Plan the week", "Three things that matter most"),
        ("Send the proposal to Dana", ""),
        ("Gym, 45 minutes", ""),
        ("Pick up flowers for Sam", "Peonies, if they have them"),
    ]
    @State private var done = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let all = done == tasks.count
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Today").font(.title3.bold()).tracking(-0.4)
                    Text(all ? "All done. Nice work!" : "\(done) of \(tasks.count) done")
                        .font(.footnote.weight(all ? .medium : .regular))
                        .foregroundStyle(all ? .ink : .ink3)
                        .monospacedDigit()
                }
                Spacer()
                Burst(active: all, radius: 26) {
                    ProgressRing(value: Double(done) / Double(tasks.count), size: 36, lineWidth: 3.5)
                }
            }
            .padding(.bottom, 12)
            ForEach(Array(tasks.enumerated()), id: \.offset) { i, t in
                HStack(alignment: .top, spacing: 12) {
                    CheckCircle(checked: i < done)
                        .padding(.top, 1)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(t.0).font(.subheadline).foregroundStyle(i < done ? .ink3 : .ink)
                        if !t.1.isEmpty { Text(t.1).font(.footnote).foregroundStyle(.ink3) }
                    }
                    .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 10)
                .overlay(alignment: .top) { Rectangle().fill(.line).frame(height: 1) }
            }
            HStack(spacing: 12) {
                Image(systemName: "plus").frame(width: 20)
                Text("Add a task")
            }
            .font(.subheadline)
            .foregroundStyle(.ink3)
            .padding(.top, 10)
            .overlay(alignment: .top) { Rectangle().fill(.line).frame(height: 1) }
        }
        .padding(20)
        .background(.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
        .elevation(Tokens.Shadow.float, cornerRadius: 22)
        .accessibilityHidden(true)
        .task {
            guard !reduceMotion else { done = tasks.count; return }
            // Wait, tick the four tasks one by one, celebrate, start over.
            let delays = [1.6, 0.95, 0.95, 0.95, 2.6, 0.9]
            var step = 0
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(delays[step % delays.count]))
                step += 1
                let phase = step % delays.count
                withAnimation(.spring(duration: 0.4)) { done = phase == 0 ? 0 : min(phase, tasks.count) }
            }
        }
    }
}
