import XCTest
@testable import Hyperanchor

/// A server that records what reaches it and can go offline or refuse.
actor RecordingBackend: Backend {
    enum Call: Equatable {
        case create(String, String), update(String, TaskPatch), delete(String), fetch
    }

    private(set) var calls: [Call] = []
    var serverTasks: [String: TaskItem] = [:]
    var offline = false
    var failNext: APIError?

    func setOffline(_ v: Bool) { offline = v }
    func setFailNext(_ e: APIError?) { failNext = e }
    func put(_ t: TaskItem) { serverTasks[t.id] = t }
    nonisolated func setToken(_ token: String?) {}

    private func check() throws {
        if offline { throw APIError.offline }
        if let e = failNext { failNext = nil; throw e }
    }

    func fetchTasks(from: DayKey, to: DayKey) async throws -> [TaskItem] {
        try check()
        calls.append(.fetch)
        return serverTasks.values.filter { $0.date >= from && $0.date <= to }
    }

    func createTask(_ task: TaskItem) async throws {
        try check()
        calls.append(.create(task.id, task.title))
        serverTasks[task.id] = task
    }

    func updateTask(id: String, patch: TaskPatch) async throws {
        try check()
        calls.append(.update(id, patch))
        if let t = serverTasks[id] { serverTasks[id] = patch.applied(to: t) }
    }

    func deleteTask(id: String) async throws {
        try check()
        calls.append(.delete(id))
        serverTasks[id] = nil
    }

    func signIn(provider: SignInProvider, idToken: String, nonce: String?, name: String?) async throws -> (token: String, user: AppUser) {
        ("t", AppUser(name: "", email: "", image: nil))
    }

    func deleteAccount(appleAuthorizationCode: String?) async throws {}
}

@MainActor
final class TaskStoreTests: XCTestCase {
    let day = DayKey("2026-10-22")!
    var backend: RecordingBackend!
    var cacheDir: URL!

    override func setUp() async throws {
        backend = RecordingBackend()
        cacheDir = FileManager.default.temporaryDirectory.appending(path: UUID().uuidString)
        try FileManager.default.createDirectory(at: cacheDir, withIntermediateDirectories: true)
    }

    override func tearDown() async throws {
        try? FileManager.default.removeItem(at: cacheDir)
    }

    private func makeStore() -> TaskStore {
        TaskStore(backend: backend, cache: TaskCache(directory: cacheDir, account: "google:1"))
    }

    /// Lets queued work run.
    private func settle(_ ms: Int = 150) async {
        try? await Task.sleep(for: .milliseconds(ms))
    }

    func testCreateShowsAtOnceAndReachesTheServer() async {
        let store = makeStore()
        let t = store.create(title: "Write", date: day)
        XCTAssertEqual(store.tasks(on: day).map(\.id), [t.id])
        await settle()
        let calls = await backend.calls
        XCTAssertEqual(calls, [.create(t.id, "Write")])
        XCTAssertEqual(store.pendingCount, 0)
    }

    func testTypingIsSavedOnceAfterAPause() async {
        let store = makeStore()
        let t = store.create(title: "W", date: day)
        await settle()
        store.edit(t.id, TaskPatch(title: "Wr"), debounce: true)
        store.edit(t.id, TaskPatch(title: "Wri"), debounce: true)
        store.edit(t.id, TaskPatch(notes: "n"), debounce: true)
        XCTAssertEqual(store.task(t.id)?.title, "Wri")
        await settle(300)
        var calls = await backend.calls
        XCTAssertEqual(calls.count, 1, "nothing is sent while typing")
        await settle(500)
        calls = await backend.calls
        XCTAssertEqual(calls.last, .update(t.id, TaskPatch(title: "Wri", notes: "n")))
        XCTAssertEqual(calls.count, 2)
    }

