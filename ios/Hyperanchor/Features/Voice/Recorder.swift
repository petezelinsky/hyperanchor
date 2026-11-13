import Foundation
import QuartzCore

/// Listening, with the hearing done on the server (src/components/voice/recorder.ts): the microphone is recorded here,
/// and once the person is done the recording goes to `POST /api/voice/transcribe`, where a speech model writes it down,
/// in any language, mixed ones too. The same microphone moves the sphere (the meter) and tells when the person has
/// stopped talking, so listening ends by itself after a pause.
@MainActor
final class Recorder {
    struct Handlers {
        /// A voice is heard (true) or there's a pause (false).
        var speaking: @MainActor (Bool) -> Void
        /// Listening is over: the recording, or nil when there's nothing worth sending (no microphone, nothing said).
        var stop: @MainActor (ListenStop, Recording?) -> Void
    }

    private let handlers: Handlers
    private let simulated: Bool
    private var microphone: Microphone?
    private var sink: TapSink?
    private var voice: SimulatedVoice?
    private var watch: SilenceWatch?
    private var looking: Task<Void, Never>?
    private var reason: ListenStop?
    private var over = false
    private var started: Double = 0

    /// `simulated`: a voice made up for the UI tests instead of the microphone.
    init(simulated: Bool, handlers: Handlers) {
        self.simulated = simulated
        self.handlers = handlers
    }

    /// What the sphere moves to.
    var source: HeardSource? { sink ?? voice }

    /// Seconds since listening started.
    var elapsed: TimeInterval { started > 0 ? CACurrentMediaTime() - started : 0 }

    func start() async {
        guard !over else { return }
        if simulated {
            voice = SimulatedVoice()
            return begin()
        }
        guard await Microphone.allowed() else { return end(.denied, nil) }
        guard !over else { return }
        let sink = TapSink(recordingTo: FileManager.default.temporaryDirectory.appending(path: "speech-\(UUID().uuidString).m4a"))
        // A call or Siri ends the listening as Done would: what was said so far is kept.
        let microphone = Microphone { [weak self] in self?.stop() }
        self.sink = sink
        self.microphone = microphone
        if let problem = await microphone.open(sink) {
            sink.discard()
            return end(problem, nil)
        }
        guard !over else {
            await microphone.close()
            sink.discard()
            return
        }
        begin()
    }

    private func begin() {
        started = CACurrentMediaTime()
        // Done was pressed while the microphone was still opening.
        if let reason { return stopNow(reason) }
        watch = SilenceWatch(started: started)
        looking = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .milliseconds(100))
                guard let self, !self.over else { return }
                self.look()
            }
        }
    }

    /// The voice and the pauses, from the meter: a pause after words, or no words at all, ends the listening.
    private func look() {
        guard !over, reason == nil, var watch, let source else { return }
        let meter = source.meter
        let step = watch.update(level: meter.level, live: meter.live, now: CACurrentMediaTime())
        self.watch = watch
        if let speaking = step.speaking { handlers.speaking(speaking) }
        if let stop = step.stop { self.stop(stop) }
    }

    /// The person is done (or listening ended by itself): what was recorded goes to `stop`.
    func stop(_ reason: ListenStop = .stopped) {
        guard !over, self.reason == nil else { return }
        self.reason = reason
        if started > 0 { stopNow(reason) }
    }

    private func stopNow(_ reason: ListenStop) {
        looking?.cancel()
        Task { await finish(reason) }
    }

    private func finish(_ reason: ListenStop) async {
        let seconds = elapsed
        var recording: Recording?
        if voice != nil {
            recording = Recording(data: Data(count: 2048), seconds: seconds)
        } else if let microphone, let sink {
            await microphone.close()
            recording = sink.finish()
        }
        let live = source?.meter.live ?? false
        let worth = recording.map {
            SilenceWatch.worthSending(reason: reason, seconds: $0.seconds, bytes: $0.data.count, live: live, spoke: watch?.spoke ?? false)
        } ?? false
        end(reason, worth ? recording : nil)
    }

    /// Stops at once and reports nothing (the screen is closing, or listening starts over).
    func cancel() {
        guard !over else { return }
        over = true
        looking?.cancel()
        if let microphone, let sink {
            Task {
                await microphone.close()
                sink.discard()
            }
        }
    }

    private func end(_ reason: ListenStop, _ recording: Recording?) {
        guard !over else { return }
        over = true
        looking?.cancel()
        if watch?.speaking == true { handlers.speaking(false) }
        handlers.stop(reason, recording)
    }
}
