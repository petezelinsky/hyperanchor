import SwiftUI

/// First visit: what Hyperanchor is for, the four moves that matter (with the gesture for each), and a way to try them —
/// a note on the page, not a card over it, on the same left edge as the list it stands in for (the web's welcome).
struct WelcomeNote: View {
    let name: String
    /// The column it stands in (the list's width on iPad).
    let column: CGFloat
    let examples: () -> Void
    let own: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    private static let steps: [(title: String, touch: String)] = [
        ("Add what’s on your mind", "Tap +"),
        ("Tick tasks off as you go", "Tap the box, or swipe right"),
        ("Stuck? Do one thing at a time", "Tap the focus button"),
        ("Plans change: move a task to another day", "Swipe left for tomorrow"),
    ]

    var body: some View {
        let wide = sizeClass == .regular
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Welcome, \(name).")
                    .font(.token(Tokens.Typography.title2, weight: .semibold))
                    .tracking(-0.02 * Tokens.Typography.title2.size)
                    .foregroundStyle(.ink)
                    .accessibilityAddTraits(.isHeader)
                Text("Hyperanchor keeps your day calm: one list, one clear next step. Four things are enough to start.")
                    .font(.token(Tokens.Typography.body))
                    .foregroundStyle(.ink2)
                    .padding(.top, 4)
                VStack(alignment: .leading, spacing: 0) {
                    ForEach(Self.steps, id: \.title) { step in
                        VStack(alignment: .leading, spacing: 0) {
                            Text(step.title)
                                .font(.token(Tokens.Typography.body))
                                .foregroundStyle(.ink)
                            Text(step.touch)
                                .font(.token(Tokens.Typography.caption))
                                .foregroundStyle(.ink3)
                        }
                        .padding(.vertical, 8)
                        .frame(maxWidth: .infinity, minHeight: 44, alignment: .leading)
                        .hairline(.bottom)
                        .accessibilityElement(children: .combine)
                    }
                }
                .hairline(.top)
                .padding(.top, 20)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) { buttons }
                    VStack(alignment: .leading, spacing: 8) { buttons }
                }
                .padding(.top, 24)
            }
            .frame(maxWidth: 520, alignment: .leading)
            .padding(.horizontal, wide ? 12 : 16)
            .padding(.top, wide ? 32 : 24)
            .padding(.bottom, 24)
            .frame(maxWidth: column, alignment: .leading)
            .frame(maxWidth: .infinity)
        }
        .scrollBounceBehavior(.basedOnSize)
    }

    @ViewBuilder
    private var buttons: some View {
        Button("Try it with three examples", action: examples)
            .buttonStyle(NoteButtonStyle(primary: true))
            .accessibilityIdentifier("welcome.examples")
        Button("Start with my own", action: own)
            .buttonStyle(NoteButtonStyle(primary: false))
            .accessibilityIdentifier("welcome.own")
    }
}

/// The welcome's two buttons (the web's medium buttons): black, or plain; 32 points tall, answering in 44.
private struct NoteButtonStyle: ButtonStyle {
    let primary: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.token(Tokens.Typography.footnote, weight: .medium))
            .foregroundStyle(primary ? Color.onPrimary : .ink2)
            .lineLimit(1)
            .padding(.horizontal, 12)
            .frame(minHeight: 32)
            .background(primary ? Color.primaryFill : configuration.isPressed ? .surface3 : .clear,
                        in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .scaleEffect(primary && configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
            .padding(.vertical, 6)
            .contentShape(Rectangle())
            .padding(.vertical, -6)
    }
}
