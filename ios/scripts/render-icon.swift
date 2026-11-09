// Renders the logo — "h.", a lowercase h and a period in the brand blue — everywhere it's used, from one geometry:
//   - the app icon: light (black h on white), dark (white h on black) and tinted (iOS 18+ picks by appearance);
//   - the launch screen's mark (light and dark, @2x and @3x);
//   - the web's icon, src/app/icon.svg.
// Run from the repository root:  swift ios/scripts/render-icon.swift
// The app draws the same mark in SwiftUI (BrandMark in ios/Hyperanchor/Design/Components.swift); keep them in sync.

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

// MARK: Geometry, in units of the h's height (1 = from the top of the stem to the baseline).

let stroke: CGFloat = 0.14     // monoline stroke, flat ends
let hWidth: CGFloat = 0.58     // outer width of the h
let xHeight: CGFloat = 0.635   // top of the arch above the baseline
let squareness: CGFloat = 0.68 // the arch's Bézier handles (0.552 would be a half circle)
let dotSize: CGFloat = 0.17
let dotGap: CGFloat = 0.075    // between the leg and the dot
let overshoot: CGFloat = 0.012 // a round dot dips a little below the baseline
// The mark sits at the center of its box, nudged toward its visual center: right (the dot is light) and up.
let nudge = CGPoint(x: 0.035, y: -0.02)

/// The h's top-left corner relative to the box center, in h units.
let origin = CGPoint(x: -(hWidth + dotGap + dotSize) / 2 + nudge.x, y: -0.5 + nudge.y)

/// The h as a stroked centerline: the stem, then the arch from the stem down the right leg.
func hPath(height a: CGFloat, at o: CGPoint) -> CGPath {
    let w = stroke * a, rc = (hWidth * a - w) / 2
    let top = o.y + a - xHeight * a + w / 2
    let cy = top + rc, x0 = o.x + w / 2, x1 = o.x + hWidth * a - w / 2, cx = o.x + hWidth * a / 2
    let p = CGMutablePath()
    p.move(to: CGPoint(x: x0, y: o.y))
    p.addLine(to: CGPoint(x: x0, y: o.y + a))
    p.move(to: CGPoint(x: x0, y: cy))
    p.addCurve(to: CGPoint(x: cx, y: top), control1: CGPoint(x: x0, y: cy - squareness * rc), control2: CGPoint(x: cx - squareness * rc, y: top))
    p.addCurve(to: CGPoint(x: x1, y: cy), control1: CGPoint(x: cx + squareness * rc, y: top), control2: CGPoint(x: x1, y: cy - squareness * rc))
    p.addLine(to: CGPoint(x: x1, y: o.y + a))
    return p
}

func dotRect(height a: CGFloat, at o: CGPoint) -> CGRect {
    CGRect(x: o.x + (hWidth + dotGap) * a, y: o.y + (1 + overshoot - dotSize) * a, width: dotSize * a, height: dotSize * a)
}

// MARK: Colors

let space = CGColorSpace(name: CGColorSpace.sRGB)!
func rgb(_ hex: UInt32, _ alpha: CGFloat = 1) -> CGColor {
    CGColor(colorSpace: space, components: [CGFloat((hex >> 16) & 0xFF) / 255, CGFloat((hex >> 8) & 0xFF) / 255, CGFloat(hex & 0xFF) / 255, alpha])!
}

struct Style {
    let background: CGColor?
    let ink: CGColor
    let dot: CGColor
}

// The dot is the blue accent (design/tokens.json): its light tone on white, its dark tone on black.
let light = Style(background: rgb(0xFFFFFF), ink: rgb(0x0A0A0A), dot: rgb(0x2563EB))
let dark = Style(background: rgb(0x000000), ink: rgb(0xFFFFFF), dot: rgb(0x3B82F6))
// Tinted icons are grayscale; iOS colors them by luminance.
let tinted = Style(background: rgb(0x000000), ink: rgb(0xFFFFFF), dot: rgb(0xFFFFFF, 0.72))

// MARK: Rendering

