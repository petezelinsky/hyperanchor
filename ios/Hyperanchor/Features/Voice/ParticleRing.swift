import SwiftUI

/// What the sphere is doing: following a voice, waiting steadily (while what was said is written down and sorted), or
/// at rest.
enum RingMode: Sendable {
    case speech, steady, silent
}

/// The voice's sphere, a thick, full ring of dots (src/components/voice/ParticleRing.ts). It moves to sound: given the
/// microphone's readings (`listen`), the ring swells with the loudness and each part of it leans out with its own slice
/// of the voice's range, so speech runs round it as waves. No two dots do the same thing: each has its own direction
/// (out, in, along the ring, or a long flight), its own pace of waking up and settling, and its own small orbit. Without
/// readings it acts out syllables while a voice is heard (`gate`). Nothing is drawn inside it.
///
/// Laid out in an 800 × 800 space scaled to the view, drawn in the foreground style (ink: black on light, white on dark).
/// The dots are drawn in a couple of dozen batches by opacity, so a frame is a few fills, not thousands.
final class ParticleRing {
    private static let tau: Float = 2 * .pi
    private static let bins = 360
    private static let bandCount = 16
    /// Opacity steps the dots are batched into.
    private static let shades = 24

    struct Options {
        var count = 5200
        var radius: Float = 226
        var spread: Float = 44
        var dotSize: Float = 2.5
        var seed = 7
        var mode = RingMode.silent
        var intensity: Float = 1
        var speed: Float = 1
        /// Reduce Motion: the ring keeps breathing, the dots stay close.
        var reduced = false
        /// Grows in over the first moments.
        var intro = true
    }

    private struct Dot {
        var ang, off, size, op, dx, dy, reach, react, att, dec, orb, os, flow, pa, pb, pc, sb, sc: Float
        var e: Float = 0
        /// How loud this dot's part of the ring is right now.
        var a: Float = 0
    }

    private struct Band {
        let k: Int
        let center: Float
        let rate: Float
        let gain: Float
        let seed: Double
        var level: Float = 0
    }

    var mode: RingMode
    var intensity: Float
    var reduced: Bool
    /// In speech mode: 1 while a voice is heard, 0 in a pause; nil lets the ring act out phrases by itself.
    var gate: Float?
    /// In speech mode: asked every frame for what the microphone hears. While it answers, the ring moves to that.
    var listen: (() -> Heard?)?

    private let radius: Float
    private let dotSize: Float
    private var dots: [Dot] = []
    private var bands: [Band] = []
    private var act = [Float](repeating: 0, count: ParticleRing.bins)
    private var t: Double = 0
    private var G: Float = 0
    private var E: Float = 0
    private var gateNow: Float = 0
    private var level: Float
    private var shown: Float
    private var lastFrame: Date?

    init(_ o: Options = Options()) {
        mode = o.mode
        intensity = o.intensity
        reduced = o.reduced
        radius = o.radius
        dotSize = o.dotSize
        level = o.intensity
        shown = o.intro ? 0 : 1
        build(o)
    }

    /// The sphere for a view `diameter` points across: as many dots as the web draws at that size, each the same size
    /// on screen at any size.
    convenience init(diameter: CGFloat, reduced: Bool) {
        var o = Options()
        o.count = Int((5200 * Double(diameter) / 280).rounded())
        o.dotSize = Float(706 / diameter)
        o.reduced = reduced
        self.init(o)
    }

    // MARK: Building

