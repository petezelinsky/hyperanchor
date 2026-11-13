// Renders the "hy" sign — the web's icon (src/app/icon.svg; the logo spec's SIGN_PATH: h flowing into y in one band of
// even width, the same when turned 180°) — wherever iOS needs it:
//   - the app icon, as the web's home-screen icon: the sign black (#111111) on a white tile, 60% of its height; dark
//     (white on near-black) and tinted (grayscale, iOS colors it) for iOS 18+;
//   - the launch screen's mark: the sign alone, 44 pt tall, light and dark, @2x and @3x (RootView draws the same image).
// The path is read from src/app/icon.svg, so the app follows the web's sign; nothing here writes to the web.
// Run from the repository root:  swift ios/scripts/render-icon.swift

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let assets = "ios/Hyperanchor/Resources/Assets.xcassets"
let webIcon = "src/app/icon.svg"
guard FileManager.default.fileExists(atPath: assets), let svg = try? String(contentsOfFile: webIcon, encoding: .utf8) else {
    fatalError("Run from the repository root (needs \(assets) and \(webIcon)).")
}

// MARK: The sign, from the web's SVG path

/// The `d` of the icon's <path>.
guard let tag = svg.range(of: "<path"),
      let open = svg.range(of: " d=\"", range: tag.upperBound..<svg.endIndex),
      let close = svg.range(of: "\"", range: open.upperBound..<svg.endIndex) else { fatalError("No path in \(webIcon).") }
let d = svg[open.upperBound..<close.lowerBound]

/// An SVG path (M L H V A Z, absolute or relative — what the sign uses) as a CGPath in the SVG's own units.
func parse(_ d: Substring) -> CGPath {
    var tokens: [String] = []
    var number = ""
    func flush() { if !number.isEmpty { tokens.append(number); number = "" } }
    for ch in d {
        if ch.isLetter && ch != "e" && ch != "E" {
            flush()
            tokens.append(String(ch))
        } else if ch == "," || ch == " " || ch == "\n" {
            flush()
        } else if ch == "-" && !number.isEmpty && !number.hasSuffix("e") {
            flush()
            number.append(ch)
        } else if ch == "." && number.contains(".") {
            flush()
            number = "."
        } else {
            number.append(ch)
        }
    }
    flush()

    let path = CGMutablePath()
    var i = 0
    var command = "M"
    var current = CGPoint.zero
    var start = CGPoint.zero
    func next() -> CGFloat {
        defer { i += 1 }
        return CGFloat(Double(tokens[i])!)
    }
    while i < tokens.count {
        if let c = tokens[i].first, c.isLetter {
            command = tokens[i]
            i += 1
            if command == "Z" || command == "z" {
                path.closeSubpath()
                current = start
                continue
            }
        }
        let relative = command == command.lowercased()
        let base = relative ? current : .zero
        switch command.uppercased() {
        case "M":
            current = CGPoint(x: base.x + next(), y: base.y + next())
            start = current
            path.move(to: current)
            command = relative ? "l" : "L" // further pairs are lines
        case "L":
            current = CGPoint(x: base.x + next(), y: base.y + next())
            path.addLine(to: current)
        case "H":
            current = CGPoint(x: (relative ? current.x : 0) + next(), y: current.y)
            path.addLine(to: current)
        case "V":
            current = CGPoint(x: current.x, y: (relative ? current.y : 0) + next())
            path.addLine(to: current)
        case "A":
            let rx = next(), ry = next(), rotation = next(), large = next() != 0, sweep = next() != 0
            let end = CGPoint(x: base.x + next(), y: base.y + next())
            addArc(path, from: current, to: end, rx: rx, ry: ry, degrees: rotation, large: large, sweep: sweep)
            current = end
        default:
            fatalError("The sign uses a path command this script doesn't draw: \(command)")
        }
    }
    return path
}

