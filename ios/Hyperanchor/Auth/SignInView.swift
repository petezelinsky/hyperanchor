import AuthenticationServices
import SwiftUI

/// The signed-out home screen, as on the web: sign-in (logo, headline, Apple and Google, legal) and the animated showcase.
/// iPhone: sign-in fills the first screen with the showcase peeking in below, the footer last.
/// iPad (regular width and height): side by side, sign-in and the footer on the left, the showcase on the right.
struct SignInView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.webAuthenticationSession) private var webAuthentication
    @Environment(\.colorScheme) private var scheme
    @Environment(\.horizontalSizeClass) private var widthClass
    @Environment(\.verticalSizeClass) private var heightClass
    @State private var working: SignInProvider?
    @State private var error: String?
    @State private var appleNonce = Nonce.make()
    @State private var legal: URL?
    /// The showcase's pause button stops every looping animation on the screen, the headline's word included.
    @State private var paused = false

    var body: some View {
        Group {
            if widthClass == .regular, heightClass == .regular { split } else { stacked }
        }
        .background(.surface)
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .environment(\.openURL, OpenURLAction { url in
            legal = url
            return .handled
        })
        .sheet(item: $legal) { SafariView(url: $0).ignoresSafeArea() }
    }

    private var stacked: some View {
        GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        main(headline: min(40, max(32, geo.size.width * 0.094)))
                            .padding(.vertical, 40)
                            .frame(maxHeight: .infinity)
                    }
                    .column(padding: 20)
                    .padding(.top, 8)
                    // Sign-in fills the first screen; the showcase peeks in below it.
                    .frame(minHeight: min(geo.size.height - 180, 640))

                    Showcase(paused: $paused)
                        .frame(minHeight: 640)
                        .padding(.horizontal, 12)

                    footer
                        .column(padding: 20)
                        .padding(.top, 20)
                        .padding(.bottom, 12)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
        }
    }

    private var split: some View {
        GeometryReader { geo in
            HStack(spacing: 0) {
                ScrollView {
                    VStack(alignment: .leading, spacing: 0) {
                        header
                        main(headline: 40)
                            .padding(.vertical, 56)
                            .frame(maxHeight: .infinity)
                        footer
                    }
                    .column(padding: 32)
                    .padding(.top, 32)
                    .padding(.bottom, 36)
                    .frame(minHeight: geo.size.height)
                }
                .scrollBounceBehavior(.basedOnSize)
                .frame(width: geo.size.width / 2.15)

                Showcase(paused: $paused)
                    .padding(16)
            }
        }
    }

    private var header: some View {
        Wordmark(size: 20)
            .frame(height: 32)
            .rise(0, distance: 0)
    }

    private func main(headline size: CGFloat) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Headline(size: size, moving: !paused)
                .rise(0)
            Text("Hyperanchor is a calm, fast planner.\nSign in to get started.")
                .font(.callout)
                .lineSpacing(4)
                .foregroundStyle(.ink2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)
                .rise(0.07)

            VStack(spacing: 10) {
                appleButton
                googleButton
            }
            .disabled(working != nil)
            .padding(.top, 32)
            .rise(0.14)

            if let message = error ?? model.session.notice {
                Text(message)
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.redInk)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(.redSoft, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .padding(.top, 16)
                    .accessibilityIdentifier("signin.error")
            }

            Text(legalText)
                .font(.caption)
                .lineSpacing(3)
                .foregroundStyle(.ink2)
                .tint(.ink2)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 20)
                .rise(0.21)
        }
    }

    /// "Free forever…", with the links underlined in a light gray, as on the web.
    private var legalText: AttributedString {
        var text = (try? AttributedString(markdown: "Free forever. By continuing, you agree to the [Terms of Service](https://hyperanchor.app/terms) and [Privacy Policy](https://hyperanchor.app/privacy).")) ?? AttributedString()
        for run in text.runs where run.link != nil {
            text[run.range].underlineStyle = Text.LineStyle(pattern: .solid, color: .ink4)
        }
        return text
    }

    private var footer: some View {
        HStack(spacing: 20) {
            Text("© 2026 Hyperanchor")
            Spacer(minLength: 0)
            Link("Privacy", destination: URL(string: "https://hyperanchor.app/privacy")!)
                .frame(minHeight: 44)
            Link("Terms", destination: URL(string: "https://hyperanchor.app/terms")!)
                .frame(minHeight: 44)
        }
        .font(.caption)
        .foregroundStyle(.ink2)
        .tint(.ink2)
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

/// "Own your day." — the last word cycles day / week / month, each sliding up into place. Stops while the showcase
/// is paused; with Reduce Motion it stays on "day.".
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
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(2.6))
                guard !Task.isCancelled else { return }
                withAnimation(.timingCurve(0.7, 0, 0.2, 1, duration: 0.4)) { index = (index + 1) % Self.words.count }
            }
        }
    }
}

/// The web's `rise` entrance: fades in from 8 points below, after `delay`. Nothing with Reduce Motion.
private struct Rise: ViewModifier {
    let delay: Double
    let distance: CGFloat
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    func body(content: Content) -> some View {
        let visible = shown || reduceMotion
        content
            .opacity(visible ? 1 : 0)
            .offset(y: visible ? 0 : distance)
            .onAppear {
                withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.6).delay(delay)) { shown = true }
            }
    }
}

private extension View {
    func rise(_ delay: Double, distance: CGFloat = 8) -> some View {
        modifier(Rise(delay: delay, distance: distance))
    }

    /// The sign-in column: at most 380 points wide, centered, with side margins.
    func column(padding: CGFloat) -> some View {
        frame(maxWidth: 380, alignment: .leading)
            .padding(.horizontal, padding)
            .frame(maxWidth: .infinity)
    }
}
