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

    func fetchOpenTasks(before: DayKey) async throws -> [TaskItem] {
        try await roundTrip()
        return tasks.values.filter { !$0.done && $0.date < before }
            .sorted { $0.date != $1.date ? $0.date > $1.date : $0.createdAt > $1.createdAt }
    }

    func searchTasks(_ query: String, today: DayKey) async throws -> [TaskItem] {
        try await roundTrip()
        let q = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { throw APIError.server(status: 400, message: "Invalid query") }
        let found = tasks.values.filter { TaskSorting.matches($0, query: q) }
        // Today and the days ahead first (soonest first), then the past (most recent first), as the server orders them.
        return found.sorted { a, b in
            let fa = a.date >= today, fb = b.date >= today
            if fa != fb { return fa }
            if a.date != b.date { return fa ? a.date < b.date : a.date > b.date }
            return a.createdAt > b.createdAt
        }.prefix(50).map { $0 }
    }

    func exportCSV() async throws -> Data {
        try await roundTrip()
        let cell = { (v: String) in v.contains(where: { ",\"\n\r".contains($0) }) ? "\"\(v.replacingOccurrences(of: "\"", with: "\"\""))\"" : v }
        let rows = tasks.values.sorted { $0.date != $1.date ? $0.date < $1.date : $0.createdAt < $1.createdAt }
            .map { [$0.date.description, cell($0.title), cell($0.notes), $0.done ? "yes" : "no", $0.createdAt, $0.updatedAt].joined(separator: ",") }
        return Data(("\u{FEFF}" + (["date,title,notes,done,created,updated"] + rows).joined(separator: "\r\n") + "\r\n").utf8)
    }

    private var tokensUsed = 1840
    private let tokenLimit = 10_000

    func usage() async throws -> Usage {
        try await roundTrip()
        return Usage(today: .init(used: tokensUsed, left: max(0, tokenLimit - tokensUsed), limit: tokenLimit),
                     features: .init(voice: true, transcribe: true, summary: true))
    }

    private func spend(_ tokens: Int) throws -> Int {
        guard tokenLimit - tokensUsed >= tokens else { throw AIFailure.limit }
        tokensUsed += tokens
        return tokenLimit - tokensUsed
    }

    func transcribe(audio: Data, mimeType: String, seconds: Double, language: String?) async throws -> (text: String, left: Int) {
        do { try await roundTrip() } catch { throw AIFailure.offline }
        try? await Task.sleep(for: .milliseconds(700))
        let left = try spend(Int(seconds * 17) + 150)
        return ("Tomorrow call the dentist about the crown and buy oat milk. On Friday book the flights for March, window seat.", left)
    }

    func parseTasks(text: String, today: DayKey, weekStart: Int) async throws -> (tasks: [TaskDraft], left: Int) {
        do { try await roundTrip() } catch { throw AIFailure.offline }
        try? await Task.sleep(for: .milliseconds(900))
        let left = try spend(1900 + text.count / 2)
        // The demo has no model: what was said is split into sentences, with "tomorrow" and weekdays understood.
        var day = today
        var drafts: [TaskDraft] = []
        let sentences = text.split(whereSeparator: { ".!?\n".contains($0) }).map { $0.trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
        for sentence in sentences {
            var words = sentence
            let lower = words.lowercased()
            if lower.hasPrefix("tomorrow") { day = today.adding(days: 1); words = String(words.dropFirst("tomorrow".count)) }
            for (i, name) in ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].enumerated() where lower.hasPrefix("on \(name)") {
                day = (0..<7).map { today.adding(days: $0) }.first { $0.dayOfWeek == i } ?? today
                words = String(words.dropFirst("on \(name)".count))
            }
            var note = ""
            if let comma = words.lastIndex(of: ",") {
                note = words[words.index(after: comma)...].trimmingCharacters(in: .whitespaces)
                words = String(words[..<comma])
            }
            for part in words.components(separatedBy: " and ") {
                let t = part.trimmingCharacters(in: .whitespacesAndNewlines)
                guard t.count > 2 else { continue }
                drafts.append(TaskDraft(title: t.prefix(1).uppercased() + t.dropFirst(), notes: note.prefix(1).uppercased() + note.dropFirst(), date: day))
            }
        }
        return (drafts, left)
    }

    func summarize(_ input: SummaryInput) async throws -> (summary: AISummary, tokens: Int, left: Int) {
        do { try await roundTrip() } catch { throw AIFailure.offline }
        try? await Task.sleep(for: .milliseconds(1200))
        let left = try spend(2800)
        let best = input.series.max { $0.done < $1.done }
        let summary = AISummary(
            headline: "\(input.done) of \(input.planned) done \(input.current ? "so far" : "in all"), most of it early in the \(input.period.rawValue).",
            points: [
                best.map { "\($0.label) carried the most, with \($0.done) of \($0.planned) done." } ?? "Most days had something done.",
                input.openTitles.first.map { "“\($0.title)” is still open." } ?? "Nothing was left open.",
                "Days with something done: \(input.activeDays) of \(input.elapsedDays).",
            ],
            next: "Put the one thing you keep moving first on the first day of the next \(input.period.rawValue)."
        )
        return (summary, 2800, left)
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
