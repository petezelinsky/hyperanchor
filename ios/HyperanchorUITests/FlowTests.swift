import XCTest

/// The main flows, against the in-memory demo backend (`-uitest`): signing in; the bar (the view switch, the arrows,
/// the way back, the month to pick a day from); the pages from the account panel (iPhone) or the sidebar (iPad);
/// Settings; Search; and the tasks themselves (add, complete, delete, move, focus).
/// "Today" is pinned to Thursday, October 22, 2026, so the sample data is always the same.
@MainActor
final class FlowTests: XCTestCase {
    /// Made on first use, on the main actor (each test gets a fresh one).
    private lazy var app: XCUIApplication = {
        let app = XCUIApplication()
        app.launchArguments = ["-uitest", "-today", "2026-10-22", "-appearance", "light"]
        return app
    }()

    override func setUp() {
        continueAfterFailure = false
    }

    private func button(_ label: String) -> XCUIElement { app.buttons[label].firstMatch }

    private func waitFor(_ element: XCUIElement, _ timeout: TimeInterval = 5, file: StaticString = #filePath, line: UInt = #line) {
        XCTAssertTrue(element.waitForExistence(timeout: timeout), "Missing \(element)", file: file, line: line)
    }

    /// The bar's title — the page's name and date ("Today, Thursday, October 22") — once it starts with `title`.
    private func waitForTitle(_ title: String, file: StaticString = #filePath, line: UInt = #line) {
        let match = app.descendants(matching: .any).matching(NSPredicate(format: "identifier == 'bar.title' AND label BEGINSWITH %@", title)).firstMatch
        waitFor(match, file: file, line: line)
    }

    /// A segment of the bar's switch (Day / Week / Month, or Progress's periods).
    private func segment(_ label: String) -> XCUIElement {
        app.descendants(matching: .any).matching(NSPredicate(format: "identifier IN {'viewSwitch', 'periodSwitch'}")).firstMatch.buttons[label]
    }

    /// iPad lists the pages in the sidebar; iPhone in the account panel.
    private func page(_ name: String) -> XCUIElement {
        let row = button("page.\(name)")
        if !row.exists { button("account").tap() }
        return row
    }

    private func openSettings() {
        button("account").tap()
        button("settings").tap()
        waitFor(app.navigationBars["Settings"])
    }

    // MARK: Signing in

    func testSignInWithTheStubAccount() {
        app.launchArguments.append("-signedOut")
        app.launch()
        waitFor(app.descendants(matching: .any)["Own your day, week and month."])
        waitFor(app.staticTexts.matching(NSPredicate(format: "label BEGINSWITH 'Hyperanchor is a calm, fast planner.'")).firstMatch)
        waitFor(button("signin.apple"))
        button("signin.google").tap()
        waitForTitle("Today")
    }

    // MARK: The bar

    func testViewsArrowsAndTheWayBack() {
        app.launch()
        waitForTitle("Today")
        segment("Week").tap()
        waitForTitle("This week")
        button("Next week").tap()
        waitForTitle("Next week")
        button("bar.back").tap()
        waitForTitle("This week")
        segment("Month").tap()
        waitForTitle("October")
        segment("Day").tap()
        waitForTitle("Today")
        button("Next day").tap()
        waitForTitle("Tomorrow")
        button("bar.back").tap()
        waitForTitle("Today")
        XCTAssertFalse(button("bar.back").exists)
    }

    func testPickADayFromTheTitle() {
        app.launch()
        button("bar.title").tap()
        let saturday = button("day.2026-10-24")
        waitFor(saturday)
        saturday.tap()
        waitForTitle("Saturday")
        XCTAssertFalse(saturday.exists)
    }

    func testPagesFromTheAccountOrTheSidebar() {
        app.launch()
        page("progress").tap()
        waitForTitle("Progress")
        segment("Month").tap()
        waitForTitle("Progress, October 2026")
        page("goals").tap()
        waitForTitle("Goals")
        page("home").tap()
        waitForTitle("Today")
    }

    // MARK: Settings

