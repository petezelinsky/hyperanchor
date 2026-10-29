import SwiftUI

/// Completed · Completion rate · Daily average · Streak — each with its change against the previous period.
struct Kpis: View {
    let sum: Stats.Summary
    let prev: Stats.Summary
    let period: Stats.Period
    /// The current period (vs an earlier one).
    let current: Bool
    let spark: [SparkPoint]
    /// Current streak (current period) or the longest one in the period.
    let streak: Int
    let longest: Int
    /// Whether each of the last 7 days had something completed, oldest first.
    let recent: [Bool]
    let columns: Int

    @Environment(\.palette) private var palette

    var body: some View {
        let vs = "vs \(current ? "last" : "previous") \(period.rawValue)"
        let prevHas = prev.planned > 0
        let none = Text("No data for the previous \(period.rawValue)")

        LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: columns), spacing: 12) {
            Tile(label: "Completed", value: "\(sum.completed)", visual: wide ? AnyView(Sparkline(points: spark)) : nil) {
                Text(sum.planned > 0 ? "of \(sum.planned) planned" : "Nothing planned yet")
                if prevHas { Delta(value: Double(sum.completed - prev.completed), digits: 0, vs: vs) }
            }
            Tile(label: "Completion rate", value: sum.rate.map(Stats.pct) ?? "—", visual: wide ? AnyView(Meter(value: sum.rate).frame(width: 64)) : nil) {
                if sum.rate == nil {
                    Text("Plan tasks to see your rate")
                } else if prevHas, let p = prev.rate, let r = sum.rate {
                    Delta(value: (r - p) * 100, digits: 0, suffix: " pts", vs: vs)
                } else {
                    none
                }
            }
            Tile(label: "Daily average", value: Stats.fmt1(sum.avg), unit: "per day") {
                Text("\(sum.activeDays)/\(sum.elapsedDays) days active")
                if prevHas { Delta(value: sum.avg - prev.avg, digits: 1, vs: vs) }
            }
            Tile(label: current ? "Current streak" : "Longest streak", value: "\(streak)", unit: streak == 1 ? "day" : "days", visual: wide ? AnyView(streakDots) : nil) {
                Text(current ? "Longest this \(period.rawValue): \(longest) \(longest == 1 ? "day" : "days")" : "Days in a row with something done")
            }
        }
    }

    /// Phones leave out the small visuals (as the web does), so labels never truncate.
    private var wide: Bool { columns > 2 || columns == 1 }

    private var streakDots: some View {
        HStack(spacing: 3) {
            ForEach(Array(recent.enumerated()), id: \.offset) { _, on in
                Circle().fill(on ? palette.accent : .line2).frame(width: 6, height: 6)
            }
            Image(systemName: "flame.fill")
                .font(.caption)
                .foregroundStyle(streak > 0 ? palette.accent : .ink4)
                .padding(.leading, 2)
        }
    }
}

private struct Tile<Foot: View>: View {
    let label: String
    let value: String
    var unit: String?
    var visual: AnyView?
    @ViewBuilder let foot: Foot

    private var labelText: some View {
        Text(label)
            .font(.footnote.weight(.medium))
            .foregroundStyle(.ink2)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // The small visual gives way when the label needs the room.
            ViewThatFits(in: .horizontal) {
                HStack {
                    labelText.fixedSize()
                    Spacer(minLength: 6)
                    visual
                }
                HStack {
                    labelText.lineLimit(1)
                    Spacer(minLength: 0)
                }
            }
            .frame(minHeight: 26)
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(.title, weight: .semibold))
                    .tracking(-0.8)
                    .contentTransition(.numericText())
                    .monospacedDigit()
                if let unit {
                    Text(unit).font(.footnote).foregroundStyle(.ink3)
                }
            }
            VStack(alignment: .leading, spacing: 2) { foot }
                .font(.caption)
                .foregroundStyle(.ink3)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous))
        .elevation(Tokens.Shadow.lift, cornerRadius: Tokens.Radius.card)
        .accessibilityElement(children: .combine)
    }
}

/// Signed change vs the previous period: arrow + number, green up, red down (up is good for every measure here).
private struct Delta: View {
    let value: Double
    let digits: Int
    var suffix = ""
    let vs: String

    var body: some View {
        let r = Double(JS.toFixed(value, digits)) ?? 0
        let tone: Color = r > 0 ? .greenInk : r < 0 ? .redInk : .ink2
        let number = r == 0 ? "0" : JS.toFixed(abs(r), digits).replacing(/\.0$/, with: "")
        HStack(spacing: 6) {
            Text("\(r > 0 ? "▲" : r < 0 ? "▼" : "=") \(number)\(r != 0 ? suffix : "")")
                .fontWeight(.semibold)
                .foregroundStyle(tone)
                .monospacedDigit()
            Text(vs)
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(r > 0 ? "Up" : r < 0 ? "Down" : "No change") \(number)\(suffix) \(vs)")
    }
}

/// Tiny columns of the period's trend; the current day or month in the accent.
private struct Sparkline: View {
    let points: [SparkPoint]
    @Environment(\.palette) private var palette

    var body: some View {
        let max = Swift.max(1, points.map(\.value).max() ?? 1)
        HStack(alignment: .bottom, spacing: points.count > 12 ? 1 : 2) {
            ForEach(Array(points.enumerated()), id: \.offset) { _, p in
                UnevenRoundedRectangle(topLeadingRadius: 1.5, topTrailingRadius: 1.5)
                    .fill(p.current ? palette.accent : p.elapsed ? Color.ink4 : Color.line)
                    .frame(height: p.elapsed ? Swift.max(2.5, 26 * Double(p.value) / Double(max)) : 2.5)
            }
        }
        .frame(width: 72, height: 26, alignment: .bottom)
        .accessibilityHidden(true)
    }
}
