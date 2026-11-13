import SwiftUI

/// iPhone: new tasks are written at the bottom, where the thumb is — a glass capsule pinned above the home indicator
/// (and above the keyboard while typing), with Speak beside it. Return adds the task at the end of the day's list and
/// keeps the field open for the next one. The list scrolls under it. (iPad keeps the web's "New task" at the top.)
struct DayComposerBar: View {
    @Binding var text: String
    var focus: FocusState<TaskField?>.Binding
    let speaks: Bool
    let add: () -> Void

    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @ScaledMetric(relativeTo: .callout) private var height: CGFloat = 50

    var body: some View {
        Group {
            if #available(iOS 26.0, *), !reduceTransparency {
                GlassEffectContainer(spacing: 10) {
                    HStack(spacing: 10) {
                        field.glassEffect(.regular.interactive(), in: .capsule)
                        if speaks { SpeakButton() }
                    }
                }
            } else {
                HStack(spacing: 10) {
                    field
                        .background {
                            if reduceTransparency {
                                Capsule().fill(.surface).strokeBorder(.line2, lineWidth: 1)
                            } else {
                                Capsule().fill(.bar)
                            }
                        }
                    if speaks { SpeakButton() }
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.top, 8)
        .padding(.bottom, 8)
    }

    private var field: some View {
        HStack(spacing: 10) {
            Image(systemName: Icon.plus)
                .font(.system(size: 14, weight: .regular))
                .foregroundStyle(.ink2)
                .accessibilityHidden(true)
            TextField("New task", text: line, prompt: Text("New task").foregroundStyle(.ink3), axis: .vertical)
                .font(.token(Tokens.Typography.callout))
                .foregroundStyle(.ink)
                .lineLimit(1...4)
                .focused(focus, equals: .newTitle)
                // A hardware keyboard's Return adds too (the on-screen one types a line break, which the text catches).
                .onKeyPress(.return, phases: .down) { _ in
                    add()
                    return .handled
                }
                .onKeyPress(.escape) {
                    text = ""
                    focus.wrappedValue = nil
                    return .handled
                }
                .accessibilityLabel("New task title")
                .accessibilityHint("Adds the task at the end of the day")
                .accessibilityIdentifier("composer.title")
        }
        .padding(.horizontal, 18)
        .padding(.vertical, 10)
        .frame(maxWidth: .infinity, minHeight: height, alignment: .leading)
        .contentShape(Capsule())
    }

    /// The field's text: Return adds the task and the field stays open for the next one (a field that grows takes Return
    /// as a new line, so it never closes the keyboard); pasted line breaks become spaces.
    private var line: Binding<String> {
        Binding(
            get: { text },
            set: { next in
                guard next.contains("\n") else { return text = String(next.prefix(TaskItem.titleMax)) }
                if next.replacingOccurrences(of: "\n", with: "") == text {
                    add()
                } else {
                    text = String(next.replacingOccurrences(of: "\n", with: " ").prefix(TaskItem.titleMax))
                }
            }
        )
    }
}
