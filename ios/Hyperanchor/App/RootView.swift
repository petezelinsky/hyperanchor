import SwiftUI
import UIKit

/// Signed out: the sign-in screen. Signed in: the planner. Applies the appearance and accent everywhere.
/// At launch the app takes over from the launch screen (the "hy" sign in the middle of the page's color): the app draws
/// the same sign in the same place, then it fades away while the screen under it settles in.
struct RootView: View {
    @Environment(AppModel.self) private var model
    @Environment(\.scenePhase) private var phase
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
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
            if splash {
                LaunchCurtain()
                    .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 1.04)))
            }
        }
        .animation(.easeInOut(duration: 0.25), value: model.session.user == nil)
        .animation(.easeOut(duration: reduceMotion ? Tokens.Motion.reduced * 2 : 0.4), value: splash)
        .task {
            // A beat on the launch screen's sign, then hand over.
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

/// The launch screen, drawn by the app so it can fade away: the sign in the middle of the launch color, exactly where
/// and as large as the system's launch screen shows it (the same image).
private struct LaunchCurtain: View {
    var body: some View {
        ZStack {
            Color("LaunchBackground")
            Image("LaunchMark")
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
