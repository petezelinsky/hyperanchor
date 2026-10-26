import SwiftUI

struct MonthScreen: View {
    let user: AppUser

    var body: some View {
        NavigationStack {
            Text("Month")
                .navigationTitle("Month")
                .toolbar { ToolbarItem(placement: .topBarLeading) { AccountMenu(user: user) } }
                .toastHost()
        }
    }
}
