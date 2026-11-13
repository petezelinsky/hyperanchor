import Foundation
import Observation
import QuartzCore
import UIKit

/// What the voice screen is doing (VoiceScreen.tsx): listening; writing down what was said (on the server); waiting for
/// the tasks to come back; or at rest. Where the server hears speech itself, the voice is recorded and sent once the
/// person stops, in any language, worked out without asking (Settings can name one); elsewhere the device's recognizer
/// writes the words under the sphere as they come. Then a window comes up at once, with lines filling in while the words
/// are sorted, then the tasks on their days: each can be reworded, moved to another day or left out. From there it's one
/// step to add them, to speak some more, or to leave. Typing (or pasting) works the same way.
@MainActor
@Observable
final class SpeakModel {
    enum Phase: Equatable {
        case listening, hearing, sorting, idle
    }

    /// Something went wrong, in words, and what trying again would take: the text to sort once more (`again`), the
    /// recording to write down once more (`audio`), or a visit to Settings (`settings`).
    struct Problem {
        let message: String
        var again: String?
        var audio: Recording?
        var settings = false
    }

    /// What the screen takes from the app.
    struct Context {
        let backend: Backend
        let today: @MainActor () -> DayKey
        let weekStart: @MainActor () -> Int
        /// The language picked in Settings, if any.
        let language: String?
        /// The person's latest task titles: what the spoken language is guessed from.
        let sample: [String]
        /// UI tests: a made-up voice instead of the microphone.
        let simulated: Bool
        /// Listen on the device even where the server writes speech down (`-listenOnDevice`, to try that path).
        let onDevice: Bool
        /// The session ran out: back to signing in.
        let unauthorized: @MainActor () -> Void
        let close: @MainActor () -> Void
    }

    /// About the least a short note costs to hear and sort: with less left today, listening doesn't start.
    static let enough = 2100
    /// The most that is sorted at once (the server's limit).
    static let textMax = 6000

    private(set) var phase = Phase.idle {
        didSet { updateRings() }
    }
    /// Typing instead of speaking.
    private(set) var typing = false
    /// Whether this screen can listen at all; otherwise it's typing only.
    private(set) var hears = true
    /// The server writes down what is said; otherwise the device listens.
    private(set) var records = true
    /// Words heard (or written down), and the ones still being worked out.
    private(set) var said = ""
    private(set) var saying = ""
    private(set) var speaking = false {
        didSet { updateRings() }
    }
    var text = ""
    var drafts = DraftList()
    private(set) var problem: Problem?
    /// Today's tokens are used up: nothing more can be heard or sorted until tomorrow.
    private(set) var spent = false
    /// The window with the tasks: up from the moment sorting starts.
    var review = false
    /// Asking before leaving with tasks in hand.
    var confirming = false
    /// Seconds spoken so far, while recording.
    private(set) var elapsed: TimeInterval = 0
    /// Changes when the box for typing should take the keyboard.
    private(set) var typeFocus = 0
    /// Opening: how the server listens is still being asked (a moment at most).
    private(set) var starting = true

    @ObservationIgnored private var context: Context?
    @ObservationIgnored private var recorder: Recorder?
    @ObservationIgnored private var dictation: Dictation?
    /// The language the device listens in, for this opening of the screen.
    @ObservationIgnored private var language = "en-US"
    @ObservationIgnored private var rings: [CGFloat: ParticleRing] = [:]
    @ObservationIgnored private var clock: Task<Void, Never>?
    @ObservationIgnored private var alive = false
    /// The person switched between typing and speaking themselves.
    @ObservationIgnored private var chose = false

    // MARK: What the screen shows

    var busy: Bool { phase == .sorting }
    var hearing: Bool { phase == .hearing }
    /// How many tasks would be added.
    var count: Int { drafts.count }

    /// Under the sphere: what's happening.
    var caption: String {
        switch phase {
        case .listening: records ? "Listening · \(listeningClock(elapsed))" : "Listening"
        case .hearing: "Writing it down…"
        case .sorting: "Sorting into tasks…"
        case .idle: ""
        }
    }

    /// Under the sphere when there are no words to show.
    var hint: String {
        if phase == .listening { return "Say what you need to do, and when." }
        if typing || hearing || starting { return "" }
        return count > 0 ? "Anything else? Speak again, or add what you have." : "Press Speak again and say what you need to do."
    }

    /// For VoiceOver: what state the screen is in, without reading every word as it is heard.
    var status: String {
        switch phase {
        case .sorting: "Sorting into tasks"
        case .hearing: "Writing down what you said"
        case .listening: "Listening"
        case .idle: problem?.message ?? (count > 0 ? "\(VoiceCopy.tasks(count)) ready to add" : "")
        }
    }

    // MARK: Opening and closing

