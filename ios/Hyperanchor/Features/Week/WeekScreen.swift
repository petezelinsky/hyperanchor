import SwiftUI

/// The selected day's week, Monday to Sunday: each day lists what's left first, finished tasks below.
struct WeekScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(\.palette) private var palette

    @State private var editor = ListEditor()
    @FocusState private var focus: TaskField?

    private var today: DayKey { clock.today }
    private var start: DayKey { router.selected.startOfWeek }
    private var actions: TaskActions { TaskActions(store: store, toaster: toaster, today: today) }

    var body: some View {
        @Bindable var router = router
        let weeks = start.days(since: today.startOfWeek) / 7
        let title = weeks == 0 ? "This Week" : weeks == -1 ? "Last Week" : weeks == 1 ? "Next Week" : "Week of \(Dates.short(start))"
        let days = (0..<7).map { start.adding(days: $0) }
        let all = days.flatMap { store.tasks(on: $0) }
        let done = all.count(where: \.done)
        let searching = !router.query.trimmingCharacters(in: .whitespaces).isEmpty
        let sections = days.map { day in
            let list = TaskSorting.sorted(store.tasks(on: day).filter { TaskSorting.matches($0, query: router.query) }, by: router.sort)
            return (day: day, open: list.filter { !$0.done || editor.isSettling($0.id) }, completed: list.filter { $0.done && !editor.isSettling($0.id) })
        }
        let visible = searching ? sections.filter { !$0.open.isEmpty || !$0.completed.isEmpty } : sections

        NavigationStack {
            ScrollViewReader { proxy in
            List {
                HStack(spacing: 6) {
                    Text(Dates.range(start, start.adding(days: 6)))
                    Text("·").foregroundStyle(.ink4)
                    if !all.isEmpty {
                        ProgressRing(value: Double(done) / Double(all.count), size: 14, lineWidth: 2.4)
                    }
                    Text(all.isEmpty ? "No tasks" : "\(done) of \(all.count) done")
                    Spacer(minLength: 8)
                    if weeks != 0 {
                        Button("This Week") { router.selected = today }
                            .buttonStyle(SecondaryButtonStyle(compact: true))
                    }
                }
                .font(.subheadline)
                .foregroundStyle(.ink2)
                .monospacedDigit()
                .lineLimit(1)
                .plainRow(insets: EdgeInsets(top: 0, leading: 16, bottom: 4, trailing: 16))

                if searching, visible.isEmpty {
                    ContentUnavailableView.search(text: router.query).plainRow()
                }

                ForEach(visible, id: \.day) { section in
                    Section {
                        ForEach(section.open) { EditableTaskRow(task: $0, editor: editor, focus: $focus, actions: actions) }
                        if editor.composerDay == section.day {
                            @Bindable var editor = editor
                            ComposerRow(title: $editor.newTitle, notes: $editor.newNotes, focus: $focus) {
                                editor.submitComposer(store: store, keepOpen: true, focus: $focus)
                            }
                            .listRowBackground(Color.surface3)
                        } else if section.open.isEmpty, section.completed.isEmpty {
                            Text("No tasks")
                                .font(.subheadline)
                                .foregroundStyle(.ink4)
                                .padding(.leading, 32)
                                .listRowBackground(Color.surface)
                        }
                        ForEach(section.completed) { EditableTaskRow(task: $0, editor: editor, focus: $focus, actions: actions) }
                    } header: {
                        DayHeader(day: section.day, today: today, tasks: store.tasks(on: section.day)) {
                            router.query = ""
                            editor.openComposer(on: section.day, store: store, focus: $focus)
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(.surface)
            .scrollDismissesKeyboard(.interactively)
            .readableContent()
            .animation(.snappy(duration: 0.35), value: sections.flatMap { $0.open.map(\.id) + ["|"] + $0.completed.map(\.id) })
            .navigationTitle(title)
            .searchable(text: $router.query, placement: .navigationBarDrawer, prompt: "Filter")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { AccountMenu(user: user) }
                ToolbarItemGroup(placement: .topBarTrailing) {
                    Button("Previous Week", systemImage: "chevron.left") { router.selected = router.selected.adding(days: -7) }
                    Button("Next Week", systemImage: "chevron.right") { router.selected = router.selected.adding(days: 7) }
                    Button("New Task", systemImage: "plus") {
                        router.query = ""
                        editor.openComposer(on: router.selected, store: store, focus: $focus)
                    }
                }
            }
            .keyboardDoneButton(focus: $focus)
            .onChange(of: router.composeRequest) { _, _ in
                if router.tab == .week { editor.openComposer(on: router.selected, store: store, focus: $focus) }
            }
            .modifier(ListKeyboard(tab: .week, ids: visible.flatMap { ($0.open + $0.completed).map(\.id) }, editor: editor, focus: $focus, actions: actions, proxy: proxy))
            }
            .toastHost()
        }
        .onChange(of: focus) { old, new in editor.focusChanged(from: old, to: new, store: store) }
        .onChange(of: start) { _, _ in editor.reset(store: store) }
        .task(id: start) {
            await store.load(start...start.adding(days: 6))
        }
    }
}

/// A day's header in Week: weekday, date, a Today badge, "x of y" and + to add a task that day.
private struct DayHeader: View {
    let day: DayKey
    let today: DayKey
    let tasks: [TaskItem]
    let add: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 8) {
            Text(Dates.dowFull[day.weekday])
                .font(.headline)
                .foregroundStyle(.ink)
            Text(Dates.short(day))
                .font(.subheadline)
                .foregroundStyle(.ink3)
            if day == today {
                Text("Today")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(palette.accentInk)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 2)
                    .background(palette.accentSoft, in: Capsule())
            }
            Spacer()
            if !tasks.isEmpty {
                Text("\(tasks.count(where: \.done)) of \(tasks.count)")
                    .font(.footnote)
                    .foregroundStyle(.ink3)
                    .monospacedDigit()
            }
            Button(action: add) {
                Image(systemName: "plus")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.ink2)
                    .frame(width: 32, height: 32)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add task to \(Dates.dowFull[day.weekday])")
        }
        .textCase(nil)
        .padding(.top, 8)
        .accessibilityElement(children: .contain)
    }
}
