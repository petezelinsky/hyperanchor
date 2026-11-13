import XCTest
@testable import Hyperanchor

/// The web's actions on the task store: manual order with renumbering, new tasks at the top in the order written,
/// undo of the last 20 actions, and every task left open on earlier days.
@MainActor
final class TaskStoreActionsTests: XCTestCase {
    let today = DayKey("2026-11-13")!

    private func makeStore(_ backend: Backend = DemoBackend(today: DayKey("2026-11-13")!, seed: false, latency: .zero)) -> TaskStore {
        TaskStore(backend: backend, cache: nil)
    }

    private func titles(_ store: TaskStore, on day: DayKey) -> [String] {
        store.openInOrder(on: day).map(\.title)
    }

    func testNewTasksLandAtTheTopInTheOrderWritten() {
        let store = makeStore()
        store.create(title: "Old one", date: today)
        store.create(title: "Old two", date: today)
        let a = store.createAtTop(title: "A", date: today)
        let b = store.createAtTop(title: "B", date: today, after: a.id)
        store.createAtTop(title: "C", date: today, after: b.id)
        XCTAssertEqual(titles(store, on: today), ["A", "B", "C", "Old one", "Old two"])
        // A new run starts at the top again.
        store.createAtTop(title: "D", date: today)
        XCTAssertEqual(titles(store, on: today).first, "D")
    }

    func testPlacingRenumbersWhenTheGapRunsOut() {
        let store = makeStore()
        let ids = ["1", "2", "3"].map { store.create(title: $0, date: today, position: Double($0)! * 0.000_000_1).id }
        // Two neighbours at 1e-7 and 2e-7 apart: halving the gap again and again leaves no number in between in time.
        for _ in 0..<60 {
            store.place(ids[2], on: today, at: 1, today: today)
            store.place(ids[1], on: today, at: 1, today: today)
        }
        let order = titles(store, on: today)
        XCTAssertEqual(Set(order), ["1", "2", "3"])
        let places = store.openInOrder(on: today).map(TaskSorting.place(of:))
        XCTAssertEqual(places, places.sorted())
        XCTAssertEqual(Set(places).count, 3, "every task keeps a place of its own")
    }

    func testMovingToAnotherDayAndUndo() {
        let store = makeStore()
        let t = store.create(title: "Call Mom", date: today)
        let notice = store.moveTo(t.id, today.adding(days: 1), today: today)
        XCTAssertEqual(notice?.message, "Moved to tomorrow")
        XCTAssertEqual(store.task(t.id)?.date, today.adding(days: 1))
        XCTAssertEqual(store.undoLast(), "Moved back to today")
        XCTAssertEqual(store.task(t.id)?.date, today)
        XCTAssertNil(store.undoLast())
    }

    func testDeleteAndRestoreKeepTheTask() {
        let store = makeStore()
        let t = store.create(title: "Gym", notes: "Upper body", date: today)
        let notice = store.delete(t.id)
        XCTAssertEqual(notice?.message, "Deleted “Gym”")
        XCTAssertNil(store.task(t.id))
        XCTAssertTrue(store.undo(notice!.undo!))
        XCTAssertEqual(store.task(t.id)?.notes, "Upper body")
    }

    func testToggleUndoSkipsStepsThatNoLongerApply() {
        let store = makeStore()
        let a = store.create(title: "A", date: today)
        let b = store.create(title: "B", date: today)
        store.toggle(a.id)
        store.toggle(b.id)
        _ = store.delete(b.id)
        // The delete is taken back first, then B's tick.
        XCTAssertEqual(store.undoLast(), "Restored “B”")
        XCTAssertEqual(store.undoLast(), "“B” is open again")
        XCTAssertEqual(store.task(b.id)?.done, false)
        // Ticking A back by hand makes its step moot: undo skips it.
        store.setDone(a.id, false)
        XCTAssertNil(store.undoLast())
    }

    func testUndoKeepsTheLastTwentyActions() {
        let store = makeStore()
        let t = store.create(title: "T", date: today)
        for _ in 0..<25 { store.toggle(t.id) }
        XCTAssertEqual(store.undoCount, 20)
    }

    func testMoveAllToTodayAndAddDraftsAreOneStepEach() {
        let store = makeStore()
        let old = (1...3).map { store.create(title: "Old \($0)", date: today.adding(days: -$0)).id }
        let moved = store.moveAllToToday(old, today: today)
        XCTAssertEqual(moved?.message, "Moved 3 tasks to today")
        XCTAssertTrue(old.allSatisfy { store.task($0)?.date == today })

        let added = store.addDrafts([TaskDraft(title: "Buy oat milk", date: today.adding(days: 1)),
                                     TaskDraft(title: "Call the dentist", date: today.adding(days: 1))], today: today)
        XCTAssertEqual(added?.message, "Added 2 tasks for tomorrow")
        XCTAssertEqual(titles(store, on: today.adding(days: 1)), ["Buy oat milk", "Call the dentist"])

        XCTAssertEqual(store.undoLast(), "2 tasks removed")
        XCTAssertTrue(store.tasks(on: today.adding(days: 1)).isEmpty)
        XCTAssertEqual(store.undoLast(), "Moved 3 tasks back")
        XCTAssertEqual(old.compactMap { store.task($0)?.date }, [-1, -2, -3].map { today.adding(days: $0) })
    }

    func testEditUndoRestoresTheWords() {
        let store = makeStore()
        let t = store.create(title: "Draft", date: today)
        let before = store.task(t.id)!
        store.edit(t.id, TaskPatch(title: "Draft the newsletter"), debounce: true)
        store.finishedEditing(t.id, before: before)
        XCTAssertEqual(store.undoLast(), "Edit undone")
        XCTAssertEqual(store.task(t.id)?.title, "Draft")
    }

    func testEarlierOpenTasksCountEveryOldDay() async {
        let backend = DemoBackend(today: today, seed: false, latency: .zero)
        let store = makeStore(backend)
        let long = store.create(title: "From last year", date: today.adding(days: -400))
        let recent = store.create(title: "Yesterday's", date: today.adding(days: -1))
        _ = store.create(title: "Done long ago", date: today.adding(days: -30), done: true)
        store.sync()
        try? await Task.sleep(for: .milliseconds(100))
        await store.loadEarlier(before: today)
        XCTAssertEqual(store.earlierLoaded, today)
        XCTAssertEqual(store.openBefore(today).map(\.id), [recent.id, long.id], "most recent first, done ones left out")
    }

    func testRestoringPatchKeepsThePlaceOfATaskNeverMoved() {
        let t = TaskItem(id: "x", date: today, title: "T", notes: "", done: false, createdAt: "2026-11-13T08:00:00.000Z", updatedAt: "2026-11-13T08:00:00.000Z")
        var moved = t
        moved.position = 5
        let back = TaskPatch.restoring(t, from: moved)
        XCTAssertEqual(back.position, TaskSorting.milliseconds("2026-11-13T08:00:00.000Z"))
        XCTAssertEqual(TaskSorting.place(of: back.applied(to: moved)), TaskSorting.place(of: t))
    }
}
