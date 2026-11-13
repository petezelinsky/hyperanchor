import Foundation
import os

/// Who is signed in (as the web's `AppUser`).
struct AppUser: Codable, Hashable, Sendable {
    var name: String
    var email: String
    var image: String?
}

enum SignInProvider: String, Codable, Sendable {
    case google, apple
}

enum APIError: Error, Equatable, LocalizedError {
    /// The session expired or was revoked: back to the sign-in screen.
    case unauthorized
    /// No connection; the request can be retried later.
    case offline
    case server(status: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .unauthorized: "Your session has ended. Please sign in again."
        case .offline: "You’re offline."
        case .server(_, let message): message
        }
    }

    var status: Int? { if case .server(let s, _) = self { s } else { nil } }
}

/// Everything the app asks of the server (the web app's API).
protocol Backend: Sendable {
    func fetchTasks(from: DayKey, to: DayKey) async throws -> [TaskItem]
    func createTask(_ task: TaskItem) async throws
    func updateTask(id: String, patch: TaskPatch) async throws
    func deleteTask(id: String) async throws
    /// `POST /api/auth/mobile`
    func signIn(provider: SignInProvider, idToken: String, nonce: String?, name: String?) async throws -> (token: String, user: AppUser)
    /// `DELETE /api/account`
    func deleteAccount(appleAuthorizationCode: String?) async throws
    func setToken(_ token: String?)

    /// `GET /api/tasks/open?before=`: every task left open before `before` (today), most recent first.
    func fetchOpenTasks(before: DayKey) async throws -> [TaskItem]
    /// `GET /api/tasks/search`: tasks whose title or notes contain `query`; today and the days ahead first.
    func searchTasks(_ query: String, today: DayKey) async throws -> [TaskItem]
    /// `GET /api/export`: every task as CSV (UTF-8 with a byte-order mark).
    func exportCSV() async throws -> Data
    /// `GET /api/usage`: today's AI allowance and what the server offers.
    func usage() async throws -> Usage
    /// `POST /api/voice/transcribe`: a recording → what was said. Throws `AIFailure`.
    func transcribe(audio: Data, mimeType: String, seconds: Double, language: String?) async throws -> (text: String, left: Int)
    /// `POST /api/tasks/parse`: text → task drafts. Throws `AIFailure`.
    func parseTasks(text: String, today: DayKey, weekStart: Int) async throws -> (tasks: [TaskDraft], left: Int)
    /// `POST /api/summary`: Progress's numbers → a short summary. Throws `AIFailure`.
    func summarize(_ input: SummaryInput) async throws -> (summary: AISummary, tokens: Int, left: Int)
}

/// The real server, over HTTPS with a bearer token.
final class HTTPBackend: Backend {
    let baseURL: URL
    private let token = OSAllocatedUnfairLock<String?>(initialState: nil)
    private let session: URLSession

