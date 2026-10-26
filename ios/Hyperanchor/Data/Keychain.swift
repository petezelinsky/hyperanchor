import Foundation
import Security

/// The session token and the signed-in person, in the Keychain.
struct Keychain: Sendable {
    let service: String

    init(service: String = "app.hyperanchor.session") {
        self.service = service
    }

    struct Stored: Codable, Sendable {
        var token: String
        var user: AppUser
    }

    func load() -> Stored? {
        var query = base
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess, let data = item as? Data else { return nil }
        return try? JSONDecoder().decode(Stored.self, from: data)
    }

    func save(_ stored: Stored) {
        guard let data = try? JSONEncoder().encode(stored) else { return }
        let attributes: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        if SecItemUpdate(base as CFDictionary, attributes as CFDictionary) == errSecItemNotFound {
            SecItemAdd(base.merging(attributes) { $1 } as CFDictionary, nil)
        }
    }

    func clear() {
        SecItemDelete(base as CFDictionary)
    }

    private var base: [String: Any] {
        [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: "session"]
    }
}

enum JWT {
    /// The `sub` claim of a JWT, without verifying it (the server does that): the account id, e.g. `apple:001234.abcd`.
    static func subject(_ token: String) -> String? {
        let parts = token.split(separator: ".")
        guard parts.count == 3 else { return nil }
        var b64 = parts[1].replacingOccurrences(of: "-", with: "+").replacingOccurrences(of: "_", with: "/")
        while b64.count % 4 != 0 { b64 += "=" }
        guard let data = Data(base64Encoded: b64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        else { return nil }
        return json["sub"] as? String
    }
}
