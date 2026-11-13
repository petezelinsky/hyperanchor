import AVFoundation
import QuartzCore
import Speech

/// A finished recording: AAC in an M4A file's bytes, and how long it is.
struct Recording: Sendable {
    let data: Data
    let seconds: Double

    /// What the server is told the audio is (it names the file `speech.m4a` for the speech model).
    static let mimeType = "audio/x-m4a"
}

/// What the screen reads while listening: what was heard a moment ago (for the sphere) and the newest level (for telling
/// a voice from a pause).
protocol HeardSource: AnyObject, Sendable {
    /// What to show at `now` (seconds on the media clock): readings are played back a buffer behind the microphone, so
    /// the sphere moves smoothly although the audio arrives in tenths of a second.
    func heard(at now: Double) -> Heard?
    /// The newest level, and whether any sound has come through yet.
    var meter: (level: Float, live: Bool) { get }
}

/// The tap's side of listening, on the audio engine's own thread: it writes the recording, feeds the device's speech
/// recognizer and works out the meter. The main thread reaches its state only through the two locks.
final class TapSink: HeardSource, @unchecked Sendable {
    /// Guards what the tap writes to: the file, the converter, the recognizer's request, the meter.
    private let lock = NSLock()
    /// Guards the readings the screen takes.
    private let readLock = NSLock()

    private let url: URL?
    private var file: AVAudioFile?
    private var fileRate: Double = 0
    private var frames: AVAudioFramePosition = 0
    private var converter: AVAudioConverter?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var analyzer: SpectrumAnalyzer?

    private var pending: [(time: Double, heard: Heard)] = []
    private var shown: Heard?
    private var newest = Heard.silence
    private var live = false
    private var latency = 0.13

    /// `url`: where to record (nil: listen only, for the recognizer and the sphere).
    init(recordingTo url: URL?) {
        self.url = url
    }

