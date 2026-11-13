import SwiftUI

/// The day: nothing but its tasks, in a column in the middle (edge to edge on iPhone). A new task (or speaking them)
/// starts at the top; what's left follows; earlier days and what's done fold away under it. The day's name, date, count
/// and Focus live in the bar above (the web's `DayView`).
struct DayScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Preferences.self) private var prefs
    @Environment(Toaster.self) private var toaster
    @Environment(AppModel.self) private var model
    @Environment(\.horizontalSizeClass) private var sizeClass

    @State private var editor = ListEditor()
    /// "From earlier days" is open, and how many of them show.
    @State private var earlierOpen = false
    @State private var earlierShown = DayEntry.firstEarlier
    /// The week and the earlier days have been asked for (the welcome waits for both, so it never flashes).
    @State private var weekLoaded = false
    @State private var earlierLoaded = false
    /// Speak is offered only where the server can sort speech into tasks (the app's one figure for the AI).
    private var speaks: Bool { AIOffer.shared.offered }
    @State private var width: CGFloat = 0
    /// iPhone: what's being written in the bar at the bottom.
    @State private var draft = ""
    @FocusState private var focus: TaskField?

    private var today: DayKey { clock.today }
    private var day: DayKey { router.selected }
    private var actions: TaskActions { TaskActions(store: store, toaster: toaster, today: today) }
    private var wide: Bool { sizeClass == .regular }

    /// First visit: a short welcome instead of an empty list (no tasks anywhere yet).
    private var showsWelcome: Bool {
        !prefs.welcomed && weekLoaded && earlierLoaded && store.tasks.isEmpty
    }

    var body: some View {
        Group {
            if showsWelcome {
                WelcomeNote(name: firstName, column: column, examples: addExamples) {
                    prefs.welcomed = true
                    openComposer(nil)
                }
            } else {
                list
            }
        }
        .background(.surface)
        .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { width = $0 }
        .onChange(of: focus) { old, new in editor.focusChanged(from: old, to: new, store: store, focus: $focus) }
        .onChange(of: day) { _, _ in
            editor.reset(store: store)
            earlierOpen = false
            earlierShown = DayEntry.firstEarlier
        }
        // Tasks written some other way (Speak) end the welcome too.
        .onChange(of: showsWelcome) { was, now in if was, !now { prefs.welcomed = true } }
        .task(id: day.startOfWeek) {
            await store.load(day.startOfWeek...day.startOfWeek.adding(days: 6))
            weekLoaded = true
            noteWelcomed()
        }
        .task(id: today) {
            // Today gathers every task left open on an earlier day, however long ago.
            await store.loadEarlier(before: today)
            earlierLoaded = true
            noteWelcomed()
        }
        .task { await askSpeak() }
    }

    // MARK: The list

    private var list: some View {
        let entries = entries()
        let visible = entries.compactMap(\.visibleTaskID)
        return ScrollViewReader { proxy in
            List {
                ForEach(entries) { row($0, proxy: proxy) }
                    // My order: a task dragged within the day takes the place it's dropped in.
                    .dropDestination(for: String.self) { ids, index in drop(ids, at: index, in: entries) }
            }
            .listStyle(.plain)
            .environment(\.defaultMinListRowHeight, 0)
            .scrollContentBackground(.hidden)
            // iPad: a column in the middle, as wide as the web's (744 points of rows, 24 at least on each side).
            .contentMargins(.horizontal, wide ? max(24, (width - Self.column) / 2) : 0, for: .scrollContent)
            .contentMargins(.top, wide ? 12 : 4, for: .scrollContent)
            .contentMargins(.bottom, wide ? 64 : 24, for: .scrollContent)
            .scrollDismissesKeyboard(.interactively)
            .keyboardDoneButton(focus: $focus)
            .modifier(ListKeyboard(tab: .day, ids: visible, editor: editor, focus: $focus, actions: actions, proxy: proxy))
            .onChange(of: router.composeRequest) { _, _ in
                if router.tab == .day { openComposer(proxy) }
            }
            // Each day is a list of its own (it starts at the top, and rows never shuffle over from the day before).
            .id(day)
            // iPhone: new tasks are written at the bottom, where the thumb is; the list scrolls under the bar.
            .safeAreaInset(edge: .bottom, spacing: 0) {
                if !wide {
                    DayComposerBar(text: $draft, focus: $focus, speaks: speaks) { addAtEnd(proxy) }
                }
            }
        }
    }

    /// The column's width on iPad (the web's 792 less its padding).
    static let column: CGFloat = 744

    private var column: CGFloat { wide ? Self.column : .infinity }

    @ViewBuilder
    private func row(_ entry: DayEntry, proxy: ScrollViewProxy) -> some View {
        switch entry.kind {
        case .leftOpen(let open):
            DayLeftOpenNotice(count: open.count) { actions.moveToToday(open) }
        case .newTask:
            if editor.composerDay == day {
                ComposerRow(
                    title: Binding(get: { editor.newTitle }, set: { editor.newTitle = $0 }),
                    notes: Binding(get: { editor.newNotes }, set: { editor.newNotes = $0 }),
                    focus: $focus,
                    run: editor.composerRun,
                    cancel: { editor.cancelComposer(focus: $focus) }
                ) {
                    editor.submitComposer(store: store, keepOpen: true, focus: $focus)
                }
            } else {
                DayNewTaskRow(speaks: speaks, hairline: entry.hairline) { openComposer(proxy) }
            }
        case .task(let task, let order):
            EditableTaskRow(task: task, editor: editor, focus: $focus, actions: actions, hairline: entry.hairline,
                            order: order.map { (up: $0.up, down: $0.down) })
                .modifier(TaskDrag(id: task.id, enabled: entry.draggable))
        case .cleared(let words):
            DayClearedLine(words: words)
        case .fold(let fold, let count, let open):
            DayFoldRow(label: fold.label, count: count, open: open, hairline: entry.hairline, identifier: fold.identifier) {
                toggle(fold)
            }
        case .earlierHead(let carried):
            DayEarlierHead(count: carried.count) { actions.moveToToday(carried) }
        case .earlier(let task, let edge):
            DayEarlierRow(task: task, edge: edge, today: today, foot: entry.foot) {
                editor.toggle(task, actions: actions, focus: $focus)
            } bring: {
                actions.move(task, to: today)
            } delete: {
                actions.delete(task)
            }
        case .more(let count):
            DayShowMore(count: count) {
                withAnimation(TaskActions.motion(Motion.out())) { earlierShown += DayEntry.moreEarlier }
            }
        }
    }

    // MARK: What the list shows

    /// The day's rows, top to bottom (`DayView` and `TaskTable` on the web).
    private func entries() -> [DayEntry] {
        let stored = store.tasks(on: day)
        // Tasks on their way to another day stay a moment longer, where they were.
        let here = Set(stored.map(\.id))
        let settling = editor.settling
        return DayEntry.rows(DayEntry.Input(
            day: day,
            today: today,
            stored: stored,
            leaving: editor.leaving.values.map(\.task).filter { $0.date == day && !here.contains($0.id) },
            settling: settling,
            sort: prefs.sort,
            newTaskRow: wide,
            composing: editor.composerDay == day,
            picked: Set([router.selectedTask, editor.editing].compactMap { $0 }),
            carried: day == today
                ? DayEntry.earlier(open: store.openBefore(today),
                                   ticked: settling.compactMap { store.task($0) }.filter { $0.date < today })
                : [],
            earlierOpen: earlierOpen,
            earlierShown: earlierShown,
            doneOpen: prefs.completedExpanded
        ))
    }

    // MARK: Doing

    private func openComposer(_ proxy: ScrollViewProxy?) {
        router.selectedTask = nil
        guard wide else {
            // iPhone: the bar at the bottom takes the keyboard.
            editor.finishEditing(store: store)
            Task { focus = .newTitle }
            return
        }
        editor.openComposer(on: day, store: store, focus: $focus)
        withAnimation(TaskActions.motion(Motion.settle)) { proxy?.scrollTo("new", anchor: .top) }
    }

    /// iPhone: Return in the bar adds the task at the end of the day's open tasks (a run keeps the order it was written
    /// in) and brings it into view just above the bar; the field stays open for the next one.
    private func addAtEnd(_ proxy: ScrollViewProxy) {
        let title = draft.trimmingCharacters(in: .whitespacesAndNewlines)
        draft = ""
        guard !title.isEmpty else { return }
        let last = store.openInOrder(on: day).last
        let added = withAnimation(TaskActions.motion(Motion.out())) {
            store.create(title: String(title.prefix(TaskItem.titleMax)), date: day, position: TaskSorting.placeBetween(last, nil))
        }
        Task {
            try? await Task.sleep(for: .milliseconds(60))
            // The field stays with the keyboard for the next one, whatever the list did meanwhile.
            if focus != .newTitle { focus = .newTitle }
            withAnimation(TaskActions.motion(Motion.settle)) { proxy.scrollTo(added.id, anchor: .bottom) }
        }
    }

    /// Folds open and close by height, as the web's lists do (240 ms; easing out to open, in to close).
    private func toggle(_ fold: DayEntry.Fold) {
        router.selectedTask = nil
        switch fold {
        case .earlier:
            let opening = !earlierOpen
            withAnimation(TaskActions.motion(opening ? Motion.out() : Motion.in(Tokens.Motion.base))) {
                earlierOpen = opening
                if !opening { earlierShown = DayEntry.firstEarlier }
            }
        case .done:
            let opening = !prefs.completedExpanded
            withAnimation(TaskActions.motion(opening ? Motion.out() : Motion.in(Tokens.Motion.base))) {
                prefs.completedExpanded = opening
            }
        }
    }

    /// A drag in My order: the task takes the place it was dropped in among the day's open tasks.
    private func drop(_ ids: [String], at index: Int, in entries: [DayEntry]) {
        guard prefs.sort.allowsReordering, let id = ids.first, let task = store.task(id), !task.done, task.date == day else { return }
        let at = entries.prefix(index).reduce(0) { n, entry in
            guard case .task(let t, _) = entry.kind, !t.done, t.id != id else { return n }
            return n + 1
        }
        actions.place(task, on: day, at: at)
    }

    /// The welcome's examples, on today (for a touch screen: tap, swipe, focus).
    private func addExamples() {
        let titles = [
            "Tick this off: tap the box, or swipe right",
            "Swipe me left to move me to tomorrow",
            "Tap the focus button to do one thing at a time",
        ]
        let now = (Date.now.timeIntervalSince1970 * 1000).rounded()
        withAnimation(TaskActions.motion(Motion.out())) {
            for (i, title) in titles.enumerated() { store.create(title: title, date: today, position: now + Double(i)) }
            prefs.welcomed = true
        }
    }

    /// Someone with tasks has nothing to be welcomed to.
    private func noteWelcomed() {
        if !prefs.welcomed, weekLoaded, earlierLoaded, !store.tasks.isEmpty { prefs.welcomed = true }
    }

    private var firstName: String {
        user.name.split(separator: " ").first.map(String.init) ?? "there"
    }

    /// Asks the server what it offers, unless it said so a moment ago.
    private func askSpeak() async {
        await AIOffer.shared.refreshIfStale(model.session.backend)
    }
}

