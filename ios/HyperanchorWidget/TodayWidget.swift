import SwiftUI
import WidgetKit

/// The Today widget: how the day is going and what's still open. Tapping opens Today in the app.
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
                message("A new day", "Open Hyperanchor to plan it.", s)
            }
        } else {
            message("Today", "Sign in to Hyperanchor to see today’s tasks.", nil)
        }
    }

    @ViewBuilder
    private func content(_ s: WidgetSnapshot) -> some View {
        let done = s.tasks.filter(\.done).count
        let open = s.tasks.filter { !$0.done }
        let accent = color(s.accent)
        switch family {
        case .systemMedium:
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 6) {
                    header(s)
                    Spacer(minLength: 0)
                    Text(status(s, done: done))
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.secondary)
                        .monospacedDigit()
                }
                .frame(width: 112, alignment: .leading)
                list(open, accent: accent, limit: 4, allDone: !s.tasks.isEmpty && open.isEmpty)
            }
        default:
            VStack(alignment: .leading, spacing: 8) {
                header(s)
                if s.tasks.isEmpty {
                    Spacer(minLength: 0)
                    Text("Nothing planned yet").font(.footnote).foregroundStyle(.secondary)
                } else if open.isEmpty {
                    Spacer(minLength: 0)
                    Text("All done").font(.title3.weight(.semibold))
                    Text("Nice work.").font(.footnote).foregroundStyle(.secondary)
                } else {
                    Text("\(open.count) left")
                        .font(.title2.weight(.bold))
                        .tracking(-0.5)
                        .monospacedDigit()
                    list(open, accent: accent, limit: 2, allDone: false)
                }
            }
        }
    }

    private func header(_ s: WidgetSnapshot) -> some View {
        HStack(alignment: .top) {
            Text("Today").font(.headline).tracking(-0.3)
            Spacer(minLength: 4)
            Ring(value: s.tasks.isEmpty ? 0 : Double(s.tasks.filter(\.done).count) / Double(s.tasks.count), accent: color(s.accent), track: color(s.track))
                .frame(width: 22, height: 22)
        }
    }

    private func list(_ open: [WidgetSnapshot.Item], accent: Color, limit: Int, allDone: Bool) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if allDone {
                Text("All done for today. Nice work!").font(.subheadline).foregroundStyle(.secondary)
            } else if open.isEmpty {
                Text("Nothing planned yet").font(.subheadline).foregroundStyle(.secondary)
            }
            ForEach(Array(open.prefix(limit).enumerated()), id: \.offset) { _, t in
                HStack(spacing: 7) {
                    Circle().strokeBorder(.secondary.opacity(0.6), lineWidth: 1.3).frame(width: 12, height: 12)
                    Text(t.title).font(.subheadline).lineLimit(1)
                }
            }
            if open.count > limit {
                Text("+\(open.count - limit) more").font(.caption).foregroundStyle(.secondary).padding(.leading, 19)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func message(_ title: String, _ text: String, _ s: WidgetSnapshot?) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title).font(.headline)
            Text(text).font(.footnote).foregroundStyle(.secondary)
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

private struct Ring: View {
    let value: Double
    let accent: Color
    let track: Color

    var body: some View {
        ZStack {
            Circle().stroke(track, lineWidth: 3.5)
            Circle().trim(from: 0, to: value).stroke(accent, style: StrokeStyle(lineWidth: 3.5, lineCap: .round)).rotationEffect(.degrees(-90))
        }
        .padding(1.75)
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
