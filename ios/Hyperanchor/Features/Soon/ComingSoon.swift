import SwiftUI

/// Pages that aren't open yet: Goals and Agent (ComingSoon.tsx). Each says in a few lines what it will be, and shows it
/// with a quiet example that can't be touched. One centered column on the page's white.
struct ComingSoon: View {
    let page: Router.Page

    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var height: CGFloat = 0
    @State private var shown = false

    var body: some View {
        let compact = sizeClass == .compact
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                SoonTag()
                if page == .goals { GoalsPreview() } else { AgentPreview() }
            }
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 8)
            .frame(maxWidth: 600 - 2 * (compact ? 20 : 32), alignment: .leading)
            .padding(.horizontal, compact ? 20 : 32)
            .padding(.top, compact ? 48 : min(height * 0.12, 120))
            .padding(.bottom, 64)
            .frame(maxWidth: .infinity)
        }
        .background(.surface)
        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height = $0 }
        .onAppear {
            withAnimation(Motion.choose(Motion.out(), reduceMotion: reduceMotion)) { shown = true }
        }
    }
}

/// The title of a Soon page: 28 points, semibold, tight.
private struct SoonTitle: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.system(.title, weight: .semibold))
            .tracking(-0.62)
            .foregroundStyle(.ink)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 16)
            .accessibilityAddTraits(.isHeader)
    }
}

private struct SoonLead: View {
    let text: String

    var body: some View {
        Text(text)
            .type(Tokens.Typography.callout)
            .foregroundStyle(.ink2)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: 520, alignment: .leading)
            .padding(.top, 12)
    }
}

extension View {
    /// The example's card: white, a hairline edge and the faintest shadow.
    fileprivate func exampleCard() -> some View {
        background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous).strokeBorder(.line2, lineWidth: 1))
            .shadow(color: .black.opacity(0.04), radius: 1, y: 1)
    }
}

// MARK: - Goals

private struct GoalsPreview: View {
    private static let ideas = ["Spanish B1 by June 24", "Marathon on October 11", "Read 24 books this year"]

    var body: some View {
        SoonTitle(text: "Goals, step by step.")
        SoonLead(text: "A goal is a card with steps. Tap a step and it becomes a task. A task done ticks the step, and once a week there is a check-in.")

        // An example goal, as the page will show it.
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("A week in Lisbon")
                        .type(Tokens.Typography.callout, weight: .semibold)
                        .foregroundStyle(.ink)
                    Text("By May 18 · check-in on Sunday")
                        .type(Tokens.Typography.footnote)
                        .foregroundStyle(.ink3)
                }
                Spacer(minLength: 0)
                HStack(spacing: 6) {
                    ProgressRing(value: 0.5, size: 14, lineWidth: 1.75)
                    Text("2 of 4")
                        .type(Tokens.Typography.footnote)
                        .foregroundStyle(.ink3)
                        .monospacedDigit()
                }
                .fixedSize()
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .hairline()
            VStack(spacing: 0) {
                GoalStep(state: .done, title: "Flights booked")
                GoalStep(state: .done, title: "A room in Alfama")
                GoalStep(state: .now, title: "Days planned", note: "3 of 5")
                GoalStep(state: .todo, title: "Packing list", last: true)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 8)
        }
        .exampleCard()
        .padding(.top, 36)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Example: a week in Lisbon, by May 18, check-in on Sunday. 2 of 4 steps done: Flights booked, done. A room in Alfama, done. Days planned, 3 of 5. Packing list.")

        Text("Also good as a goal")
            .type(Tokens.Typography.footnote)
            .foregroundStyle(.ink3)
            .padding(.top, 32)
        ChipFlow(spacing: 8) {
            ForEach(Self.ideas, id: \.self) { idea in
                Text(idea)
                    .type(Tokens.Typography.footnote)
                    .foregroundStyle(.ink2)
                    .lineLimit(1)
                    .padding(.horizontal, 14)
                    .frame(minHeight: 32)
                    .overlay(Capsule().strokeBorder(.line2, lineWidth: 1))
            }
        }
        .padding(.top, 10)
        .accessibilityElement(children: .combine)
    }
}