    /// Opens listening at once. Meanwhile it asks what's left of today's tokens: with too little for even a short note,
    /// listening stops and says so, before anything is said.
    func open(_ context: Context) {
        guard !alive else { return }
        alive = true
        self.context = context
        language = SpokenLanguage.picked(context.language).map(SpokenLanguage.withRegion)
            ?? SpokenLanguage.guess(sample: context.sample, preferred: Locale.preferredLanguages)
        let offer = AIOffer.shared
        if let known = offer.usage {
            begin(known)
            Task {
                let fresh = await offer.refresh(context.backend)
                self.check(fresh)
            }
        } else {
            // How the server listens isn't known yet: a moment to ask, then on either way.
            Task {
                let usage = await Self.answer(within: 1.5) { await offer.refresh(context.backend) }
                guard self.alive else { return }
                self.begin(usage ?? offer.usage)
                self.check(usage ?? offer.usage)
            }
        }
    }

    private func begin(_ usage: Usage?) {
        guard let context else { return }
        starting = false
        records = !context.onDevice && (usage?.features?.transcribe ?? true)
        hears = records || context.simulated || Dictation.recognizer(for: language) != nil
        // Typing was picked while the server was being asked: it stays.
        guard !chose else { return }
        typing = !hears
        if hears { listen() } else { typeFocus += 1 }
    }

    private func check(_ usage: Usage?) {
        guard alive, let usage, usage.today.left < Self.enough, phase == .listening || phase == .idle else { return }
        cancelListening()
        speaking = false
        saying = ""
        spent = true
        phase = .idle
        problem = Problem(message: VoiceCopy.limit)
    }

    /// The screen is gone: the microphone closes and nothing more is reported.
    func end() {
        alive = false
        cancelListening()
    }

    /// Leaves the screen.
    func close() {
        cancelListening()
        context?.close()
    }

    /// Leaving the stage: with tasks waiting, they're shown first, so nothing said is lost to a slip of the hand.
    func leave() {
        guard !drafts.isEmpty else { return close() }
        cancelListening()
        saying = ""
        speaking = false
        if phase == .listening { phase = .idle }
        review = true
    }

    /// Closing the window: with tasks in it, only after a second, deliberate step.
    func discard() {
        if !drafts.isEmpty, !confirming, phase != .sorting {
            confirming = true
            return
        }
        close()
    }

    /// What Add saves (nil while there's nothing to add); listening stops.
    func add() -> [TaskDraft]? {
        let ready = drafts.ready
        guard !ready.isEmpty, phase != .sorting else { return nil }
        cancelListening()
        return ready
    }

    /// The app went to the background: listening stops as Done would, and what was said is kept.
    func backgrounded() {
        if phase == .listening { stop() }
    }

    // MARK: Listening

    func listen() {
        guard let context else { return }
        cancelListening()
        problem = nil
        review = false
        confirming = false
        said = ""
        saying = ""
        phase = .listening
        if records {
            let recorder = Recorder(simulated: context.simulated, handlers: .init(
                speaking: { [weak self] in self?.speaking = $0 },
                stop: { [weak self] reason, audio in self?.recorded(reason, audio) }
            ))
            self.recorder = recorder
            elapsed = 0
            startClock()
            Task { await recorder.start() }
        } else {
            let dictation = Dictation(language: language, simulated: context.simulated, handlers: .init(
                text: { [weak self] said, saying in
                    self?.said = said
                    self?.saying = saying
                },
                speaking: { [weak self] in self?.speaking = $0 },
                stop: { [weak self] reason, words in self?.heard(reason, words) }
            ))
            self.dictation = dictation
            Task { await dictation.start() }
        }
    }

    /// Done speaking.
    func stop() {
        if let recorder { recorder.stop() } else { dictation?.stop() }
    }

    private func cancelListening() {
        recorder?.cancel()
        recorder = nil
        dictation?.cancel()
        dictation = nil
        clock?.cancel()
    }

    /// The time spoken so far, while recording.
    private func startClock() {
        clock?.cancel()
        clock = Task { [weak self] in
            while !Task.isCancelled {
                guard let self, self.phase == .listening, let recorder = self.recorder else { return }
                self.elapsed = recorder.elapsed
                try? await Task.sleep(for: .milliseconds(250))
            }
        }
    }

    private func recorded(_ reason: ListenStop, _ audio: Recording?) {
        recorder = nil
        clock?.cancel()
        speaking = false
        guard let audio else {
            phase = .idle
            problem = Problem(message: VoiceCopy.stopped(reason), settings: reason == .denied)
            return
        }
        phase = .hearing
        Task { await hear(audio) }
    }

