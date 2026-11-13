import SwiftUI

/// How Progress lays itself out for the room it has: the web's breakpoints (`sm` 640, `md` 768, `lg` 1024, `xl` 1280),
/// which measure the window, so the iPad sidebar beside the page counts as it does on the web.
struct ProgressLayout: Equatable {
    /// Panels side by side on the twelve-column grid (`lg`).
    var wide = false
    /// The four figures in one row (`xl`).
    var figuresInOneRow = false
    /// History shows Planned and Tasks too (hidden below `sm`, as on phones).
    var fullTable = false
    /// Below `sm`: figure labels keep two lines so numbers side by side line up, Summarize takes the whole width.
    var phone = true
    /// Large text: the figures stack.
    var accessibilityText = false
    /// Around the panels, and between them.
    var margin: CGFloat = 12
    var top: CGFloat = 12
    var gap: CGFloat = 12
    /// Inside a panel, and inside a figure.
    var padding: CGFloat = 20
    var figurePadding: CGFloat = 16

    init() {}

    /// `width`: the page's; `beside`: what else shares the window with it (the sidebar).
    init(width: CGFloat, beside: CGFloat, typeSize: DynamicTypeSize) {
        let window = width + beside
        let md = window >= 768
        wide = window >= 1024
        figuresInOneRow = window >= 1280
        fullTable = window >= 640
        phone = window < 640
        accessibilityText = typeSize.isAccessibilitySize
        margin = wide ? 32 : md ? 24 : 12
        top = md ? 24 : 12
        gap = md ? 16 : 12
        padding = md ? 24 : 20
        figurePadding = md ? 20 : 16
    }
}

extension EnvironmentValues {
    @Entry var progressLayout = ProgressLayout()
}

extension View {
    /// The panels' own look: white sheets with a hairline edge on the page's gray (dark: a step up from the background).
    func progressPanel() -> some View {
        background(.surface, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).strokeBorder(.line, lineWidth: 1))
    }
}

/// A section of the page: a panel with its title (and a quiet count or aside) on top.
struct Card<Aside: View, Content: View>: View {
    let title: String
    /// Shown beside the title, quietly, like the count after "To do".
    var count: Int?
    @ViewBuilder var aside: Aside
    @ViewBuilder var content: Content
    @Environment(\.progressLayout) private var layout

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 16) {
                    heading
                    Spacer(minLength: 0)
                    aside
                }
                VStack(alignment: .leading, spacing: 4) {
                    heading
                    aside
                }
            }
            .frame(minHeight: 24)
            content
        }
        .padding(layout.padding)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .progressPanel()
    }

    private var heading: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(title)
                .type(Tokens.Typography.body, weight: .semibold)
                .foregroundStyle(.ink)
            if let count, count > 0 {
                Text(verbatim: "\(count)")
                    .type(Tokens.Typography.body)
                    .foregroundStyle(.ink3)
                    .monospacedDigit()
                    .contentTransition(.numericText(value: Double(count)))
            }
        }
        .fixedSize()
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
    }
}

extension Card where Aside == EmptyView {
    init(title: String, count: Int? = nil, @ViewBuilder content: () -> Content) {
        self.init(title: title, count: count, aside: { EmptyView() }, content: content)
    }
}

/// The quiet note on the right of a panel's title ("Average done per day").
struct AsideNote: View {
    let text: String

    var body: some View {
        Text(text)
            .type(Tokens.Typography.caption)
            .foregroundStyle(.ink3)
            .monospacedDigit()
            .lineLimit(1)
    }
}

/// The four figures, as tiles of their own: two by two, four in a row on a wide page, one above the other with
/// large text.
struct Figures: View {
    let figures: [Stats.Figure]
    @Environment(\.progressLayout) private var layout