/// An SVG elliptical arc, by way of its center (SVG 1.1, appendix F.6.5).
func addArc(_ path: CGMutablePath, from p1: CGPoint, to p2: CGPoint, rx: CGFloat, ry: CGFloat, degrees: CGFloat, large: Bool, sweep: Bool) {
    var rx = abs(rx), ry = abs(ry)
    guard rx > 0, ry > 0, p1 != p2 else { return path.addLine(to: p2) }
    let phi = degrees * .pi / 180, c = cos(phi), s = sin(phi)
    let dx = (p1.x - p2.x) / 2, dy = (p1.y - p2.y) / 2
    let x1 = c * dx + s * dy, y1 = -s * dx + c * dy
    let lambda = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
    if lambda > 1 { rx *= lambda.squareRoot(); ry *= lambda.squareRoot() }
    let num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    let den = rx * rx * y1 * y1 + ry * ry * x1 * x1
    let k = (large != sweep ? 1 : -1) * max(0, num / den).squareRoot()
    let cx1 = k * rx * y1 / ry, cy1 = -k * ry * x1 / rx
    let center = CGPoint(x: c * cx1 - s * cy1 + (p1.x + p2.x) / 2, y: s * cx1 + c * cy1 + (p1.y + p2.y) / 2)
    func angle(_ ux: CGFloat, _ uy: CGFloat, _ vx: CGFloat, _ vy: CGFloat) -> CGFloat {
        atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    }
    let theta = angle(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
    var delta = angle((x1 - cx1) / rx, (y1 - cy1) / ry, (-x1 - cx1) / rx, (-y1 - cy1) / ry)
    if !sweep && delta > 0 { delta -= 2 * .pi }
    if sweep && delta < 0 { delta += 2 * .pi }
    // A unit circle, scaled and turned into the ellipse; increasing angles are "counterclockwise" in the path's own space.
    let transform = CGAffineTransform(translationX: center.x, y: center.y).rotated(by: phi).scaledBy(x: rx, y: ry)
    path.addArc(center: .zero, radius: 1, startAngle: theta, endAngle: theta + delta, clockwise: delta < 0, transform: transform)
}

let sign = parse(d)
let box = sign.boundingBoxOfPath

// MARK: Rendering

let space = CGColorSpace(name: CGColorSpace.sRGB)!
func rgb(_ hex: UInt32) -> CGColor {
    CGColor(colorSpace: space, components: [CGFloat((hex >> 16) & 0xFF) / 255, CGFloat((hex >> 8) & 0xFF) / 255, CGFloat(hex & 0xFF) / 255, 1])!
}

/// A `width` × `height` image with the sign `signHeight` pixels tall in the middle, on `background` (or transparent).
func render(width: Int, height: Int, signHeight: CGFloat, ink: CGColor, background: CGColor?, to file: String) {
    let ctx = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                        bitmapInfo: (background == nil ? CGImageAlphaInfo.premultipliedLast : .noneSkipLast).rawValue)!
    if let background {
        ctx.setFillColor(background)
        ctx.fill(CGRect(x: 0, y: 0, width: width, height: height))
    }
    let scale = signHeight / box.height
    // The SVG's y runs down: flip, then center the sign's box.
    ctx.translateBy(x: CGFloat(width) / 2, y: CGFloat(height) / 2)
    ctx.scaleBy(x: scale, y: -scale)
    ctx.translateBy(x: -box.midX, y: -box.midY)
    ctx.addPath(sign)
    ctx.setFillColor(ink)
    ctx.fillPath()

    let dest = CGImageDestinationCreateWithURL(URL(fileURLWithPath: file) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(dest, ctx.makeImage()!, nil)
    guard CGImageDestinationFinalize(dest) else { fatalError("Couldn't write \(file)") }
    print("Wrote \(file)")
}

// App icon: as the web's home-screen icon (apple-icon.png), the sign 60% of the tile's height.
let icon = 1024, iconSign = CGFloat(icon) * 0.6
render(width: icon, height: icon, signHeight: iconSign, ink: rgb(0x111111), background: rgb(0xFFFFFF), to: "\(assets)/AppIcon.appiconset/AppIcon.png")
render(width: icon, height: icon, signHeight: iconSign, ink: rgb(0xFFFFFF), background: rgb(0x141414), to: "\(assets)/AppIcon.appiconset/AppIcon-Dark.png")
render(width: icon, height: icon, signHeight: iconSign, ink: rgb(0xFFFFFF), background: rgb(0x000000), to: "\(assets)/AppIcon.appiconset/AppIcon-Tinted.png")

// Launch screen: the sign 44 pt tall, as wide as it is; light and dark.
let launchPoints: CGFloat = 44
for scale in [2, 3] {
    let h = Int((launchPoints * CGFloat(scale)).rounded())
    let w = Int((launchPoints * box.width / box.height * CGFloat(scale)).rounded(.up))
    render(width: w, height: h, signHeight: CGFloat(h), ink: rgb(0x111111), background: nil, to: "\(assets)/LaunchMark.imageset/LaunchMark@\(scale)x.png")
    render(width: w, height: h, signHeight: CGFloat(h), ink: rgb(0xFFFFFF), background: nil, to: "\(assets)/LaunchMark.imageset/LaunchMark-Dark@\(scale)x.png")
}
