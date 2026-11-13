import Foundation

/// Why listening ended: the person stopped it, a long pause, the time ran out, or something in the way.
enum ListenStop: Sendable, Equatable {
    case stopped, silence, limit
    /// The microphone isn't allowed (Settings → Privacy).
    case denied
    /// Speech recognition isn't allowed (listening on the device).
    case recognitionDenied
    case noMicrophone
    /// Listening on the device needs a connection here.
    case network
    case error
}

/// When a recording ends by itself (`Recorder.watch` in src/components/voice/recorder.ts): the meter tells a voice from
/// a pause, so listening stops five seconds after the person stops talking, after twelve seconds of nothing at all,
/// and at four and a half minutes in any case (the server takes five at a time).
struct SilenceWatch {
    static let longest: TimeInterval = 4.5 * 60
    /// A pause this long after something was said ends the listening.
    static let afterWords: TimeInterval = 5
    /// Nothing said at all for this long: there's no point in listening on.
    static let atStart: TimeInterval = 12
    /// The meter's level that counts as a voice, and the lower one it has to fall under to count as a pause.
    static let voiceOn: Float = 0.16
    static let voiceOff: Float = 0.08
    static let hold: TimeInterval = 0.6

    /// What changed at one look: whether a voice is heard now (when that changed), and whether to stop.
    struct Step: Equatable {
        var speaking: Bool?
        var stop: ListenStop?
    }

    let started: TimeInterval
    private(set) var voiceAt: TimeInterval
    private(set) var spoke = false
    private(set) var speaking = false

    init(started: TimeInterval) {
        self.started = started
        voiceAt = started
    }

    /// One look at the meter (ten a second): its `level` (0…1) and whether any sound has reached it yet.
    mutating func update(level: Float, live: Bool, now: TimeInterval) -> Step {
        if now - started > Self.longest { return Step(stop: .limit) }
        // While no sound has come through there's no telling a pause from a voice: listening waits for Done.
        guard live else { return Step() }
        let voice = level > (speaking ? Self.voiceOff : Self.voiceOn)
        if voice {
            voiceAt = now
            spoke = true
        }
        var step = Step()
        let speakingNow = voice || now - voiceAt < Self.hold
        if speakingNow != speaking {
            speaking = speakingNow
            step.speaking = speakingNow
        }
        if spoke ? now - voiceAt > Self.afterWords : now - started > Self.atStart { step.stop = .silence }
        return step
    }

    /// Whether a finished recording is worth writing down: long enough, and not only silence (by the meter's account)
    /// when listening ended by itself. When the person pressed Done it is sent anyway: a quiet voice may still be there.
    static func worthSending(reason: ListenStop, seconds: Double, bytes: Int, live: Bool, spoke: Bool) -> Bool {
        bytes > 0 && seconds >= 0.6 && !(live && !spoke && reason != .stopped)
    }
}

/// When listening on the device ends by itself (`Dictation.waitForSilence` in src/components/voice/dictation.ts): the
/// words tell, not the meter. 4.5 seconds after the last words, 12 with none at all, 4.5 minutes in any case.
struct WordsWatch {
    static let afterWords: TimeInterval = 4.5
    static let atStart: TimeInterval = 12
    /// Words arriving count as speaking for this long.
    static let hold: TimeInterval = 0.7

    let started: TimeInterval
    private(set) var wordsAt: TimeInterval?

    init(started: TimeInterval) {
        self.started = started
    }

    mutating func heard(at now: TimeInterval) {
        wordsAt = now
    }

    func speaking(at now: TimeInterval) -> Bool {
        wordsAt.map { now - $0 < Self.hold } ?? false
    }

    /// Whether to stop now; `anything` tells whether any words have been heard so far.
    func stop(at now: TimeInterval, anything: Bool) -> ListenStop? {
        if now - started > SilenceWatch.longest { return .limit }
        if anything { return now - (wordsAt ?? started) > Self.afterWords ? .silence : nil }
        return now - started > Self.atStart ? .silence : nil
    }
}

/// "0:12", "1:05": how long the recording has run.
func listeningClock(_ seconds: TimeInterval) -> String {
    let s = max(0, Int(seconds))
    return "\(s / 60):" + String(format: "%02d", s % 60)
}
