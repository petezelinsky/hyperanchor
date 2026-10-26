import SwiftUI
import UIKit

// SwiftUI colors from the generated tokens. Neutrals are static (they adapt to light/dark on their own);
// accent colors depend on the person's choice and come from the environment as a `Palette`.

extension RGBA {
    var uiColor: UIColor { UIColor(red: red, green: green, blue: blue, alpha: opacity) }
}

extension ThemeColor {
    /// Resolves to the light or dark value for the trait collection it's drawn in.
    var uiColor: UIColor {
        let light = light.uiColor
        let dark = dark.uiColor
        return UIColor { $0.userInterfaceStyle == .dark ? dark : light }
    }

    var color: Color { Color(uiColor: uiColor) }
}

extension ShapeStyle where Self == Color {
    static var canvas: Color { Tokens.canvas.color }
    static var surface: Color { Tokens.surface.color }
    static var surface2: Color { Tokens.surface2.color }
    static var surface3: Color { Tokens.surface3.color }
    static var elevated: Color { Tokens.elevated.color }
    static var glassFill: Color { Tokens.glass.color }
    static var scrim: Color { Tokens.scrim.color }
    static var ink: Color { Tokens.ink.color }
    static var ink2: Color { Tokens.ink2.color }
    static var ink3: Color { Tokens.ink3.color }
    static var ink4: Color { Tokens.ink4.color }
    static var line: Color { Tokens.line.color }
    static var line2: Color { Tokens.line2.color }
    static var checkRing: Color { Tokens.checkRing.color }
    /// Primary buttons: black in light, near-white in dark.
    static var primaryFill: Color { Tokens.primary.color }
    static var onPrimary: Color { Tokens.onPrimary.color }
    static var onAccent: Color { Tokens.onAccent.color }
    static var greenInk: Color { Tokens.greenInk.color }
    static var greenSoft: Color { Tokens.greenSoft.color }
    static var redInk: Color { Tokens.redInk.color }
    static var redSoft: Color { Tokens.redSoft.color }
}

/// The accent colors for the chosen accent. The accent means one thing everywhere: today, done, progress.
struct Palette: Equatable, Sendable {
    let choice: AccentChoice
    let accent: Color
    let accentInk: Color
    let accentSoft: Color
    let accentTrack: Color
    /// Activity heatmap levels 0…4 (0: nothing done).
    let heat: [Color]
    let accentUIColor: UIColor

    init(_ choice: AccentChoice) {
        let p = choice.palette
        self.choice = choice
        accent = p.accent.color
        accentInk = p.accentInk.color
        accentSoft = p.accentSoft.color
        accentTrack = p.accentTrack.color
        heat = [Tokens.heat0, p.heat1, p.heat2, p.heat3, p.heat4].map(\.color)
        accentUIColor = p.accent.uiColor
    }

    static func == (a: Palette, b: Palette) -> Bool { a.choice == b.choice }
}

extension EnvironmentValues {
    @Entry var palette = Palette(.default)
}

// MARK: - Shadows

private struct ElevationModifier<S: InsettableShape>: ViewModifier {
    let shadow: ThemeShadow
    let shape: S
    @Environment(\.colorScheme) private var scheme

    func body(content: Content) -> some View {
        let layers = scheme == .dark ? shadow.dark : shadow.light
        // A spread-only layer is a hairline ring; the rest are soft drop shadows.
        let ring = layers.first { $0.blur == 0 && $0.spread > 0 }
        let drops = layers.filter { $0.blur > 0 }
        content
            .overlay { if let ring { shape.strokeBorder(Color(uiColor: ring.color.uiColor), lineWidth: ring.spread) } }
            .background {
                ZStack {
                    ForEach(Array(drops.enumerated()), id: \.offset) { _, l in
                        shape
                            .fill(Color.black.opacity(0.001))
                            // A negative spread pulls the shadow in; approximate it with a smaller blur.
                            .shadow(color: Color(uiColor: l.color.uiColor), radius: max(0, l.blur + min(0, l.spread)) / 2, x: l.x, y: l.y)
                    }
                }
            }
    }
}

extension View {
    /// The web's `shadow-lift` / `shadow-sheet` / `shadow-float` around `shape`.
    func elevation<S: InsettableShape>(_ shadow: ThemeShadow, in shape: S) -> some View {
        modifier(ElevationModifier(shadow: shadow, shape: shape))
    }

    func elevation(_ shadow: ThemeShadow, cornerRadius: CGFloat) -> some View {
        elevation(shadow, in: RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}