    private func build(_ o: Options) {
        var s = Int64(o.seed) * 9973 + 1
        func rnd() -> Float {
            s = (s * 16807) % 2_147_483_647
            return Float(Double(s - 1) / 2_147_483_646)
        }
        func gauss() -> Float {
            var u: Float = 0
            var v: Float = 0
            while u == 0 { u = rnd() }
            while v == 0 { v = rnd() }
            return (-2 * log(u)).squareRoot() * cos(Self.tau * v)
        }
        let tau = Self.tau
        dots.reserveCapacity(o.count)
        for i in 0..<o.count {
            // A dense heart, a soft body around it and a wide haze: the band reads thick and full.
            let layer = rnd()
            let sigma = layer < 0.4 ? o.spread * 0.36 : layer < 0.78 ? o.spread * 0.8 : o.spread * 1.5
            var off = max(-2.3, min(2.3, gauss())) * sigma
            if off < -o.radius * 0.46 { off = -o.radius * 0.46 * rnd() } // nothing wanders into the middle
            let near = max(0, 1 - abs(off) / (o.spread * 2.4))
            let big = rnd() < 0.13
            // What kind of dot it is when the voice comes: 0 breathes out or in, 1 slides along the ring, 2 flies far.
            let k = rnd()
            let kind = k < 0.5 ? 0 : k < 0.82 ? 1 : 2
            let dir: Float
            switch kind {
            case 0: dir = (rnd() < 0.6 ? 0 : .pi) + gauss() * 0.45
            case 1: dir = (rnd() < 0.5 ? 1 : -1) * .pi * 0.5 + gauss() * 0.5
            default: dir = gauss() * 0.8
            }
            let q = rnd()
            let ang = (Float(i) + rnd()) / Float(o.count) * tau
            let size = big ? 1.9 + rnd() * 0.9 : 0.85 + rnd() * 0.95
            let op = min(1, (big ? 0.62 : 0.36) + near * 0.42 + rnd() * 0.14)
            let reach = kind == 0 ? 12 + rnd() * 24 : kind == 1 ? 10 + rnd() * 20 : 42 + rnd() * 46
            let react = q < 0.1 ? 0.12 : 0.4 + rnd() * 0.85
            let att = 2.6 + rnd() * rnd() * 14 // some wake at once, some take their time
            let dec = 1.1 + rnd() * 5.2 // some settle fast, some linger
            let orb = 1.5 + rnd() * 7.5
            let os = (0.8 + rnd() * 2.2) * (rnd() < 0.5 ? -1 : 1)
            let flow = (0.4 + rnd() * 0.6) * (rnd() < 0.24 ? -1 : 1)
            let pa = rnd() * tau
            let pb = rnd() * tau
            let pc = rnd() * tau
            let sb = 0.25 + rnd() * 0.45
            let sc = 0.35 + rnd() * 0.75
            dots.append(Dot(ang: ang, off: off, size: size, op: op, dx: cos(dir), dy: sin(dir), reach: reach, react: react,
                            att: att, dec: dec, orb: orb, os: os, flow: flow, pa: pa, pb: pb, pc: pc, sb: sb, sc: sc))
        }
        var order = Array(0..<Self.bandCount)
        for k in stride(from: Self.bandCount - 1, to: 0, by: -1) {
            let j = Int(rnd() * Float(k + 1))
            order.swapAt(k, min(j, k))
        }
        bands = order.enumerated().map { slot, k in
            Band(k: k, center: Float(slot) / Float(Self.bandCount) * tau + (rnd() - 0.5) * 0.25,
                 rate: 0.5 + Float(k) / Float(Self.bandCount - 1) * 2.2, gain: 1.12 - Float(k) / Float(Self.bandCount - 1) * 0.4,
                 seed: Double(rnd()) * 1000)
        }
    }

    // MARK: Time

    /// Moves on to `date`: as much time as has passed since the last frame (a long gap counts as one short step).
    func step(to date: Date) {
        defer { lastFrame = date }
        guard let last = lastFrame else { return }
        let dt = Float(min(0.05, max(0, date.timeIntervalSince(last))))
        if dt > 0 { advance(dt) }
    }

    /// One still frame `seconds` into its life (the small sphere on the Speak buttons).
    func settle(_ seconds: Float) {
        advance(seconds)
    }

    private static func hash(_ n: Double) -> Double {
        let v = sin(n * 91.7 + 17.3) * 43758.5453
        return v - v.rounded(.down)
    }

    private static func noise(_ x: Double) -> Double {
        let i = x.rounded(.down)
        let f = x - i
        let u = f * f * (3 - 2 * f)
        func h(_ n: Double) -> Double {
            let v = sin(n * 127.1 + 311.7) * 43758.5453
            return v - v.rounded(.down)
        }
        return h(i) * (1 - u) + h(i + 1) * u
    }

    /// Syllables: a quick rise and a slower fall, about four a second, some louder than others.
    private func speech(_ t: Double, _ step: Float) -> Float {
        let x = t * 4.3
        let n = x.rounded(.down)
        let f = x - n
        let amp = Self.hash(n) < 0.14 ? 0.25 : 0.5 + 0.5 * Self.hash(n + 0.5)
        let shape = f < 0.22 ? 0.5 - 0.5 * cos(f / 0.22 * .pi) : exp(-(f - 0.22) * 2.8)
        guard let gate else {
            let e = sin(t * 0.55) + 0.6 * sin(t * 0.23 + 1.3) + 0.35 * sin(t * 1.1 + 0.5)
            let g = max(0, min(1, (e + 0.6) / 0.5))
            return Float(g * g * (3 - 2 * g) * amp * shape)
        }
        gateNow += (gate - gateNow) * (1 - exp(-step * 7))
        return gateNow * Float(amp * shape)
    }

