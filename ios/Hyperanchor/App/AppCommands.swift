import SwiftUI

/// Keyboard shortcuts, as on the web: N new task, T today, D W M A views, F focus, ← → previous / next,
/// ↑ ↓ select, Space done, Return edit, ⌫ delete, Esc deselect, "," settings, "?" the shortcut list.
/// Declared as menu commands, so iPadOS lists them when ⌘ is held (and in the menu bar). Plain keys
/// don't fire while a text field is being typed in.
struct AppCommands: Commands {
    let model: AppModel

    var body: some Commands {
        CommandGroup(replacing: .appSettings) {
            Button("Settings…") { model.keyboard.settings() }
                .keyboardShortcut(",", modifiers: [])
                .disabled(!model.keyboard.signedIn)
        }
        CommandGroup(replacing: .newItem) {
            Button("New Task") { model.keyboard.newTask() }
                .keyboardShortcut("n", modifiers: [])
                .disabled(!model.keyboard.signedIn)
        }
        CommandMenu("View") {
            ForEach(Router.Tab.allCases, id: \.self) { tab in
                Button(tab.label) { model.keyboard.show(tab) }
                    .keyboardShortcut(KeyEquivalent(Character(String(tab.rawValue.prefix(1)))), modifiers: [])
            }
            Divider()
            Button("Today") { model.keyboard.today() }
                .keyboardShortcut("t", modifiers: [])
            Button("Previous") { model.keyboard.step(-1) }
                .keyboardShortcut(.leftArrow, modifiers: [])
            Button("Next") { model.keyboard.step(1) }
                .keyboardShortcut(.rightArrow, modifiers: [])
            Divider()
            Button("Focus") { model.keyboard.focus() }
                .keyboardShortcut("f", modifiers: [])
        }
        CommandMenu("Task") {
            Button("Select Previous") { model.keyboard.select(-1) }
                .keyboardShortcut(.upArrow, modifiers: [])
            Button("Select Next") { model.keyboard.select(1) }
                .keyboardShortcut(.downArrow, modifiers: [])
            Divider()
            Button("Complete") { model.keyboard.complete() }
                .keyboardShortcut(.space, modifiers: [])
            Button("Edit") { model.keyboard.edit() }
                .keyboardShortcut(.return, modifiers: [])
            Button("Delete") { model.keyboard.delete() }
                .keyboardShortcut(.delete, modifiers: [])
            Button("Deselect") { model.keyboard.escape() }
                .keyboardShortcut(.escape, modifiers: [])
            Divider()
            Button("Keyboard Shortcuts") { model.keyboard.help() }
                .keyboardShortcut("?", modifiers: .shift)
        }
    }
}

/// What the shortcuts do, against the app's state.
@MainActor
struct KeyboardActions {
    let model: AppModel

    var signedIn: Bool { model.store != nil }
    private var router: Router { model.router }

    func show(_ tab: Router.Tab) {
        router.focus = false
        router.selectedTask = nil
        if tab == .month { router.month = router.selected.startOfMonth }
        router.tab = tab
    }

    func today() {
        router.goToToday(model.clock.today)
    }

    func step(_ direction: Int) {
        guard !router.focus else { return }
        router.step(direction)
    }

    func newTask() {
        if router.focus { router.focusCaptureRequest = UUID(); return }
        router.newTask()
    }

    func focus() {
        if router.focus { router.focus = false; return }
        if router.tab != .day { show(.day) }
        if model.store?.tasks(on: router.selected).contains(where: { !$0.done }) == true { router.focus = true }
    }

    func settings() { router.showSettings = true }
    func help() { router.showShortcuts = true }

    /// ↑ / ↓ through the list on screen (Day or Week).
    func select(_ direction: Int) {
        let ids = router.visibleTaskIDs
        guard !router.focus, router.tab == .day || router.tab == .week, !ids.isEmpty else { return }
        if let current = router.selectedTask, let i = ids.firstIndex(of: current) {
            router.selectedTask = ids[min(ids.count - 1, max(0, i + direction))]
        } else {
            router.selectedTask = direction > 0 ? ids.first : ids.last
        }
    }

    /// Space: the selected task — or, in focus mode, the task in focus.
    func complete() {
        guard let store = model.store else { return }
        if router.focus {
            router.focusCompleteRequest = UUID()
            return
        }
        guard let id = router.selectedTask, store.task(id) != nil else { return }
        router.toggleRequest = TaskRequest(id: id)
    }

    func edit() {
        guard !router.focus, let id = router.selectedTask else { return }
        router.editRequest = TaskRequest(id: id)
    }

    func delete() {
        guard !router.focus, let store = model.store, let id = router.selectedTask, let task = store.task(id) else { return }
        // The selection moves on to the neighbor, as on the web.
        let ids = router.visibleTaskIDs
        if let i = ids.firstIndex(of: id) {
            router.selectedTask = i + 1 < ids.count ? ids[i + 1] : (i > 0 ? ids[i - 1] : nil)
        }
        TaskActions(store: store, toaster: model.toaster, today: model.clock.today).delete(task)
    }

    func escape() {
        if router.focus { router.focus = false } else { router.selectedTask = nil }
    }
}

extension AppModel {
    var keyboard: KeyboardActions { KeyboardActions(model: self) }
}
