import SwiftUI

/// The month grid: dots for tasks (accent: done, gray: open), today in the accent, the selected day black.
/// Tap a day for its tasks in a sheet; swipe for the neighboring month.
struct MonthScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(\.horizontalSizeClass) private var sizeClass

    @State private var sheetDay: DayKey?
    @State private var direction = 0

    private var today: DayKey { clock.today }
    private var month: DayKey { router.month }

    var body: some View {
        let grid = Dates.monthGrid(year: month.year, month: month.month)
        let inMonth = (0..<DayKey.daysIn(year: month.year, month: month.month)).flatMap { store.tasks(on: month.adding(days: $0)) }
        let done = inMonth.count(where: \.done)
        let isCurrent = month == today.startOfMonth

        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    HStack(spacing: 6) {
                        if inMonth.isEmpty {
                            Text("No tasks this month")
                        } else {
                            ProgressRing(value: Double(done) / Double(inMonth.count), size: 14, lineWidth: 2.4)
                            Text("\(Dates.plural(inMonth.count, "task")) · \(done) done")
                        }
                        Spacer(minLength: 8)
                        if !isCurrent {
                            Button("Today") { withAnimation(.snappy) { router.goToToday(today) } }
                                .buttonStyle(SecondaryButtonStyle(compact: true))
                        }
                    }
                    .font(.subheadline)
                    .foregroundStyle(.ink2)
                    .monospacedDigit()
                    .padding(.horizontal, 16)
                    .padding(.bottom, 12)

                    weekdayHeader

                    VStack(spacing: 0) {
                        ForEach(0..<grid.rows, id: \.self) { r in
                            HStack(spacing: 0) {
                                ForEach(0..<7, id: \.self) { c in
                                    let day = grid.start.adding(days: r * 7 + c)
                                    DayCell(day: day, month: month, today: today, selected: router.selected, tasks: store.tasks(on: day), detailed: sizeClass == .regular, weekend: c >= 5) {
                                        router.selected = day
                                        sheetDay = day
                                    }
                                }
                            }
                            .overlay(alignment: .bottom) { if r < grid.rows - 1 { Rectangle().fill(.line).frame(height: 1) } }
                        }
                    }
                    .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
                    .id(month)
                    .transition(.asymmetric(
                        insertion: .move(edge: direction >= 0 ? .trailing : .leading).combined(with: .opacity),
                        removal: .move(edge: direction >= 0 ? .leading : .trailing).combined(with: .opacity)
                    ))
                    .gesture(
                        DragGesture(minimumDistance: 24)
                            .onEnded { g in
                                guard abs(g.translation.width) > abs(g.translation.height), abs(g.translation.width) > 50 else { return }
                                shift(g.translation.width < 0 ? 1 : -1)
                            }
                    )
                }
                .clipped()
            }
            .background(.surface)
            .navigationTitle("\(Dates.months[month.month - 1]) \(String(month.year))")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { AccountMenu(user: user) }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Previous Month", systemImage: "chevron.left") { shift(-1) }
                    Button("Next Month", systemImage: "chevron.right") { shift(1) }
                }
            }
            .sheet(item: $sheetDay) { day in
                DaySheet(day: day)
                    .presentationDetents([.medium, .large])
                    .presentationDragIndicator(.visible)
            }
            .toastHost()
        }
        .task(id: month) {
            await store.load(grid.start...grid.end)
        }
    }

    private var weekdayHeader: some View {
        HStack(spacing: 0) {
            ForEach(0..<7, id: \.self) { i in
                Text(sizeClass == .regular ? Dates.dowShort[i] : String(Dates.dowShort[i].prefix(1)))
                    .font(.caption.weight(.medium))
                    .foregroundStyle(i >= 5 ? .ink3 : .ink2)
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 8)
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .background(.surface2)
        .overlay(alignment: .top) { Rectangle().fill(.line).frame(height: 1) }
        .overlay(alignment: .bottom) { Rectangle().fill(.line).frame(height: 1) }
        .accessibilityHidden(true)
    }

    private func shift(_ n: Int) {
        direction = n
        withAnimation(.snappy(duration: 0.35)) { router.month = router.month.addingMonths(n) }
    }
}

extension DayKey: Identifiable {
    var id: Int { ordinal }
}

private struct DayCell: View {
    let day: DayKey
    let month: DayKey
    let today: DayKey
    let selected: DayKey
    let tasks: [TaskItem]
    /// iPad: task titles instead of dots.
    let detailed: Bool
    let weekend: Bool
    let tap: () -> Void

    @Environment(\.palette) private var palette

