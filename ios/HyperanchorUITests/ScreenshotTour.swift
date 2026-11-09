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

    private func tour(_ appearance: String) {
        self.appearance = appearance

        launch("-signedOut")
        sleep(4) // the headline goes once around day / week / month
        snap("01 Sign in")

        launch()
        snap("02 Today")
        app.buttons["newTask"].tap()
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

        launch("-tab", "week")
        snap("06 Week")
        app.swipeUp()
        snap("07 Week, scrolled")

        launch("-tab", "month")
        snap("08 Month")
        app.buttons["Thursday, October 22, 5 tasks, 2 done"].firstMatch.tap()
        sleep(1)
        snap("09 Month, day")
        launch("-tab", "month")
        app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Wednesday, October 28'")).firstMatch.tap()
        if app.buttons["daysheet.open"].waitForExistence(timeout: 3) { app.buttons["daysheet.open"].tap() }
        snap("09b Empty day")

        launch("-tab", "analytics")
        snap("10 Analytics, week")
        app.swipeUp()
        snap("11 Analytics, week, scrolled")
        app.swipeUp()
        snap("12 Analytics, week, bottom")
        launch("-tab", "analytics")
        app.segmentedControls.buttons["Month"].firstMatch.tap()
        snap("13 Analytics, month")
        app.segmentedControls.buttons["Year"].firstMatch.tap()
        snap("14 Analytics, year")
        app.swipeUp()
        snap("15 Analytics, year, scrolled")

        launch()
        app.buttons["account"].tap()
        snap("16 Account menu")
        app.buttons["Settings"].firstMatch.tap()
        sleep(1)
        snap("17 Settings")
        app.swipeUp()
        snap("18 Settings, scrolled")

        launch()
        app.buttons["focus"].tap()
        sleep(1)
        snap("19 Focus")
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
