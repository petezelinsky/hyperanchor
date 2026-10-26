import Foundation
import Observation

/// Who is signed in. The token lives in the Keychain; a 401 from the server signs out.
@MainActor
@Observable
final class Session {
    private(set) var user: AppUser?
    /// `google:<sub>` or `apple:<sub>`, as on the server.
    private(set) var accountID: String?
    /// Shown on the sign-in screen after the server ended the session.
    var notice: String?

    @ObservationIgnored let backend: Backend
    @ObservationIgnored private let keychain: Keychain?

    var provider: SignInProvider? {
        accountID.flatMap { SignInProvider(rawValue: String($0.prefix { $0 != ":" })) }
    }

    /// `keychain` nil: nothing is remembered (demo and UI tests).
    init(backend: Backend, keychain: Keychain?, signedIn demo: AppUser? = nil) {
        self.backend = backend
        self.keychain = keychain
        if let demo {
            user = demo
            accountID = "demo:\(demo.email)"
        } else if let stored = keychain?.load() {
            user = stored.user
            accountID = JWT.subject(stored.token)
            backend.setToken(stored.token)
        }
    }

    /// Exchanges a provider's ID token for the server's own token.
    func signIn(provider: SignInProvider, idToken: String, nonce: String?, name: String?) async throws {
        let (token, serverUser) = try await backend.signIn(provider: provider, idToken: idToken, nonce: nonce, name: name)
        var user = serverUser
        // Apple shares the name only once; keep the one we had for this account.
        let account = JWT.subject(token) ?? "\(provider.rawValue):unknown"
        if let previous = keychain?.load(), JWT.subject(previous.token) == account, user.name == user.email, previous.user.name != previous.user.email {
            user.name = previous.user.name
        }
        backend.setToken(token)
        keychain?.save(Keychain.Stored(token: token, user: user))
        notice = nil
        accountID = account
        self.user = user
    }

    func signOut() {
        keychain?.clear()
        backend.setToken(nil)
        user = nil
        accountID = nil
    }

    /// The server rejected the token: back to the sign-in screen, with a note.
    func expired() {
        guard user != nil else { return }
        signOut()
        notice = "Your session has ended. Please sign in again."
    }

    /// Deletes the account and everything in it, then signs out. For Apple, `appleAuthorizationCode` lets the server revoke the token.
    func deleteAccount(appleAuthorizationCode: String?) async throws {
        try await backend.deleteAccount(appleAuthorizationCode: appleAuthorizationCode)
        signOut()
    }
}
