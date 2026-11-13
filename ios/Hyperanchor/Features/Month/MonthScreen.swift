import SwiftUI

/// The month, from edge to edge of the work area (`MonthView` on the web). iPad: the whole month as a grid that fills
/// the height, the tasks written in the days; a tap on a day opens it in a small window. iPhone: the month as numbers,
/// and the chosen day's tasks under it. Which month it is, and the way to others, is in the bar above.
struct MonthScreen: View {
    let user: AppUser

    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(Preferences.self) private var prefs
    @Environment(\.horizontalSizeClass) private var sizeClass

    var body: some View {
        // The first day of the week comes from Settings (`DayKey.weekStart`); reading it here redraws the month when it
        // changes.
        let _ = prefs.weekStart
        let month = router.month
        let grid = Dates.monthGrid(year: month.year, month: month.month)
        Group {
            if sizeClass == .regular {
                MonthGrid(month: month)
            } else {
                MonthNumbersPage(month: month)
            }
        }
        .background(.surface)
        .task(id: grid.start) {
            await store.load(grid.start...grid.end)
        }
    }
}

extension DayKey: Identifiable {
    var id: Int { ordinal }
}
