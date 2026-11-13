import SwiftUI

// The pieces of the bar on top and the sidebar, drawn like the web's (Sidebar.tsx, Toolbar.tsx, ui.tsx): quiet outlined
// buttons, a segmented switch, the arrows in one frame.

/// The web's SegmentedControl: a recessed track (a little darker than the page, with a hairline ring) and a raised
/// thumb that slides to the picked segment in 240 ms. Segments are all as wide as the widest, or share `width` equally.
/// VoiceOver reads each segment as a button, the picked one selected.
struct SegmentedSwitch<Value: Hashable>: View {
    let label: String
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    /// Narrower segments, where room is short.
    var compact = false
    /// SF Symbols before the labels, in the options' order (Appearance: a sun and a moon).
    var symbols: [String] = []
    /// A set width, shared equally (Settings: 176 pt).
    var width: CGFloat?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var thumb

    var body: some View {
        EqualWidthHStack(fills: width != nil) {
            ForEach(Array(options.enumerated()), id: \.offset) { i, option in
                segment(option.value, option.label, symbol: i < symbols.count ? symbols[i] : nil)
            }
        }
        .frame(width: width.map { $0 - 4 })
        .padding(2)
        .background(.surface2, in: RoundedRectangle(cornerRadius: 9, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 9, style: .continuous).strokeBorder(.line, lineWidth: 1))
        .fixedSize(horizontal: width == nil, vertical: true)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
        .sensoryFeedback(.selection, trigger: selection)
    }

    private func segment(_ value: Value, _ text: String, symbol: String?) -> some View {
        let on = value == selection
        return Button {
            guard !on else { return }
            withAnimation(Motion.choose(Motion.out(), reduceMotion: reduceMotion)) { selection = value }
        } label: {
            HStack(spacing: 6) {
                if let symbol { Image(systemName: symbol).imageScale(.small) }
                Text(text).lineLimit(1)
            }
            .font(.token(Tokens.Typography.footnote, weight: on ? .semibold : .medium))
            .foregroundStyle(on ? .ink : .ink3)
            .padding(.horizontal, compact ? 8 : 12)
            .frame(maxWidth: .infinity, minHeight: 28)
            .background {
                if on {
                    RoundedRectangle(cornerRadius: 7, style: .continuous)
                        .fill(.surface)
                        .elevation(Tokens.Shadow.lift, cornerRadius: 7)
                        .matchedGeometryEffect(id: "thumb", in: thumb)
                }
            }
            .contentShape(TallerShape(by: 8))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(text)
        .accessibilityAddTraits(on ? .isSelected : [])
    }
}

/// Lays its children out in a row, each as wide as the widest of them; with `fills`, they share the width offered.
struct EqualWidthHStack: Layout {
    var spacing: CGFloat = 0
    var fills = false

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let n = CGFloat(subviews.count)
        guard n > 0 else { return .zero }
        let gaps = spacing * (n - 1)
        let natural = (subviews.map { $0.sizeThatFits(.unspecified).width }.max() ?? 0) * n + gaps
        let width = fills ? (proposal.width ?? natural) : min(proposal.width ?? natural, natural)
        let column = max(0, (width - gaps) / n)
        let height = subviews.map { $0.sizeThatFits(ProposedViewSize(width: column, height: nil)).height }.max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let n = CGFloat(subviews.count)
        guard n > 0 else { return }
        let column = max(0, (bounds.width - spacing * (n - 1)) / n)
        for (i, subview) in subviews.enumerated() {
            subview.place(at: CGPoint(x: bounds.minX + CGFloat(i) * (column + spacing), y: bounds.minY), proposal: ProposedViewSize(width: column, height: bounds.height))
        }
    }
}

/// A rectangle reaching `by` points above and below the view: a 44 pt tap target for a control that is drawn smaller.
struct TallerShape: Shape {
    var by: CGFloat

    func path(in rect: CGRect) -> Path {
        Path(rect.insetBy(dx: 0, dy: -by))
    }
}

/// A square button with a hairline frame (the web's outlined `IconButton`).
struct OutlinedIconButton: View {
    let symbol: String
    let label: String
    var size: CGFloat = 32
    var disabled = false
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(disabled ? .ink4 : .ink2)
                .frame(width: size, height: size)
                .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1))
                .tapTarget()
        }
        .buttonStyle(PressableStyle())
        .disabled(disabled)
        .accessibilityLabel(label)
    }
}

/// The arrows ‹ › in one frame (the web's Stepper): two 32 pt cells split by a hairline. Each answers taps 44 pt tall.
struct StepperArrows: View {
    let prevLabel: String
    let nextLabel: String
    var nextDisabled = false
    let onPrev: () -> Void
    let onNext: () -> Void

