import SwiftUI

/// Focus mode's icon, as on the web: a viewfinder framing one point, the point in the accent. A toolbar takes a
/// symbol's palette colors once rather than per appearance, so they are picked here for the current one.
struct FocusIcon: View {
    var enabled = true
    @Environment(\.palette) private var palette
    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        // Dimmed to 40% when there's nothing to focus on, as the web dims a disabled button.
        let pick = { (color: ThemeColor) in
            Color(uiColor: (colorScheme == .dark ? color.dark : color.light).uiColor).opacity(enabled ? 1 : 0.4)
        }
        Image(systemName: "dot.viewfinder")
            .symbolRenderingMode(.palette)
            .foregroundStyle(pick(palette.choice.palette.accent), pick(Tokens.ink))
    }
}
