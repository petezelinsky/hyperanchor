import SwiftUI
import UIKit

/// A finished card turns to dust (dust.ts on the web): it holds a beat with its box ticked, then comes apart from its left
/// edge to its right, and every piece of it floats up and away as a dot — round dots in the same mix of sizes and
/// strengths as the voice's sphere. What hasn't come apart yet stays whole, so the card dissolves rather than flickering
/// out. The card is drawn once into a picture (its face, its box, its words) and that picture is what dissolves: a few
/// thousand dots in one Canvas over the screen, gone in about a second. With Reduce Motion the picture simply fades.
struct Dust: Identifiable {
    let id = UUID()
    /// Where the card was, in screen points.
    let frame: CGRect
    let picture: Image
    let start: Date
    let reduced: Bool
    /// Seconds from the start until the last dot is gone.
    let duration: Double

    // The picture in cells: each comes apart at its moment (seconds after the start), the left first, along a ragged edge.
    private let step: CGFloat
    private let columns: Int
    private let rows: Int
    private let moments: [Float]
    private let firstMoment: Float
    private let lastMoment: Float
    // The dots, grouped by color for drawing.
    private let motes: [Mote]
    private let tones: [Color]
    private let byTone: [[Int32]]

    /// How long the card stays whole, box ticked, before it comes apart.
    static let hold: Float = 0.09
    /// How long the edge takes to cross the card.
    static let sweep: Float = 0.52
    /// Reduce Motion: how long the picture takes to fade.
    static let fade = 0.16
    /// How finely the dots' strengths are grouped for drawing.
    private static let levels = 6