    /// Ready for audio in `format`: the recording file on the first call (one channel, AAC, 48 kbit/s as the web
    /// records), and the meter for its sample rate (again after the input changes).
    func prepare(for format: AVAudioFormat) throws {
        lock.lock()
        defer { lock.unlock() }
        if analyzer?.sampleRate != format.sampleRate { analyzer = SpectrumAnalyzer(sampleRate: format.sampleRate) }
        guard let url, file == nil else { return }
        let rate = min(format.sampleRate, 48_000)
        var settings: [String: Any] = [
            AVFormatIDKey: kAudioFormatMPEG4AAC, AVSampleRateKey: rate, AVNumberOfChannelsKey: 1, AVEncoderBitRateKey: 48_000,
        ]
        do {
            file = try AVAudioFile(forWriting: url, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
        } catch {
            // Some rates (a headset's 16 kHz) take the encoder's own bit rate.
            settings[AVEncoderBitRateKey] = nil
            file = try AVAudioFile(forWriting: url, settings: settings, commonFormat: .pcmFormatFloat32, interleaved: false)
        }
        fileRate = rate
    }

    /// The recognizer's request the audio goes to (listening on the device), or none.
    func setRequest(_ request: SFSpeechAudioBufferRecognitionRequest?) {
        lock.lock()
        self.request = request
        lock.unlock()
    }

    /// One buffer from the microphone.
    func process(_ buffer: AVAudioPCMBuffer, _ when: AVAudioTime) {
        let length = Int(buffer.frameLength)
        guard length > 0 else { return }
        var readings: [(time: Double, heard: Heard)] = []
        var isLive = false
        lock.lock()
        request?.append(buffer)
        if let file { write(buffer, to: file) }
        if let analyzer, let samples = buffer.floatChannelData?[0] {
            let rate = buffer.format.sampleRate
            let start = when.isHostTimeValid ? AVAudioTime.seconds(forHostTime: when.hostTime) : CACurrentMediaTime() - Double(length) / rate
            analyzer.feed(samples, count: length) { end, heard in
                readings.append((start + Double(end) / rate, heard))
            }
            isLive = analyzer.live
        }
        lock.unlock()
        guard !readings.isEmpty else { return }
        let buffered = Double(length) / buffer.format.sampleRate
        readLock.lock()
        pending += readings
        if pending.count > 64 { pending.removeFirst(pending.count - 64) }
        newest = readings[readings.count - 1].heard
        live = isLive
        latency = buffered + 0.03
        readLock.unlock()
    }

    /// Into the file, converted when the microphone's format isn't the file's (another rate, more channels).
    private func write(_ buffer: AVAudioPCMBuffer, to file: AVAudioFile) {
        let target = file.processingFormat
        if buffer.format == target {
            if (try? file.write(from: buffer)) != nil { frames += AVAudioFramePosition(buffer.frameLength) }
            return
        }
        if converter?.inputFormat != buffer.format {
            converter = AVAudioConverter(from: buffer.format, to: target)
            converter?.downmix = true
        }
        guard let converter else { return }
        let capacity = AVAudioFrameCount((Double(buffer.frameLength) * target.sampleRate / buffer.format.sampleRate).rounded(.up)) + 64
        guard let out = AVAudioPCMBuffer(pcmFormat: target, frameCapacity: capacity) else { return }
        var given = false
        var error: NSError?
        let status = converter.convert(to: out, error: &error) { _, inputStatus in
            if given {
                inputStatus.pointee = .noDataNow
                return nil
            }
            given = true
            inputStatus.pointee = .haveData
            return buffer
        }
        guard status != .error, out.frameLength > 0, (try? file.write(from: out)) != nil else { return }
        frames += AVAudioFramePosition(out.frameLength)
    }

    /// Ends the recording: the file is closed (which finishes it), read, and removed from the device.
    func finish() -> Recording? {
        lock.lock()
        let seconds = fileRate > 0 ? Double(frames) / fileRate : 0
        file = nil
        converter = nil
        request = nil
        analyzer = nil
        lock.unlock()
        guard let url else { return nil }
        defer { try? FileManager.default.removeItem(at: url) }
        guard let data = try? Data(contentsOf: url) else { return nil }
        return Recording(data: data, seconds: seconds)
    }

    /// Stops taking audio and throws the recording away.
    func discard() {
        _ = finish()
    }

    func heard(at now: Double) -> Heard? {
        readLock.lock()
        defer { readLock.unlock() }
        let due = now - latency
        var taken = 0
        while taken < pending.count, pending[taken].time <= due {
            shown = pending[taken].heard
            taken += 1
        }
        if taken > 0 { pending.removeFirst(taken) }
        return shown
    }

    var meter: (level: Float, live: Bool) {
        readLock.lock()
        defer { readLock.unlock() }
        return (newest.level, live)
    }
}

/// The microphone, open for one stretch of listening: the audio session (record only, with as little of the system's
/// processing as it allows) and the engine whose tap feeds a `TapSink`. Opening and closing run in order on a queue of
/// their own, since the session can take a moment, never on the main thread. A call, Siri or the input going away ends
/// the listening (`onInterruption`); what was heard up to then is kept by whoever listens.
final class Microphone: @unchecked Sendable {
    private let queue = DispatchQueue(label: "app.hyperanchor.microphone", qos: .userInitiated)
    private let engine = AVAudioEngine()
    /// On `queue`: the sink the tap feeds while the microphone is open.
    private var sink: TapSink?
    private let onInterruption: @MainActor @Sendable () -> Void
    private var observers: [NSObjectProtocol] = []

    init(onInterruption: @escaping @MainActor @Sendable () -> Void) {
        self.onInterruption = onInterruption
        let center = NotificationCenter.default
        observers.append(center.addObserver(forName: AVAudioSession.interruptionNotification, object: nil, queue: .main) { note in
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt
            guard raw.flatMap({ AVAudioSession.InterruptionType(rawValue: $0) }) == .began else { return }
            MainActor.assumeIsolated { onInterruption() }
        })
        observers.append(center.addObserver(forName: AVAudioSession.mediaServicesWereResetNotification, object: nil, queue: .main) { _ in
            MainActor.assumeIsolated { onInterruption() }
        })
        // A headset plugged in or out can change what the microphone delivers: the engine stops, and is started again
        // with the new input (the recording converts it).
        observers.append(center.addObserver(forName: .AVAudioEngineConfigurationChange, object: engine, queue: nil) { [weak self] _ in
            guard let self else { return }
            self.queue.async { self.restart() }
        })
    }