/// Lets a task be picked up and dropped elsewhere in its day (a long press, then a drag; the menu shows if it stays).
private struct TaskDrag: ViewModifier {
    let id: String
    let enabled: Bool

    func body(content: Content) -> some View {
        if enabled { content.draggable(id) } else { content }
    }
}


/// One row of the day's list.
struct DayEntry: Identifiable {
    enum Kind {
        /// A past day: "2 left open on this day", with the way to bring them along.
        case leftOpen([TaskItem])
        /// "New task", or the new task being written.
        case newTask
        /// A task; its place in My order when it can move up or down.
        case task(TaskItem, Order?)
        /// One quiet sentence where nothing is left.
        case cleared(String)
        case fold(Fold, count: Int, open: Bool)
        /// The earlier days' first line, with "Move all to today".
        case earlierHead([TaskItem])
        case earlier(TaskItem, Edge)
        /// "Show 40 more".
        case more(Int)
    }

    enum Fold {
        case earlier, done

        var label: String { self == .earlier ? "From earlier days" : "Done" }
        var identifier: String { self == .earlier ? "fold.earlier" : "fold.done" }
    }

    /// Where a line sits in the earlier days' framed list.
    enum Edge { case only, first, middle, last }

    struct Order {
        let up: Bool
        let down: Bool
    }

