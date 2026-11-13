import SwiftUI

/// iPhone: the month as numbers (dark where something is still to do), and under it the chosen day — the way into it,
/// how much is done, a line to add a task and its tasks to tick off. A sideways swipe on the numbers turns the month.
struct MonthNumbersPage: View {
    let month: DayKey

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        let grid = Dates.monthGrid(year: month.year, month: month.month)
        let selected = router.selected
        ScrollView {
            VStack(spacing: 0) {
                MonthNumbers(month: month)
                    .padding(.horizontal, 8)
                    .padding(.top, 8)
                    .padding(.bottom, 8)
                MonthDayList(day: selected)
            }
            .padding(.bottom, 24)
        }
        .scrollDismissesKeyboard(.interactively)
        // The chosen day may be in another month than the one on screen.
        .task(id: selected) {
            if selected < grid.start || selected > grid.end { await store.load(selected...selected) }
        }
    }
}

/// The month's days as numbers under the weekdays' letters: today on a filled tile, the chosen day outlined, days with
/// something left to do dark, the rest gray, the months around quieter still (`MiniMonth` on the web, large).
private struct MonthNumbers: View {
    let month: DayKey

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let grid = Dates.monthGrid(year: month.year, month: month.month)
        let letters = Dates.weekdayNames(.letter)
        VStack(spacing: 0) {
            HStack(spacing: 0) {
                ForEach(letters.indices, id: \.self) { i in
                    Text(letters[i])
                        .font(.token(Tokens.Typography.caption2, weight: .medium))
                        .tracking(0.22)
                        .foregroundStyle(.ink3)
                        .frame(maxWidth: .infinity, minHeight: 24)
                }
            }
            .accessibilityHidden(true)
            VStack(spacing: 0) {
                ForEach(0..<grid.rows, id: \.self) { row in
                    HStack(spacing: 0) {
                        ForEach(0..<7, id: \.self) { column in
                            number(grid.start.adding(days: row * 7 + column))
                        }
                    }
                }
            }
            .id(month)
            .transition(.opacity.animation(Motion.out(Tokens.Motion.fast)))
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .contentShape(Rectangle())
        .simultaneousGesture(
            DragGesture(minimumDistance: 30)
                .onEnded { g in
                    let dx = g.translation.width
                    guard abs(dx) > 60, abs(dx) > abs(g.translation.height) * 1.5 else { return }
                    withAnimation(Motion.choose(Motion.settle, reduceMotion: reduceMotion)) {
                        router.month = router.month.addingMonths(dx < 0 ? 1 : -1)
                    }
                }
        )
        .sensoryFeedback(.selection, trigger: router.selected)
    }

    private func number(_ day: DayKey) -> some View {
        let isToday = day == clock.today
        let chosen = day == router.selected
        let out = day.month != month.month
        let tasks = store.tasks(on: day)
        let open = tasks.count { !$0.done }
        let weight: Font.Weight = isToday || chosen ? .semibold : open > 0 && !out ? .medium : .regular
        let color: Color = isToday ? .onPrimary : chosen ? .ink : out ? .ink4 : open > 0 ? .ink : .ink3
        return Button {
            router.selected = day
            router.selectedTask = nil
        } label: {
            Text(verbatim: "\(day.day)")
                .font(.token(Tokens.Typography.callout, weight: weight))
                .monospacedDigit()
                .foregroundStyle(color)
                .frame(width: 40, height: 40)
                .background {
                    let tile = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
                    if isToday {
                        tile.fill(.primaryFill)
                    } else if chosen {
                        tile.fill(.surface).overlay(tile.strokeBorder(.ink, lineWidth: 1.5))
                    }
                }
                .frame(maxWidth: .infinity, minHeight: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel(Dates.long(day))
        .accessibilityValue(tasks.isEmpty ? "" : open > 0 ? "\(open) to do" : "All done")
        .accessibilityAddTraits(chosen ? .isSelected : [])
    }
}

/// The chosen day under the month: its name (the way into it) and how much is done, a line to add a task, its tasks.
private struct MonthDayList: View {
    let day: DayKey

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        let tasks = TaskSorting.sorted(store.tasks(on: day), by: .manual)
        let done = tasks.count { $0.done }
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Button {
                    router.open(day)
                } label: {
                    HStack(spacing: 6) {
                        Text(Dates.long(day))
                            .font(.token(Tokens.Typography.footnote, weight: .semibold))
                            .foregroundStyle(.ink)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.ink3)
                    }
                    .frame(minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
                .accessibilityHint("Opens the day")
                .accessibilityIdentifier("month.openDay")
                Spacer(minLength: 8)
                if !tasks.isEmpty {
                    Text(verbatim: "\(done) of \(tasks.count)")
                        .font(.token(Tokens.Typography.caption))
                        .monospacedDigit()
                        .foregroundStyle(.ink3)
                        .contentTransition(.numericText())
                        .accessibilityLabel("\(done) of \(tasks.count) done")
                }
            }
            .padding(.horizontal, 16)
            .frame(height: 40)
            .background(.surface2)
            .hairline(.top)
            .hairline(.bottom)

            MonthNewTaskLine(day: day, large: true)
                .hairline(.bottom)
                .id(day)

            if tasks.isEmpty {
                Text("Nothing planned.")
                    .font(.token(Tokens.Typography.body))
                    .foregroundStyle(.ink3)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.leading, 46)
                    .padding(.trailing, 16)
                    .padding(.top, 12)
            } else {
                MonthDayTasks(tasks: tasks, large: true)
            }
        }
    }
}