    init(baseURL: URL) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 20
        config.waitsForConnectivity = false
        config.httpAdditionalHeaders = ["Accept": "application/json"]
        session = URLSession(configuration: config)
    }

    func setToken(_ token: String?) { self.token.withLock { $0 = token } }

    private struct TasksResponse: Decodable { let tasks: [TaskItem] }
    private struct ErrorResponse: Decodable { let error: String }
    private struct SignInResponse: Decodable { let token: String; let user: AppUser }

    func fetchTasks(from: DayKey, to: DayKey) async throws -> [TaskItem] {
        var c = URLComponents(url: baseURL.appending(path: "api/tasks"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "from", value: from.description), URLQueryItem(name: "to", value: to.description)]
        let data = try await send(URLRequest(url: c.url!))
        return try JSONDecoder().decode(TasksResponse.self, from: data).tasks
    }

    func createTask(_ task: TaskItem) async throws {
        struct Body: Encodable {
            let id: String, title: String, description: String, date: DayKey, done: Bool, position: Double?
        }
        do {
            _ = try await send(request("api/tasks", method: "POST", body: Body(id: task.id, title: task.title, description: task.notes, date: task.date, done: task.done, position: task.position)))
        } catch APIError.server(409, _) {
            // Already there: an earlier attempt reached the server before the connection dropped.
        }
    }

    func updateTask(id: String, patch: TaskPatch) async throws {
        _ = try await send(request("api/tasks/\(id)", method: "PATCH", body: patch))
    }

    func deleteTask(id: String) async throws {
        do {
            _ = try await send(request("api/tasks/\(id)", method: "DELETE"))
        } catch APIError.server(404, _) {
            // Already gone.
        }
    }

    func signIn(provider: SignInProvider, idToken: String, nonce: String?, name: String?) async throws -> (token: String, user: AppUser) {
        struct Body: Encodable { let provider: SignInProvider, idToken: String, nonce: String?, name: String? }
        let data = try await send(request("api/auth/mobile", method: "POST", body: Body(provider: provider, idToken: idToken, nonce: nonce, name: name)), authorized: false)
        let r = try JSONDecoder().decode(SignInResponse.self, from: data)
        return (r.token, r.user)
    }

    func deleteAccount(appleAuthorizationCode: String?) async throws {
        struct Body: Encodable { let authorizationCode: String? }
        _ = try await send(request("api/account", method: "DELETE", body: Body(authorizationCode: appleAuthorizationCode)))
    }

    func fetchOpenTasks(before: DayKey) async throws -> [TaskItem] {
        var c = URLComponents(url: baseURL.appending(path: "api/tasks/open"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "before", value: before.description)]
        let data = try await send(URLRequest(url: c.url!))
        return try JSONDecoder().decode(TasksResponse.self, from: data).tasks
    }

    func searchTasks(_ query: String, today: DayKey) async throws -> [TaskItem] {
        var c = URLComponents(url: baseURL.appending(path: "api/tasks/search"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "q", value: query), URLQueryItem(name: "today", value: today.description)]
        let data = try await send(URLRequest(url: c.url!))
        return try JSONDecoder().decode(TasksResponse.self, from: data).tasks
    }

    func exportCSV() async throws -> Data {
        var r = URLRequest(url: baseURL.appending(path: "api/export"))
        r.setValue("text/csv", forHTTPHeaderField: "Accept")
        return try await send(r)
    }

    func usage() async throws -> Usage {
        try JSONDecoder().decode(Usage.self, from: try await send(URLRequest(url: baseURL.appending(path: "api/usage"))))
    }

    func transcribe(audio: Data, mimeType: String, seconds: Double, language: String?) async throws -> (text: String, left: Int) {
        struct Answer: Decodable { let text: String; let left: Int }
        var c = URLComponents(url: baseURL.appending(path: "api/voice/transcribe"), resolvingAgainstBaseURL: false)!
        c.queryItems = [URLQueryItem(name: "seconds", value: String(Int(seconds.rounded(.up))))] + (language.map { [URLQueryItem(name: "lang", value: $0)] } ?? [])
        var r = URLRequest(url: c.url!)
        r.httpMethod = "POST"
        r.setValue(mimeType, forHTTPHeaderField: "Content-Type")
        r.httpBody = audio
        r.timeoutInterval = 60
        let a = try JSONDecoder().decode(Answer.self, from: try await sendAI(r))
        return (a.text, a.left)
    }

    func parseTasks(text: String, today: DayKey, weekStart: Int) async throws -> (tasks: [TaskDraft], left: Int) {
        struct Body: Encodable { let text: String; let today: DayKey; let weekStart: Int }
        struct Answer: Decodable { let tasks: [TaskDraft]; let left: Int }
        var r = try request("api/tasks/parse", method: "POST", body: Body(text: text, today: today, weekStart: weekStart))
        r.timeoutInterval = 60
        let a = try JSONDecoder().decode(Answer.self, from: try await sendAI(r))
        return (a.tasks, a.left)
    }

    func summarize(_ input: SummaryInput) async throws -> (summary: AISummary, tokens: Int, left: Int) {
        struct Answer: Decodable { let summary: AISummary; let tokens: Int; let left: Int }
        var r = try request("api/summary", method: "POST", body: input)
        r.timeoutInterval = 60
        let a = try JSONDecoder().decode(Answer.self, from: try await sendAI(r))
        return (a.summary, a.tokens, a.left)
    }

    /// An AI call: the server's error codes become `AIFailure` (offline too); the session ending stays `unauthorized`.
    private func sendAI(_ request: URLRequest) async throws -> Data {
        do {
            return try await send(request)
        } catch APIError.offline {
            throw AIFailure.offline
        } catch APIError.server(let status, let message) {
            if let failure = AIFailure(rawValue: message) { throw failure }
            throw status == 429 ? AIFailure.limit : status == 413 ? AIFailure.tooLong : status >= 500 ? AIFailure.busy : AIFailure.failed
        }
    }

    private func request(_ path: String, method: String, body: (some Encodable)? = nil as String?) throws -> URLRequest {
        var r = URLRequest(url: baseURL.appending(path: path))
        r.httpMethod = method
        if let body {
            r.setValue("application/json", forHTTPHeaderField: "Content-Type")
            r.httpBody = try JSONEncoder().encode(body)
        }
        return r
    }

    private func send(_ request: URLRequest, authorized: Bool = true) async throws -> Data {
        var r = request
        if authorized, let token = token.withLock({ $0 }) {
            r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: r)
        } catch let e as URLError where e.isConnectivity {
            throw APIError.offline
        }
        let status = (response as? HTTPURLResponse)?.statusCode ?? 0
        if status == 401, authorized { throw APIError.unauthorized }
        guard (200..<300).contains(status) else {
            let message = (try? JSONDecoder().decode(ErrorResponse.self, from: data))?.error ?? "Request failed (\(status))"
            throw APIError.server(status: status, message: message)
        }
        return data
    }
}

extension URLError {
    /// Failures that mean "try again when there's a connection", not "the request was wrong".
    var isConnectivity: Bool {
        switch code {
        case .notConnectedToInternet, .networkConnectionLost, .timedOut, .cannotConnectToHost, .cannotFindHost,
             .dnsLookupFailed, .internationalRoamingOff, .dataNotAllowed, .callIsActive, .secureConnectionFailed:
            true
        default:
            false
        }
    }
}

/// Stand-ins for backends that don't offer the newer calls (test doubles): nothing found, nothing offered.
extension Backend {
    func fetchOpenTasks(before: DayKey) async throws -> [TaskItem] { [] }
    func searchTasks(_ query: String, today: DayKey) async throws -> [TaskItem] { [] }
    func exportCSV() async throws -> Data { Data() }
    func usage() async throws -> Usage { Usage(today: .init(used: 0, left: 0, limit: 0), features: .init(voice: false, transcribe: false, summary: false)) }
    func transcribe(audio: Data, mimeType: String, seconds: Double, language: String?) async throws -> (text: String, left: Int) { throw AIFailure.notConfigured }
    func parseTasks(text: String, today: DayKey, weekStart: Int) async throws -> (tasks: [TaskDraft], left: Int) { throw AIFailure.notConfigured }
    func summarize(_ input: SummaryInput) async throws -> (summary: AISummary, tokens: Int, left: Int) { throw AIFailure.notConfigured }
}
