import SwiftUI

// The day's rows other than its tasks, as the web's: "New task" (with Speak), the folds, the quiet lines, and the list
// of tasks from earlier days. Every row lines up with the tasks: its words start where theirs do (46 points in on
// iPhone, 42 on iPad), and its hairline too.

/// The first row: a new task starts here, at the top; speaking them is the small button at its other end.
struct DayNewTaskRow: View {
    let speaks: Bool
    let hairline: Bool
    let open: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass
    @ScaledMetric(relativeTo: .callout) private var scale: CGFloat = 1

    var body: some View {
        let wide = sizeClass == .regular
        HStack(spacing: 8) {
            Button(action: open) {
                HStack(spacing: 0) {
                    Image(systemName: Icon.plus)
                        .font(.system(size: 11, weight: .regular))
                        .foregroundStyle(.ink2)
                        .frame(width: 18, height: 18)
                        .background(.surface2, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                        .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(.line, lineWidth: 1))
                        .frame(width: 30, alignment: .leading)
                        .accessibilityHidden(true)
                    Text("New task")
                        .font(.token(Tokens.Typography.callout))
                        .foregroundStyle(.ink3)
                    Spacer(minLength: 0)
                }
                .frame(minHeight: (wide ? 48 : 50) * scale)
                .contentShape(Rectangle())
            }
            .buttonStyle(PressableStyle())
            .accessibilityLabel("New task")
            .accessibilityIdentifier("newTask")
            if speaks { SpeakButton() }
        }
        .padding(.horizontal, wide ? 12 : 16)
        .rowHairline(hairline, wide: wide)
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface)
    }
}

/// A folded group under the list (earlier days, done): a square with a chevron, the name, how many.
struct DayFoldRow: View {
    let label: String
    let count: Int
    let open: Bool
    var hairline = true
    let identifier: String
    let toggle: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .footnote) private var scale: CGFloat = 1

    var body: some View {
        let wide = sizeClass == .regular
        Button(action: toggle) {
            HStack(spacing: 0) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(.ink2)
                    .rotationEffect(.degrees(open ? 90 : 0))
                    .frame(width: 18, height: 18)
                    .background(.surface2, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(.line, lineWidth: 1))
                    .frame(width: 30, alignment: .leading)
                    .accessibilityHidden(true)
                Text(label)
                    .font(.token(Tokens.Typography.footnote, weight: .medium))
                    .foregroundStyle(.ink2)
                Spacer(minLength: 8)
                Text(verbatim: "\(count)")
                    .font(.token(Tokens.Typography.caption))
                    .monospacedDigit()
                    .foregroundStyle(.ink3)
            }
            .padding(.horizontal, wide ? 12 : 16)
            .frame(minHeight: (wide ? 44 : 46) * scale)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("\(label), \(count)")
        .accessibilityValue(open ? "Expanded" : "Collapsed")
        .accessibilityIdentifier(identifier)
        .animation(Motion.choose(Motion.out(Tokens.Motion.fast), reduceMotion: reduceMotion), value: open)
        .rowHairline(hairline, wide: wide)
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface)
    }
}

/// A past day with tasks still open: one quiet line above the list, with the way to bring them to today.
struct DayLeftOpenNotice: View {
    let count: Int
    let move: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        let words = Text("\(count) left open on this day")
            .font(.token(Tokens.Typography.footnote))
            .foregroundStyle(.ink2)
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 4) {
                words.lineLimit(1)
                DayMoveButton(label: "Move to today", action: move)
                Spacer(minLength: 0)
            }
            VStack(alignment: .leading, spacing: 4) {
                words
                DayMoveButton(label: "Move to today", action: move)
            }
        }
        .frame(minHeight: 32)
        .padding(.horizontal, sizeClass == .regular ? 12 : 16)
        .padding(.top, 8)
        .padding(.bottom, 4)
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface)
        .accessibilityElement(children: .contain)
    }
}

/// Where nothing is left (or nothing was planned): one quiet sentence, where the words of a task would start.
struct DayClearedLine: View {
    let words: String

    @Environment(\.horizontalSizeClass) private var sizeClass
    @ScaledMetric(relativeTo: .subheadline) private var height: CGFloat = 48

    var body: some View {
        Text(words)
            .font(.token(Tokens.Typography.body))
            .foregroundStyle(.ink3)
            .frame(maxWidth: .infinity, minHeight: height, alignment: .leading)
            .padding(.leading, sizeClass == .regular ? 42 : 46)
            .padding(.trailing, 16)
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
            .listRowBackground(Color.surface)
    }
}

/// The earlier days' first line, inside the fold: how the list is ordered, and the way to bring everything along.
struct DayEarlierHead: View {
    let count: Int
    let moveAll: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let wide = sizeClass == .regular
        // Large text: the button gets a line of its own.
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(alignment: .leading, spacing: 4)) : AnyLayout(HStackLayout(spacing: 12))
        layout {
            Text("Most recent first. Tick off, bring to today, or let go.")
                .font(.token(Tokens.Typography.footnote))
                .foregroundStyle(.ink3)
                .frame(maxWidth: .infinity, alignment: .leading)
            // Bringing everything along is a choice made while looking at the list, not a button that's always there.
            DayMoveButton(label: count == 1 ? "Move to today" : "Move all to today", action: moveAll)
                .accessibilityIdentifier("moveToToday")
        }
        .frame(minHeight: 36)
        .padding(.leading, wide ? 42 : 46)
        .padding(.trailing, wide ? 12 : 16)
        .padding(.top, 4)
        .padding(.bottom, 4)
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface)
    }
}

