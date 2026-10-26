import SwiftUI

/// A year of days, one column per week (Monday on top), shaded by how many tasks were completed:
/// one hue, more is darker (lighter in dark mode).
struct Heatmap: View {
    let days: [Stats.DayStat]
    let open: (DayKey) -> Void
    @Environment(\.palette) private var palette

    private let cell: CGFloat = 13
    private let gap: CGFloat = 3

    var body: some View {
        if let firstDay = days.first {
            let first = firstDay.key.startOfWeek
            let weeks = Int((Double(days.last!.key.days(since: first) + 1) / 7).rounded(.up))
            let byKey = Dictionary(uniqueKeysWithValues: days.map { ($0.key, $0) })
            let maxDone = max(1, days.map(\.done).max() ?? 1)
            let level = { (d: Stats.DayStat) in d.done == 0 ? 0 : min(4, max(1, Int((Double(d.done) / Double(maxDone) * 4).rounded(.up)))) }

            VStack(alignment: .trailing, spacing: 10) {
                HStack(alignment: .top, spacing: 6) {
                    VStack(alignment: .leading, spacing: gap) {
                        Color.clear.frame(height: 14)
                        ForEach(0..<7, id: \.self) { i in
                            Text(i % 2 == 0 && i < 6 ? Dates.dowShort[i] : "")
                                .font(.system(size: 9.5))
                                .foregroundStyle(.ink3)
                                .frame(height: cell)
                        }
                    }
                    ScrollViewReader { proxy in
                        ScrollView(.horizontal) {
                            VStack(alignment: .leading, spacing: gap) {
                                ZStack(alignment: .topLeading) {
                                    ForEach(0..<12, id: \.self) { m in
                                        let col = DayKey(year: firstDay.key.year, month: m + 1, day: 1).days(since: first) / 7
                                        Text(Dates.monthsShort[m])
                                            .font(.caption2)
                                            .foregroundStyle(.ink3)
                                            .offset(x: CGFloat(col) * (cell + gap))
                                    }
                                }
                                .frame(width: CGFloat(weeks) * (cell + gap), height: 14, alignment: .topLeading)
                                HStack(spacing: gap) {
                                    ForEach(0..<weeks, id: \.self) { w in
                                        VStack(spacing: gap) {
                                            ForEach(0..<7, id: \.self) { i in
                                                let key = first.adding(days: w * 7 + i)
                                                if let d = byKey[key] {
                                                    Button { open(key) } label: {
                                                        RoundedRectangle(cornerRadius: 3, style: .continuous)
                                                            .fill(d.elapsed ? palette.heat[level(d)] : Color.surface2)
                                                            .overlay {
                                                                if d.isToday { RoundedRectangle(cornerRadius: 3.5, style: .continuous).strokeBorder(Color.ink2, lineWidth: 1.5).padding(-2) }
                                                            }
                                                    }
                                                    .buttonStyle(.plain)
                                                    .frame(width: cell, height: cell)
                                                    .accessibilityLabel("\(Dates.medium(key)): \(d.done) of \(d.total) done")
                                                } else {
                                                    Color.clear.frame(width: cell, height: cell)
                                                }
                                            }
                                        }
                                        .id(w)
                                    }
                                }
                            }
                            .padding(2)
                        }
                        .scrollIndicators(.hidden)
                        .onAppear {
                            // Show the most recent weeks first.
                            let todayWeek = days.first(where: \.isToday).map { $0.key.days(since: first) / 7 } ?? weeks - 1
                            proxy.scrollTo(todayWeek, anchor: .trailing)
                        }
                    }
                }
                HStack(spacing: 5) {
                    Text("Less")
                    ForEach(0..<5, id: \.self) { i in
                        RoundedRectangle(cornerRadius: 3, style: .continuous).fill(palette.heat[i]).frame(width: 11, height: 11)
                    }
                    Text("More")
                }
                .font(.caption2)
                .foregroundStyle(.ink3)
                .accessibilityHidden(true)
            }
        }
    }
}

