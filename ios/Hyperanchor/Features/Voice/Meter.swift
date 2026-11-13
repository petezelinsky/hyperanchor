import Accelerate
import Foundation

/// What the microphone hears at one moment: how loud (0…1), and the same over sixteen bands from the low end of a
/// voice to the high. What the sphere moves to, and how listening tells a voice from a pause.
struct Heard: Sendable, Equatable {
    var level: Float
    var bands: SIMD16<Float>

    static let silence = Heard(level: 0, bands: .zero)
}

/// The meter's numbers made relative to the room (`Meter.read` in src/components/voice/meter.ts): the room's hum is
/// learned (slowly when it grows, quickly when it falls) and taken away; the loudest moment so far sets the top and
/// fades, so a quiet voice fills the range as well as a loud one. Silence is silence: the bands follow the level down,
/// so the hiss of an open microphone moves nothing. The web reads 60 times a second; here the rates follow `dt`.
struct LevelNormalizer {
    private(set) var floor: Float = 0.004
    private(set) var peak: Float = 0.06
    private(set) var bandPeak: Float = 0.35
    /// Whether any sound has come through yet.
    private(set) var live = false

    /// `rms`: the plain loudness of the last moment; `raw`: each band's level on the spectrum, 0…1; `dt`: seconds since
    /// the last reading.
    mutating func read(rms: Float, raw: SIMD16<Float>, dt: Float) -> Heard {
        let frames = max(0, dt) * 60
        if rms > 0.0004 { live = true }
        let follow: Float = rms < floor ? 0.3 : 0.003
        floor += (rms - floor) * (1 - pow(1 - follow, frames))
        peak = max(peak * pow(0.9993, frames), rms, 0.03)
        let quiet = floor * 1.7 + 0.0015
        let v = min(1, max(0, (rms - quiet) / max(0.02, peak - quiet)))
        let level = pow(v, 0.62)

        bandPeak = max(bandPeak * pow(0.999, frames), raw.max(), 0.2)
        let gate = min(1, level / 0.06)
        let bands = pointwiseMin(pointwiseMax(raw / bandPeak * gate, .zero), SIMD16(repeating: 1))
        return Heard(level: level, bands: bands)
    }
}

/// The spectrum the way the web's AnalyserNode sees it (2048-point FFT, a Blackman window, smoothing 0.5, −88…−18 dB),
/// read every 1024 samples: the loudness and sixteen bands a little wider each, between about 90 Hz and 5 kHz.
/// Used on the audio thread only; the numbers are worked out here and thrown away.
final class SpectrumAnalyzer {
    static let size = 2048
    static let hop = 1024
    private static let log2n = vDSP_Length(11)

    let sampleRate: Double
    private let setup: FFTSetup
    private var window = [Float](repeating: 0, count: size)
    /// The last `size` samples, oldest first.
    private var tail = [Float](repeating: 0, count: size)
    private var windowed = [Float](repeating: 0, count: size)
    private var real = [Float](repeating: 0, count: size / 2)
    private var imag = [Float](repeating: 0, count: size / 2)
    private var smoothed = [Float](repeating: 0, count: size / 2)
    private var levels = [Float](repeating: 0, count: size / 2)
    private let edges: [Int]
    private var sinceHop = 0
    private var normalizer = LevelNormalizer()

    var live: Bool { normalizer.live }

    init?(sampleRate: Double) {
        guard sampleRate > 0, let setup = vDSP_create_fftsetup(Self.log2n, FFTRadix(kFFTRadix2)) else { return nil }
        self.sampleRate = sampleRate
        self.setup = setup
        edges = Self.bandEdges(sampleRate: sampleRate)
        // Blackman, as the Web Audio API windows its analyser.
        let n = Float(Self.size)
        for i in 0..<Self.size {
            let x = Float(i) / n
            window[i] = 0.42 - 0.5 * cos(2 * .pi * x) + 0.08 * cos(4 * .pi * x)
        }
    }

    deinit { vDSP_destroy_fftsetup(setup) }

    /// The FFT bins where each of the sixteen bands starts (and the last one ends): `meter.ts` `edges`.
    static func bandEdges(sampleRate: Double) -> [Int] {
        let perBin = sampleRate / Double(size)
        return (0...16).map { k in max(1, Int((90 * pow(5000.0 / 90, Double(k) / 16) / perBin).rounded())) }
    }

    /// Takes in `count` samples; at every hop, `emit` gets the reading and the index of the sample it ends at.
    func feed(_ samples: UnsafePointer<Float>, count: Int, emit: (Int, Heard) -> Void) {
        var i = 0
        while i < count {
            let take = min(count - i, Self.hop - sinceHop)
            tail.withUnsafeMutableBufferPointer { t in
                let base = t.baseAddress!
                // Move the history along and put the new samples at its end.
                (base).update(from: base + take, count: Self.size - take)
                (base + Self.size - take).update(from: samples + i, count: take)
            }
            i += take
            sinceHop += take
            if sinceHop == Self.hop {
                sinceHop = 0
                emit(i, analyze())
            }
        }
    }

    private func analyze() -> Heard {
        let n = vDSP_Length(Self.size)
        var rms: Float = 0
        vDSP_rmsqv(tail, 1, &rms, n)
        vDSP_vmul(tail, 1, window, 1, &windowed, 1, n)

        real.withUnsafeMutableBufferPointer { re in
            imag.withUnsafeMutableBufferPointer { im in
                var split = DSPSplitComplex(realp: re.baseAddress!, imagp: im.baseAddress!)
                windowed.withUnsafeBufferPointer { w in
                    w.baseAddress!.withMemoryRebound(to: DSPComplex.self, capacity: Self.size / 2) {
                        vDSP_ctoz($0, 2, &split, 1, vDSP_Length(Self.size / 2))
                    }
                }
                vDSP_fft_zrip(setup, &split, 1, Self.log2n, FFTDirection(FFT_FORWARD))
            }
        }

        // |X[k]| / N (vDSP's forward transform is twice the plain DFT), smoothed over time, in dB, then 0…1 over
        // −88…−18 dB (the analyser's byte data, as a fraction).
        let dt = Float(Double(Self.hop) / sampleRate)
        let keep = pow(0.5, dt * 60)
        let scale = 0.5 / Float(Self.size)
        for k in 0..<(Self.size / 2) {
            let magnitude = k == 0 ? abs(real[0]) * scale : (real[k] * real[k] + imag[k] * imag[k]).squareRoot() * scale
            smoothed[k] = keep * smoothed[k] + (1 - keep) * magnitude
            let db = smoothed[k] > 0 ? 20 * log10(smoothed[k]) : -200
            levels[k] = min(1, max(0, (db + 88) / 70))
        }

        var raw = SIMD16<Float>.zero
        for k in 0..<16 {
            let from = min(edges[k], levels.count - 1)
            let to = min(max(from + 1, edges[k + 1]), levels.count)
            var sum: Float = 0
            for i in from..<to { sum += levels[i] }
            raw[k] = sum / Float(to - from)
        }
        return normalizer.read(rms: rms, raw: raw, dt: dt)
    }
}
