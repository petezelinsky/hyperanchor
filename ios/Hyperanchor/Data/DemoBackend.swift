import Foundation

/// An in-memory server with sample tasks around today, for `-demo` / `-uitest` launches (no network,
/// no account). Behaves like the real API, including validation, so the app's sync path runs unchanged.
actor DemoBackend: Backend {
    private var tasks: [String: TaskItem] = [:]
    private let latency: Duration
    /// Simulates losing the connection (`-offline`).
    private var offline: Bool

    init(today: DayKey, seed: Bool = true, latency: Duration = .milliseconds(120), offline: Bool = false) {
        self.latency = latency
        self.offline = offline
        if seed { for t in Self.sample(today: today) { tasks[t.id] = t } }
    }

    func setOffline(_ value: Bool) { offline = value }

    nonisolated func setToken(_ token: String?) {}

    private func roundTrip() async throws {
        try? await Task.sleep(for: latency)
        if offline { throw APIError.offline }
    }

    func fetchTasks(from: DayKey, to: DayKey) async throws -> [TaskItem] {
        try await roundTrip()
        return tasks.values.filter { $0.date >= from && $0.date <= to }.sorted { $0.createdAt < $1.createdAt }
    }

    func createTask(_ task: TaskItem) async throws {
        try await roundTrip()
        let title = task.title.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty, title.count <= TaskItem.titleMax else { throw APIError.server(status: 400, message: "Invalid title") }
        if tasks[task.id] == nil { tasks[task.id] = task }
    }

    func updateTask(id: String, patch: TaskPatch) async throws {
        try await roundTrip()
        guard let t = tasks[id] else { throw APIError.server(status: 404, message: "Not found") }
        var updated = patch.applied(to: t)
        updated.updatedAt = TaskItem.timestamp()
        tasks[id] = updated
    }

    func deleteTask(id: String) async throws {
        try await roundTrip()
        tasks[id] = nil
    }

    func signIn(provider: SignInProvider, idToken: String, nonce: String?, name: String?) async throws -> (token: String, user: AppUser) {
        try await roundTrip()
        return ("demo", Self.user)
    }

    func deleteAccount(appleAuthorizationCode: String?) async throws {
        try await roundTrip()
        tasks.removeAll()
    }

    static let user = AppUser(name: "Alex Morgan", email: "alex@example.com", image: nil)

    /// A believable few weeks: mostly-finished past days, a couple of loose ends, a planned future.
    static func sample(today: DayKey) -> [TaskItem] {
        var out: [TaskItem] = []
        var n = 0
        func add(_ offset: Int, _ title: String, _ notes: String = "", done: Bool) {
            n += 1
            let day = today.adding(days: offset)
            let created = day.date().addingTimeInterval(Double(8 * 3600 + n * 97))
            let stamp = TaskItem.timestamp(created)
            out.append(TaskItem(id: String(format: "00000000-0000-4000-8000-%012d", n), date: day, title: title, notes: notes, done: done, createdAt: stamp, updatedAt: stamp))
        }
        let past: [[(String, String)]] = [
            [("Plan the week", "Three things that matter most"), ("Gym — upper body", ""), ("Reply to Sam about the offsite", "")],
            [("Send the invoice to Northwind", ""), ("Grocery run", "Oat milk, lemons, rice"), ("Read 20 pages", "")],
            [("Review Q4 roadmap draft", "Leave comments by Friday"), ("Call the dentist", ""), ("Water the plants", "")],
            [("Write the project update", ""), ("Pay the electricity bill", ""), ("Book flights for March", "Window seat"), ("Stretch for 10 minutes", "")],
            [("Clean up the downloads folder", ""), ("Prepare slides for Monday", "")],
        ]
        // The past four weeks: a handful of tasks most days, nearly all done.
        for offset in stride(from: -27, through: -1, by: 1) {
            let set = past[(offset + 27) % past.count]
            let count = offset % 7 == 0 ? 1 : set.count
            for (i, item) in set.prefix(count).enumerated() {
                let done = !(offset == -2 && i == 2) && !(offset == -4 && i == 1) && (offset * 7 + i * 3) % 11 != 0
                add(offset, item.0, item.1, done: done)
            }
        }
        add(0, "Plan the week", "Three things that matter most", done: true)
        add(0, "Send the proposal to Dana", "Attach the updated budget", done: true)
        add(0, "Review the design feedback", "", done: false)
        add(0, "Call Mom", "", done: false)
        add(0, "30-minute walk", "", done: false)
        add(1, "Dentist at 10:00", "Bring the insurance card", done: false)
        add(1, "Draft the newsletter", "", done: false)
        add(2, "Team retro", "", done: false)
        add(4, "Pick up the dry cleaning", "", done: false)
        add(8, "Quarterly planning", "Book a room", done: false)
        return out
    }
}