    var body: some View {
        let out = day.month != month.month
        let isToday = day == today
        let isSelected = day == selected
        Button(action: tap) {
            VStack(alignment: detailed ? .leading : .center, spacing: 4) {
                Text("\(day.day)")
                    .font(.subheadline.weight(isToday || isSelected ? .semibold : .regular))
                    .monospacedDigit()
                    .foregroundStyle(isToday ? Color.onAccent : isSelected ? Color.onPrimary : out ? Color.ink4 : Color.ink)
                    .frame(width: 30, height: 30)
                    .background {
                        if isToday { Circle().fill(palette.accent) } else if isSelected { Circle().fill(Color.primaryFill) }
                    }
                    .frame(maxWidth: .infinity, alignment: detailed ? .trailing : .center)
                if detailed {
                    VStack(alignment: .leading, spacing: 3) {
                        ForEach(tasks.prefix(3)) { t in
                            HStack(spacing: 6) {
                                Circle()
                                    .fill(t.done ? palette.accent : .clear)
                                    .strokeBorder(t.done ? .clear : Color.checkRing, lineWidth: 1.5)
                                    .frame(width: 7, height: 7)
                                Text(t.title).lineLimit(1)
                            }
                            .font(.caption)
                            .foregroundStyle(t.done || out ? .ink3 : .ink)
                        }
                        if tasks.count > 3 {
                            Text("+\(tasks.count - 3) more").font(.caption2.weight(.medium)).foregroundStyle(.ink3).padding(.leading, 13)
                        }
                    }
                } else {
                    HStack(spacing: 3) {
                        ForEach(tasks.prefix(4)) { t in
                            Circle().fill(t.done ? palette.accent : .ink4).frame(width: 5, height: 5)
                        }
                    }
                    .frame(height: 5)
                }
                Spacer(minLength: 0)
            }
            .padding(detailed ? 8 : 4)
            .frame(maxWidth: .infinity, minHeight: detailed ? 112 : 64, alignment: .top)
            .background(weekend ? Color.surface2 : Color.surface)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(Dates.long(day) + (tasks.isEmpty ? "" : ", \(Dates.plural(tasks.count, "task")), \(tasks.count(where: \.done)) done"))
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// A day from the calendar: tick tasks off, add one, or open the day.
struct DaySheet: View {
    let day: DayKey

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @State private var title = ""
    @FocusState private var adding: Bool

    var body: some View {
        let tasks = store.tasks(on: day)
        let actions = TaskActions(store: store, toaster: toaster, today: clock.today)
        NavigationStack {
            List {
                ForEach(tasks) { t in
                    HStack(alignment: .top, spacing: 4) {
                        TaskCheckbox(task: t, size: 20) { actions.toggle(t) }
                            .padding(.leading, -12)
                            .padding(.vertical, -10)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(t.title).foregroundStyle(t.done ? .ink3 : .ink)
                            if !t.notes.isEmpty { Text(t.notes).font(.footnote).foregroundStyle(.ink3).lineLimit(1) }
                        }
                    }
                    .contextMenu { TaskMenuItems(task: t, actions: actions) { actions.toggle(t) } }
                    .listRowBackground(Color.elevated)
                }
                HStack(spacing: 10) {
                    Image(systemName: "plus").foregroundStyle(.ink3).frame(width: 20)
                    TextField("New Task", text: $title)
                        .focused($adding)
                        .submitLabel(.done)
                        .onSubmit {
                            let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !t.isEmpty else { return }
                            store.create(title: String(t.prefix(TaskItem.titleMax)), date: day)
                            title = ""
                            adding = true
                        }
                        .accessibilityIdentifier("daysheet.new")
                }
                .listRowBackground(Color.elevated)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(.elevated)
            .safeAreaInset(edge: .bottom) {
                Button {
                    dismiss()
                    router.open(day)
                } label: {
                    HStack(spacing: 6) {
                        Text("Open Day")
                        Image(systemName: "arrow.right").font(.subheadline.weight(.semibold))
                    }
                }
                .buttonStyle(PrimaryButtonStyle())
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
                .accessibilityIdentifier("daysheet.open")
            }
            .navigationTitle(Dates.long(day))
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 0) {
                        Text(Dates.long(day)).font(.headline)
                        Text(tasks.isEmpty ? "No tasks" : "\(tasks.count(where: \.done)) of \(tasks.count) done")
                            .font(.caption)
                            .foregroundStyle(.ink3)
                            .monospacedDigit()
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Close", systemImage: "xmark") { dismiss() }
                }
            }
        }
        .tint(.ink)
        .onAppear { if tasks.isEmpty { adding = true } }
    }
}
