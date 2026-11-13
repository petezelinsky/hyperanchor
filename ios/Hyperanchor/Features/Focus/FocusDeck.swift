import SwiftUI
import UIKit

// The deck (FocusPanel.tsx `DeckCard`): the task in focus is a small card, a row of the list grown large, lying on two
// more of the same size whose edges show as even strips. When the top card goes, the rest move up into its place.

/// The cards of the deck, the first on top. The two under it are the same card a step down and a step smaller each, so
/// their edges show as even strips; their words don't show. A card put off for later beyond the deck sinks behind it.
struct FocusDeck: View {
    /// Up to three tasks, the first on top.
    let cards: [TaskItem]
    /// The top card's task was just ticked: its tick plays before it turns to dust.
    let finishing: String?
    /// A card put off for later that leaves the deck, sinking behind it as it goes.
    let sinking: TaskItem?
    /// "Task 3 of 5", for VoiceOver.
    let position: String
    var spoken: AccessibilityFocusState<String?>.Binding
    let tick: (TaskItem) -> Void
    let later: ((TaskItem) -> Void)?
    /// Where the top card lies on the screen (its dust is drawn there).
    let placed: (CGRect) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    /// The top card's height: the cards under it take the same.
    @State private var topHeight: CGFloat?

    var body: some View {
        ZStack(alignment: .top) {
            ForEach(Array(cards.enumerated()), id: \.element.id) { index, task in
                DeckCard(task: task, index: index, finishing: finishing == task.id, height: topHeight, position: position,
                         spoken: spoken, tick: { tick(task) }, later: later.map { act in { act(task) } })
                    .onGeometryChange(for: CGRect.self) { $0.frame(in: .global) } action: { frame in
                        guard index == 0 else { return }
                        topHeight = frame.height
                        placed(frame)
                    }
                    .zIndex(Double(cards.count - index))
                    // Cards come and go at once: a finished one turns to dust where it lay, a new one arrives at the back.
                    .transition(.identity)
            }
        }
        .background(alignment: .top) {
            if let sinking {
                SinkingCard(task: sinking)
                    .id(sinking.id)
                    .transition(.identity)
            }
        }
        .frame(maxWidth: 560)
        .animation(reduceMotion ? nil : Motion.travel, value: cards.map(\.id))
    }
}

/// One card of the deck: on top it shows its task; under it, only its face, a step down and a step smaller.
private struct DeckCard: View {
    let task: TaskItem
    let index: Int
    let finishing: Bool
    let height: CGFloat?
    let position: String
    var spoken: AccessibilityFocusState<String?>.Binding
    let tick: () -> Void
    let later: (() -> Void)?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let top = index == 0
        FocusCardFace(task: task, finished: finishing, tick: top ? tick : nil, position: top ? position : nil,
                      spoken: top ? spoken : nil, later: top ? later : nil)
            // The words show on the top card only; a card arriving there shows them a moment after it starts to rise.
            .opacity(top ? 1 : 0)
            .animation(reduceMotion ? Motion.reduced : top ? Motion.out().delay(0.075) : Motion.out(), value: top)
            .frame(height: top ? nil : height, alignment: .top)
            .background { FocusCardSurface(depth: index) }
            .scaleEffect(1 - 0.05 * CGFloat(index), anchor: .bottom)
            .offset(y: 10 * CGFloat(index))
            .allowsHitTesting(top)
            .accessibilityHidden(!top)
    }
}

