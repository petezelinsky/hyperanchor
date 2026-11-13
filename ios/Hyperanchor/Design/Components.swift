import SafariServices
import SwiftUI

/// The account photo (Google) or the initials on a quiet gray disc, as on the web (Avatar.tsx).
struct Avatar: View {
    let user: AppUser
    var size: CGFloat = 30

    var body: some View {
        Group {
            if let image = user.image, let url = URL(string: image) {
                AsyncImage(url: url) { phase in
                    if let img = phase.image { img.resizable().scaledToFill() } else { initials }
                }
                .background(.surface3)
            } else {
                initials
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var initials: some View {
        Circle()
            .fill(.line2)
            .overlay {
                Text(verbatim: Self.initials(user.name))
                    .font(.system(size: (size * 0.36).rounded(), weight: .semibold))
                    .tracking(0.02 * (size * 0.36).rounded())
                    .foregroundStyle(.ink2)
            }
    }

    /// "Alex Morgan" → "AM": the first letters of the first two words.
    static func initials(_ name: String) -> String {
        let letters = name.split(whereSeparator: \.isWhitespace).prefix(2).compactMap(\.first).map(String.init).joined().uppercased()
        return letters.isEmpty ? "?" : letters
    }
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

/// The web's plain button (`Button`, secondary, md): the page's color with a hairline ring, 32 pt tall, a 13 pt label.
/// `.danger` is the quiet red one ("Delete account…"), `.destructive` the filled red one ("Delete for good"). The tap
/// area is at least 44 pt tall, as on the web's touch screens.
struct OutlineButtonStyle: ButtonStyle {
    enum Tone { case normal, danger, destructive }
    var tone: Tone = .normal
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
        configuration.label
            .font(.token(Tokens.Typography.footnote, weight: .medium))
            .labelStyle(OutlineLabelStyle())
            .foregroundStyle(tone == .destructive ? Color.surface : tone == .danger ? .redInk : .ink)
            .lineLimit(1)
            .padding(.horizontal, 12)
            .frame(minHeight: 32)
            .background(tone == .destructive ? Color.redInk : configuration.isPressed ? (tone == .danger ? .redSoft : .surface3) : .surface, in: shape)
            .overlay { if tone != .destructive { shape.strokeBorder(.line2, lineWidth: 1) } }
            .opacity(isEnabled ? (tone == .destructive && configuration.isPressed ? 0.9 : 1) : 0.4)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
    }
}

/// An icon and its words, 6 pt apart, the icon a little smaller than the words (the web's buttons).
private struct OutlineLabelStyle: LabelStyle {
    func makeBody(configuration: Configuration) -> some View {
        HStack(spacing: 6) {
            configuration.icon.imageScale(.small)
            configuration.title
        }
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

/// The toast (TaskApp.tsx `ToastView`), one at a time (ink, or Liquid Glass on iOS 26). It rises in; a new one
/// takes the last one's place at once; one that times out, is acted on or swiped away leaves in 110 ms. Even padding
/// when it has no button; the words wrap to a second line instead of being cut off. Reduce Motion: fades only.
struct ToastOverlay: View {
    /// From the bottom edge of the area it sits in (inside the safe area): the web's 20 pt on phones, 24 pt on iPad.
    var bottom: CGFloat = 20
    @Environment(Toaster.self) private var toaster
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown: Toaster.Toast?
    @State private var leaving = false
    @State private var width: CGFloat = 390

    var body: some View {
        ZStack(alignment: .bottom) {
            if let toast = shown {
                ToastCard(toast: toast, textWidth: min(420, (width * 0.6).rounded())) { toaster.runAction() }
                    .id(toast.id)
                    .opacity(leaving ? 0 : 1)
                    .offset(y: leaving && !reduceMotion ? 6 : 0)
                    .transition(.asymmetric(insertion: reduceMotion ? .opacity : .opacity.combined(with: .offset(y: 8)), removal: .identity))
                    .gesture(DragGesture(minimumDistance: 10).onEnded { if $0.translation.height > 10 { toaster.dismiss() } })
            }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, bottom)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onAppear { shown = toaster.current }
        .onChange(of: toaster.current) { _, next in
            if let next {
                // A new one takes the last one's place at once.
                leaving = false
                withAnimation(reduceMotion ? Motion.reduced : Motion.out()) { shown = next }
            } else if shown != nil {
                withAnimation(reduceMotion ? Motion.reduced : Motion.exit) {
                    leaving = true
                } completion: {
                    guard toaster.current == nil else { return }
                    shown = nil
                    leaving = false
                }
            }
        }
    }
}

/// The web's look: ink, with the page's color for its words. On iOS 26 (unless Reduce Transparency is on) a Liquid Glass
/// capsule instead, its button glass too.
private struct ToastCard: View {
    let toast: Toaster.Toast
    let textWidth: CGFloat
    let act: () -> Void
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        Group {
            if #available(iOS 26, *) {
                if reduceTransparency { solid } else { glass }
            } else {
                solid
            }
        }
        .dynamicTypeSize(...DynamicTypeSize.accessibility2)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("toast")
    }

    private var message: some View {
        Text(toast.message)
            .font(.token(Tokens.Typography.footnote))
            .lineLimit(2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: textWidth, alignment: .leading)
            .fixedSize(horizontal: true, vertical: false)
    }

    @available(iOS 26, *)
    private var glass: some View {
        GlassEffectContainer {
            HStack(spacing: 10) {
                message.foregroundStyle(.ink)
                if let label = toast.actionLabel {
                    Button(action: act) {
                        Text(label)
                            .font(.token(Tokens.Typography.footnote, weight: .semibold))
                            .foregroundStyle(.ink)
                    }
                    .buttonStyle(.glass)
                    .tint(.ink)
                    .contentShape(Rectangle().inset(by: -6))
                    .accessibilityIdentifier("toast.action")
                }
            }
            .padding(.leading, 18)
            .padding(.trailing, toast.actionLabel == nil ? 18 : 6)
            .padding(.vertical, 6)
            .frame(minHeight: 44)
            .glassEffect(.regular, in: .capsule)
        }
    }

    private var solid: some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous)
        return HStack(spacing: 12) {
            message.foregroundStyle(.surface)
            if let label = toast.actionLabel {
                Button(label, action: act)
                    .font(.token(Tokens.Typography.footnote, weight: .semibold))
                    .foregroundStyle(.surface)
                    .padding(.horizontal, 10)
                    .frame(minHeight: 28)
                    .background(Color.surface.opacity(0.12), in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                    .contentShape(Rectangle().inset(by: -8))
                    .buttonStyle(PressableStyle())
                    .accessibilityIdentifier("toast.action")
            }
        }
        .padding(.leading, 16)
        .padding(.trailing, toast.actionLabel == nil ? 16 : 6)
        .padding(.vertical, toast.actionLabel == nil ? 8 : 6)
        .frame(minHeight: 40)
        .background(.ink, in: shape)
        .elevation(Tokens.Shadow.float, in: shape)
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
