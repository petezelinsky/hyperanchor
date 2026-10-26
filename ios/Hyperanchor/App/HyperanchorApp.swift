import SwiftUI

@main
struct HyperanchorApp: App {
    @State private var model = AppModel()

    var body: some Scene {
        WindowGroup {
            Text("hyperanchor.")
                .font(.largeTitle.bold())
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(.canvas)
                .environment(model)
        }
    }
}
