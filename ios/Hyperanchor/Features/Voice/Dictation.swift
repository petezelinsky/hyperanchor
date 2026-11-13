import Foundation
import QuartzCore
import Speech

/// Listening on the device (src/components/voice/dictation.ts), for a server that doesn't write speech down itself:
/// Apple's speech recognizer, on the device wherever it can be, turns what is said into words as they come, and they
/// show under the sphere. A recognizer ends a stretch by itself now and then; listening goes on in a new one, keeping
/// the words of the last. Words still being worked out when listening stops are kept too.
@MainActor
final class Dictation {
    struct Handlers {
        /// What has been heard: confirmed words, and the ones still being worked out.
        var text: @MainActor (String, String) -> Void
        /// Words are arriving (true) or there's a pause (false).
        var speaking: @MainActor (Bool) -> Void
        /// Listening is over, with everything that was heard.
        var stop: @MainActor (ListenStop, String) -> Void
    }

    /// What the UI tests "say" when listening on the device is simulated: the demo's own sample.
    private static let sample = "Tomorrow call the dentist about the crown and buy oat milk. On Friday book the flights for March, window seat."

    private let language: String
    private let handlers: Handlers
    private let simulated: Bool
    private var recognizer: SFSpeechRecognizer?
    private var microphone: Microphone?
    private var sink: TapSink?
    private var voice: SimulatedVoice?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    /// Words from stretches the recognizer has already closed.
    private var kept = ""
    private var said = ""
    private var saying = ""
    private var wanted = false
    private var ended: ListenStop?
    private var restarts = 0
    private var watch = WordsWatch(started: 0)
    private var speaking = false
    private var giveUpAt: Double?
    private var looking: Task<Void, Never>?
    private var generation = 0
    private var over = false

    /// `language`: a tag such as "ru-RU" (the guess, or the one picked in Settings).
    init(language: String, simulated: Bool, handlers: Handlers) {
        self.language = language
        self.simulated = simulated
        self.handlers = handlers
    }

    /// What the sphere moves to: the same microphone, read alongside the recognizer.
    var source: HeardSource? { sink ?? voice }

    /// A recognizer for `language`: as named, then with the language's usual region, then the device's own.
    static func recognizer(for language: String) -> SFSpeechRecognizer? {
        for tag in [language, SpokenLanguage.withRegion(SpokenLanguage.base(language))] {
            if let r = SFSpeechRecognizer(locale: Locale(identifier: tag)) { return r }
        }
        return SFSpeechRecognizer()
    }

    /// Whether speech recognition may be used; asks the first time.
    static func allowed() async -> Bool {
        switch SFSpeechRecognizer.authorizationStatus() {
        case .authorized: return true
        case .notDetermined:
            return await withCheckedContinuation { done in
                SFSpeechRecognizer.requestAuthorization { @Sendable status in done.resume(returning: status == .authorized) }
            }
        default: return false
        }
    }

    func start() async {
        guard !over else { return }
        wanted = true
        if simulated {
            voice = SimulatedVoice()
            begin()
            return simulateWords()
        }
        guard await Self.allowed() else { return finish(.recognitionDenied) }
        guard await Microphone.allowed() else { return finish(.denied) }
        guard !over else { return }
        // A recognizer that isn't available right now works on Apple's servers and has no connection.
        guard let recognizer = Self.recognizer(for: language), recognizer.isAvailable else { return finish(.network) }
        self.recognizer = recognizer
        let sink = TapSink(recordingTo: nil)
        let microphone = Microphone { [weak self] in self?.stop() }
        self.sink = sink
        self.microphone = microphone
        openStretch()
        if let problem = await microphone.open(sink) { return finish(problem) }
        guard !over else { return close() }
        begin()
    }

