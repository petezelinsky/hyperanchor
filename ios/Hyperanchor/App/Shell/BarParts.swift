import SwiftUI

// The pieces of the bar on top and the sidebar, drawn like the web's (Sidebar.tsx, ui.tsx): quiet outlined buttons,
// a segmented switch, the arrows in one frame.

/// The web's SegmentedControl: a quiet track with the picked segment raised on it.
struct SegmentedSwitch<Value: Hashable>: View {
    let label: String
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    var compact = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Namespace private var pill

    var body: some View {
        HStack(spacing: 0) {
            ForEach(options, id: \.value) { option in
                let on = option.value == selection
                Button {
                    withAnimation(Motion.choose(Motion.settle, reduceMotion: reduceMotion)) { selection = option.value }
                } label: {
                    Text(option.label)
                        .font(.footnote.weight(on ? .semibold : .medium))
                        .foregroundStyle(on ? .ink : .ink2)
                        .lineLimit(1)
                        .padding(.horizontal, compact ? 10 : 14)
                        .frame(minWidth: compact ? 44 : 60, minHeight: 28)
                        .background {
                            if on {
                                RoundedRectangle(cornerRadius: Tokens.Radius.xs + 2, style: .continuous)
                                    .fill(.surface)
                                    .elevation(Tokens.Shadow.lift, cornerRadius: Tokens.Radius.xs + 2)
                                    .matchedGeometryEffect(id: "pill", in: pill)
                            }
                        }
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .padding(2)
        .background(.surface3, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
        .accessibilityElement(children: .contain)
        .accessibilityLabel(label)
        .sensoryFeedback(.selection, trigger: selection)
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

/// The arrows ‹ › in one frame (the web's Stepper).
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
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(disabled ? .ink4 : .ink2)
                .frame(width: 32, height: 32)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .disabled(disabled)
        .accessibilityLabel(label)
        .frame(minHeight: 44)
        .contentShape(Rectangle())
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

/// "Saving…" while changes go out, "Offline · 3 waiting" without a connection (the web's SyncStatus).
struct SyncStatus: View {
    var short = false
    @Environment(TaskStore.self) private var store
    @State private var showSaving = false

    var body: some View {
        Group {
            if !store.isOnline {
                Label {
                    Text(store.pendingCount > 0 ? (short ? "Offline · \(store.pendingCount) waiting" : "Offline · \(Dates.plural(store.pendingCount, "change")) waiting") : "Offline")
                } icon: {
                    Image(systemName: "icloud.slash")
                }
            } else if showSaving {
                Text("Saving…")
            }
        }
        .font(.caption)
        .foregroundStyle(.ink3)
        .lineLimit(1)
        .labelStyle(.titleOnly)
        // Saving shows only when it takes a moment: quick saves don't flash.
        .task(id: store.pendingCount > 0) {
            if store.pendingCount > 0 {
                try? await Task.sleep(for: .milliseconds(600))
                if !Task.isCancelled { showSaving = store.pendingCount > 0 }
            } else {
                showSaving = false
            }
        }
        .accessibilityElement(children: .combine)
    }
}

/// "Soon": a page that isn't built yet.
struct SoonTag: View {
    var body: some View {
        Text("Soon")
            .font(.caption2.weight(.medium))
            .foregroundStyle(.ink3)
            .padding(.horizontal, 5)
            .padding(.vertical, 1)
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.xs, style: .continuous).strokeBorder(.line2, lineWidth: 1))
    }
}
