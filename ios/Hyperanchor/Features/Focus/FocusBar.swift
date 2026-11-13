import SwiftUI

/// Focus's bar (FocusPanel.tsx's header): the way out on the left, where the day stands in the middle, the timer on the
/// right. The middle stays in the middle whatever the sides hold.
struct FocusBar: View {
    let done: Int
    let total: Int
    /// Nothing is left to do.
    let finished: Bool
    let leave: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let regular = sizeClass == .regular
        HStack(spacing: 12) {
            LeaveButton(regular: regular, action: leave)
                .frame(maxWidth: .infinity, alignment: .leading)
            FocusWhere(done: done, total: total, finished: finished)
                .fixedSize()
            FocusTimer()
                .frame(maxWidth: .infinity, alignment: .trailing)
        }
        .padding(.horizontal, regular ? 16 : 12)
        .frame(minHeight: regular ? 56 : 52)
        // The bar keeps its size from the largest text sizes on (its controls show large on a long press).
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
    }
}

/// "Leave focus" ("Leave" on phones), with its key on a keyboard.
private struct LeaveButton: View {
    let regular: Bool
    let action: () -> Void
    @Environment(\.showsKeyHints) private var keyHints

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: Icon.close)
                    .font(.system(size: 12, weight: .regular))
                    .accessibilityHidden(true)
                Text(regular ? "Leave focus" : "Leave")
                    .lineLimit(1)
                if keyHints { KeyHint(key: "Esc") }
            }
            .font(.footnote.weight(.medium))
            .foregroundStyle(.ink)
            .padding(.leading, 10)
            .padding(.trailing, keyHints ? 6 : 12)
            .frame(minHeight: 32)
            .background(.surface, in: shape)
            .overlay(shape.strokeBorder(.line2, lineWidth: 1))
            .tapTarget()
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Leave focus")
        .accessibilityShowsLargeContentViewer()
        .accessibilityIdentifier("focus.exit")
    }
}

/// Where the day stands (the web's `Where`): a dot per task (a plain bar for long days), the one in hand outlined, and
/// "3 of 7".
struct FocusWhere: View {
    let done: Int
    let total: Int
    let finished: Bool

    @Environment(\.palette) private var palette
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        if total > 0 {
            let at = min(done + 1, total)
            HStack(spacing: 10) {
                Group {
                    if total <= 12 {
                        HStack(spacing: 5) {
                            ForEach(0..<total, id: \.self) { i in
                                Circle()
                                    .fill(i < done ? palette.accent : i == done ? Color.clear : Color.line2)
                                    .overlay {
                                        Circle()
                                            .strokeBorder(palette.accent, lineWidth: 1.5)
                                            .opacity(i == done ? 1 : 0)
                                    }
                                    .frame(width: 6, height: 6)
                            }
                        }
                    } else {
                        Capsule()
                            .fill(.line2)
                            .frame(width: 96, height: 4)
                            .overlay(alignment: .leading) {
                                Capsule()
                                    .fill(palette.accent)
                                    .frame(width: 96 * CGFloat(done) / CGFloat(total))
                            }
                    }
                }
                .animation(reduceMotion ? nil : Motion.out(Tokens.Motion.data), value: done)
                Text(verbatim: "\(finished ? total : at) of \(total)")
                    .font(.footnote.weight(.medium))
                    .monospacedDigit()
                    .foregroundStyle(.ink3)
                    .lineLimit(1)
            }
            .accessibilityElement(children: .ignore)
            .accessibilityLabel(finished ? "All \(total) done" : "Task \(at) of \(total)")
            .accessibilityIdentifier("focus.where")
        }
    }
}