    var body: some View {
        HStack(spacing: 0) {
            arrow(Icon.previous, prevLabel, disabled: false, action: onPrev)
            Rectangle().fill(.line2).frame(width: 1, height: 32)
            arrow(Icon.next, nextLabel, disabled: nextDisabled, action: onNext)
        }
        .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1))
        .fixedSize()
    }

    private func arrow(_ symbol: String, _ label: String, disabled: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(disabled ? .ink4 : .ink2)
                .frame(width: 32, height: 32)
                .contentShape(TallerShape(by: 6))
        }
        .buttonStyle(PressableStyle())
        .disabled(disabled)
        .accessibilityLabel(label)
    }
}

/// The way back to the present (today, this week, this month, this period), shown only away from it: an outlined
/// square with an arrow that turns round. It pops in.
struct ReturnButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: Icon.back)
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(.ink2)
                .frame(width: 32, height: 32)
                .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1))
                .tapArea()
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(label)
        .accessibilityIdentifier("bar.back")
    }
}

/// Focus's sign (the web's FocusIcon): a viewfinder's four corners around a single line, one task in frame. Drawn with
/// the icons' hairline, 1.25 pt at any size.
struct FocusGlyph: View {
    var size: CGFloat = 15

    var body: some View {
        Self.Corners()
            .stroke(style: StrokeStyle(lineWidth: 1.25, lineCap: .round, lineJoin: .round))
            .frame(width: size, height: size)
            .accessibilityHidden(true)
    }

    /// On the web's 16-unit grid.
    private struct Corners: Shape {
        func path(in rect: CGRect) -> Path {
            let s = rect.width / 16
            func p(_ x: CGFloat, _ y: CGFloat) -> CGPoint { CGPoint(x: rect.minX + x * s, y: rect.minY + y * s) }
            var path = Path()
            for (start, corner, end) in [((2.5, 5.75), (2.5, 2.5), (5.75, 2.5)), ((10.25, 2.5), (13.5, 2.5), (13.5, 5.75)),
                                         ((13.5, 10.25), (13.5, 13.5), (10.25, 13.5)), ((5.75, 13.5), (2.5, 13.5), (2.5, 10.25))] {
                path.move(to: p(start.0, start.1))
                path.addArc(tangent1End: p(corner.0, corner.1), tangent2End: p(end.0, end.1), radius: 1.25 * s)
                path.addLine(to: p(end.0, end.1))
            }
            path.move(to: p(5.5, 8))
            path.addLine(to: p(10.5, 8))
            return path
        }
    }
}

/// A light press: the control dims a little while held.
struct PressableStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .opacity(configuration.isPressed ? 0.55 : 1)
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
    }
}

/// Quiet unless it matters (the web's SyncStatus): "Saving…" when a save takes a while, "Offline · 3 changes waiting"
/// without a connection ("Offline · 3 waiting" where room is short). Nothing at all otherwise, so it takes no room.
struct SyncStatus: View {
    var short = false
    @Environment(TaskStore.self) private var store
    @Environment(SyncState.self) private var sync: SyncState?

    var body: some View {
        let waiting = store.pendingCount
        if !store.isOnline {
            line {
                Image(systemName: "icloud.slash").imageScale(.small)
                Text(waiting > 0 ? "Offline · \(short ? "\(waiting)" : Dates.plural(waiting, "change")) waiting" : "Offline")
            }
        } else if sync?.slow == true {
            line {
                SavingDot()
                Text("Saving…")
            }
        }
    }

    private func line(@ViewBuilder _ content: () -> some View) -> some View {
        HStack(spacing: 6, content: content)
            .font(.token(Tokens.Typography.caption))
            .foregroundStyle(.ink3)
            .lineLimit(1)
            .fixedSize()
            .accessibilityElement(children: .combine)
            .accessibilityIdentifier("syncStatus")
    }
}

/// Whether saving has been taking a while (700 ms with changes still going out): quick saves don't flash "Saving…".
/// MainView keeps it; every SyncStatus reads it.
@MainActor
@Observable
final class SyncState {
    var slow = false
}

/// The accent dot beside "Saving…", breathing (still with Reduce Motion).
private struct SavingDot: View {
    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var dim = false

    var body: some View {
        Circle()
            .fill(palette.accent)
            .frame(width: 6, height: 6)
            .opacity(dim ? 0.35 : 1)
            .onAppear {
                guard !reduceMotion else { return }
                withAnimation(.easeInOut(duration: 1).repeatForever(autoreverses: true)) { dim = true }
            }
    }
}

/// "Soon": a page that isn't open yet.
struct SoonTag: View {
    var body: some View {
        Text("Soon")
            .font(.token(Tokens.Typography.caption2, weight: .medium))
            .foregroundStyle(.ink3)
            .padding(.horizontal, 6)
            .frame(minHeight: 18)
            .overlay(RoundedRectangle(cornerRadius: 5, style: .continuous).strokeBorder(.line2, lineWidth: 1))
    }
}

extension View {
    /// Answers taps `extra` points beyond the control on every side (44 pt around a 32 pt control) without taking more
    /// room, so the bar keeps its spacing (the web's `tap` utility).
    func tapArea(_ extra: CGFloat = 6) -> some View {
        contentShape(Rectangle().inset(by: -extra))
    }
}
