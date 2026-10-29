import SwiftUI

/// The round checkbox. Completing a task: the circle pops, the tick draws itself and a ring ripples out —
/// only for a change made just now, never for tasks that were already done. Reduce Motion: a plain fade.
struct CheckCircle: View {
    let checked: Bool
    var size: CGFloat = 20

    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var celebrations = 0
    @State private var drawn: CGFloat

    init(checked: Bool, size: CGFloat = 20) {
        self.checked = checked
        self.size = size
        _drawn = State(initialValue: checked ? 1 : 0)
    }

    var body: some View {
        ZStack {
            Circle()
                .strokeBorder(.checkRing, lineWidth: 1.5)
                .opacity(checked ? 0 : 1)
            Circle()
                .fill(palette.accent)
                .scaleEffect(checked ? 1 : 0.6)
                .opacity(checked ? 1 : 0)
            Checkmark()
                .trim(from: 0, to: drawn)
                .stroke(.onAccent, style: StrokeStyle(lineWidth: size * 0.095, lineCap: .round, lineJoin: .round))
                .frame(width: size * 0.6, height: size * 0.6)
        }
        .frame(width: size, height: size)
        .background {
            // The ripple.
            Circle()
                .fill(palette.accent)
                .keyframeAnimator(initialValue: Ripple(), trigger: celebrations) { view, r in
                    view.scaleEffect(r.scale).opacity(r.opacity)
                } keyframes: { _ in
                    KeyframeTrack(\.scale) {
                        LinearKeyframe(1, duration: 0)
                        CubicKeyframe(2.1, duration: 0.55)
                    }
                    KeyframeTrack(\.opacity) {
                        LinearKeyframe(0.4, duration: 0)
                        CubicKeyframe(0, duration: 0.55)
                    }
                }
        }
        .keyframeAnimator(initialValue: 1.0, trigger: celebrations) { view, scale in
            view.scaleEffect(scale)
        } keyframes: { _ in
            CubicKeyframe(0.75, duration: 0.02)
            CubicKeyframe(1.12, duration: 0.18)
            CubicKeyframe(1, duration: 0.17)
        }
        .animation(.easeOut(duration: 0.2), value: checked)
        .onChange(of: checked) { _, now in
            if now, !reduceMotion {
                celebrations += 1
                drawn = 0
                withAnimation(.easeOut(duration: 0.32).delay(0.06)) { drawn = 1 }
            } else {
                withAnimation(.easeOut(duration: 0.15)) { drawn = now ? 1 : 0 }
            }
        }
    }

    private struct Ripple {
        var scale: CGFloat = 1
        var opacity: Double = 0
    }
}

/// The tick, in a 12×12 box: M2.6 6.3 5 8.6 9.4 3.7 (as on the web).
struct Checkmark: Shape {
    func path(in rect: CGRect) -> Path {
        let s = rect.width / 12
        var p = Path()
        p.move(to: CGPoint(x: 2.6 * s, y: 6.3 * s))
        p.addLine(to: CGPoint(x: 5 * s, y: 8.6 * s))
        p.addLine(to: CGPoint(x: 9.4 * s, y: 3.7 * s))
        return p
    }
}

/// A tappable checkbox with a 44-point target, haptics and a VoiceOver label.
struct TaskCheckbox: View {
    let task: TaskItem
    var size: CGFloat = 20
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            CheckCircle(checked: task.done, size: size)
                .frame(width: max(44, size + 16), height: max(44, size + 16))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(trigger: task.done) { _, done in done ? .impact(flexibility: .soft, intensity: 0.8) : .selection }
        .accessibilityLabel(task.done ? "Mark “\(task.title)” as not done" : "Mark “\(task.title)” as done")
        .accessibilityValue(task.done ? "Done" : "Not done")
        .accessibilityIdentifier("checkbox")
    }
}

/// A small ring that fills with the accent (0…1).
struct ProgressRing: View {
    let value: Double
    var size: CGFloat = 16
    var lineWidth: CGFloat = 2.5
    @Environment(\.palette) private var palette

