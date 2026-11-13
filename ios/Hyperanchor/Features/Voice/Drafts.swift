import Foundation

/// The tasks understood from what was said (or typed), while they are looked over: each can be reworded, moved to
/// another day or left out, and only what is added becomes a task. Speaking more adds to the ones already here.
struct DraftList: Equatable {
    private(set) var items: [TaskDraft] = []

    var isEmpty: Bool { items.isEmpty }

    /// How many would be added: a task needs a title.
    var count: Int { items.count { !$0.title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty } }

    mutating func append(_ drafts: [TaskDraft]) {
        items += drafts
    }

    /// A title is one line: what is typed or pasted on more lines joins with spaces.
    mutating func setTitle(_ id: UUID, _ title: String) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        items[i].title = String(title.replacing(/\r\n|\n|\r/, with: " ").prefix(TaskItem.titleMax))
    }

    mutating func setNotes(_ id: UUID, _ notes: String) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        items[i].notes = String(notes.prefix(TaskItem.notesMax))
    }

    mutating func move(_ id: UUID, to date: DayKey) {
        guard let i = items.firstIndex(where: { $0.id == id }) else { return }
        items[i].date = date
    }

    mutating func leaveOut(_ id: UUID) {
        items.removeAll { $0.id == id }
    }

    /// What Add saves, in the order it was said: titles with their spaces tidied, notes trimmed; a draft whose title
    /// was cleared is skipped.
    var ready: [TaskDraft] {
        items.compactMap { d in
            let title = d.title.replacing(/\s+/, with: " ").trimmingCharacters(in: .whitespaces)
            guard !title.isEmpty else { return nil }
            return TaskDraft(title: title, notes: d.notes.trimmingCharacters(in: .whitespacesAndNewlines), date: d.date)
        }
    }
}

/// A day a draft can be moved to.
struct DraftDay: Identifiable, Equatable {
    let date: DayKey
    let label: String
    var id: DayKey { date }
}

/// The days the web's day menu offers: the week ahead from today, the first day of next week, and the draft's own day
/// when it is further out.
enum DraftDays {
    /// "Today", "Tomorrow" or "Sun, Nov 15".
    static func label(_ date: DayKey, today: DayKey) -> String {
        Dates.relative(date, today: today) ?? Dates.medium(date)
    }

    static func choices(for date: DayKey, today: DayKey) -> [DraftDay] {
        var days = (0..<7).map { today.adding(days: $0) }
        let nextWeek = today.startOfWeek.adding(days: 7)
        if !days.contains(nextWeek) { days.append(nextWeek) }
        if !days.contains(date) { days.append(date) }
        return days.sorted().map { day in
            let name = day == nextWeek && Dates.relative(day, today: today) == nil
                ? "\(Dates.medium(day)) · next week"
                : label(day, today: today)
            return DraftDay(date: day, label: name)
        }
    }
}
