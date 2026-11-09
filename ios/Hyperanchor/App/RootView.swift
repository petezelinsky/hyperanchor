import SwiftUI
import UIKit

/// Signed out: the sign-in screen. Signed in: the tabs. Applies the appearance and accent everywhere.
/// At launch the app takes over from the launch screen (the logo in the middle): the sign-in screen moves the logo
/// to its place; the tabs show from under it as it fades away.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var phase
    @State private var splash = true

    var body: some View {
        Group {
            if let store = model.store, let user = model.session.user {
                MainView(user: user)
                    .environment(store)
                    .transition(.opacity)
            } else {
                SignInView(splash: splash)
                    .transition(.opacity)
            }
        }
        .overlay {
            if splash, model.session.user != nil {
                LaunchCurtain()
                    .transition(.opacity.combined(with: .scale(scale: 1.04)))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.session.user == nil)
        .animation(.easeOut(duration: 0.4), value: splash)
        .task {
            // A beat on the launch screen's logo, then hand over.
            try? await Task.sleep(for: .milliseconds(250))
            splash = false
        }
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

/// The launch screen, drawn by the app so it can fade away: the logo in the middle of the launch color.
private struct LaunchCurtain: View {
    var body: some View {
        ZStack {
            Color("LaunchBackground")
            BrandMark()
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}

/// Light or Dark (or, until one is picked, the device's setting) for every window of the app, sheets included.
@MainActor
enum WindowAppearance {
    static func apply(_ appearance: Preferences.Appearance?) {
        let style: UIUserInterfaceStyle = switch appearance {
        case .light: .light
        case .dark: .dark
        case nil: .unspecified
        }
        for scene in UIApplication.shared.connectedScenes.compactMap({ $0 as? UIWindowScene }) {
            for window in scene.windows { window.overrideUserInterfaceStyle = style }
        }
    }
}