    var body: some View {
        ZStack {
            Circle().stroke(palette.accentTrack, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: max(0, min(1, value)))
                .stroke(palette.accent, style: StrokeStyle(lineWidth: lineWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
                .opacity(value > 0 ? 1 : 0)
        }
        .padding(lineWidth / 2)
        .frame(width: size, height: size)
        .animation(.easeOut(duration: 0.7), value: value)
        .accessibilityHidden(true)
    }
}

/// Wraps a small mark; when `active` turns on (not at first appearance), a ring of confetti bursts from it.
struct Burst<Content: View>: View {
    let active: Bool
    var radius: CGFloat = 16
    @ViewBuilder let content: Content

    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var bursts = 0

    var body: some View {
        content
            .overlay {
                if bursts > 0 {
                    ZStack {
                        ForEach(0..<8, id: \.self) { i in
                            Particle(index: i, color: color(i), distance: radius + CGFloat(i % 3) * radius * 0.31)
                        }
                    }
                    .id(bursts)
                    .allowsHitTesting(false)
                }
            }
            .onChange(of: active) { was, now in
                if now, !was, !reduceMotion { bursts += 1 }
            }
    }

    private func color(_ i: Int) -> Color {
        [palette.accent, .ink3, palette.accentTrack, palette.accent, .ink4, palette.accent, palette.accentTrack, .ink3][i]
    }

    private struct Particle: View {
        let index: Int
        let color: Color
        let distance: CGFloat
        @State private var out = false

        var body: some View {
            Circle()
                .fill(color)
                .frame(width: 5, height: 5)
                .offset(y: out ? -distance : 0)
                .scaleEffect(out ? 0.4 : 1)
                .opacity(out ? 0 : 1)
                .rotationEffect(.degrees(Double(index) * 45 + 20))
                .onAppear {
                    withAnimation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.8).delay(Double(index) * 0.015)) { out = true }
                }
        }
    }
}

/// A shower of confetti for closing a whole day. Falls with gravity, then clears; nothing with Reduce Motion.
struct ConfettiView: View {
    /// Changes to fire again.
    let trigger: Int
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var start: Date?

    private struct Piece {
        let angle: Double, speed: Double, spin: Double, size: CGSize, colorIndex: Int, delay: Double
    }

    private static let pieces: [Piece] = (0..<36).map { i in
        var g = SeededGenerator(seed: UInt64(i * 7919 + 13))
        return Piece(
            angle: Double.random(in: -150 ... -30, using: &g) * .pi / 180,
            speed: Double.random(in: 260...520, using: &g),
            spin: Double.random(in: -8...8, using: &g),
            size: CGSize(width: Double.random(in: 5...9, using: &g), height: Double.random(in: 3...5, using: &g)),
            colorIndex: i % 4,
            delay: Double.random(in: 0...0.12, using: &g)
        )
    }

    var body: some View {
        TimelineView(.animation(paused: start == nil)) { timeline in
            Canvas { context, size in
                guard let start else { return }
                let t = timeline.date.timeIntervalSince(start)
                let colors = [palette.accent, palette.accentTrack, Color.ink3, palette.accent]
                let origin = CGPoint(x: size.width / 2, y: size.height * 0.35)
                for p in Self.pieces {
                    let time = t - p.delay
                    guard time > 0, time < 1.6 else { continue }
                    let x = origin.x + cos(p.angle) * p.speed * time
                    let y = origin.y + sin(p.angle) * p.speed * time + 0.5 * 900 * time * time
                    var c = context
                    c.opacity = max(0, 1 - time / 1.6)
                    c.translateBy(x: x, y: y)
                    c.rotate(by: .radians(p.spin * time))
                    c.fill(Path(roundedRect: CGRect(origin: CGPoint(x: -p.size.width / 2, y: -p.size.height / 2), size: p.size), cornerRadius: 1.5), with: .color(colors[p.colorIndex]))
                }
            }
        }
        .allowsHitTesting(false)
        .accessibilityHidden(true)
        .onChange(of: trigger) { _, _ in
            guard !reduceMotion else { return }
            start = .now
            Task {
                try? await Task.sleep(for: .seconds(1.8))
                start = nil
            }
        }
    }
}

/// Deterministic randomness, so the confetti looks the same every time.
struct SeededGenerator: RandomNumberGenerator {
    private var state: UInt64
    init(seed: UInt64) { state = seed &+ 0x9E37_79B9_7F4A_7C15 }
    mutating func next() -> UInt64 {
        state &+= 0x9E37_79B9_7F4A_7C15
        var z = state
        z = (z ^ (z >> 30)) &* 0xBF58_476D_1CE4_E5B9
        z = (z ^ (z >> 27)) &* 0x94D0_49BB_1331_11EB
        return z ^ (z >> 31)
    }
}
