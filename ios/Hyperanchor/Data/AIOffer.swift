import Foundation
import Observation

/// What the server offers of the AI (speaking tasks, the summary in Progress) and how many of today's tokens are left,
/// in one place for the whole app (`GET /api/usage`). Every AI call answers with what is left, and that number lands
/// here at once, so the account panel, the voice screen and Progress always show the same, current figure.
/// Asked when the app opens or comes back, when the account panel opens, and before the voice screen listens.
@MainActor
@Observable
final class AIOffer {
    static let shared = AIOffer()

    private(set) var usage: Usage?
    @ObservationIgnored private var asking: Task<Usage?, Never>?
    @ObservationIgnored private var askedAt: Date?

    /// Speaking tasks; nil until the server has answered (servers that don't say offer everything).
    var voice: Bool? { usage.map { $0.features?.voice ?? true } }
    /// Speech written down on the server (any language, worked out from the voice).
    var transcribe: Bool? { usage.map { $0.features?.transcribe ?? true } }
    /// The summary in Progress.
    var summary: Bool? { usage.map { $0.features?.summary ?? true } }
    /// Whether the Speak button is offered (until the server answers it is, as on the web).
    var offered: Bool { SpeakButton.isOffered(usage: usage) }
    /// Today's tokens left, as last heard.
    var left: Int? { usage?.today.left }

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
    func refreshIfStale(_ backend: Backend, after seconds: TimeInterval = 300) async {
        guard askedAt.map({ Date.now.timeIntervalSince($0) > seconds }) ?? true else { return }
        await refresh(backend)
    }

    /// What an AI call says is left today: the figure everywhere changes at once.
    func left(_ tokens: Int) {
        guard var u = usage else { return }
        u.today.left = max(0, tokens)
        u.today.used = max(0, u.today.limit - u.today.left)
        usage = u
    }

    /// Signed out: the next account has its own allowance.
    func reset() {
        asking?.cancel()
        asking = nil
        askedAt = nil
        usage = nil
    }
}
