import SwiftUI

/// The selected day: what's left under "To do", finished tasks in a collapsible "Completed" group.
struct DayScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Preferences.self) private var prefs
    @Environment(Toaster.self) private var toaster
    @Environment(\.palette) private var palette

    @State private var editor = ListEditor()
    @State private var confetti = 0
    @FocusState private var focus: TaskField?

    private var today: DayKey { clock.today }
    private var day: DayKey { router.selected }
    private var actions: TaskActions { TaskActions(store: store, toaster: toaster, today: today) }

    var body: some View {
        @Bindable var router = router
        @Bindable var editor = editor
        let all = store.tasks(on: day)
        let filtered = TaskSorting.sorted(all.filter { TaskSorting.matches($0, query: router.query) }, by: router.sort)
        let open = filtered.filter { !$0.done || editor.isSettling($0.id) }
        let completed = filtered.filter { $0.done && !editor.isSettling($0.id) }
        let doneCount = all.count(where: \.done)
        let allDone = !all.isEmpty && doneCount == all.count
        let searching = !router.query.trimmingCharacters(in: .whitespaces).isEmpty
        let composing = editor.composerDay == day

        NavigationStack {
            ScrollViewReader { proxy in
                List {
                    header(all: all, done: doneCount, allDone: allDone)
                    if !searching { notices(open: all.filter { !$0.done }) }

                    if all.isEmpty, !composing, !searching {
                        EmptyDay(past: day < today) { openComposer(proxy) }
                            .plainRow()
                    } else if searching, filtered.isEmpty {
                        ContentUnavailableView.search(text: router.query)
                            .plainRow()
                    } else {
                        Section {
                            ForEach(open) { row($0) }
                            if open.isEmpty, !completed.isEmpty, !searching {
                                ClearedRow(isToday: day == today)
                            }
                            if !searching {
                                if composing {
                                    ComposerRow(title: $editor.newTitle, notes: $editor.newNotes, focus: $focus) {
                                        editor.submitComposer(store: store, keepOpen: true, focus: $focus)
                                    }
                                    .id("composer")
                                    .listRowBackground(Color.surface3)
                                } else {
                                    AddTaskRow { openComposer(proxy) }
                                        .listRowBackground(Color.surface)
                                }
                            }
                        } header: {
                            SectionHeader(title: "To do", count: open.count(where: { !$0.done }))
                        }

                        if !completed.isEmpty {
                            Section {
                                if prefs.completedExpanded {
                                    ForEach(completed) { row($0) }
                                }
                            } header: {
                                CompletedHeader(count: completed.count, expanded: prefs.completedExpanded) {
                                    withAnimation(.snappy) { prefs.completedExpanded.toggle() }
                                }
                            }
                        }
                    }
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(.surface)
                .scrollDismissesKeyboard(.interactively)
                .readableContent()
                .animation(.snappy(duration: 0.35), value: open.map(\.id))
                .animation(.snappy(duration: 0.35), value: completed.map(\.id))
                .navigationTitle(Dates.relative(day, today: today) ?? Dates.dowFull[day.weekday])
                .searchable(text: $router.query, placement: .navigationBarDrawer, prompt: "Filter")
                .toolbar { toolbar(hasOpen: all.contains { !$0.done }, proxy: proxy) }
                .keyboardDoneButton(focus: $focus)
                .overlay { ConfettiView(trigger: confetti) }
                .onChange(of: router.composeRequest) { _, _ in
                    if router.tab == .day { openComposer(proxy) }
                }
                .modifier(ListKeyboard(tab: .day, ids: (open + (prefs.completedExpanded ? completed : [])).map(\.id), editor: editor, focus: $focus, actions: actions, proxy: proxy))
            }
            .toastHost()
        }
        .onChange(of: focus) { old, new in editor.focusChanged(from: old, to: new, store: store) }
        .onChange(of: allDone) { was, now in
            if now, !was, editor.justToggled { confetti += 1 }
        }
        .onChange(of: day) { _, _ in editor.reset(store: store) }
        .task(id: day.startOfWeek) {
            await store.load(day.startOfWeek...day.startOfWeek.adding(days: 6))
        }
        .task(id: today) {
            // Today gathers what was left open during the past week.
            await store.load(today.adding(days: -7)...today.adding(days: -1))
        }
    }

    // MARK: Pieces

    @ViewBuilder
    private func header(all: [TaskItem], done: Int, allDone: Bool) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 6) {
                let relative = Dates.relative(day, today: today) != nil
                let year = day.year != today.year ? ", \(day.year)" : ""
                Text((relative ? Dates.long(day) : "\(Dates.months[day.month - 1]) \(day.day)") + year)
                Text("·").foregroundStyle(.ink4)
                if all.isEmpty {
                    Text("No tasks")
                } else {
                    Burst(active: allDone && editor.justToggled) {
                        ProgressRing(value: Double(done) / Double(all.count), size: 14, lineWidth: 2.4)
                    }
                    Text(allDone ? "All done" : "\(done) of \(all.count) done")
                        .fontWeight(allDone ? .medium : .regular)
                        .foregroundStyle(allDone ? .ink : .ink2)
                }
                Spacer(minLength: 8)
                if day != today {
                    Button("Today") { router.selected = today }
                        .buttonStyle(SecondaryButtonStyle(compact: true))
                        .accessibilityIdentifier("day.today")
                }
            }
            .font(.subheadline)
            .foregroundStyle(.ink2)
            .monospacedDigit()
            .lineLimit(1)

            WeekStrip(selected: day, today: today) { router.selected = $0 }
        }
        .plainRow(insets: EdgeInsets(top: 0, leading: 16, bottom: 8, trailing: 16))
    }

    @ViewBuilder
    private func notices(open: [TaskItem]) -> some View {
        if day < today, !open.isEmpty {
            Notice(text: open.count == 1 ? "1 task was left open on this day." : "\(open.count) tasks were left open on this day.") {
                actions.moveToToday(open)
            }
        }
        if day == today {
            let carried = store.openTasks(in: today.adding(days: -7)...today.adding(days: -1))
            if !carried.isEmpty {
                Notice(
                    text: carried.count == 1 ? "1 task is still open from earlier days" : "\(carried.count) tasks are still open from earlier days",
                    detail: carried.map(\.title).joined(separator: ", ")
                ) {
                    actions.moveToToday(carried)
                }
            }
        }
    }

    private func row(_ task: TaskItem) -> some View {
        EditableTaskRow(task: task, editor: editor, focus: $focus, actions: actions)
    }

    @ToolbarContentBuilder
    private func toolbar(hasOpen: Bool, proxy: ScrollViewProxy) -> some ToolbarContent {
        @Bindable var router = router
        ToolbarItem(placement: .topBarLeading) {
            AccountMenu(user: user)
        }
        ToolbarItemGroup(placement: .topBarTrailing) {
            Button("Focus", systemImage: "scope") { router.focus = true }
                .disabled(!hasOpen)
                .accessibilityHint("One task at a time")
                .accessibilityIdentifier("focus")
            Menu("Sort", systemImage: "arrow.up.arrow.down") {
                Picker("Sort by", selection: $router.sort) {
                    ForEach(SortOption.allCases) { Text($0.label).tag($0) }
                }
            }
            .accessibilityIdentifier("sort")
            Button("New Task", systemImage: "plus") { openComposer(proxy) }
                .accessibilityIdentifier("newTask")
        }
    }

    private func openComposer(_ proxy: ScrollViewProxy) {
        router.query = ""
        editor.openComposer(on: day, store: store, focus: $focus)
        Task {
            try? await Task.sleep(for: .milliseconds(100))
            withAnimation { proxy.scrollTo("composer", anchor: .center) }
        }
    }
}

