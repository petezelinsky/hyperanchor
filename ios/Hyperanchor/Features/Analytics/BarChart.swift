import SwiftUI

/// Stacked columns, as on the web (BarChart.tsx): done (accent) under still open (the accent's track), a 2-point gap
/// between them, 4-point rounded tops, square at the baseline; a hairline grid; a dashed line for the average with its
/// label. A column opens its day (a month of the year opens in Progress). A long press shows what was in it, and so
/// does the pointer on iPad, dimming the other columns.
struct BarChart: View {
    let bars: [Stats.Bar]
    let average: Double
    /// What the chart is, for VoiceOver ("Done per day").
    let title: String
    let pick: (Stats.Target) -> Void

    @Environment(\.palette) private var palette
    @Environment(\.progressLayout) private var layout
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var grown = false
    @State private var hover: String?
    @State private var plotWidth: CGFloat = 0

    private let height: CGFloat = 216

    var body: some View {
        let top = Stats.niceMax(Double(bars.map(\.total).max() ?? 0))
        let dense = bars.count > 12
        let gap: CGFloat = dense ? 3 : layout.phone ? 8 : 12
        let widest: CGFloat = dense ? 14 : 24

        HStack(alignment: .top, spacing: 10) {
            axis(top)
            VStack(spacing: 8) {
                ZStack(alignment: .bottom) {
                    grid
                    HStack(alignment: .bottom, spacing: gap) {
                        ForEach(Array(bars.enumerated()), id: \.element.id) { i, bar in
                            column(bar, index: i, top: top, widest: widest)
                        }
                    }
                    if average > 0 { averageLine(top) }
                }
                .frame(height: height)
                .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { plotWidth = $0 }
                .overlay(alignment: .topLeading) { tooltip }
                HStack(alignment: .top, spacing: gap) {
                    ForEach(bars) { label($0, dense: dense) }
                }
                // The axis keeps its geometry: its labels grow up to a point (VoiceOver reads each column whole).
                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                .accessibilityHidden(true)
            }
        }
        .onAppear { grown = true }
        .accessibilityElement(children: .contain)
        .accessibilityLabel(title)
        .accessibilityChartDescriptor(Descriptor(bars: bars, title: title, top: top))
    }

    // MARK: Axis and grid

    private func axis(_ top: Double) -> some View {
        ZStack(alignment: .topTrailing) {
            ForEach(Array([top, top / 2, 0].enumerated()), id: \.offset) { i, v in
                Text(Stats.fmt1(v))
                    .type(Tokens.Typography.caption2)
                    .foregroundStyle(.ink3)
                    .monospacedDigit()
                    .lineLimit(1)
                    .fixedSize()
                    // Centered on its line: the top, the middle, the baseline.
                    .alignmentGuide(.top) { $0.height / 2 - height * CGFloat(i) / 2 }
            }
        }
        .frame(width: 24, height: height, alignment: .topTrailing)
        .dynamicTypeSize(...DynamicTypeSize.xxLarge)
        .accessibilityHidden(true)
    }

    private var grid: some View {
        VStack(spacing: 0) {
            Rectangle().fill(.line).frame(height: 1)
            Spacer(minLength: 0)
            Rectangle().fill(.line).frame(height: 1)
            Spacer(minLength: 0)
            Rectangle().fill(.line2).frame(height: 1)
        }
        .accessibilityHidden(true)
    }