/// A square image `pixels` wide with the mark `markHeight` (fraction of the side) tall in the middle.
func render(_ style: Style, pixels: Int, markHeight: CGFloat, to path: String) {
    let ctx = CGContext(data: nil, width: pixels, height: pixels, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                        bitmapInfo: (style.background == nil ? CGImageAlphaInfo.premultipliedLast : .noneSkipLast).rawValue)!
    let side = CGFloat(pixels)
    // Top-left origin, like the SVG.
    ctx.translateBy(x: 0, y: side)
    ctx.scaleBy(x: 1, y: -1)
    if let bg = style.background {
        ctx.setFillColor(bg)
        ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
    }
    let a = side * markHeight
    let o = CGPoint(x: side / 2 + origin.x * a, y: side / 2 + origin.y * a)
    ctx.addPath(hPath(height: a, at: o))
    ctx.setStrokeColor(style.ink)
    ctx.setLineWidth(stroke * a)
    ctx.setLineCap(.butt)
    ctx.setLineJoin(.round)
    ctx.strokePath()
    ctx.setFillColor(style.dot)
    ctx.fillEllipse(in: dotRect(height: a, at: o))

    let url = URL(fileURLWithPath: path)
    let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("Couldn't write \(path)") }
    print("Wrote \(path)")
}

/// The web's icon: a black rounded square; a bigger mark than the app icon's, so it reads at 16 px.
func svg(markHeight: CGFloat) -> String {
    let side: CGFloat = 64, a = side * markHeight
    let o = CGPoint(x: side / 2 + origin.x * a, y: side / 2 + origin.y * a)
    let w = stroke * a, rc = (hWidth * a - w) / 2
    let top = o.y + a - xHeight * a + w / 2
    let cy = top + rc, x0 = o.x + w / 2, x1 = o.x + hWidth * a - w / 2, cx = o.x + hWidth * a / 2
    let k = squareness * rc
    func f(_ v: CGFloat) -> String { String(format: "%.2f", v).replacingOccurrences(of: #"\.?0+$"#, with: "", options: .regularExpression) }
    let d = "M\(f(x0)) \(f(o.y))V\(f(o.y + a))M\(f(x0)) \(f(cy))C\(f(x0)) \(f(cy - k)) \(f(cx - k)) \(f(top)) \(f(cx)) \(f(top))"
        + "S\(f(x1)) \(f(cy - k)) \(f(x1)) \(f(cy))V\(f(o.y + a))"
    let dot = dotRect(height: a, at: o)
    return ##"<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="15" fill="#000"/>"##
        + ##"<path d="\##(d)" fill="none" stroke="#fff" stroke-width="\##(f(w))"/>"##
        + ##"<circle cx="\##(f(dot.midX))" cy="\##(f(dot.midY))" r="\##(f(dot.width / 2))" fill="#3b82f6"/></svg>"##
        + "\n"
}

let assets = "ios/Hyperanchor/Resources/Assets.xcassets"
guard FileManager.default.fileExists(atPath: assets) else { fatalError("Run from the repository root.") }

// App icon: the mark is small on purpose, a third of the icon.
let iconMark: CGFloat = 0.35
render(light, pixels: 1024, markHeight: iconMark, to: "\(assets)/AppIcon.appiconset/AppIcon.png")
render(dark, pixels: 1024, markHeight: iconMark, to: "\(assets)/AppIcon.appiconset/AppIcon-Dark.png")
render(tinted, pixels: 1024, markHeight: iconMark, to: "\(assets)/AppIcon.appiconset/AppIcon-Tinted.png")

// Launch screen: the mark 44 pt tall in a 55 pt square (BrandMark draws the same box), centered on the screen.
let launchPoints = 55, launchMark: CGFloat = 44.0 / 55.0
for scale in [2, 3] {
    render(Style(background: nil, ink: light.ink, dot: light.dot), pixels: launchPoints * scale, markHeight: launchMark,
           to: "\(assets)/LaunchMark.imageset/LaunchMark@\(scale)x.png")
    render(Style(background: nil, ink: dark.ink, dot: dark.dot), pixels: launchPoints * scale, markHeight: launchMark,
           to: "\(assets)/LaunchMark.imageset/LaunchMark-Dark@\(scale)x.png")
}

try! svg(markHeight: 0.56).write(toFile: "src/app/icon.svg", atomically: true, encoding: .utf8)
print("Wrote src/app/icon.svg")