    var body: some View {
        let perRow = layout.accessibilityText ? 1 : layout.figuresInOneRow ? 4 : 2
        let rows = stride(from: 0, to: figures.count, by: perRow).map { Array(figures[$0..<min($0 + perRow, figures.count)]) }
        VStack(spacing: layout.gap) {
            ForEach(rows, id: \.first?.id) { row in
                HStack(alignment: .top, spacing: layout.gap) {
                    ForEach(row) { FigureTile(figure: $0, labelLines: perRow == 2 ? 2 : 1) }
                }
                .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// One figure: what it is, the number, and one line of context.
struct FigureTile: View {
    let figure: Stats.Figure
    /// Lines kept for the label, so numbers side by side line up when one label wraps.
    var labelLines = 1
    @Environment(\.progressLayout) private var layout
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @ScaledMetric(relativeTo: .footnote) private var labelLine: CGFloat = 18

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(figure.label)
                .type(Tokens.Typography.footnote)
                .foregroundStyle(.ink3)
                .frame(minHeight: labelLines > 1 && layout.phone ? labelLine * CGFloat(labelLines) : nil, alignment: .topLeading)
                .fixedSize(horizontal: false, vertical: true)
            HStack(alignment: .firstTextBaseline, spacing: 6) {
                Text(figure.value)
                    .font(.system(.title, weight: .semibold))
                    .tracking(-0.56)
                    .monospacedDigit()
                    .foregroundStyle(.ink)
                    .contentTransition(.numericText(value: figure.amount ?? 0))
                    .animation(Motion.choose(Motion.out(0.45), reduceMotion: reduceMotion), value: figure.value)
                if let unit = figure.unit {
                    Text(unit)
                        .type(Tokens.Typography.footnote)
                        .foregroundStyle(.ink3)
                        .monospacedDigit()
                }
            }
            .padding(.top, 6)
            foot
                .padding(.top, 4)
                .frame(minHeight: 16, alignment: .topLeading)
        }
        .padding(layout.figurePadding)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .progressPanel()
        .modifier(ProgressTip(text: figure.tip))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(figure.spoken)
        .accessibilityHint(figure.tip ?? "")
    }

    @ViewBuilder
    private var foot: some View {
        switch figure.foot {
        case .text(let text):
            Text(text)
                .type(Tokens.Typography.caption)
                .foregroundStyle(.ink3)
                .monospacedDigit()
                .fixedSize(horizontal: false, vertical: true)
        case .delta(let delta):
            DeltaLabel(delta: delta)
        case nil:
            EmptyView()
        }
    }
}

/// Signed change vs the previous period: arrow and number, red for a drop and green for a rise, then "vs last week".
struct DeltaLabel: View {
    let delta: Stats.Delta

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 6) {
            Text(delta.text)
                .type(Tokens.Typography.caption, weight: .semibold)
                .monospacedDigit()
                .foregroundStyle(tone)
                .fixedSize()
            Text(delta.vs)
                .type(Tokens.Typography.caption)
                .foregroundStyle(.ink3)
        }
    }

    private var tone: Color {
        switch delta.direction {
        case .rise: .greenInk
        case .drop: .redInk
        case .flat: .ink2
        }
    }
}

/// "Show all 13" / "Show less": a quiet underlined link under a list.
struct ShowAllToggle: View {
    let count: Int
    @Binding var all: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        Button {
            withAnimation(Motion.choose(Motion.settle, reduceMotion: reduceMotion)) { all.toggle() }
        } label: {
            Text(all ? "Show less" : "Show all \(count)")
                .type(Tokens.Typography.caption, weight: .medium)
                .foregroundStyle(.ink2)
                .underline(color: .ink4)
                .padding(.vertical, 12)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .padding(.vertical, -12)
        .padding(.top, 12)
    }
}

/// A tooltip under the pointer (iPad with a trackpad), as the web's `data-tip`.
struct ProgressTip: ViewModifier {
    let text: String?

    func body(content: Content) -> some View {
        if let text { content.help(text) } else { content }
    }
}

/// Enlarges what a small control answers to (to 44 points) without changing its size on the page.
struct WideHitArea: ViewModifier {
    var horizontal: CGFloat = 13
    var vertical: CGFloat = 13

    func body(content: Content) -> some View {
        content
            .padding(.horizontal, horizontal)
            .padding(.vertical, vertical)
            .contentShape(Rectangle())
            .padding(.horizontal, -horizontal)
            .padding(.vertical, -vertical)
    }
}

/// Panels side by side on the web's twelve-column grid (`lg:col-span-8` beside `lg:col-span-4`, …), as tall as the
/// tallest of them, as CSS grid rows stretch.
struct GridRow12: Layout {
    /// Columns each panel spans, adding up to 12.
    let spans: [Int]
    let gap: CGFloat

    private func widths(_ total: CGFloat) -> [CGFloat] {
        spans.map { n in (total - 11 * gap) * CGFloat(n) / 12 + CGFloat(n - 1) * gap }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 1000
        let height = zip(subviews, widths(width)).map { $0.sizeThatFits(ProposedViewSize(width: $1, height: nil)).height }.max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        for (view, width) in zip(subviews, widths(bounds.width)) {
            view.place(at: CGPoint(x: x, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: bounds.height))
            x += width + gap
        }
    }
}

/// Two columns sharing the width in proportion (CSS `grid-cols-[5fr_7fr]`), each as tall as it needs.
struct FractionRow: Layout {
    let fractions: [CGFloat]
    let spacing: CGFloat

    private func widths(_ total: CGFloat) -> [CGFloat] {
        let room = max(0, total - spacing * CGFloat(fractions.count - 1))
        let sum = fractions.reduce(0, +)
        return fractions.map { room * $0 / sum }
    }

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let width = proposal.width ?? 1000
        let height = zip(subviews, widths(width)).map { $0.sizeThatFits(ProposedViewSize(width: $1, height: nil)).height }.max() ?? 0
        return CGSize(width: width, height: height)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        var x = bounds.minX
        for (view, width) in zip(subviews, widths(bounds.width)) {
            view.place(at: CGPoint(x: x, y: bounds.minY), anchor: .topLeading, proposal: ProposedViewSize(width: width, height: nil))
            x += width + spacing
        }
    }
}