    private func averageLine(_ top: Double) -> some View {
        ZStack(alignment: .bottomTrailing) {
            Line()
                .stroke(Color.ink3, style: StrokeStyle(lineWidth: 1, dash: [3, 3]))
                .frame(height: 1)
            Text("avg \(Stats.fmt1(average))")
                .type(Tokens.Typography.caption2, weight: .medium)
                .foregroundStyle(.ink2)
                .monospacedDigit()
                .padding(.horizontal, 6)
                .padding(.vertical, 1)
                .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.xs, style: .continuous))
                .elevation(Tokens.Shadow.lift, cornerRadius: Tokens.Radius.xs)
                .fixedSize()
                .dynamicTypeSize(...DynamicTypeSize.xxLarge)
                .offset(y: -4)
        }
        .frame(maxHeight: .infinity, alignment: .bottom)
        .offset(y: -height * CGFloat(min(1, average / top)))
        .allowsHitTesting(false)
        .animation(Motion.choose(Motion.out(Tokens.Motion.data), reduceMotion: reduceMotion), value: average)
        .accessibilityElement()
        .accessibilityLabel("Average: \(Stats.fmt1(average)) a \(bars.count == 12 ? "month" : "day")")
    }

    // MARK: Columns

    private func column(_ bar: Stats.Bar, index: Int, top: Double, widest: CGFloat) -> some View {
        let dimmed = hover != nil && hover != bar.id
        let grow = Motion.choose(Motion.out(Tokens.Motion.data), reduceMotion: reduceMotion).delay(reduceMotion ? 0 : Double(min(index, 30)) * 0.018)
        return Button {
            if let target = bar.target { pick(target) }
        } label: {
            ZStack(alignment: .bottom) {
                Color.clear
                if bar.total > 0 {
                    stack(bar, top: top)
                        .frame(maxWidth: widest)
                        .opacity(bar.elapsed ? 1 : 0.6)
                        // The columns grow from the baseline, one after another (with Reduce Motion: a fade).
                        .scaleEffect(x: 1, y: grown || reduceMotion ? 1 : 0, anchor: .bottom)
                        .opacity(grown || !reduceMotion ? 1 : 0)
                        .animation(grow, value: grown)
                } else if bar.elapsed {
                    // Nothing planned: a short stub on the baseline.
                    Capsule().fill(.line2).frame(maxWidth: widest).frame(height: 2)
                }
            }
            .frame(minWidth: 0, maxWidth: .infinity, maxHeight: .infinity)
            .contentShape(Rectangle())
        }
        .buttonStyle(ColumnStyle(hovered: hover == bar.id))
        .disabled(bar.disabled)
        .opacity(dimmed ? 0.45 : 1)
        .animation(.easeOut(duration: Tokens.Motion.fast), value: dimmed)
        .onHover { inside in
            if inside { hover = bar.id } else if hover == bar.id { hover = nil }
        }
        .contextMenu {
            if let target = bar.target {
                Button("Open \(bar.title)", systemImage: target.isMonth ? Icon.progress : "calendar") { pick(target) }
            }
        } preview: {
            BarDetails(bar: bar)
        }
        .accessibilityLabel("\(bar.title): \(bar.done) of \(bar.total) done")
        .accessibilityHint(bar.target.map { $0.isMonth ? "Opens the month" : "Opens the day" } ?? "")
    }

    /// Open on top of done, in proportion, with the gap between them.
    private func stack(_ bar: Stats.Bar, top: Double) -> some View {
        let full = height * CGFloat(Double(bar.total) / top)
        let both = bar.open > 0 && bar.done > 0
        let room = max(0, full - (both ? 2 : 0))
        let openHeight = bar.open > 0 ? max(3, room * CGFloat(bar.open) / CGFloat(bar.total)) : 0
        let doneHeight = bar.done > 0 ? max(3, room - openHeight) : 0
        let corner = Tokens.Radius.xs
        return VStack(spacing: 0) {
            if bar.open > 0 {
                UnevenRoundedRectangle(topLeadingRadius: corner, topTrailingRadius: corner, style: .continuous)
                    .fill(palette.accentTrack)
                    .frame(height: openHeight)
            }
            if both { Color.clear.frame(height: 2) }
            if bar.done > 0 {
                UnevenRoundedRectangle(topLeadingRadius: bar.open > 0 ? 0 : corner, topTrailingRadius: bar.open > 0 ? 0 : corner, style: .continuous)
                    .fill(palette.accent)
                    .frame(height: doneHeight)
            }
        }
        .animation(Motion.choose(Motion.out(), reduceMotion: reduceMotion), value: bar.done)
        .animation(Motion.choose(Motion.out(), reduceMotion: reduceMotion), value: bar.total)
    }

    private func label(_ bar: Stats.Bar, dense: Bool) -> some View {
        let dimmed = hover != nil && hover != bar.id
        return VStack(spacing: 0) {
            // Dense axes label every fifth day (and today); the rest keep their place.
            Text(bar.label)
                .opacity(dense && !bar.major && !bar.current ? 0 : 1)
            if let sub = bar.sub { Text(sub) }
        }
        .type(Tokens.Typography.caption2, weight: bar.current ? .semibold : .regular)
        .foregroundStyle(bar.current ? .ink : .ink3)
        .monospacedDigit()
        .lineLimit(1)
        .fixedSize()
        // As narrow as its column, even when the label is wider (the web's `minmax(0, 1fr)`).
        .frame(minWidth: 0, maxWidth: .infinity)
        .opacity(dimmed ? 0.45 : 1)
    }

    // MARK: The pointer's details

    @ViewBuilder
    private var tooltip: some View {
        if let hover, let index = bars.firstIndex(where: { $0.id == hover }), bars[index].total > 0 || bars[index].elapsed {
            let width: CGFloat = 244
            let center = (CGFloat(index) + 0.5) / CGFloat(bars.count)
            let x = center < 0.22 ? 0 : center > 0.78 ? plotWidth - width : center * plotWidth - width / 2
            BarDetails(bar: bars[index])
                .clipShape(RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
                .elevation(Tokens.Shadow.float, cornerRadius: Tokens.Radius.lg)
                // Above the chart, 8 points clear of it.
                .alignmentGuide(.top) { $0[.bottom] + 8 }
                .offset(x: x)
                .allowsHitTesting(false)
                .transition(.opacity.animation(.easeOut(duration: Tokens.Motion.fast)))
                .accessibilityHidden(true)
        }
    }

    /// The column's look while pressed or under the pointer: a quiet box behind it.
    private struct ColumnStyle: ButtonStyle {
        let hovered: Bool

        func makeBody(configuration: Configuration) -> some View {
            configuration.label
                .background(configuration.isPressed || hovered ? Color.surface2 : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
                .animation(.easeOut(duration: Tokens.Motion.fast), value: configuration.isPressed)
        }
    }

    private struct Line: Shape {
        func path(in rect: CGRect) -> Path {
            var p = Path()
            p.move(to: CGPoint(x: rect.minX, y: rect.midY))
            p.addLine(to: CGPoint(x: rect.maxX, y: rect.midY))
            return p
        }
    }

    /// VoiceOver's audio graph and data table for the chart.
    private struct Descriptor: AXChartDescriptorRepresentable {
        let bars: [Stats.Bar]
        let title: String
        let top: Double

        func makeChartDescriptor() -> AXChartDescriptor {
            let x = AXCategoricalDataAxisDescriptor(title: bars.count == 12 ? "Month" : "Day", categoryOrder: bars.map(\.title))
            let y = AXNumericDataAxisDescriptor(title: "Done", range: 0...top, gridlinePositions: [top / 2]) { "\(Int($0)) done" }
            let done = AXDataSeriesDescriptor(name: "Done", isContinuous: false, dataPoints: bars.map {
                AXDataPoint(x: $0.title, y: Double($0.done), label: "\($0.done) of \($0.total) done")
            })
            let open = AXDataSeriesDescriptor(name: "Open", isContinuous: false, dataPoints: bars.map {
                AXDataPoint(x: $0.title, y: Double($0.open), label: "\($0.open) open")
            })
            return AXChartDescriptor(title: title, summary: nil, xAxis: x, yAxis: y, additionalAxes: [], series: [done, open])
        }
    }
}

extension Stats.Target {
    var isMonth: Bool {
        if case .month = self { return true }
        return false
    }
}

/// What a column holds: done of planned, the day, and its tasks, done first. The pointer's tooltip and the long press's
/// preview.
struct BarDetails: View {
    let bar: Stats.Bar
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Group {
                if bar.total > 0 {
                    Text("\(bar.done) ").font(.token(Tokens.Typography.callout, weight: .semibold)).foregroundStyle(.ink)
                        + Text("of \(bar.total) done · \(Stats.pct(Double(bar.done) / Double(bar.total)))").font(.token(Tokens.Typography.caption)).foregroundStyle(.ink3)
                } else {
                    Text("Nothing planned").type(Tokens.Typography.footnote).foregroundStyle(.ink3)
                }
            }
            .monospacedDigit()
            Text(bar.title)
                .type(Tokens.Typography.caption)
                .foregroundStyle(.ink2)
            let tasks = bar.tasks.sorted { $0.done && !$1.done }
            if !tasks.isEmpty {
                VStack(alignment: .leading, spacing: 4) {
                    ForEach(tasks.prefix(6)) { task in
                        HStack(spacing: 8) {
                            ZStack {
                                if task.done {
                                    Circle().fill(palette.accent)
                                    Checkmark()
                                        .stroke(palette.onAccent, style: StrokeStyle(lineWidth: 1.2, lineCap: .round, lineJoin: .round))
                                        .frame(width: 8, height: 8)
                                } else {
                                    Circle().strokeBorder(.checkRing, lineWidth: 1)
                                }
                            }
                            .frame(width: 12, height: 12)
                            Text(task.title)
                                .type(Tokens.Typography.caption)
                                .foregroundStyle(task.done ? .ink : .ink3)
                                .lineLimit(1)
                        }
                    }
                    if tasks.count > 6 {
                        Text("\(tasks.count - 6) more")
                            .type(Tokens.Typography.caption)
                            .foregroundStyle(.ink3)
                            .padding(.leading, 20)
                    }
                }
                .padding(.top, 8)
                .hairline(.top)
                .padding(.top, 8)
            }
        }
        .padding(12)
        .frame(width: 244, alignment: .leading)
        .background(.elevated)
    }
}
