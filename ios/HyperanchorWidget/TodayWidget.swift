import SwiftUI
import WidgetKit

/// The Today widget: how the day is going and what's still open, in the app's look (square boxes, the accent as the
/// app has it — graphite by default). Tapping opens Today in the app.
@main
struct HyperanchorWidgets: WidgetBundle {
    var body: some Widget {
        TodayWidget()
    }
}

struct TodayWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "today", provider: Provider()) { entry in
            TodayWidgetView(entry: entry)
                .containerBackground(for: .widget) { Color("WidgetBackground") }
                .widgetURL(URL(string: "hyperanchor://today"))
        }
        .configurationDisplayName("Today")
        .description("What’s left today, at a glance.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

struct Entry: TimelineEntry {
    let date: Date
    let snapshot: WidgetSnapshot?
}

struct Provider: TimelineProvider {
    func placeholder(in context: Context) -> Entry {
        Entry(date: .now, snapshot: .placeholder)
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(Entry(date: .now, snapshot: context.isPreview ? .placeholder : WidgetSnapshot.load() ?? .placeholder))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // The app reloads the widget when today's tasks change; at midnight the day turns over.
        let snapshot = WidgetSnapshot.load()
        let midnight = Calendar.current.startOfDay(for: .now.addingTimeInterval(86_400))
        completion(Timeline(entries: [Entry(date: .now, snapshot: snapshot), Entry(date: midnight, snapshot: snapshot)], policy: .after(midnight)))
    }
}

struct TodayWidgetView: View {
    let entry: Entry
    @Environment(\.widgetFamily) private var family
    @Environment(\.colorScheme) private var scheme

    private var today: String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: entry.date)
        return String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
    }

    var body: some View {
        if let s = entry.snapshot, s.signedIn {
            if s.day == today || s.day.isEmpty {
                content(s)
            } else {
                message("A new day", "Open Hyperanchor to plan it.")
            }
        } else {
            message("Today", "Sign in to Hyperanchor to see today’s tasks.")
        }
    }

    @ViewBuilder
    private func content(_ s: WidgetSnapshot) -> some View {
        let done = s.tasks.filter(\.done).count
        let open = s.tasks.filter { !$0.done }
        switch family {
        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    header(s)
                    Spacer(minLength: 0)
                    Text(status(s, done: done))
                        .font(.footnote)
                        .foregroundStyle(Ink.quiet)
                        .monospacedDigit()
                }
                .frame(width: 104, alignment: .leading)
                list(open, limit: 4, allDone: !s.tasks.isEmpty && open.isEmpty)
            }
        default:
            VStack(alignment: .leading, spacing: 8) {
                header(s)
                if s.tasks.isEmpty {
                    Spacer(minLength: 0)
                    Text("Nothing planned yet").font(.footnote).foregroundStyle(Ink.quiet)
                } else if open.isEmpty {
                    Spacer(minLength: 0)
                    Text("All done").font(.title3.weight(.semibold)).tracking(-0.3).foregroundStyle(Ink.main)
                    Text("\(s.tasks.count) of \(s.tasks.count)").font(.footnote).foregroundStyle(Ink.quiet).monospacedDigit()
                } else {
                    Text("\(open.count) left")
                        .font(.title2.weight(.semibold))
                        .tracking(-0.5)
                        .monospacedDigit()
                        .foregroundStyle(Ink.main)
                    list(open, limit: 2, allDone: false)
                }
            }
        }
    }

    private func header(_ s: WidgetSnapshot) -> some View {
        HStack(alignment: .center) {
            Text("Today").font(.headline).tracking(-0.3).foregroundStyle(Ink.main)
            Spacer(minLength: 4)
            Ring(value: s.tasks.isEmpty ? 0 : Double(s.tasks.filter(\.done).count) / Double(s.tasks.count), accent: color(s.accent), track: color(s.track))
                .frame(width: 18, height: 18)
        }
    }

    private func list(_ open: [WidgetSnapshot.Item], limit: Int, allDone: Bool) -> some View {
        VStack(alignment: .leading, spacing: 7) {
            if allDone {
                Text("All done for today.").font(.subheadline).foregroundStyle(Ink.quiet)
            } else if open.isEmpty {
                Text("Nothing planned yet").font(.subheadline).foregroundStyle(Ink.quiet)
            }
            ForEach(Array(open.prefix(limit).enumerated()), id: \.offset) { _, t in
                HStack(spacing: 8) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .strokeBorder(Ink.box, lineWidth: 1.25)
                        .frame(width: 13, height: 13)
                    Text(t.title).font(.subheadline).foregroundStyle(Ink.main).lineLimit(1)
                }
            }
            if open.count > limit {
                Text("\(open.count - limit) more").font(.caption).foregroundStyle(Ink.quiet).padding(.leading, 21)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func message(_ title: String, _ text: String) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline).foregroundStyle(Ink.main)
            Text(text).font(.footnote).foregroundStyle(Ink.quiet)
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func status(_ s: WidgetSnapshot, done: Int) -> String {
        s.tasks.isEmpty ? "No tasks" : done == s.tasks.count ? "All done" : "\(done) of \(s.tasks.count) done"
    }

    /// The light or dark value of a [light, dark] pair.
    private func color(_ pair: [UInt32]) -> Color {
        let hex = scheme == .dark ? pair.last ?? 0 : pair.first ?? 0
        return Color(red: Double((hex >> 16) & 0xFF) / 255, green: Double((hex >> 8) & 0xFF) / 255, blue: Double(hex & 0xFF) / 255)
    }
}

/// The app's neutrals (design/tokens.json): ink, the quiet gray for text, an open box's edge.
private enum Ink {
    static let main = Color(light: 0x171717, dark: 0xEDEDED)
    static let quiet = Color(light: 0x6B6B6B, dark: 0x8A8A8A)
    static let box = Color(light: 0x8A8A8A, dark: 0x707070)
}

private extension Color {
    init(light: UInt32, dark: UInt32) {
        func c(_ hex: UInt32) -> UIColor {
            UIColor(red: CGFloat((hex >> 16) & 0xFF) / 255, green: CGFloat((hex >> 8) & 0xFF) / 255, blue: CGFloat(hex & 0xFF) / 255, alpha: 1)
        }
        let l = c(light), d = c(dark)
        self.init(uiColor: UIColor { $0.userInterfaceStyle == .dark ? d : l })
    }
}

private struct Ring: View {
    let value: Double
    let accent: Color
    let track: Color

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: 2.5)
            Circle().trim(from: 0, to: value).stroke(accent, style: StrokeStyle(lineWidth: 2.5, lineCap: .round)).rotationEffect(.degrees(-90))
                .opacity(value > 0 ? 1 : 0)
        }
        .padding(1.25)
    }
}

#Preview("Small", as: .systemSmall) {
    TodayWidget()
} timeline: {
    Entry(date: .now, snapshot: .placeholder)
}

#Preview("Medium", as: .systemMedium) {
    TodayWidget()
} timeline: {
    Entry(date: .now, snapshot: .placeholder)
}
