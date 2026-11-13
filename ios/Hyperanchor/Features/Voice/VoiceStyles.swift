import SwiftUI

/// The web's buttons on the voice screen (`Button` in src/components/ui.tsx): secondary, white with a hairline ring;
/// primary, black (white in dark mode); plain, gray words; danger-quiet, red words on white. Sizes: sm 28 pt and md 32 pt
/// (footnote), lg 44 pt on phones and 40 on iPad (callout). Pressed, they take the web's hover and active looks.
struct VoiceButtonStyle: ButtonStyle {
    enum Variant { case primary, secondary, plain, dangerQuiet }
    enum Size { case sm, md, lg }

    var variant: Variant = .secondary
    var size: Size = .md
    /// Shares the row with the buttons beside it (phones).
    var fill = false
    /// iPad's proportions for lg: 40 pt high, a little rounder, and the primary at least 140 wide.
    var wide = false
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        let pressed = configuration.isPressed
        let shape = RoundedRectangle(cornerRadius: size == .lg && wide ? 10 : Tokens.Radius.sm, style: .continuous)
        configuration.label
            .font(size == .lg ? .token(Tokens.Typography.callout, weight: .medium) : .token(Tokens.Typography.footnote, weight: .medium))
            .foregroundStyle(foreground(pressed))
            .multilineTextAlignment(.center)
            // Stretched buttons share the row, so their padding is only a minimum (two fit side by side on an SE).
            .padding(.horizontal, size == .lg ? (fill ? 12 : 20) : size == .md ? 12 : 10)
            .padding(.vertical, 4)
            .frame(minWidth: size == .lg && wide && variant == .primary ? 140 : nil)
            .frame(maxWidth: fill ? .infinity : nil, minHeight: height)
            .background(background(pressed), in: shape)
            .overlay {
                if variant == .secondary || variant == .dangerQuiet { shape.strokeBorder(Color.line2, lineWidth: 1) }
            }
            .contentShape(shape)
            .scaleEffect(pressed && variant != .plain ? 0.98 : 1)
            .opacity(isEnabled ? 1 : 0.4)
            .animation(.easeOut(duration: Tokens.Motion.fast), value: pressed)
    }

    private var height: CGFloat {
        switch size {
        case .sm: 28
        case .md: 32
        case .lg: wide ? 40 : 44
        }
    }

    private func foreground(_ pressed: Bool) -> Color {
        switch variant {
        case .primary: .onPrimary
        case .secondary: .ink
        case .plain: pressed ? .ink : .ink2
        case .dangerQuiet: .redInk
        }
    }

    private func background(_ pressed: Bool) -> Color {
        switch variant {
        case .primary: pressed ? Tokens.primaryHover.color : .primaryFill
        case .secondary: pressed ? .surface3 : .surface
        case .plain: pressed ? .line : .clear
        case .dangerQuiet: pressed ? .redSoft : .surface
        }
    }
}

/// A button of the voice screen's controls: Liquid Glass on iOS 26 and later (prominent, in the primary black or white,
/// for the next step; clear glass for the others), and the web's solid look before that or with Reduce Transparency.
/// Only the controls are glass: the screen itself stays plain.
struct VoiceButton<Label: View>: View {
    let variant: VoiceButtonStyle.Variant
    var size: VoiceButtonStyle.Size = .lg
    /// Shares the row with the buttons beside it (phones).
    var fill = false
    /// iPad's proportions.
    var wide = false
    let action: () -> Void
    @ViewBuilder let label: () -> Label

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        if #available(iOS 26.0, *), !reduceTransparency {
            glass
        } else {
            Button(action: action, label: label)
                .buttonStyle(VoiceButtonStyle(variant: variant, size: size, fill: fill, wide: wide))
        }
    }

    @available(iOS 26.0, *)
    @ViewBuilder
    private var glass: some View {
        let button = Button(action: action) {
            label()
                .foregroundStyle(foreground)
                .lineLimit(2)
                .multilineTextAlignment(.center)
                .frame(maxWidth: fill ? .infinity : nil)
                .frame(minWidth: wide && variant == .primary ? 116 : nil)
        }
        .font(size == .lg ? .token(Tokens.Typography.callout, weight: .medium) : .token(Tokens.Typography.footnote, weight: .medium))
        .controlSize(size == .lg ? .large : .regular)
        .buttonBorderShape(.capsule)
        if variant == .primary {
            button.buttonStyle(.glassProminent).tint(Color.primaryFill)
        } else {
            button.buttonStyle(.glass)
        }
    }

    private var foreground: Color {
        switch variant {
        case .primary: .onPrimary
        case .secondary: .ink
        case .plain: .ink2
        case .dangerQuiet: .redInk
        }
    }
}