    private func advance(_ dt: Float) {
        let step = dt
        t += Double(step)
        func ease(_ k: Float) -> Float { 1 - exp(-step * k) }
        level += ((reduced ? min(intensity, 0.35) : intensity) - level) * ease(4)
        if shown < 1 { shown = min(1, shown + dt / 0.8) }

        // Real sound when there is some to read; otherwise syllables acted out while a voice is heard.
        let heard = mode == .speech ? listen?() : nil
        let x: Float = switch mode {
        case .speech: heard?.level ?? speech(t, step)
        case .steady: 0.3 + 0.08 * Float(sin(t * 0.8))
        case .silent: 0
        }
        let real = heard != nil
        G += (x - G) * ease(x > G ? (real ? 36 : 13) : real ? 7.5 : 4.6)
        E += (G - E) * ease(G > E ? (real ? 9 : 3) : real ? 2.2 : 1.1)

        // The bands: an equalizer wrapped around the ring. With the microphone, each sector follows its own slice of the
        // voice; without it, each has its own slow life.
        for i in bands.indices {
            let b = bands[i]
            let target: Float
            if let heard {
                target = min(1.3, (0.22 * heard.level + 1.1 * heard.bands[b.k]) * b.gain)
            } else {
                let n = Self.noise(t * Double(0.3 + b.rate * 0.22) + b.seed)
                let w = Float(max(0, min(1, (n - 0.18) / 0.62)))
                target = G * b.gain * (0.22 + 0.78 * w)
            }
            bands[i].level += (target - b.level) * ease(target > b.level ? (real ? 32 : 12) : real ? 8.5 : 4.4)
        }
        let w: Float = 0.3
        let tau = Self.tau
        for i in 0..<Self.bins {
            let a = Float(i) / Float(Self.bins) * tau
            var v: Float = 0
            for b in bands {
                var d = abs(a - b.center).truncatingRemainder(dividingBy: tau)
                if d > .pi { d = tau - d }
                if d < 3 * w { v += b.level * exp(-(d * d) / (2 * w * w)) }
            }
            act[i] = min(1.3, v) * level
        }

        // Every dot follows its sector at its own pace. With real sound every dot answers sooner (and lets go a little
        // sooner), so each word shows.
        let slide: Float = reduced ? 0 : 1
        let wake: Float = real ? 2.6 : 1.3
        let calm: Float = real ? 1.5 : 1
        let rise = 1 - exp(-step * 26)
        let fall = 1 - exp(-step * 9)
        let bins = Float(Self.bins)
        act.withUnsafeBufferPointer { act in
            dots.withUnsafeMutableBufferPointer { dots in
                for i in 0..<dots.count {
                    var na = dots[i].ang.truncatingRemainder(dividingBy: tau)
                    if na < 0 { na += tau }
                    let part = act[Int(na / tau * bins) % Self.bins]
                    dots[i].a += (part - dots[i].a) * (part > dots[i].a ? rise : fall)
                    let target = part * dots[i].react
                    let e = dots[i].e
                    dots[i].e = e + (target - e) * (1 - exp(-step * (target > e ? dots[i].att * wake : dots[i].dec * calm)))
                    let ne = dots[i].e
                    dots[i].pa += step * dots[i].os * (0.3 + 1.1 * ne)
                    dots[i].pb += step * dots[i].sb
                    dots[i].pc += step * dots[i].sc * (1 + 0.5 * ne)
                    dots[i].ang += step * dots[i].flow * (0.018 + 0.1 * ne) * slide
                }
            }
        }
    }

    // MARK: Drawing

    /// Draws the ring filling `size`, in `shading` (the foreground style by default).
    func draw(in context: inout GraphicsContext, size: CGSize, shading: GraphicsContext.Shading = .foreground) {
        let scale = Float(min(size.width, size.height)) / 800
        let ox = Float(size.width) / 2 - 400 * scale
        let oy = Float(size.height) / 2 - 400 * scale
        let k3 = 1 - pow(1 - shown, 3)
        // The whole ring swells a little with the loudness; each part of it leans out with its own sound.
        let R = radius * (0.93 + 0.07 * k3) * (1 + 0.045 * E * level)
        let ds = dotSize
        var paths = [Path](repeating: Path(), count: Self.shades)
        let shades = Float(Self.shades)
        dots.withUnsafeBufferPointer { dots in
            for p in dots {
                let e = p.e
                let spc = sin(p.pc)
                let along = e * p.reach * (0.78 + 0.22 * spc)
                let r = R + p.off + p.a * (7 + 15 * p.react) + sin(p.pb) * 1.6 + p.dx * along + cos(p.pa) * p.orb * e
                let tn = cos(p.pb * 0.8 + p.pc) * 1.6 + p.dy * along + sin(p.pa) * p.orb * e
                let alpha = min(1, p.op * (0.84 + 0.16 * spc) * (0.82 + 0.5 * e)) * k3
                let shade = Int(alpha * shades + 0.5)
                guard shade > 0 else { continue }
                let ca = cos(p.ang)
                let sa = sin(p.ang)
                let x = 400 + ca * r - sa * tn
                let y = 400 + sa * r + ca * tn
                let d = p.size * ds * (1 + 0.2 * e) * scale
                paths[min(Self.shades, shade) - 1].addEllipse(in: CGRect(
                    x: CGFloat(ox + x * scale - d / 2), y: CGFloat(oy + y * scale - d / 2), width: CGFloat(d), height: CGFloat(d)))
            }
        }
        for (i, path) in paths.enumerated() where !path.isEmpty {
            var layer = context
            layer.opacity = Double(i + 1) / Double(Self.shades)
            layer.fill(path, with: shading)
        }
    }
}
