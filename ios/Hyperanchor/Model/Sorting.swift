import Foundation

/// How a day's tasks are ordered (src/lib/tasks.ts and Settings → Task order): the person's own order by default.
struct TaskSort: Hashable, Sendable, Codable {
    enum Key: String, Codable, Sendable { case manual, added, title }
    var key: Key
    var ascending: Bool

    static let manual = TaskSort(key: .manual, ascending: true)
    static let newestFirst = TaskSort(key: .added, ascending: false)
    static let nameAscending = TaskSort(key: .title, ascending: true)
    static let nameDescending = TaskSort(key: .title, ascending: false)

    /// What Settings offers, in the web's order (`SORTS` in TaskTable.tsx).
    static let options: [TaskSort] = [.manual, .newestFirst, .nameAscending, .nameDescending]

    var label: String {
        switch (key, ascending) {
        case (.manual, _): "My order"
        case (.added, false): "Newest first"
        case (.added, true): "Oldest first"
        case (.title, true): "Name A–Z"
        case (.title, false): "Name Z–A"
        }
    }

    /// Dragging to rearrange works only in the person's own order.
    var allowsReordering: Bool { key == .manual }
}

enum TaskSorting {
    /// Creation order; ties (same timestamp) by id, so rows never shuffle.
    static func addedBefore(_ a: TaskItem, _ b: TaskItem) -> Bool {
        a.createdAt != b.createdAt ? a.createdAt < b.createdAt : a.id < b.id
    }

    /// Where a task sits in its day's manual order: its position once it has been moved, its creation time (in
    /// milliseconds since 1970, like `Date.parse`) until then. `placeOf` in src/lib/tasks.ts.
    static func place(of task: TaskItem) -> Double {
        if let p = task.position { return p }
        return milliseconds(task.createdAt)
    }

    /// `Date.parse` of an ISO timestamp, in milliseconds (0 when it can't be read).
    static func milliseconds(_ iso: String) -> Double {
        if let d = try? Date(iso, strategy: Date.ISO8601FormatStyle(includingFractionalSeconds: true)) { return (d.timeIntervalSince1970 * 1000).rounded() }
        if let d = try? Date(iso, strategy: Date.ISO8601FormatStyle()) { return (d.timeIntervalSince1970 * 1000).rounded() }
        return 0
    }

    /// A position that puts a task between `before` and `after` (either may be missing): `placeBetween` on the web.
    static func placeBetween(_ before: TaskItem?, _ after: TaskItem?, now: Date = .now) -> Double {
        switch (before, after) {
        case let (b?, a?): (place(of: b) + place(of: a)) / 2
        case let (b?, nil): place(of: b) + 1000
        case let (nil, a?): place(of: a) - 1000
        case (nil, nil): (now.timeIntervalSince1970 * 1000).rounded()
        }
    }

    /// A sorted copy (`sortTasks` on the web). Ties always fall back to creation order.
    static func sorted(_ tasks: [TaskItem], by sort: TaskSort) -> [TaskItem] {
        tasks.sorted { a, b in
            let c: ComparisonResult
            switch sort.key {
            case .manual:
                let pa = place(of: a), pb = place(of: b)
                c = pa < pb ? .orderedAscending : pa > pb ? .orderedDescending : .orderedSame
            case .added:
                // Creation time, then id (`byAdded` on the web), both in the sort's direction.
                c = a.createdAt != b.createdAt ? (a.createdAt < b.createdAt ? .orderedAscending : .orderedDescending)
                    : a.id < b.id ? .orderedAscending : a.id == b.id ? .orderedSame : .orderedDescending
            case .title:
                // Like localeCompare with sensitivity "base": case and accents don't matter.
                c = a.title.compare(b.title, options: [.caseInsensitive, .diacriticInsensitive], range: nil, locale: .current)
            }
            switch c {
            case .orderedAscending: return sort.ascending
            case .orderedDescending: return !sort.ascending
            case .orderedSame: return addedBefore(a, b)
            }
        }
    }

    /// Title or notes contain the query (case-insensitive); an empty query matches everything.
    static func matches(_ task: TaskItem, query: String) -> Bool {
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return q.isEmpty || task.title.lowercased().contains(q) || task.notes.lowercased().contains(q)
    }
}
