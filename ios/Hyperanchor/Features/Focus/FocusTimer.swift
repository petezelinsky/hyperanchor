import AVFoundation
import SwiftUI
import UIKit

/// An optional timer for a stretch of focus (the web's `FocusTimer`): one tap starts it, another stops it, and the
/// chevron beside it picks its length (remembered). When the time is up a soft chime plays (if Settings allows sounds)
/// and the phone taps twice; the bar says so for a while, then the timer rests until the next round.
struct FocusTimer: View {
    /// The lengths offered, in minutes (the web's `FOCUS_MINUTES`).
    static let lengths = [5, 10, 15, 25, 45, 60]

    @Environment(Preferences.self) private var prefs
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// When the running timer is up; nil while it rests.
    @State private var end: Date?
    /// The time just ran out: the bar says so for ten seconds.
    @State private var over = false

    private var minutes: Int { prefs.focusMinutes }
    private var shape: RoundedRectangle { RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous) }

    var body: some View {
        Group {
            if over {
                Text("\(minutes) minutes are up.")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.ink)
                    .lineLimit(1)
                    // Narrow phones: a little smaller rather than cut off.
                    .minimumScaleFactor(0.75)
                    .padding(.horizontal, 4)
                    .frame(minHeight: 32)
                    .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.96)).combined(with: .offset(y: -3)))
            } else {
                HStack(spacing: 0) {
                    if let end { running(until: end) } else { resting }
                }
                // The frame is 32 points tall; its taps reach 44.
                .background { shape.fill(.surface).frame(height: 32) }
                .overlay { shape.strokeBorder(.line2, lineWidth: 1).frame(height: 32) }
                .fixedSize()
                .accessibilityElement(children: .contain)
                .accessibilityLabel("Timer")
            }
        }
        .animation(reduceMotion ? Motion.reduced : Motion.out(Tokens.Motion.fast), value: over)
        .task(id: end) {
            guard let end else { return }
            try? await Task.sleep(for: .seconds(max(0, end.timeIntervalSinceNow)))
            guard !Task.isCancelled, self.end == end else { return }
            self.end = nil
            over = true
            timeIsUp()
        }
        .task(id: over) {
            guard over else { return }
            try? await Task.sleep(for: .seconds(10))
            if !Task.isCancelled { over = false }
        }
    }

    /// "25:00": starts it; the chevron picks the length.
    private var resting: some View {
        HStack(spacing: 0) {
            Button(action: start) {
                HStack(spacing: 8) {
                    Image(systemName: "stopwatch")
                        .font(.system(size: 13, weight: .light))
                        .foregroundStyle(.ink2)
                        .accessibilityHidden(true)
                    Text(verbatim: "\(minutes):00")
                        .monospacedDigit()
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(.ink)
                .padding(.horizontal, 10)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Start a \(minutes)-minute timer")
            .accessibilityIdentifier("focus.timer")
            Rectangle()
                .fill(.line2)
                .frame(width: 1, height: 32)
            Menu {
                Section("Timer") {
                    ForEach(Self.lengths, id: \.self) { length in
                        Toggle("\(length) min", isOn: Binding(get: { minutes == length }, set: { if $0 { prefs.focusMinutes = length } }))
                    }
                }
            } label: {
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.ink2)
                    .frame(width: 28)
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
            }
            .menuOrder(.fixed)
            .accessibilityLabel("Timer length: \(minutes) minutes. Change")
            .accessibilityIdentifier("focus.timerLength")
        }
    }

    /// The time left beside a ring that fills as it goes; a tap stops it.
    private func running(until end: Date) -> some View {
        let total = Double(minutes * 60)
        let start = end.addingTimeInterval(-total)
        return TimelineView(.periodic(from: start, by: 1)) { context in
            let left = max(0, end.timeIntervalSince(context.date))
            let seconds = Int(left.rounded(.up))
            Button(action: stop) {
                HStack(spacing: 8) {
                    ProgressRing(value: 1 - left / total, size: 14, lineWidth: 1.75)
                    Text(verbatim: "\(seconds / 60):\(String(format: "%02d", seconds % 60))")
                        .monospacedDigit()
                        .frame(minWidth: 36, alignment: .leading)
                }
                .font(.footnote.weight(.medium))
                .foregroundStyle(.ink)
                .padding(.leading, 10)
                .padding(.trailing, 12)
                .frame(minHeight: 44)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("Stop the timer")
            .accessibilityValue(Dates.plural(Int((left / 60).rounded(.up)), "minute") + " left")
            .accessibilityIdentifier("focus.timer")
        }
    }

    private func start() {
        // Ready before it's needed, so the chime plays the moment the time is up.
        if prefs.sounds { Chime.shared.prepare() }
        over = false
        end = .now.addingTimeInterval(Double(minutes * 60))
    }

    private func stop() {
        end = nil
    }

    private func timeIsUp() {
        if prefs.sounds { Chime.shared.play() }
        // Two soft taps, as phones buzz on the web.
        let tap = UIImpactFeedbackGenerator(style: .soft)
        tap.impactOccurred(intensity: 0.9)
        Task {
            try? await Task.sleep(for: .milliseconds(160))
            tap.impactOccurred(intensity: 0.9)
        }
        UIAccessibility.post(notification: .announcement, argument: "\(minutes) minutes are up.")
    }
}

/// The chime when the focus timer is up, made on the spot as the web makes it (voice/sound.ts): three unhurried drops,
/// each a little lower — sines whose pitch glides down, with a quick rise and a soft tail. It mixes with whatever else
/// is playing and stays silent when the ring switch is set to silent.
@MainActor
final class Chime {
    static let shared = Chime()

    private var player: AVAudioPlayer?

    /// Makes the sound ready to play at once.
    func prepare() {
        guard player == nil else { return }
        player = try? AVAudioPlayer(data: Self.sound, fileTypeHint: AVFileType.wav.rawValue)
        player?.prepareToPlay()
    }

    func play() {
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient)
            try AVAudioSession.sharedInstance().setActive(true)
        } catch {
            // No sound on this device just now: the timer still says the time is up.
        }
        prepare()
        player?.currentTime = 0
        player?.play()
    }

    /// The three drops as a 16-bit mono WAV: 880 → 784 Hz, then 784 → 659 Hz a third of a second later, then 659 → 523 Hz.
    private static let sound: Data = {
        let rate = 44_100.0
        let drops: [(from: Double, to: Double, at: Double, gain: Double, tail: Double)] = [
            (880, 784, 0, 0.09, 0.9),
            (784, 659, 0.34, 0.08, 0.9),
            (659, 523, 0.68, 0.075, 1.3),
        ]
        let glide = 0.06
        let rise = 0.014
        // Phones play quieter than computers: the same shape, a little louder.
        let boost = 1.8
        var samples = [Double](repeating: 0, count: Int((0.02 + 0.68 + 1.3 + 0.06) * rate))
        for drop in drops {
            let first = Int((0.02 + drop.at) * rate)
            let count = Int((drop.tail + 0.05) * rate)
            var phase = 0.0
            for n in 0..<count where first + n < samples.count {
                let t = Double(n) / rate
                let frequency = t < glide ? drop.from * pow(drop.to / drop.from, t / glide) : drop.to
                phase += 2 * .pi * frequency / rate
                let gain = t < rise
                    ? 0.0001 * pow(drop.gain / 0.0001, t / rise)
                    : t < drop.tail ? drop.gain * pow(0.0001 / drop.gain, (t - rise) / (drop.tail - rise)) : 0
                samples[first + n] += sin(phase) * gain * boost
            }
        }
        var data = Data()
        func append<T: FixedWidthInteger>(_ value: T) { withUnsafeBytes(of: value.littleEndian) { data.append(contentsOf: $0) } }
        let bytes = UInt32(samples.count * 2)
        data.append(contentsOf: Array("RIFF".utf8))
        append(36 + bytes)
        data.append(contentsOf: Array("WAVEfmt ".utf8))
        append(UInt32(16))
        append(UInt16(1)) // PCM
        append(UInt16(1)) // mono
        append(UInt32(rate))
        append(UInt32(rate) * 2)
        append(UInt16(2))
        append(UInt16(16))
        data.append(contentsOf: Array("data".utf8))
        append(bytes)
        for sample in samples { append(Int16(max(-1, min(1, sample)) * 32_767)) }
        return data
    }()
}
