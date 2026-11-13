import SwiftUI
import UIKit

/// Focus's keys on a hardware keyboard (iPad), as on the web: Space finishes the task, → puts it off, N jots a thought
/// down, Esc and F leave. While nothing is being typed, a small UIKit responder holds them, ahead of the app's own key
/// commands (which mean other things outside focus: Space ticks the selected row, → steps to the next day) and of the
/// system's focus movement, which would take the arrows.
struct FocusKeys: UIViewRepresentable {
    enum Key { case done, later, jot, leave }

    /// Off while the line at the foot is being typed in: the keys are the text's then.
    let active: Bool
    let press: (Key) -> Void

    func makeUIView(context: Context) -> Responder {
        Responder()
    }

    func updateUIView(_ view: Responder, context: Context) {
        view.press = press
        view.active = active
        view.claim()
    }

    final class Responder: UIView {
        var press: ((Key) -> Void)?
        var active = true

        override var canBecomeFirstResponder: Bool { active }

        override func didMoveToWindow() {
            super.didMoveToWindow()
            claim()
        }

        /// Takes the keyboard when it should have it: once on screen, and again when typing is over.
        func claim() {
            guard active, window != nil, !isFirstResponder else { return }
            // After the current update, so a field giving up the keyboard has done so.
            Task { [weak self] in
                guard let self, self.active, self.window != nil, !self.isFirstResponder else { return }
                self.becomeFirstResponder()
            }
        }

        override var keyCommands: [UIKeyCommand]? {
            Self.keys.map { input, _ in
                let command = UIKeyCommand(input: input, modifierFlags: [], action: #selector(pressed(_:)))
                command.wantsPriorityOverSystemBehavior = true
                return command
            }
        }

        private static let keys: [(String, Key)] = [
            (" ", .done), (UIKeyCommand.inputRightArrow, .later), ("n", .jot), (UIKeyCommand.inputEscape, .leave), ("f", .leave),
        ]

        @objc private func pressed(_ command: UIKeyCommand) {
            guard let key = Self.keys.first(where: { $0.0 == command.input })?.1 else { return }
            press?(key)
        }
    }
}
