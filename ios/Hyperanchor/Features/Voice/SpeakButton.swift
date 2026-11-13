import SwiftUI

/// Speak your tasks, with the voice screen's sphere drawn small and still as its sign. It opens the voice screen
/// (`router.showSpeak`), and V does the same on a keyboard. Two forms: `.compact`, a round 44-point button for the bar at
/// the foot of Day (Liquid Glass on iOS 26 and later, a material elsewhere, solid with Reduce Transparency), and
/// `.full`, the web's small quiet chip with the word "Speak". It shows only where the server offers speaking tasks
/// (`Usage.features.voice`); it asks the server itself, now and then, so whoever places it needs nothing else.
struct SpeakButton: View {
    enum Form {
        /// A round 44-point button with the sphere only.
        case compact
        /// The sphere and "Speak" in a small outlined chip (the web's `SpeakChip`).
        case full
    }

    private let form: Form
    @Environment(Router.self) private var router
    @Environment(AppModel.self) private var app
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    private let offer = AIOffer.shared

    init(_ form: Form = .compact) {
        self.form = form
    }

    /// Whether speaking tasks is offered by a server that answered `usage`: it is unless the server says it has no
    /// sorting (no Anthropic key); an older server that doesn't say, or no answer yet, counts as yes (as on the web,
    /// a call the server can't take is worded on the voice screen).
    nonisolated static func isOffered(usage: Usage?) -> Bool {
        usage?.features?.voice ?? true
    }

    var body: some View {
        Group {
            if offer.offered {
                button
                    .keyboardShortcut("v", modifiers: [])
                    .accessibilityLabel("Speak your tasks")
                    .accessibilityIdentifier("speak")
                    .transition(.opacity)
            } else {
                Color.clear.frame(width: 0, height: 0)
            }
        }
        .task { await offer.refreshIfStale(app.session.backend) }
    }

    @ViewBuilder
    private var button: some View {
        switch form {
        case .full:
            Button(action: open) {
                HStack(spacing: 6) {
                    Orb(size: 16)
                    Text("Speak")
                }
            }
            .buttonStyle(ChipStyle())
        case .compact:
            let sphere = Orb(size: 22)
                .foregroundStyle(Color.ink)
                .frame(width: 44, height: 44)
                .contentShape(Circle())
            if #available(iOS 26.0, *), !reduceTransparency {
                Button(action: open) { sphere.glassEffect(.regular.interactive(), in: .circle) }
                    .buttonStyle(.plain)
            } else {
                Button(action: open) { sphere }
                    .buttonStyle(RoundStyle(solid: reduceTransparency))
            }
        }
    }

    private func open() {
        router.showSpeak = true
    }

    /// The round button before Liquid Glass: a material disc with a hairline (solid with Reduce Transparency).
    private struct RoundStyle: ButtonStyle {
        let solid: Bool

        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .background {
                    if solid {
                        Circle().fill(Color.surface)
                    } else {
                        Circle().fill(.regularMaterial)
                    }
                }
                .overlay { Circle().strokeBorder(Color.line2, lineWidth: 1) }
                .elevation(Tokens.Shadow.lift, in: Circle())
                .scaleEffect(configuration.isPressed ? 0.94 : 1)
                .animation(.spring(duration: 0.2), value: configuration.isPressed)
        }
    }

    private struct ChipStyle: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            let shape = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
            configuration.label
                .font(.token(Tokens.Typography.footnote, weight: .medium))
                .foregroundStyle(configuration.isPressed ? Color.ink : .ink2)
                .lineLimit(1)
                .padding(.leading, 8)
                .padding(.trailing, 10)
                .frame(minHeight: 28)
                .background(configuration.isPressed ? Color.surface3 : .surface, in: shape)
                .overlay { shape.strokeBorder(Color.line2, lineWidth: 1) }
                .contentShape(Rectangle())
                .tapTarget()
                .animation(.easeOut(duration: Tokens.Motion.fast), value: configuration.isPressed)
        }
    }
}

