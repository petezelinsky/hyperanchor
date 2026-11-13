import SwiftUI

/// The small Speak button beside "New task" (the web's, with the voice screen's sphere drawn small and still): opens the
/// voice screen. Shown only where the server offers speaking tasks (`Usage.features.voice`).
struct SpeakButton: View {
    @Environment(Router.self) private var router

    var body: some View {
        Button {
            router.showSpeak = true
        } label: {
            HStack(spacing: 6) {
                Circle()
                    .strokeBorder(.ink2, lineWidth: 1.5)
                    .frame(width: 11, height: 11)
                Text("Speak").font(.footnote.weight(.medium))
            }
            .foregroundStyle(.ink)
            .padding(.horizontal, 10)
            .frame(height: 30)
            .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1))
            .tapTarget()
        }
        .buttonStyle(PressableStyle())
        .accessibilityLabel("Speak your tasks")
        .accessibilityIdentifier("speak")
    }
}
