import Charts
import SwiftUI

/// Done (accent) under not done (accent track) per day or month, a 2-point gap between them, rounded tops,
/// recessive grid and a dashed average. Tap a column for its numbers; "Open" goes to the day or month.
struct CompletionChart: View {
    let model: ChartModel
    let pick: (ChartModel.Target) -> Void

    @Environment(\.palette) private var palette
    @State private var selected: String?

    private let height: CGFloat = 200

    var body: some View {
        let bars = model.bars
        let maxValue = Stats.niceMax(Double(bars.map(\.total).max() ?? 0))
        let gap = 2 * maxValue / height // two points, in data units
        let dense = bars.count > 12
        let byID = Dictionary(uniqueKeysWithValues: bars.map { ($0.id, $0) })
        let pinned = selected.flatMap { byID[$0] }

        VStack(alignment: .leading, spacing: 12) {
            readout(pinned)

            Chart {
                ForEach(bars) { bar in
                    let open = bar.total - bar.done
                    let dim = pinned != nil && pinned?.id != bar.id
                    if bar.total > 0 {
                        if bar.done > 0 {
                            BarMark(x: .value("Day", bar.id), yStart: .value("Start", 0), yEnd: .value("Done", Double(bar.done)), width: .ratio(dense ? 0.72 : 0.6))
                                .foregroundStyle(palette.accent)
                                .clipShape(UnevenRoundedRectangle(topLeadingRadius: open > 0 ? 0 : 4, topTrailingRadius: open > 0 ? 0 : 4))
                                .opacity((bar.elapsed ? 1 : 0.6) * (dim ? 0.45 : 1))
                        }
                        if open > 0 {
                            BarMark(x: .value("Day", bar.id), yStart: .value("Start", Double(bar.done) + (bar.done > 0 ? gap : 0)), yEnd: .value("Total", Double(bar.total)), width: .ratio(dense ? 0.72 : 0.6))
                                .foregroundStyle(palette.accentTrack)
                                .clipShape(UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4))
                                .opacity((bar.elapsed ? 1 : 0.6) * (dim ? 0.45 : 1))
                        }
                    } else if bar.elapsed {
                        // Nothing planned: a short stub on the baseline.
                        BarMark(x: .value("Day", bar.id), yStart: .value("Start", 0), yEnd: .value("Empty", gap), width: .ratio(dense ? 0.72 : 0.6))
                            .foregroundStyle(Color.line2)
                    }
                }
                if model.average > 0 {
                    RuleMark(y: .value("Average", model.average))
                        .lineStyle(StrokeStyle(lineWidth: 1, dash: [4, 3]))
                        .foregroundStyle(Color.ink3)
                        .annotation(position: .top, alignment: .trailing, spacing: 2) {
                            Text("avg \(Stats.fmt1(model.average))")
                                .font(.caption2.weight(.medium))
                                .foregroundStyle(.ink2)
                                .monospacedDigit()
                                .padding(.horizontal, 5)
                                .padding(.vertical, 1)
                                .background(.surface, in: RoundedRectangle(cornerRadius: 5, style: .continuous))
                                .elevation(Tokens.Shadow.lift, cornerRadius: 5)
                        }
                }
            }
            .chartXScale(domain: bars.map(\.id))
            .chartYScale(domain: 0...maxValue)
            .chartYAxis {
                AxisMarks(position: .leading, values: [0, maxValue / 2, maxValue]) { value in
                    AxisGridLine(stroke: StrokeStyle(lineWidth: 1)).foregroundStyle(value.index == 0 ? Color.line2 : Color.line)
                    AxisValueLabel {
                        if let v = value.as(Double.self) { Text(Stats.fmt1(v)).font(.caption2).foregroundStyle(.ink3).monospacedDigit() }
                    }
                }
            }
            .chartXAxis {
                AxisMarks(values: bars.map(\.id)) { value in
                    if let id = value.as(String.self), let bar = byID[id], !dense || bar.major || bar.current {
                        AxisValueLabel(centered: true) {
                            VStack(spacing: 0) {
                                Text(bar.label)
                                if let sub = bar.sub { Text(sub) }
                            }
                            .font(.caption2.weight(bar.current ? .semibold : .regular))
                            .foregroundStyle(bar.current ? .ink : .ink3)
                            .monospacedDigit()
                            .fixedSize()
                        }
                    }
                }
            }
            .chartOverlay { proxy in
                // A tap selects a column (a drag would fight the page's scrolling); tapping it again clears it.
                GeometryReader { geo in
                    Rectangle().fill(.clear).contentShape(Rectangle())
                        .onTapGesture { location in
                            guard let plot = proxy.plotFrame else { return }
                            let x = location.x - geo[plot].origin.x
                            guard let id: String = proxy.value(atX: x) else { return }
                            selected = selected == id ? nil : id
                        }
                }
            }
            .frame(height: height)
            .sensoryFeedback(.selection, trigger: selected)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Completed per \(bars.count == 12 ? "month" : "day")")
            .accessibilityChartDescriptor(Descriptor(bars: bars))

            HStack(spacing: 14) {
                LegendSwatch(color: palette.accent, label: "Done")
                LegendSwatch(color: palette.accentTrack, label: "Not done")
                HStack(spacing: 5) {
                    Rectangle().fill(.clear).frame(width: 14, height: 1)
                        .overlay(Line().stroke(Color.ink3, style: StrokeStyle(lineWidth: 1, dash: [3, 2])))
                    Text("Average")
                }
            }
            .font(.caption)
            .foregroundStyle(.ink2)
        }
    }

    /// The selected column's numbers, in a fixed-height row so nothing jumps.
    @ViewBuilder
    private func readout(_ bar: ChartModel.Bar?) -> some View {
        HStack(alignment: .center, spacing: 10) {
            if let bar {
                VStack(alignment: .leading, spacing: 1) {
                    if bar.total > 0 {
                        (Text("\(bar.done) ").font(.headline) + Text("of \(bar.total) done · \(Stats.pct(Double(bar.done) / Double(bar.total)))").font(.footnote).foregroundStyle(.ink3))
                            .monospacedDigit()
                    } else {
                        Text("Nothing planned").font(.footnote).foregroundStyle(.ink3)
                    }
                    Text(bar.title).font(.caption).foregroundStyle(.ink2)
                }
                Spacer()
                Button {
                    pick(bar.target)
                    selected = nil
                } label: {
                    HStack(spacing: 3) {
                        Text("Open")
                        Image(systemName: "chevron.right").font(.caption2.weight(.semibold))
                    }
                }
                .buttonStyle(SecondaryButtonStyle(compact: true))
                .accessibilityIdentifier("chart.open")
            } else {
                Text("Tap a column for details.")
                    .font(.footnote)
                    .foregroundStyle(.ink3)
                Spacer()
            }
        }
        .frame(height: 40)
        .animation(.snappy(duration: 0.2), value: bar?.id)
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
        let bars: [ChartModel.Bar]

        func makeChartDescriptor() -> AXChartDescriptor {
            let x = AXCategoricalDataAxisDescriptor(title: "Period", categoryOrder: bars.map(\.title))
            let maxTotal = Double(bars.map(\.total).max() ?? 0)
            let y = AXNumericDataAxisDescriptor(title: "Completed", range: 0...max(1, maxTotal), gridlinePositions: []) { "\(Int($0)) done" }
            let series = AXDataSeriesDescriptor(name: "Done", isContinuous: false, dataPoints: bars.map {
                AXDataPoint(x: $0.title, y: Double($0.done), label: "\($0.done) of \($0.total) done")
            })
            return AXChartDescriptor(title: "Completed tasks", summary: nil, xAxis: x, yAxis: y, additionalAxes: [], series: [series])
        }
    }
}

struct LegendSwatch: View {
    let color: Color
    let label: String

    var body: some View {
        HStack(spacing: 5) {
            RoundedRectangle(cornerRadius: 3, style: .continuous).fill(color).frame(width: 10, height: 10)
            Text(label)
        }
    }
}
