import SwiftUI

/// The voice screen: what is said becomes tasks on their days. (Placeholder until the voice screen is built.)
struct SpeakView: View {
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: 20) {
            Spacer()
            Circle().strokeBorder(.ink3, lineWidth: 2).frame(width: 160, height: 160)
            Text("Speak your tasks").font(.headline)
            Spacer()
            Button("Close") { dismiss() }.buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.surface)
    }
}