    /// How many tasks from earlier days show at first, and how many more each "Show more" adds.
    static let firstEarlier = 12
    static let moreEarlier = 40

    let id: String
    let kind: Kind
    /// The hairline under it (where it has one): hidden over a picked row, whose edge takes its place.
    var hairline = true
    /// The last line of the earlier days' list: the fold's space under it.
    var foot = false
    /// A task row that can be picked up (My order). Every task row can, so a row keeps its identity — and the tick
    /// playing in it — as it travels into Done; only what's left takes a new place when dropped.
    var draggable = false

    /// A task the keyboard's ↑ ↓ go through (the list's own rows, not the earlier days').
    var visibleTaskID: String? {
        if case .task(let task, _) = kind { task.id } else { nil }
    }
}

extension DayEntry {
    /// What decides the day's rows.
    struct Input {
        var day: DayKey
        var today: DayKey
        /// The day's tasks, as the store has them.
        var stored: [TaskItem]
        /// Tasks on their way to another day, still shown where they were.
        var leaving: [TaskItem] = []
        /// Tasks just ticked: they stay with what's left while the tick plays.
        var settling: Set<String> = []
        var sort: TaskSort = .manual
        /// "New task" at the top (iPad, as the web); iPhone writes new tasks in the bar at the bottom.
        var newTaskRow = true
        var composing = false
        /// The picked task (and the one being edited).
        var picked: Set<String> = []
        /// Today: every task still open from an earlier day, in the order shown (`earlier(open:ticked:)`).
        var carried: [TaskItem] = []
        var earlierOpen = false
        var earlierShown = DayEntry.firstEarlier
        var doneOpen = true
    }

