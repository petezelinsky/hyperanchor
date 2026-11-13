import SwiftUI
import UIKit

/// The liquid lens over Progress (lens.ts on the web, from the zelinsky-liquid-lens recipe): pressing Summarize drops a
/// ring of liquid glass on the page that rolls out from the exact point pressed. A quick press gives a light ring;
/// holding presses a dent under the finger and lets a deeper, slightly wider ring go on release. About a second for the
/// ring itself.
///
/// As on the web, the ring plays on a picture of the page (taken when the finger comes down), laid over the page and
/// gone once the ring has passed: a shader bends one flat image reliably, where the live page is drawn in many layers.
/// Scrolling under the picture ends it at once. With Reduce Motion nothing plays.
@MainActor
@Observable
final class LensDriver {
    /// The levers, at the recipe's defaults: a subtle ring.
    static let strength: Float = 12
    static let ring: Float = 64
    static let speed: Float = 520
    static let chroma: Float = 0.6
    static let boost: Float = 1.5
    static let chargeTime: Double = 0.8

    /// The page as it was when the finger came down; nil when nothing plays.
    private(set) var picture: UIImage?
    /// Where the press is, in the page's coordinates (`LensSpace`).
    private(set) var origin: CGPoint = .zero
    private(set) var pressedAt: Date?
    private(set) var releasedAt: Date?
    /// How deep the press was when it let go (0 a tap … 1 a full hold).
    private(set) var charge: Float = 0
    /// A press that didn't end on the button: the dent springs back without a ring.
    private(set) var ringless = false

    /// The window the page is in, and where the page is in it (to take its picture).
    @ObservationIgnored weak var window: UIWindow?
    @ObservationIgnored var pageFrame: CGRect = .zero
    /// The middle of the button, in the page's coordinates: where a press without a finger starts the ring.
    @ObservationIgnored var keyOrigin: CGPoint = .zero
    /// Where the page's content is (it moves when the page scrolls).
    @ObservationIgnored private var contentY: CGFloat = 0
    @ObservationIgnored private var pictureY: CGFloat = 0
    @ObservationIgnored private var ending: Task<Void, Never>?

    var holding: Bool { pressedAt != nil }

    /// The finger comes down: the picture is taken and dented under the finger while it's held.
    func press(at point: CGPoint) {
        ending?.cancel()
        guard let picture = takePicture() else { return }
        self.picture = picture
        pictureY = contentY
        origin = point
        pressedAt = .now
        releasedAt = nil
        ringless = false
        UIImpactFeedbackGenerator(style: .soft).impactOccurred()
    }

    /// The press ends on the button: the ring rolls out from where it was.
    func release() {
        guard let pressed = pressedAt else { return }
        charge = Self.charge(held: Date.now.timeIntervalSince(pressed))
        UIImpactFeedbackGenerator(style: charge > 0.5 ? .medium : .light).impactOccurred()
        let ring = Double(Self.ring * (1 + 0.4 * charge))
        let corners = [CGPoint.zero, CGPoint(x: pageFrame.width, y: 0), CGPoint(x: 0, y: pageFrame.height), CGPoint(x: pageFrame.width, y: pageFrame.height)]
        let far = corners.map { hypot($0.x - origin.x, $0.y - origin.y) }.max() ?? 0
        end(after: min(2.4, (Double(far) + ring * 2.5) / Double(Self.speed) + 0.15), ringless: false)
    }

    /// The press didn't end on the button: no ring, the dent springs back.
    func cancel() {
        guard let pressed = pressedAt else { return }
        charge = Self.charge(held: Date.now.timeIntervalSince(pressed))
        end(after: 0.3, ringless: true)
    }

    /// A press without a finger (VoiceOver, a keyboard): a light ring from the button's middle.
    func tap() {
        press(at: keyOrigin)
        release()
    }

    /// The page's content moved (a scroll): a picture of where it was would show the wrong page, so the ring stops.
    func contentMoved(to y: CGFloat) {
        contentY = y
        if picture != nil, abs(y - pictureY) > 0.5 { stop(fade: false) }
    }

    /// Ends whatever plays (the page went away, or it scrolled).
    func stop(fade: Bool = true) {
        ending?.cancel()
        pressedAt = nil
        releasedAt = nil
        guard picture != nil else { return }
        if fade {
            withAnimation(.easeOut(duration: Tokens.Motion.fast)) { picture = nil }
        } else {
            picture = nil
        }
    }

    private func end(after seconds: Double, ringless: Bool) {
        pressedAt = nil
        self.ringless = ringless
        releasedAt = .now
        ending?.cancel()
        ending = Task { [weak self] in
            try? await Task.sleep(for: .seconds(seconds))
            guard !Task.isCancelled else { return }
            // The page underneath may have changed meanwhile (the summary is being written): a short fade, not a jump.
            self?.stop(fade: true)
        }
    }

