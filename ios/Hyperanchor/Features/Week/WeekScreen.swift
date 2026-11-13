import SwiftUI

/// The week, from edge to edge of the work area (`WeekView` on the web): seven lanes side by side where they fit (iPad),
/// a list of days elsewhere. Which week it is, and the way to others, is in the bar above; the order within a day is the
/// person's (Settings → Task order), and the week starts on the day they chose.
struct WeekScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(Preferences.self) private var prefs
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    @State private var state = WeekState()
    @FocusState private var focus: WeekField?

    var body: some View {
        // The first day of the week comes from Settings (`DayKey.weekStart`); reading it here redraws the week when it
        // changes.
        let _ = prefs.weekStart
        let start = router.selected.startOfWeek
        let days = WeekDay.week(from: start, store: store, sort: prefs.sort, settling: state.settling)
        let work = WeekWork(store: store, router: router, state: state,
                            actions: PlannerActions(store: store, toaster: toaster, today: clock.today),
                            sort: prefs.sort, week: start...start.adding(days: 6), reduceMotion: reduceMotion, focus: $focus)
        GeometryReader { geo in
            // Measured before anything is drawn, so the week never flashes up in the wrong layout. Huge text gets the
            // list, where titles have the whole width.
            if sizeClass == .regular, !typeSize.isAccessibilitySize, geo.size.width >= WeekBoard.minimumWidth {
                WeekBoard(days: days, work: work, size: geo.size)
            } else {
                WeekList(days: days, work: work)
            }
        }
        .background(.surface)
        .modifier(WeekKeys(ids: days.flatMap { ($0.open + $0.done).map(\.id) }, work: work))
        .onChange(of: focus) { old, new in work.focusChanged(from: old, to: new) }
        .onChange(of: start) { _, _ in work.reset() }
        .onChange(of: router.composeRequest) { _, _ in
            if router.tab == .week { work.openComposer(on: router.selected) }
        }
        .onChange(of: router.toggleRequest) { _, request in
            guard router.tab == .week, let request, let task = store.task(request.id) else { return }
            work.toggle(task)
        }
        .onChange(of: router.editRequest) { _, request in
            guard router.tab == .week, let request, let task = store.task(request.id) else { return }
            work.startEditing(task)
        }
        .task(id: start) {
            await store.load(start...start.adding(days: 6))
        }
    }
}

/// A hardware keyboard in Week, as on the web: ↑ ↓ pick the task above or below (in screen order, day by day), Space
/// ticks it, Return edits it, ⌫ deletes it, Esc lets it go, ⌥↑ / ⌥↓ move it within its day. The week takes the
/// keyboard whenever no field has it, so the arrows reach it before the system's focus navigation.
private struct WeekKeys: ViewModifier {
    let ids: [String]
    let work: WeekWork

    @Environment(AppModel.self) private var model
    @FocusState private var focused: Bool

    func body(content: Content) -> some View {
        content
            .focusable()
            .focusEffectDisabled()
            .focused($focused)
            .onKeyPress(keys: [.upArrow, .downArrow, .space, .return, .delete, .escape]) { press in
                guard work.focus.wrappedValue == nil, work.router.tab == .week else { return .ignored }
                let keys = model.keyboard
                switch press.key {
                case .upArrow, .downArrow:
                    let direction = press.key == .upArrow ? -1 : 1
                    if press.modifiers.contains(.option) { work.nudge(direction) } else { keys.select(direction) }
                case .space: keys.complete()
                case .return: keys.edit()
                case .delete: keys.delete()
                case .escape: keys.escape()
                default: return .ignored
                }
                return .handled
            }
            .onAppear { focused = true }
            .onChange(of: work.focus.wrappedValue) { _, field in if field == nil { focused = true } }
            .onChange(of: ids, initial: true) { _, ids in publish(ids) }
            .onChange(of: work.router.tab) { _, tab in
                if tab == .week {
                    focused = true
                    publish(ids)
                }
            }
    }

    /// The tasks on screen, in order, for ↑ ↓. A selection that left the week is dropped, so keys never act unseen.
    private func publish(_ ids: [String]) {
        guard work.router.tab == .week else { return }
        work.router.visibleTaskIDs = ids
        if let selected = work.router.selectedTask, !ids.contains(selected) { work.router.selectedTask = nil }
    }
}