    /// The day's rows, top to bottom: what's left open on a past day; "New task"; what's left (or one sentence when
    /// nothing is); today's tasks from earlier days, folded; what's done, folded.
    static func rows(_ input: Input) -> [DayEntry] {
        let day = input.day, today = input.today
        let past = day < today
        let isToday = day == today
        let manual = input.sort.allowsReordering
        let sorted = TaskSorting.sorted(input.stored + input.leaving, by: input.sort)
        let open = sorted.filter { !$0.done || input.settling.contains($0.id) }
        let done = sorted.filter { $0.done && !input.settling.contains($0.id) }
        let leavingIDs = Set(input.leaving.map(\.id))
        // A row's hairline gives way to the edge of a picked row under it.
        let line = { (next: TaskItem?) in !(next.map { input.picked.contains($0.id) } ?? false) }

        var out: [DayEntry] = []
        let leftOpen = input.stored.filter { !$0.done }
        if past, !leftOpen.isEmpty { out.append(DayEntry(id: "left-open", kind: .leftOpen(leftOpen))) }

        if input.newTaskRow { out.append(DayEntry(id: "new", kind: .newTask, hairline: line(open.first))) }

        // My order: a task can go one place up or down among the open ones (not while its tick plays).
        let reorderable = open.filter { !$0.done && !leavingIDs.contains($0.id) }
        for (i, task) in open.enumerated() {
            var order: Order?
            if manual, let at = reorderable.firstIndex(where: { $0.id == task.id }) {
                order = Order(up: at > 0, down: at < reorderable.count - 1)
            }
            out.append(DayEntry(id: task.id, kind: .task(task, order), hairline: line(i + 1 < open.count ? open[i + 1] : nil),
                                draggable: manual))
        }

        if open.isEmpty, !input.composing {
            let words = input.stored.isEmpty
                ? past ? "Nothing was planned." : isToday ? "Nothing planned yet." : "Nothing planned for \(Dates.dayName(day)) yet."
                : isToday ? "All done for today." : "Everything on this day is done."
            out.append(DayEntry(id: "cleared", kind: .cleared(words)))
        }

        let carried = isToday ? input.carried : []
        if !carried.isEmpty {
            out.append(DayEntry(id: "fold.earlier", kind: .fold(.earlier, count: carried.count, open: input.earlierOpen)))
            if input.earlierOpen {
                out.append(DayEntry(id: "earlier.head", kind: .earlierHead(carried)))
                let shown = Array(carried.prefix(input.earlierShown))
                let more = carried.count - shown.count
                for (i, task) in shown.enumerated() {
                    let edge: Edge = shown.count == 1 ? .only : i == 0 ? .first : i == shown.count - 1 ? .last : .middle
                    out.append(DayEntry(id: task.id, kind: .earlier(task, edge), foot: i == shown.count - 1 && more == 0))
                }
                if more > 0 { out.append(DayEntry(id: "earlier.more", kind: .more(min(moreEarlier, more)))) }
            }
        }

        if !done.isEmpty {
            out.append(DayEntry(id: "fold.done", kind: .fold(.done, count: done.count, open: input.doneOpen),
                                hairline: !input.doneOpen || line(done[0])))
            if input.doneOpen {
                for (i, task) in done.enumerated() {
                    out.append(DayEntry(id: task.id, kind: .task(task, nil), hairline: line(i + 1 < done.count ? done[i + 1] : nil),
                                        draggable: manual))
                }
            }
        }
        return out
    }

    /// Every task left open on an earlier day (and one just ticked there, while its tick plays): the most recent day
    /// first, and within a day in the order they were added (`carried` on the web).
    static func earlier(open: [TaskItem], ticked: [TaskItem]) -> [TaskItem] {
        let listed = Set(open.map(\.id))
        let all = open + ticked.filter { !listed.contains($0.id) }
        return all.sorted { $0.date != $1.date ? $0.date > $1.date : TaskSorting.addedBefore($0, $1) }
    }
}
