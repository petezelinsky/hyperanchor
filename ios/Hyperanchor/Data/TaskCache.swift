import Foundation

/// The tasks and the queue of unsent changes, on disk: the app opens instantly with what it had and
/// keeps changes made offline across launches. One file per signed-in account.
final class TaskCache: Sendable {
    struct Snapshot: Codable, Sendable {
        var version = 1
        var tasks: [TaskItem]
        var outbox: [PendingOperation]
    }

    let url: URL
    private let queue = DispatchQueue(label: "app.hyperanchor.cache", qos: .utility)

    /// `account` keeps different people's tasks apart on a shared device.
    init(directory: URL, account: String) {
        let safe = account.addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "default"
        url = directory.appending(path: "tasks-\(safe).json")
    }

    static var defaultDirectory: URL {
        let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }

    func load() -> Snapshot? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Snapshot.self, from: data)
    }

    /// Writes in the background; the latest snapshot wins.
    func save(_ snapshot: Snapshot) {
        guard let data = try? JSONEncoder().encode(snapshot) else { return }
        let url = url
        queue.async {
            try? data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
        }
    }

    func clear() {
        let url = url
        queue.async { try? FileManager.default.removeItem(at: url) }
    }
}