    func testSettings() {
        app.launch()
        openSettings()
        let sunday = app.descendants(matching: .any)["settings.weekStart"].buttons["Sunday"]
        sunday.tap()
        XCTAssertTrue(sunday.isSelected)

        button("settings.order").tap()
        button("Name A–Z").tap()
        waitFor(app.staticTexts["Dragging is off while tasks are sorted."])

        button("settings.account").tap()
        waitFor(app.navigationBars["Account"])
        waitFor(app.staticTexts["alex@example.com"])
        button("settings.delete").tap()
        waitFor(app.staticTexts["Delete your account?"])
        button("settings.delete.cancel").tap()
        waitFor(button("settings.delete"))

        app.navigationBars["Account"].buttons.firstMatch.tap()
        waitFor(app.navigationBars["Settings"])
        button("settings.close").tap()
        XCTAssertTrue(app.navigationBars["Settings"].waitForNonExistence(timeout: 3))
    }

    func testKeyboardShortcutsOpenOnTheirOwn() throws {
        try XCTSkipUnless(UIDevice.current.userInterfaceIdiom == .pad, "A hardware keyboard's list: iPad.")
        app.launch()
        app.typeKey("?", modifierFlags: .shift)
        waitFor(app.navigationBars["Keyboard shortcuts"])
        waitFor(app.staticTexts["Undo the last action"])
    }

    // MARK: Search

    func testSearchOpensTheFoundTasksDay() {
        app.launch()
        waitForTitle("Today")
        app.typeKey("k", modifierFlags: .command)
        let field = app.textFields["search.field"]
        waitFor(field)
        waitFor(app.staticTexts["Find any task by its title or notes, on any day."])
        field.typeText("quarterly")
        let result = button("search.result")
        waitFor(result)
        XCTAssertTrue(app.staticTexts["Fri, Oct 30"].exists)
        result.tap()
        waitForTitle("Friday")
    }

    func testSearchWithNothingFound() {
        app.launch()
        app.typeKey("k", modifierFlags: .command)
        let field = app.textFields["search.field"]
        waitFor(field)
        field.typeText("zebra")
        waitFor(app.staticTexts["No tasks match “zebra”."])
        button("search.cancel").tap()
        XCTAssertTrue(field.waitForNonExistence(timeout: 3))
    }

    // MARK: Tasks

    func testAddATaskAndComplete() {
        app.launch()
        waitForTitle("Today")
        // iPad writes new tasks in the web's row at the top (opened by New task); iPhone in the bar at the bottom.
        let newTask = button("newTask")
        if newTask.waitForExistence(timeout: 2) { newTask.tap() }
        let title = app.textFields["composer.title"]
        waitFor(title)
        if !newTask.exists { title.tap() }
        title.typeText("Buy oat milk\n")
        waitFor(button("Mark “Buy oat milk” as done"))
        // The row stays open, with the keyboard, for the next one.
        waitFor(app.textFields["composer.title"])
        app.typeText("Water the plants\n")
        waitFor(button("Mark “Water the plants” as done"))

        button("Mark “Buy oat milk” as done").tap()
        waitFor(button("Mark “Buy oat milk” as open"))
        // The day's count in the bar.
        waitFor(app.descendants(matching: .any).matching(NSPredicate(format: "identifier == 'bar.count' AND label == '3 of 7 done'")).firstMatch)
    }

    func testSwipeToDeleteAndUndo() {
        app.launch()
        let row = button("Call Mom")
        waitFor(row)
        row.swipeLeft()
        button("Delete").tap()
        waitFor(app.staticTexts["Deleted “Call Mom”"])
        XCTAssertFalse(button("Call Mom").exists)
        button("toast.action").tap()
        waitFor(button("Call Mom"))
    }

    func testMoveToTomorrowFromTheMenu() {
        app.launch()
        let row = button("30-minute walk")
        waitFor(row)
        row.press(forDuration: 1.0)
        button("Move to tomorrow").tap()
        waitFor(app.staticTexts["Moved to tomorrow"])
        XCTAssertFalse(button("30-minute walk").exists)
        button("Next day").tap()
        waitForTitle("Tomorrow")
        waitFor(button("30-minute walk"))
    }

    func testFocusOneThingAtATime() {
        app.launch()
        button("focus").tap()
        waitFor(button("focus.done"))
        button("focus.exit").tap()
        waitForTitle("Today")
    }
}