/// The card itself under the words: white and lifted on top, a little closer to the page and outlined underneath.
struct FocusCardSurface: View {
    let depth: Int
    /// The sheet's soft shadow on the card on top (not in the dust's picture).
    var lifted = true
    @Environment(\.colorScheme) private var scheme

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: FocusCardFace.radius, style: .continuous)
        let top = depth == 0
        shape
            .fill(fill)
            .overlay(shape.strokeBorder(ring, lineWidth: 1))
            .background {
                // The sheet's soft drop shadows, only on top (they fade as a card goes under or comes up).
                ZStack {
                    ForEach(Array(drops.enumerated()), id: \.offset) { _, layer in
                        shape
                            .fill(Color.black.opacity(0.001))
                            .shadow(color: Color(uiColor: layer.color.uiColor), radius: max(0, layer.blur + min(0, layer.spread)) / 2, x: layer.x, y: layer.y)
                    }
                }
                .opacity(top && lifted ? 1 : 0)
            }
    }

    private var layers: [ShadowLayer] { scheme == .dark ? Tokens.Shadow.sheet.dark : Tokens.Shadow.sheet.light }
    private var drops: [ShadowLayer] { layers.filter { $0.blur > 0 } }

    /// On top the sheet's hairline; underneath, the ink at 8% (7% for the last).
    private var ring: Color {
        if depth == 0, let ring = layers.first(where: { $0.blur == 0 && $0.spread > 0 }) { return Color(uiColor: ring.color.uiColor) }
        return Color.ink.opacity(depth == 1 ? 0.08 : 0.07)
    }

    /// The surface on top; underneath, the surface mixed with the page (78%, then 50%).
    private var fill: Color {
        switch depth {
        case 0: .surface
        case 1: Self.under.color
        default: Self.last.color
        }
    }

    private static let under = mix(0.78)
    private static let last = mix(0.5)

    private static func mix(_ amount: Double) -> ThemeColor {
        func blend(_ a: RGBA, _ b: RGBA) -> RGBA {
            let channel = { (x: Double, y: Double) in UInt32(((x * amount + y * (1 - amount)) * 255).rounded()) }
            return RGBA(hex: channel(a.red, b.red) << 16 | channel(a.green, b.green) << 8 | channel(a.blue, b.blue))
        }
        return ThemeColor(light: blend(Tokens.surface.light, Tokens.canvas.light), dark: blend(Tokens.surface.dark, Tokens.canvas.dark))
    }
}

/// A card put off for later that no longer fits in the deck: it sinks behind the deck and fades (the web's
/// `focus-later`), as it last looked.
private struct SinkingCard: View {
    let task: TaskItem
    @State private var sunk = false

    var body: some View {
        FocusCardFace(task: task, finished: false)
            .fixedSize(horizontal: false, vertical: true)
            .background { FocusCardSurface(depth: 0) }
            .scaleEffect(sunk ? 0.9 : 1, anchor: .bottom)
            .offset(y: sunk ? 22 : 0)
            .opacity(sunk ? 0 : 1)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .onAppear {
                withAnimation(Motion.out(Tokens.Motion.move)) { sunk = true }
            }
    }
}

// MARK: - The card's face

/// A row of the list grown large: the square box and the words (the title, the note under it), as tall as its text.
/// Ticking it fills the box and draws the tick, and the words are crossed out. The same face, drawn already ticked, is
/// the picture that turns to dust.
struct FocusCardFace: View {
    static let radius: CGFloat = 18

