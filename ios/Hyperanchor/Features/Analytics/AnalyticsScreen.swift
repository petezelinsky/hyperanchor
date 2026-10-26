import SwiftUI

struct AnalyticsScreen: View {
    let user: AppUser

    var body: some View {
        NavigationStack {
            Text("Analytics")
                .navigationTitle("Analytics")
                .toolbar { ToolbarItem(placement: .topBarLeading) { AccountMenu(user: user) } }
                .toastHost()
        }
    }
}
