import SwiftUI

struct WeekScreen: View {
    let user: AppUser

    var body: some View {
        NavigationStack {
            Text("Week")
                .navigationTitle("Week")
                .toolbar { ToolbarItem(placement: .topBarLeading) { AccountMenu(user: user) } }
                .toastHost()
        }
    }
}
