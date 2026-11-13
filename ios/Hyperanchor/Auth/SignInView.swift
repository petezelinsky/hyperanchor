import AuthenticationServices
import SwiftUI

/// The signed-out screen: the name, the headline and one line about the app, Sign in with Apple and Google, the legal
/// line — the web's words. One calm screen with nothing to scroll, on purpose unlike the web's landing page.
/// It takes over from the launch screen: while `splash` is on, the launch screen's sign covers it (RootView); as the sign
/// fades, the screen rises in. iPhone: the name on top, the headline in the middle, the buttons at the bottom. iPad: all
/// of it together, centered.
struct SignInView: View {
    var splash = false
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuthentication
    @Environment(\.colorScheme) private var scheme
    @Environment(\.horizontalSizeClass) private var widthClass
    @Environment(\.verticalSizeClass) private var heightClass
    @State private var working: SignInProvider?
    @State private var error: String?
    @State private var appleNonce = Nonce.make()
    @State private var legal: URL?

    var body: some View {
        GeometryReader { geo in
            let regular = widthClass == .regular && heightClass == .regular
            ScrollView {
                Group {
                    if regular {
                        VStack(spacing: 0) {
                            Spacer(minLength: 40)
                            Wordmark(size: 24)
                                .rise(hidden: splash, delay: 0.06)
                            hero(headline: 40)
                                .padding(.top, 36)
                            actions.padding(.top, 44)
                            Spacer(minLength: 40)
                        }
                    } else {
                        VStack(spacing: 0) {
                            Wordmark(size: 24)
                                .frame(minHeight: 44)
                                .padding(.top, 8)
                                .rise(hidden: splash, delay: 0.06)
                            Spacer(minLength: 40)
                            hero(headline: 34)
                            Spacer(minLength: 40)
                            actions
                        }
                        .padding(.bottom, 12)
                    }
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: regular ? 400 : 440)
                .frame(maxWidth: .infinity, minHeight: geo.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollIndicators(.hidden)
        }
        .background(Color("LaunchBackground").ignoresSafeArea())
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .environment(\.openURL, OpenURLAction { url in
            legal = url
            return .handled
        })
        .sheet(item: $legal) { SafariView(url: $0).ignoresSafeArea() }
    }

    /// The headline and the lines under it.
    private func hero(headline size: CGFloat) -> some View {
        VStack(spacing: 0) {
            Headline(size: size, moving: !splash)
                .rise(hidden: splash, delay: 0.12)
            Text("Hyperanchor is a calm, fast planner.\nSign in to get started.")
                .font(.callout)
                .lineSpacing(3)
                .foregroundStyle(.ink2)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
                .rise(hidden: splash, delay: 0.18)
        }
    }

    /// The two ways in, a failure if there was one, and the legal line.
    private var actions: some View {
        VStack(spacing: 0) {
            VStack(spacing: 10) {
                appleButton
                googleButton
            }
            .disabled(working != nil)

            if let message = error ?? model.session.notice {
                Text(message)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.redInk)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity)
                    .background(.redSoft, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                    .padding(.top, 16)
                    .accessibilityIdentifier("signin.error")
            }

            // Two set lines: the documents always together on the second, neither name ever broken.
            VStack(spacing: 3) {
                Text("Free forever. By continuing, you agree to the")
                Text(legalLinks)
            }
            .font(.caption)
            .foregroundStyle(.ink2)
            .tint(.ink2)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 20)
        }
        .rise(hidden: splash, delay: 0.26)
    }

    /// "Terms of Service and Privacy Policy.", the names underlined in a light gray.
    private var legalLinks: AttributedString {
        var text = (try? AttributedString(markdown: "[Terms\u{A0}of\u{A0}Service](https://hyperanchor.app/terms) and [Privacy\u{A0}Policy](https://hyperanchor.app/privacy).")) ?? AttributedString()
        for run in text.runs where run.link != nil {
            text[run.range].underlineStyle = Text.LineStyle(pattern: .solid, color: .ink4)
        }
        return text
    }

    @ViewBuilder
    private var appleButton: some View {
        if model.launch.demo {
            // UI tests and demos can't drive the system sheet: a stand-in that signs in to the demo account.
            Button { Task { await signInStub(.apple) } } label: {
                HStack(spacing: 8) {
                    Image(systemName: "apple.logo")
                    Text(working == .apple ? "Signing in…" : "Continue with Apple")
                }
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
            .frame(height: ProviderButtonStyle.height)
            .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
            .accessibilityIdentifier("signin.apple")
        }
    }

    private var googleButton: some View {
        Button { Task { await signInWithGoogle() } } label: {
            HStack(spacing: 8) {
                if working == .google {
                    ProgressView().tint(scheme == .dark ? .black : .white)
                } else {
                    Image("GoogleG").resizable().frame(width: 18, height: 18)
                }
                Text(working == .google ? "Signing in…" : "Continue with Google")
            }
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

/// "Continue with Google" (and the demo's Apple stand-in), matching the system Sign in with Apple button next to it:
/// full width, black (white in dark mode), 48 points, the mark centered next to the label.
struct ProviderButtonStyle: ButtonStyle {
    static let height: CGFloat = 48
    @Environment(\.colorScheme) private var scheme

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.system(size: 18.5, weight: .medium))
            .foregroundStyle(scheme == .dark ? Color.black : Color.white)
            .frame(height: Self.height)
            .frame(maxWidth: .infinity)
            .background(scheme == .dark ? Color.white : Color.black, in: RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
            .opacity(configuration.isPressed ? 0.8 : 1)
            .scaleEffect(configuration.isPressed ? 0.985 : 1)
            .animation(.easeOut(duration: 0.15), value: configuration.isPressed)
    }
}

/// "Own your day." — the last word goes once around day / week / month, each sliding up into place, and comes
/// to rest on "day.". Starts when `moving` turns on; with Reduce Motion it stays on "day.".
private struct Headline: View {
    let size: CGFloat
    let moving: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var index = 0
    private static let words = ["day.", "week.", "month."]

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 0) {
            Text("Own your ")
            ZStack(alignment: .leading) {
                Text(Self.words[index])
                    .id(index)
                    .transition(.push(from: .bottom))
            }
        }
        .font(.system(size: size, weight: .semibold))
        .tracking(-0.032 * size)
        .foregroundStyle(.ink)
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .clipped()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Own your day, week and month.")
        .accessibilityAddTraits(.isHeader)
        .task(id: moving && !reduceMotion) {
            guard moving, !reduceMotion else {
                if reduceMotion { index = 0 }
                return
            }
            for _ in Self.words.indices {
                try? await Task.sleep(for: .seconds(2.2))
                guard !Task.isCancelled else { return }
                withAnimation(.timingCurve(0.7, 0, 0.2, 1, duration: 0.45)) { index = (index + 1) % Self.words.count }
            }
        }
    }
}

/// Hidden while the launch screen hands over; then fades in from a little below, after `delay`.
private struct Rise: ViewModifier {
    let hidden: Bool
    let delay: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .opacity(hidden ? 0 : 1)
            .offset(y: hidden && !reduceMotion ? 14 : 0)
            .animation(reduceMotion ? .easeInOut(duration: 0.35) : .timingCurve(0.2, 0.8, 0.2, 1, duration: 0.7).delay(delay), value: hidden)
    }
}

private extension View {
    func rise(hidden: Bool, delay: Double) -> some View {
        modifier(Rise(hidden: hidden, delay: delay))
    }
}