    /// Takes apart the card drawn in `image` (at `scale` pixels per point) that lay at `frame`; `face` is the card's own
    /// color, which goes as fewer, fainter dots than its box and its words.
    init?(image: CGImage, scale: CGFloat, frame: CGRect, face: RGBA, reduced: Bool) {
        let w = Float(frame.width)
        let h = Float(frame.height)
        guard w >= 4, h >= 4 else { return nil }
        self.frame = frame
        picture = Image(decorative: image, scale: scale)
        start = .now
        self.reduced = reduced
        guard !reduced else {
            self.step = 0
            self.columns = 0
            self.rows = 0
            self.moments = []
            self.firstMoment = 0
            self.lastMoment = 0
            self.motes = []
            self.tones = []
            self.byTone = []
            self.duration = Self.fade
            return
        }

        // The picture's pixels, to see what each cell holds.
        let pw = image.width
        let ph = image.height
        var pixels = [UInt8](repeating: 0, count: pw * ph * 4)
        let drawn = pixels.withUnsafeMutableBytes { buffer -> Bool in
            guard let space = CGColorSpace(name: CGColorSpace.sRGB),
                  let context = CGContext(data: buffer.baseAddress, width: pw, height: ph, bitsPerComponent: 8, bytesPerRow: pw * 4,
                                          space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
            else { return false }
            context.draw(image, in: CGRect(x: 0, y: 0, width: pw, height: ph))
            return true
        }
        guard drawn else { return nil }

        var random = Random()
        let step = max(2.4, (w * h / 5200).squareRoot())
        let columns = Int((w / step).rounded(.up))
        let rows = Int((h / step).rounded(.up))
        let faceRGB = (Float(face.red * 255), Float(face.green * 255), Float(face.blue * 255))
        var moments = [Float](repeating: 0, count: rows * columns)
        var motes: [Mote] = []
        var tones: [Color] = []
        var byTone: [[Int32]] = []
        var toneOf: [Int: Int] = [:]
        for row in 0..<rows {
            let y = (Float(row) + 0.5) * step
            for column in 0..<columns {
                let x = (Float(column) + 0.5) * step
                let at = max(Self.hold, Self.hold + x / w * Self.sweep + y / h * 0.07 + (random.next() - 0.5) * 0.15)
                moments[row * columns + column] = at
                let px = min(pw - 1, Int(CGFloat(x) * scale))
                let py = min(ph - 1, Int(CGFloat(y) * scale))
                let i = (py * pw + px) * 4
                let alpha = Float(pixels[i + 3]) / 255
                if alpha < 0.08 { continue }
                let rgb = (Float(pixels[i]) / alpha, Float(pixels[i + 1]) / alpha, Float(pixels[i + 2]) / alpha)
                let plain = abs(rgb.0 - faceRGB.0) + abs(rgb.1 - faceRGB.1) + abs(rgb.2 - faceRGB.2) < 24
                // The plain face of the card goes as fewer, fainter dots.
                if plain && random.next() > 0.42 { continue }
                let key = (Int(rgb.0) >> 3) << 10 | (Int(rgb.1) >> 3) << 5 | Int(rgb.2) >> 3
                let tone: Int
                if let known = toneOf[key] {
                    tone = known
                } else {
                    tone = tones.count
                    toneOf[key] = tone
                    tones.append(Color(.sRGB, red: Double(min(255, rgb.0)) / 255, green: Double(min(255, rgb.1)) / 255, blue: Double(min(255, rgb.2)) / 255))
                    byTone.append([])
                }
                let big = random.next() < 0.12
                byTone[tone].append(Int32(motes.count))
                motes.append(Mote(
                    x: Float(frame.minX) + x,
                    y: Float(frame.minY) + y,
                    at: at,
                    vx: -8 + random.next() * 78,
                    vy: -18 - random.next() * 62,
                    lift: 50 + random.next() * 130,
                    amp: 1.5 + random.next() * 8,
                    freq: 2.5 + random.next() * 5,
                    phase: random.next() * 2 * .pi,
                    life: 0.52 + random.next() * 0.56,
                    size: (big ? 2.1 + random.next() * 0.9 : 0.95 + random.next() * 1.05) * (plain ? 1.1 : 1),
                    alpha: alpha * (plain ? 0.5 + random.next() * 0.35 : 0.55 + random.next() * 0.45)
                ))
            }
        }
        self.step = CGFloat(step)
        self.columns = columns
        self.rows = rows
        self.moments = moments
        firstMoment = moments.min() ?? 0
        lastMoment = moments.max() ?? 0
        self.motes = motes
        self.tones = tones
        self.byTone = byTone
        duration = Double(max(lastMoment, motes.map { $0.at + $0.life }.max() ?? 0)) + 0.05
    }

    /// Draws the card as it is `date`: what's left of the picture, and the dots on their way.
    func draw(in context: inout GraphicsContext, at date: Date) {
        let t = max(0, date.timeIntervalSince(start))
        if reduced {
            guard t < Self.fade else { return }
            var faded = context
            faded.opacity = 1 - t / Self.fade
            faded.draw(picture, in: frame)
            return
        }
        let now = Float(t)

        // What hasn't come apart yet: the picture, without the cells whose moment has come.
        if now < firstMoment {
            context.draw(picture, in: frame)
        } else if now < lastMoment {
            var whole = Path()
            for row in 0..<rows {
                var run = -1
                let base = row * columns
                for column in 0...columns {
                    if column < columns, moments[base + column] > now {
                        if run < 0 { run = column }
                    } else if run >= 0 {
                        // A little over each edge, so neighboring runs leave no seam.
                        whole.addRect(CGRect(x: frame.minX + CGFloat(run) * step - 0.5, y: frame.minY + CGFloat(row) * step - 0.5,
                                             width: CGFloat(column - run) * step + 1, height: step + 1))
                        run = -1
                    }
                }
            }
            var rest = context
            rest.clip(to: whole)
            rest.draw(picture, in: frame)
        }

        // The dots: each rises from its cell with its own drift and sway, shrinking and fading as it goes.
        let levels = Self.levels
        for (tone, members) in byTone.enumerated() {
            var paths = [Path](repeating: Path(), count: levels)
            for m in members {
                let d = motes[Int(m)]
                let age = now - d.at
                guard age >= 0, age <= d.life else { continue }
                let k = age / d.life
                let strength = pow(1 - k, 1.6) * d.alpha
                guard strength >= 0.02 else { continue }
                let x = d.x + d.vx * age + sin(d.freq * age + d.phase) * d.amp * min(1, age * 3)
                let y = d.y + d.vy * age - 0.5 * d.lift * age * age
                let r = d.size / 2 * (1 - 0.35 * k)
                paths[min(levels - 1, Int(strength * Float(levels)))]
                    .addEllipse(in: CGRect(x: CGFloat(x - r), y: CGFloat(y - r), width: CGFloat(2 * r), height: CGFloat(2 * r)))
            }
            for level in 0..<levels where !paths[level].isEmpty {
                context.fill(paths[level], with: .color(tones[tone].opacity((Double(level) + 0.5) / Double(levels))))
            }
        }
    }

    /// One dot: where it starts (screen points) and when (seconds), how it drifts, sways and lifts, how long it lasts.
    private struct Mote {
        let x: Float
        let y: Float
        let at: Float
        let vx: Float
        let vy: Float
        let lift: Float
        let amp: Float
        let freq: Float
        let phase: Float
        let life: Float
        let size: Float
        let alpha: Float
    }

    /// A quick source of randomness (xorshift), enough for scattering dots.
    private struct Random {
        private var state = UInt64.random(in: 1...UInt64.max)

        mutating func next() -> Float {
            state ^= state << 13
            state ^= state >> 7
            state ^= state << 17
            return Float(state >> 40) / Float(1 << 24)
        }
    }
}

/// Where dust is drawn: one Canvas over the whole screen, running only while something is turning to dust.
struct DustLayer: View {
    let clouds: [Dust]
    /// The layer's own place on the screen (the clouds are in screen points).
    @State private var origin: CGPoint = .zero

    var body: some View {
        TimelineView(.animation(minimumInterval: nil, paused: clouds.isEmpty)) { timeline in
            Canvas { context, _ in
                context.translateBy(x: -origin.x, y: -origin.y)
                for cloud in clouds { cloud.draw(in: &context, at: timeline.date) }
            }
        }
        .onGeometryChange(for: CGPoint.self) { $0.frame(in: .global).origin } action: { origin = $0 }
        .ignoresSafeArea()
        .allowsHitTesting(false)
        .accessibilityHidden(true)
    }
}