extension VoiceButton where Label == Text {
    init(_ title: String, variant: VoiceButtonStyle.Variant, size: VoiceButtonStyle.Size = .lg, fill: Bool = false, wide: Bool = false,
         action: @escaping () -> Void) {
        self.init(variant: variant, size: size, fill: fill, wide: wide, action: action) { Text(title) }
    }
}

/// The web's small square icon button (`IconButton`): an icon in 28 or 32 points, plain or with a hairline ring, in a
/// 44-point tap target.
struct VoiceIconButton: View {
    let symbol: String
    let label: String
    var size: CGFloat = 32
    var iconSize: CGFloat = 13
    var ringed = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: iconSize, weight: .medium))
                .frame(width: size, height: size)
                .overlay {
                    if ringed {
                        RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(Color.line2, lineWidth: 1)
                    }
                }
                .tapTarget()
        }
        .buttonStyle(IconPressStyle())
        .accessibilityLabel(label)
    }

    private struct IconPressStyle: ButtonStyle {
        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .foregroundStyle(configuration.isPressed ? Color.ink : .ink2)
                .background {
                    if configuration.isPressed {
                        RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).fill(Color.surface3).padding(6)
                    }
                }
        }
    }
}

/// A small ring that turns while the tasks are being sorted (the web's spinner: a light circle, its top quarter dark).
struct RingSpinner: View {
    var body: some View {
        TimelineView(.animation) { timeline in
            let turn = timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 0.9) / 0.9
            ZStack {
                Circle().stroke(Color.line2, lineWidth: 1.5)
                Circle().trim(from: 0, to: 0.25)
                    .stroke(Color.ink, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                    .rotationEffect(.degrees(turn * 360 - 90))
            }
        }
        .frame(width: 16, height: 16)
        .accessibilityHidden(true)
    }
}

/// Lines where the tasks will be while they are sorted: a soft band of light passes over each (the web's `.skeleton`),
/// one after another. Still with Reduce Motion.
struct SkeletonRows: View {
    private static let widths: [CGFloat] = [0.72, 0.54, 0.63]
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        VStack(spacing: 0) {
            ForEach(Self.widths.indices, id: \.self) { i in
                HStack(spacing: 24) {
                    GeometryReader { geo in
                        bar(delay: Double(i) * 0.14).frame(width: geo.size.width * Self.widths[i])
                    }
                    .frame(height: 12)
                    bar(delay: Double(i) * 0.14 + 0.07).frame(width: 56, height: 12)
                }
                .padding(.horizontal, 20)
                .frame(height: 52)
                .hairline()
            }
        }
        .accessibilityHidden(true)
    }

    private func bar(delay: Double) -> some View {
        Capsule()
            .fill(Color.surface3)
            .overlay {
                if !reduceMotion {
                    TimelineView(.animation) { timeline in
                        GeometryReader { geo in
                            let w = geo.size.width
                            let t = ((timeline.date.timeIntervalSinceReferenceDate - delay) / 1.3).truncatingRemainder(dividingBy: 1)
                            let eased = t * t * (3 - 2 * t)
                            LinearGradient(stops: [.init(color: .surface3, location: 0), .init(color: .line2, location: 0.45),
                                                   .init(color: .surface3, location: 0.9)], startPoint: .leading, endPoint: .trailing)
                                .frame(width: w * 2.2)
                                .offset(x: -1.44 * w + 2.64 * w * eased)
                        }
                    }
                    .clipShape(Capsule())
                }
            }
            .frame(height: 12)
    }
}
