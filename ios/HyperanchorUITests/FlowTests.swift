import XCTest

/// The main flows, against the in-memory demo backend (`-uitest`): sign in, add, complete, move, delete, focus.
/// "Today" is pinned to Thursday, October 22, 2026, so the sample data is always the same.
final class FlowTests: XCTestCase {
    private var app: XCUIApplication!

    override func setUp() {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["-uitest", "-today", "2026-10-22", "-appearance", "light"]
    }

    private func button(_ label: String) -> XCUIElement { app.buttons[label].firstMatch }

    private func waitFor(_ element: XCUIElement, _ timeout: TimeInterval = 5, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "Missing \(element)", file: file, line: line)
    }

    func testSignInWithTheStubAccount() {
        app.launchArguments.append("-signedOut")
        app.launch()
        waitFor(app.staticTexts["Hyperanchor is a calm, fast planner. Capture tasks in a blink, focus on one thing at a time, and see your week at a glance."])
        button("signin.google").tap()
        waitFor(app.navigationBars["Today"])
        waitFor(button("Mark “Call Mom” as done"))
    }

    func testAddATaskAndComplete() {
        app.launch()
        waitFor(app.navigationBars["Today"])
        button("newTask").tap()
        let title = app.textFields["composer.title"]
        waitFor(title)
        title.typeText("Buy oat milk\n")
        waitFor(button("Mark “Buy oat milk” as done"))
        // The row stays open, with the keyboard, for the next one.
        waitFor(app.textFields["composer.title"])
        app.typeText("Water the plants\n")
        waitFor(button("Mark “Water the plants” as done"))

        button("Mark “Buy oat milk” as done").tap()
        waitFor(button("Mark “Buy oat milk” as not done"))
        waitFor(app.staticTexts["3 of 7 done"])
    }

    func testSwipeToDeleteAndUndo() {
        app.launch()
        let row = button("Call Mom")
        waitFor(row)
        row.swipeLeft()
        button("Delete").tap()
        waitFor(app.staticTexts["Deleted “Call Mom”"])
        XCTAssertFalse(button("Call Mom").exists)
        button("Undo").tap()
        waitFor(button("Call Mom"))
    }

    func testMoveToTomorrowFromTheMenu() {
        app.launch()
        let row = button("30-minute walk")
        waitFor(row)
        row.press(forDuration: 1.0)
        button("Move to Tomorrow").tap()
        waitFor(app.staticTexts["Moved to Tomorrow"])
        XCTAssertFalse(button("30-minute walk").exists)
        button("Friday, October 23: 0 of 3 done").tap()
        waitFor(app.navigationBars["Tomorrow"])
        waitFor(button("30-minute walk"))
    }

    func testMoveEarlierTasksToToday() {
        app.launch()
        waitFor(app.staticTexts["4 tasks are still open from earlier days"])
        button("moveToToday").tap()
        waitFor(app.staticTexts["Moved 4 tasks to Today"])
        waitFor(app.staticTexts["2 of 9 done"])
        button("Undo").tap()
        waitFor(app.staticTexts["2 of 5 done"])
    }

    func testFocusOneThingAtATime() {
        app.launch()
        button("focus").tap()
        waitFor(app.staticTexts["ONE THING AT A TIME"])
        waitFor(app.staticTexts["Review the design feedback"])
        waitFor(app.staticTexts["Up next: Call Mom · 1 more after that"])

        // Not now: to the back of the queue.
        button("focus.later").tap()
        waitFor(app.staticTexts["Call Mom"])

        // A thought, for later, without leaving.
        let capture = app.textFields["focus.capture"]
        capture.tap()
        capture.typeText("Pick up the keys\n")
        waitFor(app.staticTexts["Added for later"])

        for _ in 0..<4 {
            button("focus.done").tap()
            sleep(1)
        }
        waitFor(app.staticTexts["All done for today."])
        waitFor(app.staticTexts["Nice work. Take a breath."])
        button("focus.exit").tap()
        waitFor(app.staticTexts["All done"])
    }

    func testViews() {
        app.launch()
        app.tabBars.buttons["Week"].tap()
        waitFor(app.navigationBars["This Week"])
        waitFor(app.staticTexts["October 19 – 25, 2026"])
        app.tabBars.buttons["Month"].tap()
        waitFor(app.navigationBars["October 2026"])
        button("Thursday, October 22, 5 tasks, 2 done").tap()
        waitFor(button("daysheet.open"))
        button("daysheet.open").tap()
        waitFor(app.navigationBars["Today"])
        app.tabBars.buttons["Analytics"].tap()
        waitFor(app.navigationBars["Analytics"])
        app.buttons["Year"].firstMatch.tap()
        waitFor(app.staticTexts["Completed per month"])
    }
}
