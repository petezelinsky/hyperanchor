import Foundation

/// The voice screen's words, as the web says them (VoiceScreen.tsx), each failure in the words of the step it happened
/// in (writing down, or sorting). Where the web points at the address bar, the app points at Settings.
enum VoiceCopy {
    static let limit = "That’s all of today’s AI tokens. More tomorrow."
    static let offline = "You’re offline. What you said is kept: try again when you’re back."
    static let nothingHeard = "Nothing was heard. Try again a little closer to the microphone."
    static let noTasks = "No tasks in that. Say what you need to do, and when."
    static let tooMuch = "That’s too much for one go. Sort it in two or three parts."

    /// Sorting into tasks didn't work.
    static func sorting(_ failure: AIFailure) -> String {
        switch failure {
        case .limit: limit
        case .notConfigured: "Sorting into tasks isn’t set up on this server yet."
        case .refused: "That couldn’t be sorted into tasks. Try saying it another way."
        case .busy: "The sorter is busy right now."
        case .offline: offline
        case .failed, .tooLong: "That couldn’t be sorted into tasks."
        }
    }

    /// Writing down what was said didn't work.
    static func hearing(_ failure: AIFailure) -> String {
        switch failure {
        case .limit: limit
        case .notConfigured: "Listening isn’t set up on this server yet. Type instead."
        case .tooLong: "That was too long to write down at once. Say it in two or three parts."
        case .busy: "Couldn’t write that down right now. Try again in a moment."
        case .offline: offline
        case .failed, .refused: "That couldn’t be written down. Try again."
        }
    }

    /// Listening ended with nothing to go on.
    static func stopped(_ reason: ListenStop) -> String {
        switch reason {
        case .denied: "The microphone is blocked for Hyperanchor. Allow it in Settings, or type instead."
        case .recognitionDenied: "Speech recognition is blocked for Hyperanchor. Allow it in Settings, or type instead."
        case .noMicrophone: "No microphone was found. Connect one, or type instead."
        case .network: "Listening needs a connection. Try again, or type instead."
        case .error: "Listening didn’t start. Try again, or type instead."
        case .stopped, .silence, .limit: nothingHeard
        }
    }

    /// "1 task", "3 tasks".
    static func tasks(_ n: Int) -> String {
        "\(n) \(n == 1 ? "task" : "tasks")"
    }
}
