import SwiftUI

// The web's scales from design/tokens.json, for SwiftUI: type (with Dynamic Type), motion, radii and the hairlines.

// MARK: - Type

extension TextStyleName {
    var textStyle: Font.TextStyle {
        switch self {
        case .caption2: .caption2
        case .caption: .caption
        case .footnote: .footnote
        case .subheadline: .subheadline
        case .callout: .callout
        case .body: .body
        case .title3: .title3
        case .title: .title
        }
    }
}

extension Font {
    /// A step of the type scale: the Dynamic Type style it scales with (so text grows with the person's setting).
    static func token(_ step: TypeStep, weight: Font.Weight = .regular) -> Font {
        .system(step.style.textStyle, weight: weight)
    }
}

extension View {
    /// Font and tracking of a step of the type scale (`text-body`, `text-headline`, … on the web).
    func type(_ step: TypeStep, weight: Font.Weight = .regular) -> some View {
        font(.token(step, weight: weight)).tracking(step.tracking * step.size)
    }
}

// MARK: - Motion

/// The motion tokens: durations and curves the whole app shares (motion.ts on the web).
enum Motion {
    private static func curve(_ c: CubicCurve, _ duration: Double) -> Animation {
        .timingCurve(c.x1, c.y1, c.x2, c.y2, duration: duration)
    }

    /// Things arriving and settling: `ease-out`.
    static func out(_ duration: Double = Tokens.Motion.base) -> Animation { curve(Tokens.Motion.outCurve, duration) }
    /// Things leaving: `ease-in`.
    static func `in`(_ duration: Double = Tokens.Motion.fast) -> Animation { curve(Tokens.Motion.inCurve, duration) }
    /// A row travelling to its new place (a ticked task into Done).
    static var travel: Animation { .spring(duration: Tokens.Motion.move, bounce: 0.15) }
    /// Neighbours closing up or making room.
    static var settle: Animation { .snappy(duration: Tokens.Motion.base) }
    /// Menus, popovers and toasts on their way out: 110 ms.
    static var exit: Animation { curve(Tokens.Motion.inCurve, 0.11) }
    /// With Reduce Motion: a short fade instead of movement.
    static var reduced: Animation { .easeOut(duration: Tokens.Motion.reduced) }

    /// `animation`, or the short fade when the person asked for less motion.
    static func choose(_ animation: Animation, reduceMotion: Bool) -> Animation { reduceMotion ? reduced : animation }
}

// MARK: - Shapes and lines

extension View {
    /// A 1 pt hairline in the line color along one edge (the web's `border-b border-line`).
    func hairline(_ edge: VerticalEdge = .bottom, color: Color = .line) -> some View {
        overlay(alignment: edge == .bottom ? .bottom : .top) {
            Rectangle().fill(color).frame(height: 1)
        }
    }

    /// A tap target of at least 44 × 44 pt around a smaller control, looking the same (the web's `tap` utility).
    func tapTarget(_ size: CGFloat = 44) -> some View {
        frame(minWidth: size, minHeight: size).contentShape(Rectangle())
    }
}

/// The app's name as text, the web's Wordmark: "hyperanchor", semibold, tight.
struct Wordmark: View {
    var size: CGFloat = 17
    @ScaledMetric(relativeTo: .body) private var scale: CGFloat = 1

    var body: some View {
        Text(verbatim: "hyperanchor")
            .font(.system(size: size * scale, weight: .semibold))
            .tracking(-0.035 * size)
            .foregroundStyle(.ink)
            .lineLimit(1)
            .fixedSize()
            .accessibilityLabel("Hyperanchor")
    }
}

/// How much of the day on screen is done: a small ring and "2/7", quiet (the web's `DayCount`). Nothing for a day
/// without tasks. A ring that fills throws a little confetti.
struct DayCount: View {
    let done: Int
    let total: Int

    var body: some View {
        if total > 0 {
            HStack(spacing: 6) {
                Burst(active: done == total) {
                    ProgressRing(value: Double(done) / Double(total), size: 14, lineWidth: 1.75)
                }
                Text(verbatim: "\(done)/\(total)")
                    .font(.footnote)
                    .monospacedDigit()
                    .foregroundStyle(.ink3)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(done == total ? "All done" : "\(done) of \(total) done")
        }
    }
}

/// The icons, one family (SF Symbols at a light weight, like the web's 1.25 px line).
enum Icon {
    static let home = "house"
    static let progress = "chart.bar"
    static let goals = "flag"
    static let agent = "sparkles"
    static let focus = "viewfinder"
    static let sidebar = "sidebar.left"
    static let back = "arrow.uturn.backward"
    static let settings = "slider.horizontal.3"
    static let keyboard = "keyboard"
    static let signOut = "rectangle.portrait.and.arrow.right"
    static let more = "ellipsis"
    static let moreVertical = "ellipsis"
    static let search = "magnifyingglass"
    static let plus = "plus"
    static let previous = "chevron.left"
    static let next = "chevron.right"
    static let close = "xmark"
    static let summary = "sparkles"

    static func symbol(for page: Router.Page) -> String {
        switch page {
        case .home: home
        case .progress: progress
        case .goals: goals
        case .agent: agent
        }
    }
}