    /// Whatever ended the listening, words that were heard are sorted: nothing said is lost to a late hiccup.
    private func heard(_ reason: ListenStop, _ words: String) {
        dictation = nil
        saying = ""
        speaking = false
        guard !words.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            phase = .idle
            problem = Problem(message: VoiceCopy.stopped(reason), settings: reason == .denied || reason == .recognitionDenied)
            return
        }
        said = words
        phase = .sorting
        Task { await sort(words) }
    }

    // MARK: Writing down and sorting

    /// Sends a recording to be written down; the words that come back are sorted into tasks.
    func hear(_ audio: Recording) async {
        guard let context else { return }
        // Listening stops when the app goes to the background; what was said still gets there.
        let time = BackgroundTime()
        defer { time.end() }
        phase = .hearing
        problem = nil
        do {
            let answer = try await context.backend.transcribe(
                audio: audio.data, mimeType: Recording.mimeType, seconds: audio.seconds, language: SpokenLanguage.picked(context.language))
            guard alive else { return }
            AIOffer.shared.left(answer.left)
            let words = answer.text.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !words.isEmpty else {
                phase = .idle
                problem = Problem(message: VoiceCopy.nothingHeard)
                return
            }
            said = words
            await sort(words)
        } catch {
            guard alive else { return }
            if (error as? APIError) == .unauthorized { return context.unauthorized() }
            let failure = error as? AIFailure ?? .failed
            if failure == .limit { spent = true }
            phase = .idle
            problem = Problem(message: VoiceCopy.hearing(failure), audio: [.busy, .failed, .offline].contains(failure) ? audio : nil)
        }
    }

    /// Sends `words` to be sorted; the window comes up at once, and the tasks that come back join the ones already there.
    func sort(_ words: String) async {
        guard let context else { return }
        let clean = words.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        guard clean.count <= Self.textMax else {
            phase = .idle
            review = true
            problem = Problem(message: VoiceCopy.tooMuch)
            return
        }
        phase = .sorting
        problem = nil
        confirming = false
        review = true
        let time = BackgroundTime()
        defer { time.end() }
        do {
            let answer = try await context.backend.parseTasks(text: clean, today: context.today(), weekStart: context.weekStart())
            guard alive else { return }
            AIOffer.shared.left(answer.left)
            said = ""
            text = ""
            if answer.tasks.isEmpty {
                problem = Problem(message: VoiceCopy.noTasks)
            } else {
                drafts.append(answer.tasks)
            }
        } catch {
            guard alive else { return }
            if (error as? APIError) == .unauthorized { return context.unauthorized() }
            let failure = error as? AIFailure ?? .failed
            if failure == .limit { spent = true }
            problem = Problem(message: VoiceCopy.sorting(failure), again: [.busy, .failed, .offline].contains(failure) ? clean : nil)
        }
        phase = .idle
    }

    /// Try again: the recording or the words that didn't get through.
    func retry() {
        if let audio = problem?.audio {
            Task { await hear(audio) }
        } else if let again = problem?.again {
            Task { await sort(again) }
        }
    }

    // MARK: Typing

    /// Typing instead of speaking, or back to speaking.
    func type(_ on: Bool) {
        chose = true
        cancelListening()
        speaking = false
        saying = ""
        said = ""
        problem = nil
        typing = on
        if on {
            phase = .idle
            typeFocus += 1
        } else {
            listen()
        }
    }

    /// From the window back to the stage, for more: listening again, or the box to type in.
    func more() {
        if typing {
            review = false
            problem = nil
            typeFocus += 1
        } else {
            listen()
        }
    }

    // MARK: The sphere

    /// The sphere at `diameter` points: one for each size the screen is shown at, moving to what this screen hears.
    func ring(diameter: CGFloat, reduced: Bool) -> ParticleRing {
        if let ring = rings[diameter] {
            ring.reduced = reduced
            return ring
        }
        let ring = ParticleRing(diameter: diameter, reduced: reduced)
        ring.listen = { [weak self] in self?.source?.heard(at: CACurrentMediaTime()) }
        rings[diameter] = ring
        configure(ring)
        return ring
    }

    private var source: HeardSource? { recorder?.source ?? dictation?.source }

    private func updateRings() {
        for ring in rings.values { configure(ring) }
    }

    private func configure(_ ring: ParticleRing) {
        let mode: RingMode = phase == .listening ? .speech : phase == .sorting || phase == .hearing ? .steady : .silent
        ring.mode = mode
        ring.intensity = mode == .steady ? 0.55 : 1
        ring.gate = mode == .speech ? (speaking ? 1 : 0) : nil
    }

    // MARK: Helpers

    /// `work`'s answer, or nil when it takes longer than `seconds` (the work goes on regardless).
    private static func answer<T: Sendable>(within seconds: Double, _ work: @escaping @MainActor () async -> T?) async -> T? {
        await withCheckedContinuation { (done: CheckedContinuation<T?, Never>) in
            let once = Once(done)
            Task { @MainActor in once.resume(await work()) }
            Task { @MainActor in
                try? await Task.sleep(for: .seconds(seconds))
                once.resume(nil)
            }
        }
    }

    /// A little time to finish a request when the app goes to the background meanwhile.
    @MainActor
    private final class BackgroundTime {
        private var id = UIBackgroundTaskIdentifier.invalid

        init() {
            id = UIApplication.shared.beginBackgroundTask(withName: "Speak your tasks") { [weak self] in self?.end() }
        }

        func end() {
            guard id != .invalid else { return }
            UIApplication.shared.endBackgroundTask(id)
            id = .invalid
        }
    }

    @MainActor
    private final class Once<T: Sendable> {
        private var continuation: CheckedContinuation<T?, Never>?
        init(_ continuation: CheckedContinuation<T?, Never>) { self.continuation = continuation }
        func resume(_ value: T?) {
            continuation?.resume(returning: value)
            continuation = nil
        }
    }
}
