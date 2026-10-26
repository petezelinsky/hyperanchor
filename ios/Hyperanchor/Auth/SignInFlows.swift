import AuthenticationServices
import CryptoKit
import Foundation
import UIKit

/// A random one-time value tying a sign-in response to this request.
enum Nonce {
    static func make(length: Int = 32) -> String {
        let chars = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        var rng = SystemRandomNumberGenerator()
        return String((0..<length).map { _ in chars[Int(rng.next() % UInt64(chars.count))] })
    }

    static func sha256(_ s: String) -> String {
        SHA256.hash(data: Data(s.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// What Sign in with Apple hands back.
struct AppleCredential {
    let identityToken: String
    let authorizationCode: String?
    /// Only on the first sign-in.
    let name: String?

    init?(_ authorization: ASAuthorization) {
        guard let c = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = c.identityToken, let token = String(data: tokenData, encoding: .utf8)
        else { return nil }
        identityToken = token
        authorizationCode = c.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        let formatted = c.fullName.map { PersonNameComponentsFormatter.localizedString(from: $0, style: .default) } ?? ""
        name = formatted.isEmpty ? nil : formatted
    }
}

/// Runs Sign in with Apple outside the system button — to confirm deleting the account, which needs a
/// fresh authorization code so the server can revoke the app's access.
@MainActor
final class AppleReauthentication: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    private var continuation: CheckedContinuation<ASAuthorization, Error>?
    private var controller: ASAuthorizationController?

    func run() async throws -> AppleCredential {
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = []
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        self.controller = controller
        let authorization = try await withCheckedThrowingContinuation { c in
            continuation = c
            controller.performRequests()
        }
        guard let credential = AppleCredential(authorization) else { throw URLError(.cannotParseResponse) }
        return credential
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        MainActor.assumeIsolated {
            continuation?.resume(returning: authorization)
            continuation = nil
        }
    }

    nonisolated func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        MainActor.assumeIsolated {
            continuation?.resume(throwing: error)
            continuation = nil
        }
    }

    nonisolated func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        MainActor.assumeIsolated {
            UIApplication.shared.connectedScenes.compactMap { ($0 as? UIWindowScene)?.keyWindow }.first ?? ASPresentationAnchor()
        }
    }
}

/// Google sign-in with OAuth 2.0 + PKCE in the system browser sheet (what GoogleSignIn-iOS does internally),
/// for an OAuth client of type iOS. Ends with a Google ID token for the server to verify.
struct GoogleOAuth {
    let clientID: String
    let state = Nonce.make()
    let nonce = Nonce.make()
    private let verifier = Nonce.make(length: 64)

    enum Failure: LocalizedError {
        case notConfigured, cancelledOrInvalid, tokenExchange(String)

        var errorDescription: String? {
            switch self {
            case .notConfigured: "Google sign-in isn’t set up in this build."
            case .cancelledOrInvalid: "Sign-in didn’t work. Please try again."
            case .tokenExchange(let m): m
            }
        }
    }

    /// `com.googleusercontent.apps.<id>`: the URL scheme Google redirects back to.
    var callbackScheme: String {
        clientID.split(separator: ".").reversed().joined(separator: ".")
    }

    var redirectURI: String { "\(callbackScheme):/oauth2redirect" }

    var authorizationURL: URL {
        let challenge = Data(SHA256.hash(data: Data(verifier.utf8))).base64URL
        var c = URLComponents(string: "https://accounts.google.com/o/oauth2/v2/auth")!
        c.queryItems = [
            .init(name: "client_id", value: clientID),
            .init(name: "redirect_uri", value: redirectURI),
            .init(name: "response_type", value: "code"),
            .init(name: "scope", value: "openid email profile"),
            .init(name: "code_challenge", value: challenge),
            .init(name: "code_challenge_method", value: "S256"),
            .init(name: "state", value: state),
            .init(name: "nonce", value: nonce),
            .init(name: "prompt", value: "select_account"),
        ]
        return c.url!
    }

    /// Exchanges the code in Google's redirect for an ID token.
    func idToken(from callback: URL) async throws -> String {
        let items = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        guard items.first(where: { $0.name == "state" })?.value == state,
              let code = items.first(where: { $0.name == "code" })?.value
        else { throw Failure.cancelledOrInvalid }

        var request = URLRequest(url: URL(string: "https://oauth2.googleapis.com/token")!)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        var form = URLComponents()
        form.queryItems = [
            .init(name: "code", value: code),
            .init(name: "client_id", value: clientID),
            .init(name: "code_verifier", value: verifier),
            .init(name: "grant_type", value: "authorization_code"),
            .init(name: "redirect_uri", value: redirectURI),
        ]
        request.httpBody = form.percentEncodedQuery?.data(using: .utf8)
        let (data, response) = try await URLSession.shared.data(for: request)
        struct TokenResponse: Decodable { let id_token: String? ; let error_description: String? }
        let body = try? JSONDecoder().decode(TokenResponse.self, from: data)
        guard (response as? HTTPURLResponse)?.statusCode == 200, let token = body?.id_token else {
            throw Failure.tokenExchange(body?.error_description ?? "Google sign-in failed.")
        }
        return token
    }
}

extension Data {
    var base64URL: String {
        base64EncodedString().replacingOccurrences(of: "+", with: "-").replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
    }
}
