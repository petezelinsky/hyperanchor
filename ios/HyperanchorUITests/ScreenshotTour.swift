import XCTest

/// Not a check of behavior: walks through every screen and attaches a screenshot of each, in light and dark, for
/// design review and the App Store. Skipped unless asked for:
///   TEST_RUNNER_SCREENSHOTS=1 xcodebuild test … -only-testing:HyperanchorUITests/ScreenshotTour -resultBundlePath Tour.xcresult
///   xcrun xcresulttool export attachments --path Tour.xcresult --output-path Screenshots
@MainActor
final class ScreenshotTour: XCTestCase {
    private var app: XCUIApplication!
    private var appearance = "light"

    override func setUpWithError() throws {
        try XCTSkipUnless(ProcessInfo.processInfo.environment["SCREENSHOTS"] != nil, "Set TEST_RUNNER_SCREENSHOTS=1 to take screenshots.")
        continueAfterFailure = true
    }

    func testLight() { tour("light") }
    func testDark() { tour("dark") }

    private var pad: Bool { UIDevice.current.userInterfaceIdiom == .pad }

    private func tour(_ appearance: String) {
        self.appearance = appearance

        launch("-signedOut")
        sleep(4) // the headline goes once around day / week / month
        snap("01 Sign in")

        launch()
        snap("02 Today")
        app.buttons["newTask"].firstMatch.tap()
        if app.textFields["composer.title"].waitForExistence(timeout: 3) {
            app.textFields["composer.title"].typeText("Book a table for Friday")
        }
        snap("03 New task")

        launch()
        app.buttons["Call Mom"].firstMatch.press(forDuration: 1)
        snap("04 Task menu")

        launch()
        app.buttons["Call Mom"].firstMatch.swipeLeft()
        snap("05 Swipe")

        launch()
        app.buttons["bar.title"].firstMatch.tap()
        snap("06 Pick a day")

        launch("-tab", "week")
        snap("07 Week")
        app.swipeUp()
        snap("08 Week, scrolled")

        launch("-tab", "month")
        snap("09 Month")

        launch("-tab", "analytics")
        snap("10 Progress, week")
        app.swipeUp()
        snap("11 Progress, week, scrolled")
        launch("-tab", "analytics")
        app.buttons["Month"].firstMatch.tap()
        snap("12 Progress, month")
        app.buttons["Year"].firstMatch.tap()
        snap("13 Progress, year")

        launch("-tab", "goals")
        snap("14 Goals")
        launch("-tab", "agent")
        snap("15 Agent")

        launch()
        app.buttons["account"].firstMatch.tap()
        snap("16 Account")
        app.buttons["settings"].firstMatch.tap()
        sleep(1)
        snap("17 Settings")
        app.swipeUp()
        snap("18 Settings, scrolled")
        app.buttons["settings.account"].firstMatch.tap()
        sleep(1)
        snap("19 Settings, account")

        launch()
        app.typeKey("k", modifierFlags: .command)
        if app.textFields["search.field"].waitForExistence(timeout: 3) {
            app.textFields["search.field"].typeText("plan")
        }
        sleep(1)
        snap("20 Search")

        if pad {
            launch()
            app.typeKey("?", modifierFlags: .shift)
            snap("21 Keyboard shortcuts")
            launch()
            app.buttons["sidebar.hide"].firstMatch.tap()
            snap("22 Sidebar hidden")
        }

        launch()
        app.buttons["focus"].firstMatch.tap()
        sleep(1)
        snap("23 Focus")
    }

    private func launch(_ arguments: String...) {
        app = XCUIApplication()
        app.launchArguments = ["-uitest", "-today", "2026-10-22", "-appearance", appearance] + arguments
        app.launch()
        sleep(2)
    }

    private func snap(_ name: String) {
        sleep(1)
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = "\(name) (\(appearance))"
        attachment.lifetime = .keepAlways
        add(attachment)
    }
}