/// A task row wired to a list's editor: tap to edit in place, swipe and long-press actions.
struct EditableTaskRow: View {
    let task: TaskItem
    let editor: ListEditor
    var focus: FocusState<TaskField?>.Binding
    let actions: TaskActions
    @Environment(\.palette) private var palette
    @Environment(Router.self) private var router

    var body: some View {
        let isEditing = editor.editing == task.id
        let isSelected = router.selectedTask == task.id
        TaskRow(
            task: task,
            isEditing: isEditing,
            focus: focus,
            toggle: toggle,
            startEditing: { editor.startEditing(task, field: $0, store: actions.store, focus: focus) },
            change: { actions.store.edit(task.id, $0, debounce: true) },
            commit: { focus.wrappedValue = nil }
        )
        .listRowBackground(isEditing || isSelected ? Color.surface3 : Color.surface)
        .taskSwipeActions(task, actions: actions, accent: palette.accent, toggle: toggle)
        .contextMenu {
            TaskMenuItems(task: task, actions: actions, toggle: toggle) {
                editor.startEditing(task, field: .title(task.id), store: actions.store, focus: focus)
            }
        }
        .accessibilityIdentifier("task.\(task.title)")
    }

    private func toggle() { editor.toggle(task, actions: actions, focus: focus) }
}

