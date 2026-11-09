import Combine
import GameController
import SwiftUI

// Key hints: small key caps on buttons that have a keyboard shortcut ("Done  Space"). The web hides them on touch
// screens; here they show only on iPad while a hardware keyboard is attached — never on iPhone.

extension EnvironmentValues {
    /// Whether to show key hints. Set by `readsHardwareKeyboard()`.
    @Entry var showsKeyHints = false
}

extension View {
    /// Shows key hints in this view on iPad while a hardware keyboard is attached (see `\.showsKeyHints`) — or once
    /// one has been `used` here, in case the system hasn't reported it.
    func readsHardwareKeyboard(used: Bool = false) -> some View {
        modifier(HardwareKeyboardReader(used: used))
    }
}

private struct HardwareKeyboardReader: ViewModifier {
    let used: Bool
    @State private var attached = GCKeyboard.coalesced != nil

    func body(content: Content) -> some View {
        content
            .environment(\.showsKeyHints, (attached || used) && UIDevice.current.userInterfaceIdiom == .pad)
            .onReceive(NotificationCenter.default.publisher(for: .GCKeyboardDidConnect).receive(on: RunLoop.main)) { _ in
                attached = true
            }
            .onReceive(NotificationCenter.default.publisher(for: .GCKeyboardDidDisconnect).receive(on: RunLoop.main)) { _ in
                attached = GCKeyboard.coalesced != nil
            }
            .task {
                // The game controller framework finds keyboards shortly after it is first asked.
                try? await Task.sleep(for: .milliseconds(500))
                attached = GCKeyboard.coalesced != nil
            }
    }
}

/// A small key cap, as on the web: `.plain` stands on its own (like `Kbd`), `.onPrimary` sits inside a black
/// primary button, `.onSecondary` inside a white one. Hidden from VoiceOver (the button already says what it does).
struct KeyHint: View {
    enum Tone { case plain, onPrimary, onSecondary }

    let key: String
    var tone: Tone = .plain

    var body: some View {
        Text(key)
            .font(.caption2.weight(.medium))
            .foregroundStyle(foreground)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 6)
            .frame(minWidth: 20, minHeight: 20)
            .background(background, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
            .overlay {
                if tone == .plain {
                    RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(.line2)
                }
            }
            .shadow(color: tone == .plain ? .line2 : .clear, radius: 0, y: 1)
            .accessibilityHidden(true)
    }

    private var foreground: Color {
        switch tone {
        case .plain: .ink2
        case .onPrimary: Color.onPrimary.opacity(0.75)
        case .onSecondary: .ink3
        }
    }

    private var background: Color {
        switch tone {
        case .plain: .surface
        case .onPrimary: Color.onPrimary.opacity(0.15)
        case .onSecondary: .surface3
        }
    }
}