    func testOfflineChangesQueueFoldAndGoOutLater() async {
        await backend.setOffline(true)
        let store = makeStore()
        let t = store.create(title: "Draft", date: day)
        await settle()
        XCTAssertFalse(store.isOnline)
        store.edit(t.id, TaskPatch(title: "Draft 2"))
        store.setDone(t.id, true)
        let gone = store.create(title: "Temp", date: day)
        store.remove(gone.id)
        XCTAssertEqual(store.pendingCount, 1, "edits fold into the unsent create; create + delete cancel out")

        await backend.setOffline(false)
        store.networkChanged(available: true)
        await settle(300)
        let calls = await backend.calls
        XCTAssertEqual(calls.filter { if case .fetch = $0 { false } else { true } }, [.create(t.id, "Draft 2")])
        let server = await backend.serverTasks
        XCTAssertEqual(server[t.id]?.done, true)
        XCTAssertTrue(store.isOnline)
        XCTAssertEqual(store.pendingCount, 0)
    }

    func testQueueSurvivesARelaunch() async {
        await backend.setOffline(true)
        var store: TaskStore? = makeStore()
        let t = store!.create(title: "Offline", date: day)
        await settle()
        store!.saveNow()
        store = nil
        await settle(100) // the cache writes in the background

        let relaunched = makeStore()
        XCTAssertEqual(relaunched.task(t.id)?.title, "Offline", "shown from disk at launch")
        XCTAssertEqual(relaunched.pendingCount, 1)
        await backend.setOffline(false)
        relaunched.sync()
        await settle()
        let server = await backend.serverTasks
        XCTAssertNotNil(server[t.id])
    }

    func testServerDataDoesNotOverwriteUnsavedChanges() async {
        let now = TaskItem.timestamp()
        let serverCopy = TaskItem(id: TaskItem.newID(), date: day, title: "Server title", notes: "", done: false, createdAt: now, updatedAt: now)
        await backend.put(serverCopy)
        let store = makeStore()
        await store.load(day...day)
        XCTAssertEqual(store.task(serverCopy.id)?.title, "Server title")

        store.edit(serverCopy.id, TaskPatch(title: "Typing…"), debounce: true)
        await store.load(day...day)
        XCTAssertEqual(store.task(serverCopy.id)?.title, "Typing…")
    }

    func testLoadReplacesTheRangeButKeepsOtherDays() async {
        let store = makeStore()
        let other = store.create(title: "Next week", date: day.adding(days: 7))
        let local = store.create(title: "Deleted elsewhere", date: day)
        await settle()
        await backend.setFailNext(nil)
        // Someone deleted it on the web.
        _ = try? await backend.deleteTask(id: local.id)
        await store.load(day...day)
        XCTAssertNil(store.task(local.id))
        XCTAssertNotNil(store.task(other.id))
    }

    func testARefusedChangeIsDroppedReportedAndReloaded() async {
        let store = makeStore()
        var errors: [String] = []
        store.onError = { errors.append($0) }
        let t = store.create(title: "Keep", date: day)
        await settle()
        await store.load(day...day)
        await backend.setFailNext(.server(status: 400, message: "Invalid title"))
        store.edit(t.id, TaskPatch(title: "Bad"))
        await settle(300)
        XCTAssertEqual(errors, ["Invalid title"])
        XCTAssertEqual(store.task(t.id)?.title, "Keep", "the screen matches the server again")
        XCTAssertEqual(store.pendingCount, 0)
    }

    func testDeleteAndUndo() async {
        let store = makeStore()
        let t = store.create(title: "Oops", date: day)
        await settle()
        let removed = store.remove(t.id)
        XCTAssertNil(store.task(t.id))
        store.restore(removed!)
        await settle(300)
        let server = await backend.serverTasks
        XCTAssertEqual(server[t.id]?.title, "Oops")
        XCTAssertEqual(store.tasks(on: day).map(\.id), [t.id])
    }

    func testUnauthorizedSignsOut() async {
        let store = makeStore()
        var expired = false
        store.onUnauthorized = { expired = true }
        await backend.setFailNext(.unauthorized)
        await store.load(day...day)
        XCTAssertTrue(expired)
    }

    func testDayOrderIsCreationOrder() {
        let store = makeStore()
        let a = store.create(title: "a", date: day)
        let b = store.create(title: "b", date: day)
        let c = store.create(title: "c", date: day)
        store.move(a.id, to: day.adding(days: 1))
        store.move(a.id, to: day)
        XCTAssertEqual(store.tasks(on: day).map(\.id), [a.id, b.id, c.id])
        XCTAssertEqual(store.openTasks(in: day...day).count, 3)
    }
}