    /// The page as it is on screen now, from the window (everything in it, as drawn).
    private func takePicture() -> UIImage? {
        guard let window, pageFrame.width >= 8, pageFrame.height >= 8 else { return nil }
        let frame = pageFrame
        let format = UIGraphicsImageRendererFormat()
        format.scale = window.traitCollection.displayScale
        format.opaque = true
        return UIGraphicsImageRenderer(size: frame.size, format: format).image { _ in
            window.drawHierarchy(in: CGRect(origin: CGPoint(x: -frame.minX, y: -frame.minY), size: window.bounds.size), afterScreenUpdates: false)
        }
    }

    private static func charge(held seconds: Double) -> Float {
        let c = Float(min(1, max(0, seconds) / chargeTime))
        return 1 - (1 - c) * (1 - c)
    }

    /// The shader's inputs at `date`.
    func uniforms(at date: Date) -> (t: Float, press: Float, amp: Float, ring: Float) {
        if let pressed = pressedAt {
            return (-1, Self.charge(held: date.timeIntervalSince(pressed)), 0, Self.ring)
        }
        guard let released = releasedAt else { return (-1, 0, 0, Self.ring) }
        let t = Float(date.timeIntervalSince(released))
        let c = charge
        if ringless { return (-1, c * exp(-t * 9), 0, Self.ring) }
        let press = c * exp(-t * 9) + sin(.pi * min(1, max(0, t) / 0.45)) * 0.5 * (1 - c)
        return (t, press, Self.strength * (1 + Self.boost * c), Self.ring * (1 + 0.4 * c))
    }
}

/// The coordinate space of the page the ring plays over (the work area under the bar): presses are measured in it.
enum LensSpace {
    static let name = "progress.lens"
}

extension View {
    /// The page the lens plays over (put on its scroll view): its coordinate space, its picture's place, and the ring.
    func lensSurface(_ driver: LensDriver) -> some View {
        coordinateSpace(.named(LensSpace.name))
            .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { driver.pageFrame = $0 }
            .background(WindowReader { driver.window = $0 })
            .overlay(alignment: .topLeading) { LensOverlay(driver: driver) }
            .onDisappear { driver.stop(fade: false) }
    }

    /// What scrolls on that page: when it moves, the ring stops.
    func lensContent(_ driver: LensDriver) -> some View {
        onGeometryChange(for: CGFloat.self) { $0.frame(in: .named(LensSpace.name)).minY } action: { driver.contentMoved(to: $0) }
    }

    /// Makes this button press the lens: the dent while held, the ring when it's released on the button. A press that
    /// turns into a scroll lets go without a ring. `enabled` false: the press does nothing.
    func pressesLens(_ driver: LensDriver, enabled: Bool) -> some View {
        modifier(LensPress(driver: driver, enabled: enabled))
    }
}

/// The picture of the page with the ring playing over it.
private struct LensOverlay: View {
    let driver: LensDriver
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if let picture = driver.picture, !reduceMotion {
            TimelineView(.animation) { context in
                let u = driver.uniforms(at: context.date)
                Image(uiImage: picture)
                    .resizable()
                    .frame(width: picture.size.width, height: picture.size.height)
                    .layerEffect(
                        ShaderLibrary.liquidLens(
                            .float2(picture.size), .float2(driver.origin), .float(u.t), .float(u.press), .float(u.amp), .float(u.ring),
                            .float(LensDriver.speed), .float(LensDriver.chroma)
                        ),
                        maxSampleOffset: .zero
                    )
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .transition(.opacity)
        }
    }
}

/// Finds the window a view is in.
private struct WindowReader: UIViewRepresentable {
    let found: @MainActor (UIWindow?) -> Void

    func makeUIView(context: Context) -> Probe { Probe(found: found) }
    func updateUIView(_ view: Probe, context: Context) {}

    final class Probe: UIView {
        let found: @MainActor (UIWindow?) -> Void

        init(found: @escaping @MainActor (UIWindow?) -> Void) {
            self.found = found
            super.init(frame: .zero)
            isUserInteractionEnabled = false
            isAccessibilityElement = false
        }

        required init?(coder: NSCoder) { nil }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            found(window)
        }
    }
}

private struct LensPress: ViewModifier {
    let driver: LensDriver
    let enabled: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private enum Touch: Equatable {
        case idle, down(CGPoint), moved
    }

    @GestureState private var touch: Touch = .idle

    func body(content: Content) -> some View {
        content
            .simultaneousGesture(
                DragGesture(minimumDistance: 0, coordinateSpace: .named(LensSpace.name))
                    .updating($touch) { value, state, _ in
                        if state == .moved { return }
                        state = hypot(value.translation.width, value.translation.height) > 10 ? .moved : .down(value.startLocation)
                    }
            )
            .onGeometryChange(for: CGPoint.self) { g in
                let f = g.frame(in: .named(LensSpace.name))
                return CGPoint(x: f.midX, y: f.midY)
            } action: { driver.keyOrigin = $0 }
            .onChange(of: touch) { old, new in
                switch (old, new) {
                case (.idle, .down(let point)):
                    if enabled && !reduceMotion { driver.press(at: point) }
                case (.down, .moved):
                    driver.cancel()
                case (.down, .idle):
                    // The button's own action releases the ring when the press ends on it; whatever else ended the
                    // press lets go without one.
                    Task { @MainActor in
                        if driver.holding { driver.cancel() }
                    }
                default:
                    break
                }
            }
    }
}
