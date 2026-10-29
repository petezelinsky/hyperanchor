// Renders the app icon (1024×1024 PNG) from the same geometry as src/app/icon.svg:
// a black square, a white "h" and an accent-colored dot. iOS rounds the corners itself.
//   swift ios/scripts/render-icon.swift ios/Hyperanchor/Resources/Assets.xcassets/AppIcon.appiconset/AppIcon.png

import CoreGraphics
import Foundation
import ImageIO
import UniformTypeIdentifiers

let size = 1024
let scale = CGFloat(size) / 64 // the SVG's viewBox is 64×64
let output = CommandLine.arguments.dropFirst().first ?? "AppIcon.png"

let space = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: 0, space: space,
                    bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
// SVG coordinates: origin top-left.
ctx.translateBy(x: 0, y: CGFloat(size))
ctx.scaleBy(x: scale, y: -scale)

func rgb(_ hex: UInt32) -> CGColor {
    CGColor(colorSpace: space, components: [CGFloat((hex >> 16) & 0xFF) / 255, CGFloat((hex >> 8) & 0xFF) / 255, CGFloat(hex & 0xFF) / 255, 1])!
}

ctx.setFillColor(rgb(0x171717))
ctx.fill(CGRect(x: 0, y: 0, width: 64, height: 64))

// M20 15v34  M20 33.5c0-6 4.4-10 10-10s9.5 4 9.5 10V49
let h = CGMutablePath()
h.move(to: CGPoint(x: 20, y: 15))
h.addLine(to: CGPoint(x: 20, y: 49))
h.move(to: CGPoint(x: 20, y: 33.5))
h.addCurve(to: CGPoint(x: 30, y: 23.5), control1: CGPoint(x: 20, y: 27.5), control2: CGPoint(x: 24.4, y: 23.5))
h.addCurve(to: CGPoint(x: 39.5, y: 33.5), control1: CGPoint(x: 35.6, y: 23.5), control2: CGPoint(x: 39.5, y: 27.5))
h.addLine(to: CGPoint(x: 39.5, y: 49))
ctx.addPath(h)
ctx.setStrokeColor(rgb(0xFFFFFF))
ctx.setLineWidth(6.5)
ctx.setLineCap(.round)
ctx.setLineJoin(.round)
ctx.strokePath()

// The dot: the accent (blue, its dark-theme tone, as in icon.svg).
ctx.setFillColor(rgb(0x3B82F6))
ctx.fillEllipse(in: CGRect(x: 49.5 - 4.25, y: 45.75 - 4.25, width: 8.5, height: 8.5))

let image = ctx.makeImage()!
let url = URL(fileURLWithPath: output)
let dest = CGImageDestinationCreateWithURL(url as CFURL, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, image, nil)
guard CGImageDestinationFinalize(dest) else { fatalError("Couldn't write \(output)") }
print("Wrote \(output)")
