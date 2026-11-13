import SwiftUI
import UIKit
import UniformTypeIdentifiers

// Pieces Week and Month share: the store's undoable actions with the web's messages, a task's menu, long words broken
// calmly, the card a dragged task becomes, and the small square controls of the web's rows and headers.

/// What Week and Month do with a task: the store's actions, each one undoable, with the web's message and Undo.
@MainActor
struct PlannerActions {
    let store: TaskStore
    let toaster: Toaster
    let today: DayKey

    var tomorrow: DayKey { today.adding(days: 1) }
    /// The first day of next week (`startOfWeek(today) + 7` on the web).
    var nextWeek: DayKey { today.startOfWeek.adding(days: 7) }

    /// Ticks a task or opens it again. As on the web there's no toast: ⌘Z takes it back.
    func toggle(_ task: TaskItem) {
        store.toggle(task.id)
    }

    func move(_ task: TaskItem, to day: DayKey) {
        guard let notice = store.moveTo(task.id, day, today: today) else { return }
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        announce(notice)
    }

    func delete(_ task: TaskItem) {
        guard let notice = store.delete(task.id) else { return }
        UIImpactFeedbackGenerator(style: .medium).impactOccurred()
        announce(notice)
    }

    /// A dropped task takes its place: `index` among the day's open tasks (nil: the end of another day).
    func place(_ id: String, on day: DayKey, at index: Int?) {
        let notice = store.place(id, on: day, at: index, today: today)
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
        announce(notice)
    }

    /// A new task at the top of its day, after the one written just before it (so a run lands in the order written).
    @discardableResult
    func create(_ title: String, on day: DayKey, after: String?) -> TaskItem? {
        let t = title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return nil }
        return store.createAtTop(title: String(t.prefix(TaskItem.titleMax)), date: day, after: after)
    }

    private func announce(_ notice: TaskStore.Notice?) {
        guard let notice else { return }
        if let step = notice.undo {
            toaster.show(notice.message, action: "Undo") { [store] in store.undo(step) }
        } else {
            toaster.show(notice.message)
        }
    }
}

/// A task's actions, as the web's menu (⋯ and the long press): done or open, edit, three moves, delete.
struct PlannerTaskMenu: View {
    let task: TaskItem
    let today: DayKey
    let toggle: () -> Void
    var edit: (() -> Void)?
    let move: (DayKey) -> Void
    let delete: () -> Void

    var body: some View {
        let tomorrow = today.adding(days: 1)
        let nextWeek = today.startOfWeek.adding(days: 7)
        Button(task.done ? "Mark as open" : "Mark as done", systemImage: task.done ? "square" : "checkmark.square", action: toggle)
        if let edit {
            Button("Edit", systemImage: "pencil", action: edit)
        }
        Divider()
        Button("Move to today", systemImage: "arrow.down.to.line") { move(today) }
            .disabled(task.date == today)
        Button("Move to tomorrow", systemImage: "arrow.right") { move(tomorrow) }
            .disabled(task.date == tomorrow)
        Button("Move to next week", systemImage: "arrow.right.to.line") { move(nextWeek) }
            .disabled(task.date == nextWeek)
        Divider()
        Button("Delete", systemImage: "trash", role: .destructive, action: delete)
    }
}

/// Long words in narrow columns break with a hyphen, but only words of ten letters or more, and never closer than four
/// letters to either end: never "li-brary" or "den-tist" (`hyphens-calm` on the web). The breaks are soft hyphens where
/// the word's language allows one; they show only when a line actually breaks there.
@MainActor
enum CalmHyphens {
    private static var cache: [String: String] = [:]
    private static var locales: [String: CFLocale] = [:]

    static func apply(_ text: String) -> String {
        if let known = cache[text] { return known }
        var out = ""
        var word = ""
        for ch in text {
            if ch.isLetter {
                word.append(ch)
            } else {
                out += hyphenated(word)
                word = ""
                out.append(ch)
            }
        }
        out += hyphenated(word)
        if cache.count > 400 { cache.removeAll() }
        cache[text] = out
        return out
    }