    deinit {
        for observer in observers { NotificationCenter.default.removeObserver(observer) }
    }

    /// Whether the microphone may be used; asks the first time.
    static func allowed() async -> Bool {
        switch AVAudioApplication.shared.recordPermission {
        case .granted: true
        case .denied: false
        default: await AVAudioApplication.requestRecordPermission()
        }
    }

    /// Opens the microphone into `sink`: nil once audio is flowing, otherwise what's in the way.
    func open(_ sink: TapSink) async -> ListenStop? {
        await withCheckedContinuation { done in
            queue.async { done.resume(returning: self.openNow(sink)) }
        }
    }

    /// Closes the microphone (the sink keeps what it has) and gives the audio back to other apps.
    func close() async {
        await withCheckedContinuation { done in
            queue.async {
                self.closeNow()
                done.resume()
            }
        }
    }

    private func openNow(_ sink: TapSink) -> ListenStop? {
        closeNow()
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.record, mode: .measurement, options: [])
            // The start and stop of listening are felt as well as seen.
            try session.setAllowHapticsAndSystemSoundsDuringRecording(true)
            try session.setActive(true)
        } catch {
            return session.isInputAvailable ? .error : .noMicrophone
        }
        guard session.isInputAvailable else {
            deactivate()
            return .noMicrophone
        }
        self.sink = sink
        guard tap(into: sink) else {
            self.sink = nil
            deactivate()
            return engine.inputNode.outputFormat(forBus: 0).channelCount == 0 ? .noMicrophone : .error
        }
        return nil
    }

    /// Taps the input in the format it delivers now and starts the engine.
    private func tap(into sink: TapSink) -> Bool {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard format.sampleRate > 0, format.channelCount > 0, (try? sink.prepare(for: format)) != nil else { return false }
        input.installTap(onBus: 0, bufferSize: 4096, format: format) { @Sendable buffer, when in
            sink.process(buffer, when)
        }
        engine.prepare()
        do {
            try engine.start()
            return true
        } catch {
            input.removeTap(onBus: 0)
            return false
        }
    }

    private func restart() {
        guard let sink else { return }
        engine.inputNode.removeTap(onBus: 0)
        guard tap(into: sink) else {
            closeNow()
            let interrupted = onInterruption
            Task { @MainActor in interrupted() }
            return
        }
    }

    private func closeNow() {
        guard sink != nil else { return }
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
        sink = nil
        deactivate()
    }

    private func deactivate() {
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}

/// A voice for the UI tests (`-uitest`), where no microphone is asked for: about three seconds of syllables after a
/// short wait, then quiet, so listening runs its whole course, stopping by itself.
final class SimulatedVoice: HeardSource, @unchecked Sendable {
    private let started = CACurrentMediaTime()

    private func reading(at now: Double) -> Heard {
        let t = now - started
        guard t > 0.6, t < 3.6 else { return .silence }
        let x = t * 4.3
        let f = x - x.rounded(.down)
        let level = Float(f < 0.22 ? 0.5 - 0.5 * cos(f / 0.22 * .pi) : exp(-(f - 0.22) * 2.8)) * 0.8
        var bands = SIMD16<Float>.zero
        for k in 0..<16 { bands[k] = level * Float(0.4 + 0.6 * abs(sin(Double(k) * 0.9 + t * 3))) }
        return Heard(level: level, bands: bands)
    }

    func heard(at now: Double) -> Heard? { reading(at: now) }

    var meter: (level: Float, live: Bool) { (reading(at: CACurrentMediaTime()).level, true) }
}
