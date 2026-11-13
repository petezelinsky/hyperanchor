import SwiftUI
import UIKit

/// Keyboard shortcuts, as on the web (TaskApp.tsx): N new task, V speak, F focus, / and ⌘K search, T today, ← → the day
/// (week, month, period) before and after, D W M the planner's views, A Progress, [ the sidebar, ⌘Z undo, ↑ ↓ pick a
/// task, ⌥↑ ⌥↓ move it, Space done, Return edit, ⌫ delete, Esc deselect, "," Settings, "?" the shortcut list.
/// Declared as menu commands, so iPadOS lists them while ⌘ is held (and in the menu bar). Plain keys stand aside while a
/// text field is being typed in; ⌘Z then undoes the typing, as it always does.
struct AppCommands: Commands {
    let model: AppModel

    var body: some Commands {
        let keys = model.keyboard
        // Plain keys (no ⌘): only while nothing is being typed and no window is over the page.
        let plain = keys.signedIn && !TypingWatch.shared.active
        CommandGroup(replacing: .appSettings) {
            Button("Settings…") { keys.settings() }
                .keyboardShortcut(",", modifiers: [])
                .disabled(!plain || !keys.onPage)
        }
        CommandGroup(replacing: .newItem) {
            Button("New task") { keys.newTask() }
                .keyboardShortcut("n", modifiers: [])
                .disabled(!plain || keys.covered)
            Button("Speak your tasks") { keys.speak() }
                .keyboardShortcut("v", modifiers: [])
                .disabled(!plain || !keys.onPage || !keys.speakOffered)
        }
        CommandGroup(replacing: .undoRedo) {
            Button("Undo") { keys.undo() }
                .keyboardShortcut("z", modifiers: .command)
                .disabled(!keys.canUndo)
            Button("Redo") { keys.redo() }
                .keyboardShortcut("z", modifiers: [.command, .shift])
                .disabled(!TypingWatch.shared.active)
        }
        CommandMenu("Go") {
            Button("Search all tasks") { keys.search() }
                .keyboardShortcut("k", modifiers: .command)
                .disabled(!keys.signedIn || !keys.onPage)
            Button("Search") { keys.search() }
                .keyboardShortcut("/", modifiers: [])
                .disabled(!plain || !keys.onPage)
            Divider()
            ForEach([Router.Tab.day, .week, .month, .analytics], id: \.self) { tab in
                Button(tab.label) { keys.show(tab) }
                    .keyboardShortcut(KeyEquivalent(Character(String(tab.rawValue.prefix(1)))), modifiers: [])
                    .disabled(!plain || keys.covered)
            }
            Divider()
            Button("Today") { keys.today() }
                .keyboardShortcut("t", modifiers: [])
                .disabled(!plain || !keys.onPage)
            // In focus, → puts the task off (the focus screen takes the arrows itself).
            Button("Previous") { keys.step(-1) }
                .keyboardShortcut(.leftArrow, modifiers: [])
                .disabled(!plain || !keys.onPage)
            Button("Next") { keys.step(1) }
                .keyboardShortcut(.rightArrow, modifiers: [])
                .disabled(!plain || !keys.onPage)
            Divider()
            Button("Focus") { keys.focus() }
                .keyboardShortcut("f", modifiers: [])
                .disabled(!plain || keys.covered)
            Button("Show or hide the sidebar") { keys.toggleSidebar() }
                .keyboardShortcut("[", modifiers: [])
                .disabled(!plain || !keys.onPage || !keys.hasSidebar)
        }
        CommandMenu("Task") {
            Button("Select previous") { keys.select(-1) }
                .keyboardShortcut(.upArrow, modifiers: [])
                .disabled(!plain || !keys.onPage)
            Button("Select next") { keys.select(1) }
                .keyboardShortcut(.downArrow, modifiers: [])
                .disabled(!plain || !keys.onPage)
            Button("Move up") { keys.nudge(-1) }
                .keyboardShortcut(.upArrow, modifiers: .option)
                .disabled(!plain || !keys.canNudge)
            Button("Move down") { keys.nudge(1) }
                .keyboardShortcut(.downArrow, modifiers: .option)
                .disabled(!plain || !keys.canNudge)
            Divider()
            Button("Complete") { keys.complete() }
                .keyboardShortcut(.space, modifiers: [])
                .disabled(!plain || keys.covered)
            Button("Edit the title") { keys.edit() }
                .keyboardShortcut(.return, modifiers: [])
                .disabled(!plain || !keys.onPage)
            Button("Delete") { keys.delete() }
                .keyboardShortcut(.delete, modifiers: [])
                .disabled(!plain || !keys.onPage)
            Button("Deselect") { keys.escape() }
                .keyboardShortcut(.escape, modifiers: [])
                .disabled(!plain || !keys.onPage)
            Divider()
            Button("Keyboard shortcuts") { keys.shortcuts() }
                .keyboardShortcut("?", modifiers: .shift)
                .disabled(!plain || !keys.onPage)
        }
    }
}

