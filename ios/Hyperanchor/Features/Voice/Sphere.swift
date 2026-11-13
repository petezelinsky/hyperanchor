import SwiftUI

/// The sphere on the voice screen: the particle ring, a frame at a time, in the color of the text: 60 frames a second
/// while it moves to a voice or waits on the server (`lively`), 30 while it only drifts at rest. Decorative: VoiceOver
/// hears what the screen is doing from its words instead.
struct Sphere: View {
    let ring: ParticleRing
    var lively = true

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / (lively ? 60 : 30))) { timeline in
            Canvas { context, size in
                ring.step(to: timeline.date)
                ring.draw(in: &context, size: size)
            }
        }
        .accessibilityHidden(true)
    }
}

/// The sphere, small (Orb.tsx): the voice screen's own ring of dots, drawn once and still, as the sign of everything
/// spoken (the Speak buttons). Fewer, larger dots than on the voice screen, so the ring still reads as dots at the size
/// of an icon. It takes the color of the text around it.
struct Orb: View {
    var size: CGFloat = 16

    var body: some View {
        Canvas { context, canvasSize in
            Self.ring.draw(in: &context, size: canvasSize)
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    @MainActor private static let ring: ParticleRing = {
        var o = ParticleRing.Options()
        o.count = 700
        o.dotSize = 14
        o.spread = 56
        o.intro = false
        let ring = ParticleRing(o)
        ring.settle(0.4)
        return ring
    }()
}
