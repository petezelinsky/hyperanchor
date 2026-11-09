import Foundation

/// Today's tasks as the Today widget shows them. The app writes it to the shared App Group container
/// whenever today's tasks change; the widget only reads it.
struct WidgetSnapshot: Codable, Equatable, Sendable {
    struct Item: Codable, Equatable, Sendable {
        var title: String
        var done: Bool
    }

    /// "YYYY-MM-DD" — the day the snapshot is for.
    var day: String
    var tasks: [Item]
    var signedIn: Bool
    /// The chosen accent and its track, light and dark, as 0xRRGGBB.
    var accent: [UInt32]
    var track: [UInt32]

    static let appGroup = "group.app.hyperanchor"

    static var url: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup)?.appending(path: "widget-today.json")
    }

    static func load() -> WidgetSnapshot? {
        guard let url, let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(WidgetSnapshot.self, from: data)
    }

    func save() {
        guard let url = Self.url, let data = try? JSONEncoder().encode(self) else { return }
        try? data.write(to: url, options: .atomic)
    }

    static let placeholder = WidgetSnapshot(
        day: "",
        tasks: [Item(title: "Plan the week", done: true), Item(title: "Send the proposal to Dana", done: true),
                Item(title: "Review the design feedback", done: false), Item(title: "Call Mom", done: false),
                Item(title: "30-minute walk", done: false)],
        signedIn: true,
        accent: [0x2563EB, 0x3B82F6],
        track: [0xD5E2FD, 0x1A3263]
    )
}
