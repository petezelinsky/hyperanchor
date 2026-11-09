import SafariServices
import SwiftUI

/// The logo: "h." — a lowercase h and a period in the brand blue (the blue accent, whatever accent is chosen).
/// Drawn in a square box, the h 80% of its height and nudged toward its visual center, exactly like the launch
/// screen's image (a 55-point box) and the app icon. ios/scripts/render-icon.swift has the same geometry.
struct BrandMark: View {
    /// The side of the box.
    var size: CGFloat = 55

    var body: some View {
        Canvas { context, box in
            let a = box.height * 0.8
            let o = CGPoint(x: box.width / 2 + Self.origin.x * a, y: box.height / 2 + Self.origin.y * a)
            context.stroke(Self.h(height: a, at: o), with: .color(Self.ink), style: StrokeStyle(lineWidth: Self.stroke * a, lineCap: .butt, lineJoin: .round))
            let d = Self.dot * a
            context.fill(Path(ellipseIn: CGRect(x: o.x + (Self.width + Self.gap) * a, y: o.y + (1.012 - Self.dot) * a, width: d, height: d)), with: .color(Self.blue))
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    // In units of the h's height.
    private static let stroke: CGFloat = 0.14, width: CGFloat = 0.58, xHeight: CGFloat = 0.635, squareness: CGFloat = 0.68
    private static let dot: CGFloat = 0.17, gap: CGFloat = 0.075
    private static let origin = CGPoint(x: -(width + gap + dot) / 2 + 0.035, y: -0.5 - 0.02)

    private static func h(height a: CGFloat, at o: CGPoint) -> Path {
        let w = stroke * a, rc = (width * a - w) / 2
        let top = o.y + a - xHeight * a + w / 2
        let cy = top + rc, x0 = o.x + w / 2, x1 = o.x + width * a - w / 2, cx = o.x + width * a / 2
        var p = Path()
        p.move(to: CGPoint(x: x0, y: o.y))
        p.addLine(to: CGPoint(x: x0, y: o.y + a))
        p.move(to: CGPoint(x: x0, y: cy))
        p.addCurve(to: CGPoint(x: cx, y: top), control1: CGPoint(x: x0, y: cy - squareness * rc), control2: CGPoint(x: cx - squareness * rc, y: top))
        p.addCurve(to: CGPoint(x: x1, y: cy), control1: CGPoint(x: cx + squareness * rc, y: top), control2: CGPoint(x: x1, y: cy - squareness * rc))
        p.addLine(to: CGPoint(x: x1, y: o.y + a))
        return p
    }

    private static let ink = Color(uiColor: UIColor { $0.userInterfaceStyle == .dark ? .white : UIColor(white: 10 / 255, alpha: 1) })
    private static let blue = AccentChoice.blue.palette.accent.color
}

/// The account photo (Google) or initials on a gray gradient.
struct Avatar: View {
    let user: AppUser
    var size: CGFloat = 30

    var body: some View {
        Group {
            if let image = user.image, let url = URL(string: image) {
                AsyncImage(url: url) { phase in
                    if let img = phase.image { img.resizable().scaledToFill() } else { initials }
                }
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var initials: some View {
        let parts = user.name.split(whereSeparator: \.isWhitespace).prefix(2)
        let letters = parts.compactMap(\.first).map(String.init).joined().uppercased()
        return LinearGradient(colors: [Color(uiColor: Self.top), Color(uiColor: Self.bottom)], startPoint: .top, endPoint: .bottom)
            .overlay {
                Text(letters.isEmpty ? "?" : letters)
                    .font(.system(size: size * 0.4, weight: .semibold))
                    .foregroundStyle(.white)
            }
    }

    private static let top = UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.36, alpha: 1) : UIColor(white: 0.64, alpha: 1) }
    private static let bottom = UIColor { $0.userInterfaceStyle == .dark ? UIColor(white: 0.24, alpha: 1) : UIColor(white: 0.45, alpha: 1) }
}

/// Black (white in dark mode) — the primary action, as on the web.
struct PrimaryButtonStyle: ButtonStyle {
    var height: CGFloat = 50
    /// Full width (otherwise as wide as its label).
    var fill = true
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(.onPrimary)
            .frame(maxWidth: fill ? .infinity : nil, minHeight: height)
            .padding(.horizontal, fill ? 16 : 20)
            .background(.primaryFill, in: RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.4)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.spring(duration: 0.2), value: configuration.isPressed)
    }
}

/// White surface with a hairline ring — the secondary action.
struct SecondaryButtonStyle: ButtonStyle {
    var compact = false
    var height: CGFloat = 44
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(compact ? .footnote.weight(.semibold) : .body.weight(.medium))
            .foregroundStyle(.ink)
            .padding(.horizontal, compact ? 11 : 16)
            .frame(minHeight: compact ? 30 : height)
            .background(configuration.isPressed ? .surface3 : .surface, in: RoundedRectangle(cornerRadius: compact ? Tokens.Radius.sm : Tokens.Radius.lg, style: .continuous))
            .elevation(Tokens.Shadow.lift, cornerRadius: compact ? Tokens.Radius.sm : Tokens.Radius.lg)
            .opacity(isEnabled ? 1 : 0.4)
            .contentShape(Rectangle())
    }
}

/// A web page in Safari, inside the app (Privacy Policy, Terms of Service).
struct SafariView: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> SFSafariViewController {
        SFSafariViewController(url: url)
    }

    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
}

extension URL: @retroactive Identifiable {
    public var id: String { absoluteString }
}

/// The toast: dark capsule above the tab bar, optional Undo.
struct ToastOverlay: View {
    @Environment(Toaster.self) private var toaster

    var body: some View {
        VStack {
            Spacer()
            if let toast = toaster.current {
                HStack(spacing: 12) {
                    Text(toast.message)
                        .font(.subheadline)
                        .lineLimit(2)
                        .foregroundStyle(.surface)
                    if let label = toast.actionLabel {
                        Button(label) { toaster.runAction() }
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(.surface)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(.surface.opacity(0.14), in: RoundedRectangle(cornerRadius: 8, style: .continuous))
                            .accessibilityIdentifier("toast.action")
                    }
                }
                .padding(.leading, 16)
                .padding(.trailing, toast.actionLabel == nil ? 16 : 6)
                .padding(.vertical, toast.actionLabel == nil ? 11 : 6)
                .background(.ink, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
                .elevation(Tokens.Shadow.float, cornerRadius: 12)
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .id(toast.id)
                .gesture(DragGesture(minimumDistance: 10).onEnded { if $0.translation.height > 10 { toaster.dismiss() } })
                .accessibilityElement(children: .contain)
                .accessibilityIdentifier("toast")
            }
        }
        .animation(.spring(duration: 0.35, bounce: 0.2), value: toaster.current)
    }
}

/// Keeps a scrolling list to a comfortable reading width on wide screens (iPad), centered.
private struct ReadableContent: ViewModifier {
    let maxWidth: CGFloat
    @State private var width: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .contentMargins(.horizontal, max(0, (width - maxWidth) / 2), for: .scrollContent)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
    }
}

extension View {
    func readableContent(maxWidth: CGFloat = 820) -> some View {
        modifier(ReadableContent(maxWidth: maxWidth))
    }
}
