import SwiftUI

/// The keyboard shortcuts (iPad or a hardware keyboard), as on the web's "?" sheet.
struct ShortcutsView: View {
    @Environment(\.dismiss) private var dismiss

    private let groups: [(String, [(String, String)])] = [
        ("Anywhere", [
            ("N", "New task"),
            ("F", "Focus: one task at a time"),
            ("T", "Go to today"),
            ("← →", "Previous / next"),
            ("D W M A", "Switch view"),
            ("?", "Show shortcuts"),
            (",", "Settings"),
        ]),
        ("In a list", [
            ("↑ ↓", "Select a task"),
            ("Space", "Complete"),
            ("↩", "Edit the title"),
            ("⌫", "Delete"),
            ("Esc", "Cancel or deselect"),
        ]),
    ]

    var body: some View {
        NavigationStack {
            List {
                ForEach(groups, id: \.0) { group in
                    Section(group.0) {
                        ForEach(group.1, id: \.1) { keys, what in
                            HStack {
                                Text(what).foregroundStyle(.ink2)
                                Spacer()
                                HStack(spacing: 4) {
                                    ForEach(keys.split(separator: " ").map(String.init), id: \.self) { Kbd(text: $0) }
                                }
                            }
                            .accessibilityElement(children: .combine)
                        }
                    }
                }
                Section {
                } footer: {
                    Text("Hold ⌘ to see them anytime.")
                }
            }
            .navigationTitle("Keyboard Shortcuts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() }.fontWeight(.semibold) }
            }
        }
        .tint(.ink)
        .presentationDetents([.medium, .large])
    }
}

/// A small key cap.
struct Kbd: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.caption.weight(.medium))
            .foregroundStyle(.ink2)
            .padding(.horizontal, 6)
            .frame(minWidth: 22, minHeight: 22)
            .background(.surface, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(.line2))
            .shadow(color: .line2, radius: 0, y: 1)
    }
}
