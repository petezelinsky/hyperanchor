import SwiftUI

/// Speak your tasks: the small, quiet button beside "New task" (the web's `SpeakChip`), with the voice screen's sphere
/// drawn small and still as its sign. It opens the voice screen (`router.showSpeak`), and V does the same on a keyboard.
/// It shows only where the server offers speaking tasks (`Usage.features.voice`); it asks the server itself, now and
/// then, so whoever places it needs nothing else.
struct SpeakButton: View {
    @Environment(Router.self) private var router
    @Environment(AppModel.self) private var app
    private let offer = VoiceOffer.shared

    /// Whether speaking tasks is offered by a server that answered `usage`: it is unless the server says it has no
    /// sorting (no Anthropic key); an older server that doesn't say, or no answer yet, counts as yes (as on the web,
    /// a call the server can't take is worded on the voice screen).
    static func isOffered(usage: Usage?) -> Bool {
        usage?.features?.voice ?? true
    }

    var body: some View {
        Group {
            if offer.offered {
                Button {
                    router.showSpeak = true
                } label: {
                    HStack(spacing: 6) {
                        Orb(size: 16)
                        Text("Speak")
                    }
                }
                .buttonStyle(ChipStyle())
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

/// What the server offers for speaking tasks, and today's AI allowance, as last heard (`GET /api/usage`): asked when a
/// Speak button shows (at most every few minutes) and each time the voice screen opens.
@MainActor
@Observable
final class VoiceOffer {
    static let shared = VoiceOffer()

    private(set) var usage: Usage?
    @ObservationIgnored private var asking: Task<Usage?, Never>?
    @ObservationIgnored private var askedAt: Date?

    /// Whether the Speak button is offered.
    var offered: Bool { SpeakButton.isOffered(usage: usage) }

    /// Asks the server (one question at a time); nil when it couldn't be reached.
    @discardableResult
    func refresh(_ backend: Backend) async -> Usage? {
        if let asking { return await asking.value }
        let question = Task { try? await backend.usage() }
        asking = question
        let answer = await question.value
        asking = nil
        askedAt = .now
        if let answer { usage = answer }
        return answer
    }

    /// Asks again when the last answer is a few minutes old (or there is none).
    func refreshIfStale(_ backend: Backend) async {
        guard askedAt.map({ Date.now.timeIntervalSince($0) > 300 }) ?? true else { return }
        await refresh(backend)
    }

    /// What an AI call says is left today.
    func left(_ tokens: Int) {
        usage?.today.left = tokens
    }
}