/// A task from an earlier day: its box, its title and when it was planned, "Today →" and delete — a line of the framed
/// list under "From earlier days".
struct DayEarlierRow: View {
    let task: TaskItem
    let edge: DayEntry.Edge
    let today: DayKey
    /// The list's last line: the fold's space follows it.
    let foot: Bool
    let toggle: () -> Void
    let bring: () -> Void
    let delete: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let wide = sizeClass == .regular
        Group {
            if typeSize.isAccessibilitySize {
                // Large text: the title gets the width, the two buttons a line under it.
                VStack(alignment: .leading, spacing: 4) {
                    HStack(alignment: .top, spacing: 12) {
                        box
                        words
                    }
                    HStack(spacing: 12) {
                        Spacer(minLength: 0)
                        buttons
                    }
                }
            } else {
                HStack(spacing: 12) {
                    box
                    words
                    buttons
                }
            }
        }
        .padding(.vertical, 6)
        .padding(.leading, 14)
        .padding(.trailing, 8)
        .background { EarlierBox(edge: edge) }
        .padding(.leading, wide ? 42 : 46)
        .padding(.trailing, wide ? 12 : 16)
        .padding(.bottom, foot ? 12 : 0)
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface)
    }

    private var box: some View {
        TaskCheckbox(task: task, size: 18, toggle: toggle)
            .padding(-13)
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(task.title)
                .font(.token(Tokens.Typography.body))
                .foregroundStyle(task.done ? .ink3 : .ink)
                .lineLimit(typeSize.isAccessibilitySize ? 4 : 1)
            Text(when)
                .font(.token(Tokens.Typography.caption))
                .foregroundStyle(.ink3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    @ViewBuilder
    private var buttons: some View {
        DayMoveButton(label: "Today", action: bring)
            .accessibilityLabel("Move “\(task.title)” to today")
        Button(action: delete) {
            Image(systemName: "trash")
                .font(.system(size: 13, weight: .regular))
                .foregroundStyle(.ink2)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .padding(-8)
        .accessibilityLabel("Delete “\(task.title)”")
    }

    /// "Yesterday", "Wed, Nov 11", or "Mon, Oct 20, 2025" from another year.
    private var when: String {
        let d = task.date
        return Dates.relative(d, today: today) ?? Dates.medium(d) + (d.year != today.year ? ", \(d.year)" : "")
    }
}

/// The part of the earlier days' framed list that one line draws: its sides, its rounded top or bottom where the list
/// begins or ends, and the hairline between it and the line above.
private struct EarlierBox: View {
    let edge: DayEntry.Edge

    var body: some View {
        let top = edge == .only || edge == .first
        let bottom = edge == .only || edge == .last
        let r = Tokens.Radius.lg
        UnevenRoundedRectangle(topLeadingRadius: top ? r : 0, bottomLeadingRadius: bottom ? r : 0,
                               bottomTrailingRadius: bottom ? r : 0, topTrailingRadius: top ? r : 0, style: .continuous)
            .strokeBorder(.line, lineWidth: 1)
            // The edges it shares with its neighbours reach past it, out of sight; the line between them is drawn once.
            .padding(.top, top ? 0 : -1)
            .padding(.bottom, bottom ? 0 : -1)
            .overlay(alignment: .top) {
                if !top { Rectangle().fill(.line).frame(height: 1) }
            }
            .clipped()
            .accessibilityHidden(true)
    }
}

/// "Show 40 more": the next of the earlier days' tasks (hundreds of old tasks cost nothing until someone asks).
struct DayShowMore: View {
    let count: Int
    let more: () -> Void

    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        Button(action: more) {
            Text("Show \(count) more")
                .font(.token(Tokens.Typography.caption, weight: .medium))
                .underline(color: .ink4)
                .foregroundStyle(.ink2)
                .frame(minHeight: 28, alignment: .leading)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.leading, sizeClass == .regular ? 42 : 46)
        .padding(.top, 4)
        .padding(.bottom, 6)
        .listRowInsets(EdgeInsets())
        .listRowSeparator(.hidden)
        .listRowBackground(Color.surface)
    }
}

/// A quiet button that brings tasks to today: "Move to today →" (the web's small plain button, in ink).
struct DayMoveButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(label)
                Image(systemName: "arrow.right")
                    .font(.system(size: 10, weight: .semibold))
            }
            .font(.token(Tokens.Typography.footnote, weight: .medium))
            .foregroundStyle(.ink)
            .lineLimit(1)
            .fixedSize()
            .padding(.horizontal, 10)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .padding(.vertical, -8)
    }
}
