import SwiftUI
import UIKit

/// Signed out: the sign-in screen. Signed in: the tabs. Applies the appearance and accent everywhere.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var phase

    var body: some View {
        Group {
            if let store = model.store, let user = model.session.user {
                MainView(user: user)
                    .environment(store)
                    .transition(.opacity)
            } else {
                SignInView()
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.session.user == nil)
        .environment(model.router)
        .environment(model.clock)
        .environment(model.prefs)
        .environment(model.toaster)
        .environment(\.palette, Palette(model.prefs.accent))
        .tint(.ink)
        .onChange(of: model.prefs.appearance, initial: true) { _, appearance in
            WindowAppearance.apply(appearance)
        }
        .onOpenURL { url in
            // hyperanchor://today (the widget)
            if url.host() == "today", model.store != nil { model.router.open(model.clock.today) }
        }
        .onChange(of: phase) { _, phase in
            switch phase {
            case .active: model.becameActive()
            case .background: model.movedToBackground()
            default: break
            }
        }
    }
}

/// Light / Auto / Dark for every window of the app, sheets included.
@MainActor
enum WindowAppearance {
    static func apply(_ appearance: Preferences.Appearance) {
        let style: UIUserInterfaceStyle = switch appearance {
        case .light: .light
        case .dark: .dark
        case .system: .unspecified
        }
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for window in scene.windows { window.overrideUserInterfaceStyle = style }
        }
    }
}
