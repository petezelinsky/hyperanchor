import SwiftUI

/// The keyboard shortcuts (iPad, or any device with a keyboard), as Settings → Keyboard shortcuts lists them on the web.
struct ShortcutsView: View {
    @Environment(\.settingsMargin) private var margin
    private let offer = AIOffer.shared

    private var groups: [(title: String, items: [(keys: String, what: String)])] {
        [
            ("Anywhere", [("N", "New task")] + (offer.voice == true ? [("V", "Speak your tasks")] : []) + [
                ("F", "Focus: one task at a time"),
                ("/", "Search all tasks"),
                ("T", "Go to today"),
                ("← →", "Previous / next"),
                ("D W M", "Day, week, month"),
                ("A", "Progress"),
                ("[", "Show or hide the sidebar"),
                ("⌘ Z", "Undo the last action"),
                ("?", "Keyboard shortcuts"),
                (",", "Settings"),
            ]),
            ("In a list", [
                ("↑ ↓", "Select a task"),
                ("⌥ ↑ ↓", "Move it up or down"),
                ("Space", "Complete"),
                ("↵", "Edit the title"),
                ("⌫", "Delete"),
                ("Esc", "Cancel or deselect"),
            ]),
            ("In focus", [
                ("Space", "Done"),
                ("→", "Later"),
                ("N", "Jot something down"),
                ("Esc", "Leave focus"),
            ]),
        ]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 260), spacing: 32, alignment: .top)], alignment: .leading, spacing: 20) {
                    ForEach(groups, id: \.title) { group in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(group.title.uppercased())
                                .font(.token(Tokens.Typography.caption2, weight: .semibold))
                                .tracking(0.06 * 11)
                                .foregroundStyle(.ink3)
                                .padding(.bottom, 4)
                                .accessibilityAddTraits(.isHeader)
                            ForEach(Array(group.items.enumerated()), id: \.offset) { i, item in
                                HStack(spacing: 16) {
                                    Text(item.what)
                                        .font(.token(Tokens.Typography.footnote))
                                        .foregroundStyle(.ink2)
                                    Spacer(minLength: 0)
                                    HStack(spacing: 4) {
                                        ForEach(item.keys.split(separator: " ").map(String.init), id: \.self) { Kbd(text: $0) }
                                    }
                                }
                                .frame(minHeight: 36)
                                .overlay(alignment: .bottom) {
                                    if i < group.items.count - 1 { Rectangle().fill(.line).frame(height: 1) }
                                }
                                .accessibilityElement(children: .ignore)
                                .accessibilityLabel("\(item.what): \(Self.spoken(item.keys))")
                            }
                        }
                    }
                }
                Text("Hold ⌘ to see them anytime.")
                    .font(.token(Tokens.Typography.caption))
                    .foregroundStyle(.ink3)
            }
            .padding(.horizontal, margin)
            .padding(.top, 16)
            .padding(.bottom, 24)
        }
        .settingsChrome("Keyboard shortcuts")
    }

    /// How VoiceOver reads the keys.
    private static func spoken(_ keys: String) -> String {
        let names = ["←": "left arrow", "→": "right arrow", "↑": "up arrow", "↓": "down arrow", "⌘": "command", "⌥": "option",
                     "↵": "return", "⌫": "delete", "Esc": "escape", "/": "slash", "[": "left bracket", "?": "question mark", ",": "comma"]
        return keys.split(separator: " ").map { names[String($0)] ?? String($0) }.joined(separator: " ")
    }
}

/// A small key cap (the web's Kbd).
struct Kbd: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.token(Tokens.Typography.caption2, weight: .medium))
            .foregroundStyle(.ink3)
            .padding(.horizontal, 6)
            .frame(minWidth: 20, minHeight: 20)
            .background(.surface2, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(.line, lineWidth: 1))
    }
}
