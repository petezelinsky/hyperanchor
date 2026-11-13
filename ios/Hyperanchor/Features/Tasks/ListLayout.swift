import SwiftUI

// Small layout helpers for the task lists' summary lines (Week's head uses them).

extension View {
    /// A list row without background or separators, for headers, notices and empty states.
    func plainRow(insets: EdgeInsets = EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16)) -> some View {
        listRowInsets(insets)
            .listRowSeparator(.hidden)
            .listRowBackground(Color.surface)
    }
}

/// A row that becomes a column at accessibility text sizes, so nothing truncates.
struct AdaptiveStack<Content: View>: View {
    var spacing: CGFloat = 8
    @ViewBuilder let content: Content
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: spacing) { content }
                .environment(\.stacked, true)
        } else {
            HStack(spacing: spacing) { content }
                .lineLimit(1)
        }
    }
}

extension EnvironmentValues {
    @Entry var stacked = false
}

private struct HiddenWhenStacked: ViewModifier {
    @Environment(\.stacked) private var stacked
    func body(content: Content) -> some View {
        if !stacked { content }
    }
}

extension View {
    /// Separators and spacers that only make sense in a row.
    func hiddenWhenStacked() -> some View { modifier(HiddenWhenStacked()) }
}
