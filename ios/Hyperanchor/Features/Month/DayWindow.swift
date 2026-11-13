import SwiftUI

/// iPad: a day of the month opened in place (`DayPopover` on the web) — its name, a line to add a task, its tasks to tick
/// off, and at the foot how much is done and the way into the day itself.
struct DayWindow: View {
    let day: DayKey
    let close: () -> Void

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router

    var body: some View {
        let tasks = TaskSorting.sorted(store.tasks(on: day), by: .manual)
        let done = tasks.count { $0.done }
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                Text(Dates.long(day))
                    .font(.token(Tokens.Typography.callout, weight: .semibold))
                    .foregroundStyle(.ink)
                    .lineLimit(1)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: 8)
                Button(action: close) {
                    Image(systemName: Icon.close)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundStyle(.ink2)
                        .frame(width: 32, height: 32)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel("Close")
            }
            .padding(.leading, 16)
            .padding(.trailing, 2)
            .frame(minHeight: 48)

            MonthNewTaskLine(day: day, autofocus: tasks.isEmpty)
                .hairline(.top)
                .hairline(.bottom)

            Group {
                if tasks.isEmpty {
                    Text("Nothing planned.")
                        .font(.token(Tokens.Typography.body))
                        .foregroundStyle(.ink3)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 12)
                } else if tasks.count > 8 {
                    // A long day scrolls inside the window; a short one sizes it.
                    ScrollView {
                        MonthDayTasks(tasks: tasks).padding(.vertical, 4)
                    }
                    .frame(height: 360)
                } else {
                    MonthDayTasks(tasks: tasks).padding(.vertical, 4)
                }
            }

            HStack(spacing: 12) {
                Text(tasks.isEmpty ? "No tasks" : "\(done) of \(tasks.count) done")
                    .font(.token(Tokens.Typography.caption))
                    .monospacedDigit()
                    .foregroundStyle(.ink3)
                    .contentTransition(.numericText())
                Spacer(minLength: 8)
                Button {
                    close()
                    router.open(day)
                } label: {
                    HStack(spacing: 6) {
                        Text("Open day")
                        Image(systemName: "arrow.right")
                            .font(.system(size: 11, weight: .medium))
                            .foregroundStyle(.ink3)
                    }
                }
                .buttonStyle(SecondaryButtonStyle(compact: true))
                .frame(minHeight: 44)
                .accessibilityIdentifier("daysheet.open")
            }
            .padding(.leading, 16)
            .padding(.trailing, 10)
            .frame(minHeight: 52)
            .hairline(.top)
        }
        .frame(width: 340)
        .presentationBackground(.elevated)
        .presentationDetents([.medium, .large])
    }
}

/// The line a new task is written on, above a day's tasks (`NewTaskLine` on the web). Return adds it at the top of the
/// day — a run of them in the order written — and leaves the field ready for the next.
struct MonthNewTaskLine: View {
    let day: DayKey
    /// An empty day's window starts here, ready to type.
    var autofocus = false
    /// iPhone's list: 16-point text on a 50-point line; the window: 15 on 44.
    var large = false

    @Environment(TaskStore.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(TodayClock.self) private var clock
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var title = ""
    /// The task written just before: the next lands after it.
    @State private var after: String?
    @FocusState private var focused: Bool

    var body: some View {
        HStack(alignment: .top, spacing: 0) {
            PlusTile()
                .frame(width: 30, height: 22, alignment: .leading)
            TextField("New task", text: $title.returnSubmits { add() }, axis: .vertical)
                .font(.token(large ? Tokens.Typography.callout : Tokens.Typography.body))
                .lineLimit(1...4)
                .focused($focused)
                .submitLabel(.done)
                .onSubmit(add)
                .accessibilityLabel("New task on \(Dates.long(day))")
                .accessibilityIdentifier("daysheet.new")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, large ? 14 : 11)
        .frame(minHeight: large ? 50 : 44)
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
        .task {
            guard autofocus else { return }
            // After the window has come up.
            try? await Task.sleep(for: .milliseconds(350))
            focused = true
        }
    }

    private func add() {
        let actions = PlannerActions(store: store, toaster: toaster, today: clock.today)
        withAnimation(Motion.choose(Motion.travel, reduceMotion: reduceMotion)) {
            if let task = actions.create(title, on: day, after: after) { after = task.id }
        }
        title = ""
        // The field stays ready for the next one.
        Task { focused = true }
    }
}

/// A day's tasks to tick off, each on its own line; long titles wrap. Hold one for its menu.
struct MonthDayTasks: View {
    let tasks: [TaskItem]
    /// iPhone's list: 16-point titles on 44-point lines; the window: 15.
    var large = false

    @Environment(TaskStore.self) private var store
    @Environment(Toaster.self) private var toaster
    @Environment(TodayClock.self) private var clock
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let actions = PlannerActions(store: store, toaster: toaster, today: clock.today)
        VStack(spacing: 0) {
            ForEach(tasks) { task in
                HStack(alignment: .top, spacing: 12) {
                    TaskCheckbox(task: task, size: 18) { actions.toggle(task) }
                        .padding(-13)
                        .padding(.top, 1)
                    Text(task.title)
                        .font(.token(large ? Tokens.Typography.callout : Tokens.Typography.body))
                        .foregroundStyle(task.done ? .ink3 : .ink)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .animation(Motion.out(Tokens.Motion.base), value: task.done)
                }
                .padding(.horizontal, 16)
                .padding(.vertical, large ? 12 : 9)
                .contentShape(Rectangle())
                .contextMenu {
                    PlannerTaskMenu(task: task, today: clock.today,
                                    toggle: { actions.toggle(task) },
                                    move: { day in withAnimation(motion) { actions.move(task, to: day) } },
                                    delete: { withAnimation(motion) { actions.delete(task) } })
                }
                .transition(.opacity)
                .accessibilityElement(children: .contain)
            }
        }
    }

    private var motion: Animation { Motion.choose(Motion.in(Tokens.Motion.base), reduceMotion: reduceMotion) }
}
