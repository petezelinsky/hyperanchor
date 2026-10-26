import SafariServices
import SwiftUI

/// The logo is the name itself: lowercase, with a period in the accent.
struct Wordmark: View {
    var size: CGFloat = 19
    @Environment(\.palette) private var palette

    var body: some View {
        (Text("hyperanchor").foregroundStyle(.ink) + Text(".").foregroundStyle(palette.accent))
            .font(.system(size: size, weight: .semibold))
            .tracking(-0.045 * size)
            .accessibilityLabel("Hyperanchor")
    }
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