    private func begin() {
        watch = WordsWatch(started: CACurrentMediaTime())
        looking = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(100))
                guard let self, !self.over else { return }
                self.look()
            }
        }
    }

    /// The person is done: the last words are still collected, then `stop` is called.
    func stop() {
        guard wanted else { return }
        wanted = false
        ended = .stopped
        endStretch()
    }

    /// Stops at once and reports nothing (the screen is closing, or listening starts over).
    func cancel() {
        guard !over else { return }
        over = true
        wanted = false
        close()
    }

    // MARK: Stretches

    /// A new request to the recognizer; the microphone stays open between them.
    private func openStretch() {
        guard let recognizer, let sink else { return }
        generation += 1
        let stretch = generation
        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        request.taskHint = .dictation
        request.addsPunctuation = true
        // On the device wherever it can be: what is said stays on it.
        if recognizer.supportsOnDeviceRecognition { request.requiresOnDeviceRecognition = true }
        self.request = request
        sink.setRequest(request)
        task = recognizer.recognitionTask(with: request) { @Sendable [weak self] result, error in
            let text = result?.bestTranscription.formattedString ?? ""
            let lastWord = result?.bestTranscription.segments.last?.substringRange.location
            let final = result?.isFinal ?? false
            let failed = error != nil
            DispatchQueue.main.async {
                MainActor.assumeIsolated {
                    self?.received(stretch, text: text, lastWord: lastWord, final: final, failed: failed)
                }
            }
        }
    }

    /// No more audio for this stretch: the recognizer answers with its last words, then the stretch ends. If it
    /// never says it has ended, listening ends anyway a moment later.
    private func endStretch() {
        guard let request else { return finish(ended ?? .stopped) }
        request.endAudio()
        giveUpAt = CACurrentMediaTime() + 1.5
    }

    private func received(_ stretch: Int, text: String, lastWord: Int?, final: Bool, failed: Bool) {
        guard stretch == generation, !over else { return }
        if !text.isEmpty {
            if final {
                said = text
                saying = ""
            } else {
                // The last word is the one still being worked out.
                let cut = min(lastWord ?? 0, (text as NSString).length)
                said = (text as NSString).substring(to: cut).trimmingCharacters(in: .whitespaces)
                saying = (text as NSString).substring(from: cut)
            }
            restarts = 0
            handlers.text(Self.join(kept, said), saying)
            heard()
        }
        guard final || failed else { return }
        // This stretch is over: what it heard is kept, confirmed or not.
        kept = Self.join(kept, said, saying)
        said = ""
        saying = ""
        if let ended { return finish(ended) }
        guard wanted else { return finish(.stopped) }
        // The recognizer stopped by itself (a pause, its own time limit): listen on. One that keeps refusing is left alone.
        restarts += 1
        guard restarts <= 6 else { return finish(recognizer?.isAvailable == false ? .network : .error) }
        handlers.text(kept, "")
        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(120))
            guard let self, self.wanted, self.generation == stretch else { return }
            self.openStretch()
        }
    }

    private func heard() {
        let now = CACurrentMediaTime()
        watch.heard(at: now)
        if !speaking {
            speaking = true
            handlers.speaking(true)
        }
    }

    /// Ten times a second: the pause after the last words, and the end of a stretch that never says so.
    private func look() {
        guard !over else { return }
        let now = CACurrentMediaTime()
        if speaking, !watch.speaking(at: now) {
            speaking = false
            handlers.speaking(false)
        }
        if let giveUpAt, now >= giveUpAt { return finish(ended ?? .stopped) }
        guard wanted, let stop = watch.stop(at: now, anything: !Self.join(kept, said, saying).isEmpty) else { return }
        wanted = false
        ended = stop
        endStretch()
    }

    // MARK: The end

    private func finish(_ reason: ListenStop) {
        guard !over else { return }
        over = true
        let text = Self.join(kept, said, saying)
        close()
        if speaking { handlers.speaking(false) }
        handlers.stop(reason, text)
    }

    private func close() {
        looking?.cancel()
        task?.cancel()
        task = nil
        request = nil
        sink?.setRequest(nil)
        if let microphone, let sink {
            Task {
                await microphone.close()
                sink.discard()
            }
        }
    }

    private static func join(_ parts: String...) -> String {
        parts.map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }.joined(separator: " ")
    }

    // MARK: UI tests

    /// The sample comes in a word at a time, as a recognizer would give it, then a pause ends the listening.
    private func simulateWords() {
        let words = Self.sample.split(separator: " ").map(String.init)
        Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(600))
            for i in words.indices {
                guard let self, self.wanted, !self.over else { return }
                self.said = words[..<i].joined(separator: " ")
                self.saying = words[i]
                self.handlers.text(self.said, self.saying)
                self.heard()
                try? await Task.sleep(for: .milliseconds(260))
            }
            guard let self, !self.over else { return }
            self.said = Self.sample
            self.saying = ""
            self.handlers.text(self.said, "")
        }
    }
}
