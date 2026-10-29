import Foundation

/// The Day list's sort options (src/lib/tasks.ts and the web's sort menu).
enum SortOption: String, CaseIterable, Identifiable, Sendable {
    case orderAdded, newestFirst, nameAscending, nameDescending

    var id: String { rawValue }

    var label: String {
        switch self {
        case .orderAdded: "Order Added"
        case .newestFirst: "Newest First"
        case .nameAscending: "Name A–Z"
        case .nameDescending: "Name Z–A"
        }
    }
}

enum TaskSorting {
    /// Creation order; ties (same timestamp) by id, so rows never shuffle.
    static func addedBefore(_ a: TaskItem, _ b: TaskItem) -> Bool {
        a.createdAt != b.createdAt ? a.createdAt < b.createdAt : a.id < b.id
    }

    /// A sorted copy. Ties always fall back to creation order.
    static func sorted(_ tasks: [TaskItem], by option: SortOption) -> [TaskItem] {
        tasks.sorted { a, b in
            let c: ComparisonResult
            switch option {
            case .orderAdded, .newestFirst:
                c = a.createdAt != b.createdAt ? (a.createdAt < b.createdAt ? .orderedAscending : .orderedDescending)
                    : a.id < b.id ? .orderedAscending : a.id == b.id ? .orderedSame : .orderedDescending
            case .nameAscending, .nameDescending:
                // Like localeCompare with sensitivity "base": case and accents don't matter.
                c = a.title.compare(b.title, options: [.caseInsensitive, .diacriticInsensitive], range: nil, locale: .current)
            }
            let descending = option == .newestFirst || option == .nameDescending
            switch c {
            case .orderedAscending: return !descending
            case .orderedDescending: return descending
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