/// "Completed 3 ⌄" — collapses the group; remembered.
struct CompletedHeader: View {
    let count: Int
    let expanded: Bool
    let toggle: () -> Void

    var body: some View {
        Button(action: toggle) {
            HStack(spacing: 6) {
                SectionHeader(title: "Completed", count: count)
                Image(systemName: "chevron.down")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.ink3)
                    .rotationEffect(.degrees(expanded ? 0 : -90))
                Spacer()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Completed, \(count)")
        .accessibilityValue(expanded ? "Expanded" : "Collapsed")
        .accessibilityIdentifier("completed.toggle")
    }
}

extension View {
    /// A "Done" button above the keyboard.
    func keyboardDoneButton(focus: FocusState<TaskField?>.Binding) -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                Spacer()
                Button("Done") { focus.wrappedValue = nil }.fontWeight(.semibold)
            }
        }
    }
}

// MARK: - Small pieces

extension View {
    /// A list row without background or separators, for headers, notices and empty states.
    func plainRow(insets: EdgeInsets = EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16)) -> some View {
        listRowInsets(insets)
            .listRowSeparator(.hidden)
            .listRowBackground(Color.surface)
    }
}

/// "To do 3"
struct SectionHeader: View {
    let title: String
    let count: Int

    var body: some View {
        HStack(spacing: 6) {
            Text(title).fontWeight(.semibold).foregroundStyle(.ink)
            Text("\(count)").foregroundStyle(.ink3).monospacedDigit()
        }
        .font(.subheadline)
        .textCase(nil)
    }
}

/// A quiet one-line notice above the list, with "Move to Today".
struct Notice: View {
    let text: String
    var detail: String?
    let action: () -> Void

    var body: some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 12) { label; button }
            VStack(alignment: .leading, spacing: 10) { label; button }
        }
        .padding(.vertical, 10)
        .padding(.horizontal, 14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(.line))
        .plainRow(insets: EdgeInsets(top: 4, leading: 16, bottom: 12, trailing: 16))
        .transition(.opacity.combined(with: .move(edge: .top)))
    }

    private var label: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(text).foregroundStyle(detail == nil ? .ink2 : .ink)
            if let detail {
                Text(detail).font(.footnote).foregroundStyle(.ink3).lineLimit(1)
            }
        }
        .font(.subheadline)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var button: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text("Move to Today")
                Image(systemName: "arrow.right").font(.caption.weight(.semibold))
            }
        }
        .buttonStyle(SecondaryButtonStyle(compact: true))
        .fixedSize()
        .accessibilityIdentifier("moveToToday")
    }
}

/// Shown in place of the To do list once everything is done.
struct ClearedRow: View {
    let isToday: Bool
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "checkmark")
                .font(.system(size: 10, weight: .bold))
                .foregroundStyle(.onAccent)
                .frame(width: 20, height: 20)
                .background(palette.accent, in: Circle())
            Text(isToday ? "All done for today. Nice work!" : "Everything on this day is done.")
                .foregroundStyle(.ink2)
        }
        .font(.body)
        .padding(.vertical, 4)
        .listRowBackground(Color.surface)
        .transition(.opacity)
        .accessibilityElement(children: .combine)
    }
}

/// Nothing planned: an invitation to add the first task.
struct EmptyDay: View {
    let past: Bool
    let add: () -> Void
    @Environment(\.palette) private var palette

    var body: some View {
        VStack(spacing: 0) {
            Image(systemName: "sun.max")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(palette.accentInk)
                .frame(width: 56, height: 56)
                .background(palette.accentSoft, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            Text(past ? "Nothing was planned" : "Nothing planned yet")
                .font(.headline)
                .foregroundStyle(.ink)
                .padding(.top, 16)
            Text("Tap + to add one.")
                .font(.subheadline)
                .foregroundStyle(.ink2)
                .padding(.top, 6)
            Button(action: add) {
                Label("Add a task", systemImage: "plus")
            }
            .buttonStyle(SecondaryButtonStyle(compact: true))
            .padding(.top, 20)
            .accessibilityIdentifier("empty.add")
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
    }
}