/// Average completed per weekday; the best day in the accent, the rest de-emphasized.
struct WeekdayCard: View {
    let days: [Stats.DayStat]
    @Environment(\.palette) private var palette

    var body: some View {
        let ws = Stats.weekdayStats(days)
        let maxAvg = ws.map(\.avg).max() ?? 0
        let best = maxAvg > 0 ? ws.reduce(ws[0]) { $1.avg > $0.avg ? $1 : $0 } : nil

        Card(title: "By weekday", aside: "Average completed per day") {
            VStack(spacing: 9) {
                ForEach(ws) { w in
                    let top = best?.index == w.index
                    HStack(spacing: 12) {
                        Text(Dates.dowShort[w.index])
                            .font(.footnote.weight(top ? .semibold : .regular))
                            .foregroundStyle(top ? .ink : .ink2)
                            .frame(width: 34, alignment: .leading)
                        GeometryReader { g in
                            Capsule().fill(.surface3)
                                .overlay(alignment: .leading) {
                                    Capsule().fill(top ? palette.accent : .ink4).frame(width: maxAvg > 0 ? g.size.width * w.avg / maxAvg : 0)
                                }
                        }
                        .frame(height: 8)
                        HStack(spacing: 6) {
                            Text(Stats.fmt1(w.avg)).foregroundStyle(.ink)
                            Text(w.rate.map(Stats.pct) ?? "—").foregroundStyle(.ink3)
                        }
                        .font(.footnote)
                        .monospacedDigit()
                        .frame(width: 76, alignment: .trailing)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("\(Dates.dowFull[w.index]): \(Stats.fmt1(w.avg)) a day, \(w.rate.map(Stats.pct) ?? "no tasks")")
                }
            }
            Group {
                if let best {
                    Text("You get the most done on ") + Text("\(Dates.dowFull[best.index])s").fontWeight(.semibold).foregroundStyle(.ink) + Text(".")
                } else {
                    Text("Not enough completed tasks yet.")
                }
            }
            .font(.footnote)
            .foregroundStyle(.ink2)
        }
    }
}

/// What was planned but not completed, newest first: tick it off, open its day, or move it to today.
struct LeftOpenCard: View {
    let open: [Stats.OpenTask]
    let actions: TaskActions
    let openDay: (DayKey) -> Void
    @State private var all = false
    @Environment(\.palette) private var palette

    var body: some View {
        Card(title: "Left open", aside: open.isEmpty ? nil : "\(open.count) not completed") {
            if open.isEmpty {
                HStack(spacing: 8) {
                    Circle().fill(palette.accent).frame(width: 6, height: 6)
                    Text("Nothing left open — everything planned was completed.")
                }
                .font(.footnote)
                .foregroundStyle(.ink2)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
            } else {
                VStack(spacing: 0) {
                    ForEach(all ? open : Array(open.prefix(6))) { item in
                        HStack(spacing: 10) {
                            TaskCheckbox(task: item.task, size: 18) { actions.toggle(item.task) }
                                .padding(-12)
                            Button { openDay(item.day.key) } label: {
                                Text(item.task.title)
                                    .font(.subheadline)
                                    .foregroundStyle(.ink)
                                    .lineLimit(1)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            .buttonStyle(.plain)
                            Text(item.day.isToday ? "Today" : Dates.short(item.day.key))
                                .font(.caption.weight(item.day.isToday ? .regular : .medium))
                                .foregroundStyle(item.day.isToday ? .ink3 : .ink2)
                                .monospacedDigit()
                            if !item.day.isToday {
                                Button("Today") { actions.move(item.task, to: actions.today) }
                                    .buttonStyle(SecondaryButtonStyle(compact: true))
                                    .accessibilityLabel("Move to Today")
                            }
                        }
                        .padding(.vertical, 8)
                        .overlay(alignment: .bottom) { Rectangle().fill(.line).frame(height: 1) }
                    }
                }
                if open.count > 6 {
                    Button(all ? "Show less" : "Show all \(open.count)") { withAnimation { all.toggle() } }
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.ink2)
                }
            }
        }
    }
}

/// Every number behind the charts, as a sortable table — the charts' table view.
struct HistoryCard: View {
    let rows: [ChartModel.Row]
    let unit: String
    let pick: (ChartModel.Target) -> Void