    let task: TaskItem
    /// Ticked just now in focus: the box fills, the tick draws itself and the words are crossed out.
    let finished: Bool
    /// The box finishes the task (the card on top). Without it the box is only drawn.
    var tick: (() -> Void)?
    /// "Task 3 of 5": read by VoiceOver after the words, on the card on top.
    var position: String?
    var spoken: AccessibilityFocusState<String?>.Binding?
    var later: (() -> Void)?

    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.legibilityWeight) private var legibilityWeight
    @ScaledMetric(relativeTo: .title3) private var phoneTitle: CGFloat = 20
    @ScaledMetric(relativeTo: .title2) private var padTitle: CGFloat = 24

    private var regular: Bool { sizeClass == .regular }
    private var titleSize: CGFloat { regular ? padTitle : phoneTitle }

    var body: some View {
        // The box sits on the middle of the first line, at any text size.
        let lift = Self.capHeight(titleSize, bold: legibilityWeight == .bold) / 2
        HStack(alignment: .firstTextBaseline, spacing: regular ? 18 : 16) {
            box
                .alignmentGuide(.firstTextBaseline) { d in d[VerticalAlignment.center] + lift }
            words
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(.horizontal, regular ? 28 : 20)
        .padding(.vertical, regular ? 24 : 20)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    @ViewBuilder
    private var box: some View {
        if let tick {
            Button(action: tick) {
                FocusBox(checked: finished)
                    .padding(9) // a 44-point target around the 26-point box, without taking room
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .padding(-9)
            .accessibilityLabel(finished ? "“\(task.title)” is done" : "Mark “\(task.title)” as done")
            .accessibilityIdentifier("focus.checkbox")
        } else {
            FocusBox(checked: finished)
        }
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: regular ? 8 : 6) {
            StruckTitle(text: task.title, size: titleSize, regular: regular, struck: finished)
            if !task.notes.isEmpty {
                Text(task.notes)
                    .font(regular ? .body : .callout)
                    .lineSpacing(3)
                    .foregroundStyle(finished ? Color.ink3 : Color.ink2)
                    .fixedSize(horizontal: false, vertical: true)
                    .animation(Motion.out(), value: finished)
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(task.notes.isEmpty ? task.title : "\(task.title). \(task.notes)")
        .accessibilityValue(position ?? "")
        .accessibilityAddTraits(.isHeader)
        .modifier(SpokenFocus(binding: spoken, id: task.id))
        .modifier(CardActions(done: finished ? nil : tick, later: finished ? nil : later))
    }

    /// The height of capital letters in the title's font, to put the box on the middle of the first line.
    static func capHeight(_ size: CGFloat, bold: Bool) -> CGFloat {
        UIFont.systemFont(ofSize: size, weight: bold ? .heavy : .semibold).capHeight
    }
}

/// The title, with a line that draws itself along the words when the task is done (the web's `.strike`).
private struct StruckTitle: View {
    let text: String
    let size: CGFloat
    let regular: Bool
    let struck: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn: CGFloat

    init(text: String, size: CGFloat, regular: Bool, struck: Bool) {
        self.text = text
        self.size = size
        self.regular = regular
        self.struck = struck
        _drawn = State(initialValue: struck ? 1 : 0)
    }

    var body: some View {
        title
            .foregroundStyle(struck ? Color.ink3 : Color.ink)
            .animation(reduceMotion ? Motion.reduced : Motion.out(0.2), value: struck)
            .overlay(alignment: .topLeading) {
                // The same words, unseen, carrying only the line through them; revealed from the left.
                title
                    .foregroundStyle(.clear)
                    .strikethrough(true, color: .ink3)
                    .mask(alignment: .leading) {
                        GeometryReader { geo in
                            Rectangle().frame(width: geo.size.width * drawn)
                        }
                    }
            }
            .onChange(of: struck) { _, now in
                if reduceMotion {
                    drawn = now ? 1 : 0
                } else {
                    withAnimation(Motion.out(0.2)) { drawn = now ? 1 : 0 }
                }
            }
    }

    private var title: some View {
        Text(text)
            .font(.system(size: size, weight: .semibold))
            .tracking((regular ? -0.022 : -0.018) * size)
            .lineSpacing(size * (regular ? 0.22 : 0.2))
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// The square box at the size of the focus card (the web's `Checkbox` at 26): an outline when open; filled with the
/// accent and ticked when done. Ticked here, it pops and the tick draws itself, quickly enough to have finished by the
/// time the card turns to dust (no ripple: the dust follows).
struct FocusBox: View {
    let checked: Bool
    var size: CGFloat = 26

    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var drawn: CGFloat
    @State private var pops = 0

    init(checked: Bool, size: CGFloat = 26) {
        self.checked = checked
        self.size = size
        _drawn = State(initialValue: checked ? 1 : 0)
    }

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 8, style: .continuous)
        ZStack {
            shape
                .fill(.surface)
                .strokeBorder(.checkRing, lineWidth: 1.5)
                .opacity(checked ? 0 : 1)
            shape
                .fill(palette.accent)
                .opacity(checked ? 1 : 0)
            Checkmark()
                .trim(from: 0, to: drawn)
                .stroke(palette.onAccent, style: StrokeStyle(lineWidth: 1.8, lineCap: .round, lineJoin: .round))
                .frame(width: size * 0.72, height: size * 0.72)
        }
        .frame(width: size, height: size)
        .keyframeAnimator(initialValue: 1.0, trigger: pops) { view, scale in
            view.scaleEffect(scale)
        } keyframes: { _ in
            CubicKeyframe(0.8, duration: 0.02)
            CubicKeyframe(1.1, duration: 0.11)
            CubicKeyframe(1, duration: 0.1)
        }
        .animation(Motion.out(Tokens.Motion.press), value: checked)
        .onChange(of: checked) { _, now in
            if now, !reduceMotion {
                pops += 1
                drawn = 0
                withAnimation(Motion.out(0.16).delay(0.04)) { drawn = 1 }
            } else {
                // Reduce Motion: the tick is simply there as the box fills.
                drawn = now ? 1 : 0
            }
        }
        .accessibilityHidden(true)
    }
}

/// Moves VoiceOver to the card on top when it changes (only on the live card).
private struct SpokenFocus: ViewModifier {
    let binding: AccessibilityFocusState<String?>.Binding?
    let id: String

    func body(content: Content) -> some View {
        if let binding {
            content.accessibilityFocused(binding, equals: id)
        } else {
            content
        }
    }
}

/// Done and Later from the card itself, as VoiceOver actions.
private struct CardActions: ViewModifier {
    let done: (() -> Void)?
    let later: (() -> Void)?

    func body(content: Content) -> some View {
        if let done {
            if let later {
                content
                    .accessibilityAction(named: "Done", done)
                    .accessibilityAction(named: "Later", later)
            } else {
                content.accessibilityAction(named: "Done", done)
            }
        } else {
            content
        }
    }
}