private struct GoalStep: View {
    enum Kind { case done, now, todo }
    let state: Kind
    let title: String
    var note: String?
    var last = false

    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            Group {
                switch state {
                case .done:
                    RoundedRectangle(cornerRadius: 6, style: .continuous)
                        .fill(palette.accent)
                        .overlay {
                            Checkmark()
                                .stroke(palette.onAccent, style: StrokeStyle(lineWidth: 1.6, lineCap: .round, lineJoin: .round))
                                .frame(width: 13, height: 13)
                        }
                case .now:
                    ProgressRing(value: 0.6, size: 18, lineWidth: 2)
                case .todo:
                    RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(.checkRing, lineWidth: 1.5)
                }
            }
            .frame(width: 18, height: 18)
            Text(title)
                .type(Tokens.Typography.body)
                .foregroundStyle(state == .done ? .ink3 : .ink)
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
            if let note {
                Text(note)
                    .type(Tokens.Typography.footnote)
                    .foregroundStyle(.ink3)
                    .monospacedDigit()
            }
        }
        .frame(minHeight: 44)
        .overlay(alignment: .bottom) {
            if !last { Rectangle().fill(.line).frame(height: 1) }
        }
    }
}

// MARK: - Agent

private struct AgentPreview: View {
    private static let steps = [
        ("You say it.", "Out loud or typed, the way it comes to mind."),
        ("It knows you.", "What you tell it once, it keeps."),
        ("It does the work.", "It searches, reads, compares and writes it up."),
        ("You decide once.", "One card, one tap. Then nothing needs you."),
    ]

    var body: some View {
        SoonTitle(text: "Nothing needs you.")
        SoonLead(text: "An AI agent that leads your life and makes it better.")

        VStack(spacing: 0) {
            ForEach(Array(Self.steps.enumerated()), id: \.offset) { i, step in
                HStack(alignment: .top, spacing: 16) {
                    Text(verbatim: "\(i + 1)")
                        .type(Tokens.Typography.caption, weight: .semibold)
                        .foregroundStyle(.ink2)
                        .monospacedDigit()
                        .frame(width: 24, height: 24)
                        .background(.surface3, in: Circle())
                        .padding(.top, 1)
                        .accessibilityHidden(true)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(step.0)
                            .type(Tokens.Typography.callout, weight: .semibold)
                            .foregroundStyle(.ink)
                        Text(step.1)
                            .type(Tokens.Typography.body)
                            .foregroundStyle(.ink3)
                    }
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.horizontal, 20)
                .padding(.vertical, 16)
                .overlay(alignment: .bottom) {
                    if i < Self.steps.count - 1 { Rectangle().fill(.line).frame(height: 1) }
                }
                .accessibilityElement(children: .combine)
                .accessibilityLabel("Step \(i + 1): \(step.0) \(step.1)")
            }
        }
        .exampleCard()
        .padding(.top, 36)
    }
}

/// Chips that wrap onto the next line when the row is full.
private struct ChipFlow: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let rows = arrange(subviews, width: proposal.width ?? .infinity)
        let width = rows.map { $0.width }.max() ?? 0
        let height = rows.map(\.height).reduce(0, +) + spacing * CGFloat(max(0, rows.count - 1))
        return CGSize(width: proposal.width ?? width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var y = bounds.minY
        for row in arrange(subviews, width: bounds.width) {
            var x = bounds.minX
            for i in row.items {
                let size = subviews[i].sizeThatFits(.unspecified)
                subviews[i].place(at: CGPoint(x: x, y: y), proposal: ProposedViewSize(width: min(size.width, bounds.width), height: size.height))
                x += min(size.width, bounds.width) + spacing
            }
            y += row.height + spacing
        }
    }

    private func arrange(_ subviews: Subviews, width: CGFloat) -> [(items: [Int], width: CGFloat, height: CGFloat)] {
        var rows: [(items: [Int], width: CGFloat, height: CGFloat)] = []
        var current: (items: [Int], width: CGFloat, height: CGFloat) = ([], 0, 0)
        for i in subviews.indices {
            let size = subviews[i].sizeThatFits(.unspecified)
            let w = min(size.width, width)
            if !current.items.isEmpty && current.width + spacing + w > width {
                rows.append(current)
                current = ([], 0, 0)
            }
            current.width += (current.items.isEmpty ? 0 : spacing) + w
            current.height = max(current.height, size.height)
            current.items.append(i)
        }
        if !current.items.isEmpty { rows.append(current) }
        return rows
    }
}