    enum SortKey: String, CaseIterable { case date = "Date", done = "Completed", rate = "Rate" }
    @State private var sort: SortKey = .date
    @State private var ascending = false
    @State private var all = false

    var body: some View {
        let sorted = rows.sorted { a, b in
            let (x, y): (Double, Double) = switch sort {
            case .date: (Double(a.order), Double(b.order))
            case .done: (Double(a.done), Double(b.done))
            case .rate: (a.rate ?? -1, b.rate ?? -1)
            }
            return x == y ? a.order > b.order : (ascending ? x < y : x > y)
        }
        Card(title: "History", aside: rows.isEmpty ? nil : "\(rows.count) \(unit) with tasks") {
            if rows.isEmpty {
                Text("No tasks in this period yet.")
                    .font(.footnote)
                    .foregroundStyle(.ink2)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 16)
            } else {
                HStack {
                    Menu {
                        Picker("Sort by", selection: $sort) {
                            ForEach(SortKey.allCases, id: \.self) { Text($0 == .date ? (unit == "days" ? "Date" : "Month") : $0.rawValue).tag($0) }
                        }
                        Picker("Order", selection: $ascending) {
                            Text("Descending").tag(false)
                            Text("Ascending").tag(true)
                        }
                    } label: {
                        Label("Sort: \(sort == .date ? (unit == "days" ? "Date" : "Month") : sort.rawValue)", systemImage: "arrow.up.arrow.down")
                            .font(.caption.weight(.medium))
                            .foregroundStyle(.ink2)
                    }
                    Spacer()
                    Text("Completed · Planned · Rate").font(.caption).foregroundStyle(.ink3)
                }
                VStack(spacing: 0) {
                    ForEach(all ? sorted : Array(sorted.prefix(10))) { r in
                        Button { pick(r.target) } label: { row(r) }
                            .buttonStyle(.plain)
                    }
                }
                if rows.count > 10 {
                    Button(all ? "Show less" : "Show all \(rows.count)") { withAnimation { all.toggle() } }
                        .font(.footnote.weight(.medium))
                        .foregroundStyle(.ink2)
                }
            }
        }
    }

    private func row(_ r: ChartModel.Row) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 10) {
                Text(r.label).font(.subheadline.weight(.medium)).foregroundStyle(.ink)
                Spacer()
                Text("\(r.done)").font(.subheadline).foregroundStyle(.ink).frame(minWidth: 22, alignment: .trailing)
                Text("\(r.planned)").font(.subheadline).foregroundStyle(.ink2).frame(minWidth: 22, alignment: .trailing)
                Meter(value: r.rate).frame(width: 44)
                Text(r.rate.map(Stats.pct) ?? "—")
                    .font(.footnote.weight(r.rate == 1 ? .medium : .regular))
                    .foregroundStyle(r.rate == 1 ? .ink : .ink2)
                    .frame(width: 40, alignment: .trailing)
                Image(systemName: "chevron.right").font(.caption2.weight(.semibold)).foregroundStyle(.ink4)
            }
            .monospacedDigit()
            Group {
                if let tasks = r.tasks {
                    tasks.sorted { $0.done && !$1.done }.enumerated().reduce(Text("")) { text, item in
                        text + Text(item.offset > 0 ? ", " : "").foregroundStyle(.ink3) + Text(item.element.title).foregroundStyle(item.element.done ? .ink2 : .ink3)
                    }
                } else if let active = r.activeDays {
                    Text("Active days: \(active)").foregroundStyle(.ink3)
                }
            }
            .font(.caption)
            .lineLimit(1)
        }
        .padding(.vertical, 9)
        .contentShape(Rectangle())
        .overlay(alignment: .bottom) { Rectangle().fill(.line).frame(height: 1) }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(r.label): \(r.done) of \(r.planned) completed, \(r.rate.map(Stats.pct) ?? "no rate")")
        .accessibilityAddTraits(.isButton)
    }
}