/// What the shortcuts do, against the app's state.
@MainActor
struct KeyboardActions {
    let model: AppModel

    var signedIn: Bool { model.store != nil }
    private var router: Router { model.router }

    /// Something covers the page: a sheet (Settings, Search, the month to pick a day from) or the voice screen.
    /// Focus is not counted: it takes its own keys (Space, N, F, Esc).
    var covered: Bool { router.showSettings || router.showSearch || router.showDayPicker || router.showSpeak || router.showAccount }
    /// The page itself has the keyboard: nothing over it, not even focus.
    var onPage: Bool { !covered && !router.focus }
    var speakOffered: Bool { AIOffer.shared.voice == true }
    var hasSidebar: Bool { UIDevice.current.userInterfaceIdiom == .pad }
    var canUndo: Bool { TypingWatch.shared.active || (onPage && (model.store?.undoCount ?? 0) > 0) }
    var canNudge: Bool {
        onPage && (router.tab == .day || router.tab == .week) && router.selectedTask != nil && model.prefs.sort == .manual
    }

    func show(_ tab: Router.Tab) {
        router.show(tab)
    }

    func today() {
        router.selectedTask = nil
        router.goToToday(model.clock.today)
    }

    func step(_ direction: Int) {
        router.selectedTask = nil
        router.step(direction)
    }

    func newTask() {
        if router.focus { router.focusCaptureRequest = UUID(); return }
        router.newTask()
    }

    func speak() {
        router.showSpeak = true
    }

    func search() {
        router.showSearch = true
    }

    func focus() {
        if router.focus { router.focus = false; return }
        router.startFocus(hasOpen: model.store?.tasks(on: router.selected).contains { !$0.done } == true)
    }

    func toggleSidebar() {
        withAnimation(Motion.choose(Motion.out(), reduceMotion: UIAccessibility.isReduceMotionEnabled)) { model.prefs.sidebarHidden.toggle() }
    }

    func settings() { router.openSettings() }
    func shortcuts() { router.openSettings(.shortcuts) }

    /// ⌘Z (and shaking the iPhone): while typing, the text's own undo; otherwise the last action, and a toast saying
    /// what was taken back.
    func undo() {
        if TypingWatch.shared.active {
            UIResponder.current?.undoManager?.undo()
            return
        }
        guard let store = model.store, let done = store.undoLast() else { return }
        model.toaster.show(done)
    }

    func redo() {
        guard TypingWatch.shared.active else { return }
        UIResponder.current?.undoManager?.redo()
    }

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

    /// ⌥↑ / ⌥↓: the picked task one place up or down its day, in the person's own order (the list carries it out).
    func nudge(_ direction: Int) {
        guard canNudge, let id = router.selectedTask, model.store?.task(id)?.done == false else { return }
        router.nudgeRequest = NudgeRequest(id: id, direction: direction)
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

/// Whether a text field or text view is being typed in: plain-key shortcuts stand aside, ⌘Z undoes the typing and a shake
/// is the system's own "Undo Typing".
@MainActor
@Observable
final class TypingWatch {
    static let shared = TypingWatch()
    private(set) var active = false
    @ObservationIgnored private var observers: [NSObjectProtocol] = []

    private init() {
        let changes: [(Notification.Name, Bool)] = [
            (UITextField.textDidBeginEditingNotification, true), (UITextField.textDidEndEditingNotification, false),
            (UITextView.textDidBeginEditingNotification, true), (UITextView.textDidEndEditingNotification, false),
        ]
        for (name, typing) in changes {
            observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
                MainActor.assumeIsolated { self?.active = typing }
            })
        }
    }
}

extension UIResponder {
    private static weak var found: UIResponder?

    /// The first responder (the field being typed in), found by sending an action with no target.
    static var current: UIResponder? {
        found = nil
        UIApplication.shared.sendAction(#selector(captureFirstResponder), to: nil, from: nil, for: nil)
        return found
    }

    @objc private func captureFirstResponder() {
        UIResponder.found = self
    }
}

extension Notification.Name {
    /// The device was shaken (outside text): MainView offers to undo the last action.
    static let deviceDidShake = Notification.Name("app.hyperanchor.deviceDidShake")
}

extension UIWindow {
    /// A shake undoes, as everywhere on iOS. While typing, the system's own "Undo Typing"; otherwise MainView asks to take
    /// back the last action.
    override open func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        if motion == .motionShake, !TypingWatch.shared.active {
            NotificationCenter.default.post(name: .deviceDidShake, object: nil)
            return
        }
        super.motionEnded(motion, with: event)
    }
}
