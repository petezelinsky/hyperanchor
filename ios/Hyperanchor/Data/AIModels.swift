import Foundation

/// Today's AI allowance (`GET /api/usage`), in tokens, and what the server offers: hearing speech, sorting it into
/// tasks, the summary in Progress. Without the server's AI keys the app doesn't offer them (as on the web).
struct Usage: Codable, Hashable, Sendable {
    struct Today: Codable, Hashable, Sendable {
        var used: Int
        var left: Int
        var limit: Int
    }
    struct Features: Codable, Hashable, Sendable {
        /// Speak: text → tasks (the server's Anthropic key).
        var voice: Bool
        /// Speech → text on the server (OpenAI); without it the app listens on the device.
        var transcribe: Bool
        /// The AI summary in Progress.
        var summary: Bool
    }
    var today: Today
    /// Missing from servers older than this app: then everything is assumed on, and a call that isn't configured
    /// answers `not_configured`, which the app words itself.
    var features: Features?
}

/// A task understood from what was said or typed (`TaskDraft` on the web): shown for review, saved only when added.
struct TaskDraft: Codable, Hashable, Sendable, Identifiable {
    var id = UUID()
    var title: String
    var notes: String
    var date: DayKey

    enum CodingKeys: String, CodingKey { case title, notes = "description", date }

    init(title: String, notes: String = "", date: DayKey) {
        self.title = title
        self.notes = notes
        self.date = date
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        title = try c.decode(String.self, forKey: .title)
        notes = (try? c.decode(String.self, forKey: .notes)) ?? ""
        date = try c.decode(DayKey.self, forKey: .date)
    }
}

/// What Progress sends for its AI summary (`SummaryInput` in src/lib/summary.ts).
struct SummaryInput: Codable, Hashable, Sendable {
    enum Period: String, Codable, Sendable { case week, month, year }
    struct Count: Codable, Hashable, Sendable { var done: Int; var planned: Int }
    struct Point: Codable, Hashable, Sendable { var label: String; var done: Int; var planned: Int }
    struct Weekday: Codable, Hashable, Sendable { var day: String; var done: Int; var planned: Int }
    struct OpenTitle: Codable, Hashable, Sendable { var title: String; var date: String }

    var period: Period
    /// "Nov 9 – 15", "November 2026", "2026".
    var label: String
    /// The period is the current one (still running).
    var current: Bool
    var today: DayKey
    var done: Int
    var planned: Int
    /// Planned for the days still ahead in the period.
    var upcoming: Int
    var activeDays: Int
    var elapsedDays: Int
    var previous: Count?
    var series: [Point]
    var weekdays: [Weekday]
    var doneTitles: [String]
    var openTitles: [OpenTitle]
}

/// The summary Claude writes: a headline, a few observations, one thing to try next.
struct AISummary: Codable, Hashable, Sendable {
    var headline: String
    var points: [String]
    var next: String
}

/// Why an AI call didn't give an answer, in the server's codes; the app words each one itself.
enum AIFailure: String, Error, Sendable {
    /// The server has no key for it.
    case notConfigured = "not_configured"
    /// Not enough tokens left today.
    case limit
    /// The model declined the text.
    case refused
    /// The service is busy or unreachable: worth another try.
    case busy
    case failed
    /// The recording is too long.
    case tooLong = "too_long"
    case offline

    /// One sentence for a toast or the voice screen.
    var message: String {
        switch self {
        case .notConfigured: "Speaking tasks isn’t available right now."
        case .limit: "That’s all the AI for today. It comes back tomorrow."
        case .refused: "Couldn’t make tasks out of that. Try saying it another way."
        case .busy: "The AI is busy. Try again in a moment."
        case .failed: "Something went wrong. Try again."
        case .tooLong: "That was too long to write down. Try a shorter one."
        case .offline: "You’re offline. Connect to the internet and try again."
        }
    }
}