    private static func hyphenated(_ word: String) -> String {
        guard word.count >= 10, let locale = locale(for: word) else { return word }
        let cf = word as CFString
        let length = CFStringGetLength(cf)
        var breaks: Set<Int> = []
        var before = length
        while before > 0 {
            let at = CFStringGetHyphenationLocationBeforeIndex(cf, before, CFRange(location: 0, length: length), 0, locale, nil)
            if at == kCFNotFound || at <= 0 { break }
            if at >= 4, length - at >= 4 { breaks.insert(at) }
            before = at
        }
        guard !breaks.isEmpty else { return word }
        var out: [UInt16] = []
        for (i, unit) in word.utf16.enumerated() {
            if breaks.contains(i) { out.append(0x00AD) }
            out.append(unit)
        }
        return String(decoding: out, as: UTF16.self)
    }

    /// Cyrillic words by Russian rules, the rest by the device's language (or English where it has none).
    private static func locale(for word: String) -> CFLocale? {
        let cyrillic = word.unicodeScalars.contains { (0x0400...0x04FF).contains($0.value) }
        let preferred = cyrillic ? "ru" : (Locale.current.language.languageCode?.identifier ?? "en")
        for id in [preferred, "en"] {
            if let known = locales[id] { return known }
            if let made = CFLocaleCreate(nil, CFLocaleIdentifier(rawValue: id as CFString)), CFStringIsHyphenationAvailableForLocale(made) {
                locales[id] = made
                return made
            }
        }
        return nil
    }
}

/// Dragging tasks between days. The drag carries the task's title as text (so it reads well dropped into another app);
/// the screen remembers which task it started from.
@MainActor
enum TaskDrop {
    /// The drop goes ahead only if what arrives is that task's title: a drag that ended elsewhere leaves its task
    /// remembered, and text dragged in from another app must not move it.
    static func confirm(_ info: DropInfo, title: String, then commit: @escaping @MainActor () -> Void) {
        guard let provider = info.itemProviders(for: [.plainText]).first else { return }
        _ = provider.loadObject(ofClass: String.self) { text, _ in
            Task { @MainActor in
                if text == title { commit() }
            }
        }
    }

    /// What a drag of `task` carries.
    static func provider(for task: TaskItem) -> NSItemProvider {
        NSItemProvider(object: task.title as NSString)
    }
}

/// What a dragged task looks like under the finger: a lifted card with its box and its title (the web's drag ghost).
struct TaskDragPreview: View {
    let task: TaskItem
    var width: CGFloat = 260

    var body: some View {
        HStack(spacing: 12) {
            CheckCircle(checked: task.done, size: 18)
            Text(task.title)
                .font(.token(Tokens.Typography.body))
                .foregroundStyle(task.done ? .ink3 : .ink)
                .lineLimit(1)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(width: width, alignment: .leading)
        .background(.elevated, in: RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
    }
}

/// The small square with + that starts a new task (the mark of the web's "New task" lines).
struct PlusTile: View {
    var body: some View {
        Image(systemName: Icon.plus)
            .font(.system(size: 10, weight: .semibold))
            .foregroundStyle(.ink2)
            .frame(width: 18, height: 18)
            .background(.surface2, in: RoundedRectangle(cornerRadius: 6, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 6, style: .continuous).strokeBorder(.line, lineWidth: 1))
            .accessibilityHidden(true)
    }
}

/// "+" in a day's header: a 24-point tile with an edge, answering in a 44-point square.
struct DayPlusButton: View {
    let label: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: Icon.plus)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(.ink2)
                .frame(width: 24, height: 24)
                .background(.surface, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(.line2, lineWidth: 1))
                .padding(10)
                .contentShape(Rectangle())
        }
        .buttonStyle(PressableStyle())
        .padding(-10)
        .accessibilityLabel(label)
    }
}

extension Binding where Value == String {
    /// A field where Return means "add" or "done" (a text field that grows takes Return as a new line): a line break
    /// typed on its own runs `onReturn`; pasted line breaks become spaces. Titles stay within what the server takes.
    @MainActor
    func returnSubmits(_ onReturn: @escaping @MainActor () -> Void) -> Binding<String> {
        let base = self
        return Binding(
            get: { base.wrappedValue },
            set: { next in
                guard next.contains("\n") else {
                    base.wrappedValue = String(next.prefix(TaskItem.titleMax))
                    return
                }
                let old = base.wrappedValue
                if next.count == old.count + 1, next.replacingOccurrences(of: "\n", with: "") == old {
                    onReturn()
                } else {
                    base.wrappedValue = String(next.replacingOccurrences(of: "\n", with: " ").prefix(TaskItem.titleMax))
                }
            }
        )
    }
}
