import SwiftUI

@main
struct HyperanchorApp: App {
    var body: some Scene {
        WindowGroup {
            Text("hyperanchor.")
                .font(.largeTitle.bold())
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.canvas)
        }
    }
}
