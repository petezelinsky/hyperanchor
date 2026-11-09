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
            let id: String, title: String, description: String, date: DayKey, done: Bool
        }
        do {
            _ = try await send(request("api/tasks", method: "POST", body: Body(id: task.id, title: task.title, description: task.notes, date: task.date, done: task.done)))
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
