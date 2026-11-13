import SwiftUI
import UIKit

/// Speak your tasks: the whole screen, plain (white, or near-black in dark mode). The sphere listens in the middle and
/// moves to every sound; listening stops by itself after a pause, or with Done. What was said comes back as tasks on their
/// days in a window over the screen, to look over and add. Typing (or pasting) works the same way. The screen makes no
/// sounds of its own; the start and end of listening are felt.
struct SpeakView: View {
    var body: some View {
        SpeakScreen()
            .readsHardwareKeyboard()
    }
}

private struct SpeakScreen: View {
    @Environment(AppModel.self) private var app
    @Environment(TaskStore.self) private var store
    @Environment(TodayClock.self) private var clock
    @Environment(Preferences.self) private var prefs
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.scenePhase) private var scenePhase
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.showsKeyHints) private var keyHints
    @Environment(\.openURL) private var openURL

    @State private var model = SpeakModel()
    @State private var started = 0
    @State private var stopped = 0
    @FocusState private var typingFocused: Bool

    private var wide: Bool { sizeClass == .regular }

    var body: some View {
        GeometryReader { root in
            ZStack {
                VStack(spacing: 0) {
                    header
                    stage
                    foot(bottomInset: root.safeAreaInsets.bottom)
                }
                .accessibilityHidden(model.review)
                if model.review {
                    ReviewWindow(model: model, wide: wide, today: clock.today, bottomInset: root.safeAreaInsets.bottom, add: add)
                        .transition(.opacity)
                        .zIndex(1)
                }
            }
            .animation(reduceMotion ? Motion.reduced : .easeOut(duration: Tokens.Motion.fast), value: model.review)
        }
        .background(Color.surface.ignoresSafeArea())
        .task { model.open(context) }
        .onDisappear { model.end() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { model.backgrounded() }
        }
        .onChange(of: model.phase) { old, new in
            if new == .listening { started += 1 } else if old == .listening { stopped += 1 }
        }
        .sensoryFeedback(.start, trigger: started)
        .sensoryFeedback(.stop, trigger: stopped)
        .onChange(of: model.status) { _, status in
            if !status.isEmpty { AccessibilityNotification.Announcement(status).post() }
        }
        .onChange(of: model.typeFocus) {
            // The box appears with the change that asks for it: it takes the keyboard on the next turn.
            DispatchQueue.main.async { typingFocused = true }
        }
        .onChange(of: model.review) { _, review in
            // The window takes the screen: the keyboard goes down (and doesn't come back when sorting ends).
            if review { typingFocused = false }
        }
    }

    private var context: SpeakModel.Context {
        SpeakModel.Context(
            backend: app.session.backend,
            today: { [clock] in clock.today },
            weekStart: { [prefs] in prefs.weekStart },
            language: prefs.voiceLanguage,
            sample: store.tasks.values.sorted { $0.updatedAt > $1.updatedAt }.prefix(40).map(\.title),
            simulated: app.launch.uiTest,
            onDevice: ProcessInfo.processInfo.arguments.contains("-listenOnDevice"),
            unauthorized: { [store] in store.onUnauthorized?() },
            close: { [dismiss] in dismiss() }
        )
    }

    // MARK: Header

    private var header: some View {
        HStack(spacing: 8) {
            VoiceButton(variant: .secondary, size: .md, action: model.leave) {
                HStack(spacing: 8) {
                    Image(systemName: Icon.close).font(.system(size: 12, weight: .medium))
                    Text("Cancel")
                    if keyHints { KeyHint(key: "Esc", tone: .onSecondary) }
                }
            }
            .tapTarget()
            .keyboardShortcut(model.review ? nil : .cancelAction)
            .accessibilityIdentifier("speak.cancel")
            Spacer(minLength: 8)
            if model.hears {
                VoiceButton(model.typing ? "Speak instead" : "Type instead", variant: .plain, size: .md) { model.type(!model.typing) }
                    .tapTarget()
                    .disabled(model.busy || model.hearing)
                    .accessibilityIdentifier("speak.type")
            }
        }
        .padding(.horizontal, wide ? 16 : 12)
        .frame(minHeight: wide ? 56 : 52)
    }

    // MARK: The stage

    /// The sphere and the words, or a box to type into, in the middle of the screen.
    private var stage: some View {
        GeometryReader { geo in
            ScrollView {
                Group {
                    if model.typing { typingBox } else { voice }
                }
                .padding(.horizontal, wide ? 24 : 16)
                .padding(.top, 8)
                .padding(.bottom, wide ? 24 : 16)
                .frame(maxWidth: .infinity, minHeight: geo.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
        }
    }

    private var voice: some View {
        let diameter: CGFloat = wide ? 300 : 240
        return VStack(spacing: 0) {
            Sphere(ring: model.ring(diameter: diameter, reduced: reduceMotion), lively: model.phase != .idle)
                .frame(width: diameter, height: diameter)
                .foregroundStyle(Color.ink)
            Caption(model: model)
                .padding(.top, 4)
            words
                .padding(.top, 8)
        }
    }

    /// What was heard, or what went wrong, or what to do.
    private var words: some View {
        Group {
            if let problem = model.problem, model.phase != .listening, !model.review {
                Text(problem.message).fontWeight(.regular).foregroundStyle(Color.ink2)
            } else if !model.said.isEmpty || !model.saying.isEmpty {
                Text(model.said).foregroundStyle(model.busy ? Color.ink2 : .ink)
                    + Text(model.saying.isEmpty ? "" : (model.said.isEmpty ? "" : " ") + model.saying).foregroundStyle(Color.ink3)
            } else {
                Text(model.hint).fontWeight(.regular).foregroundStyle(Color.ink3)
            }
        }
        .font(wide ? .title3.weight(.medium) : .token(Tokens.Typography.headline, weight: .medium))
        .multilineTextAlignment(.center)
        .lineLimit(typeSize.isAccessibilitySize ? 8 : 4)
        .frame(maxWidth: 560)
        .frame(minHeight: wide ? 60 : 52, alignment: .top)
        .accessibilityIdentifier("speak.words")
    }

    private var typingBox: some View {
        @Bindable var model = model
        return VStack(alignment: .leading, spacing: 0) {
            Text("Type your tasks")
                .font(.token(Tokens.Typography.title2, weight: .semibold))
                .tracking(-0.4)
                .foregroundStyle(Color.ink)
                .accessibilityAddTraits(.isHeader)
            Text(model.hears
                 ? "In any order, as it comes. Each thing to do becomes a task on its day."
                 : "Listening isn’t available here, so type or paste. Each thing to do becomes a task on its day.")
                .font(.token(Tokens.Typography.body))
                .foregroundStyle(Color.ink2)
                .padding(.top, 4)
            TextField("Tomorrow morning call the bank. On Friday book the dentist…", text: $model.text, axis: .vertical)
                .font(.callout)
                .lineLimit(4...12)
                .padding(14)
                .background(Color.surface2, in: RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: Tokens.Radius.lg, style: .continuous)
                        .strokeBorder(typingFocused ? Color.line2 : .line, lineWidth: 1)
                }
                .focused($typingFocused)
                // Under the window it can't take the keyboard back ("Type more" gives it back).
                .disabled(model.busy || model.review)
                .padding(.top, 16)
                .accessibilityLabel("What you need to do")
                .accessibilityIdentifier("speak.field")
                .onChange(of: model.text) { _, text in
                    if text.count > SpeakModel.textMax { model.text = String(text.prefix(SpeakModel.textMax)) }
                }
        }
        .frame(maxWidth: 600, alignment: .leading)
        .padding(.top, 16)
    }

    // MARK: The foot

    /// The next step, in the middle, on the same white.
    private func foot(bottomInset: CGFloat) -> some View {
        let n = model.count
        // The web keeps the buttons a phone's home bar (or 16 points) off the bottom, 36 on iPad; with the keyboard up,
        // just clear of it.
        let bottom: CGFloat = bottomInset > 100 ? 8 : max(wide ? 16 : 0, (wide ? 36 : 16) - bottomInset)
        return HStack(spacing: 8) {
            if n > 0, !model.review {
                VoiceButton("Review \(VoiceCopy.tasks(n))", variant: .secondary, fill: !wide, wide: wide) { model.review = true }
                    .accessibilityIdentifier("speak.review")
            }
            if model.typing {
                VoiceButton("Sort into tasks", variant: .primary, fill: !wide, wide: wide) { Task { await model.sort(model.text) } }
                    .disabled(model.busy || model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                    .keyboardShortcut(.return, modifiers: .command)
                    .accessibilityIdentifier("speak.sort")
            } else if let problem = model.problem, problem.settings, model.phase == .idle {
                VoiceButton("Open Settings", variant: .primary, fill: !wide, wide: wide) {
                    if let url = URL(string: UIApplication.openSettingsURLString) { openURL(url) }
                }
                .accessibilityIdentifier("speak.settings")
            } else if model.problem?.audio != nil, model.phase == .idle {
                VoiceButton(variant: .secondary, fill: !wide, wide: wide, action: model.listen) { speakAgain }
                VoiceButton("Try again", variant: .primary, fill: !wide, wide: wide, action: model.retry)
                    .accessibilityIdentifier("speak.retry")
            } else if model.phase == .listening {
                VoiceButton(variant: .primary, fill: !wide, wide: wide, action: model.stop) {
                    HStack(spacing: 8) {
                        Text("Done")
                        if keyHints { KeyHint(key: "↵", tone: .onPrimary) }
                    }
                }
                .keyboardShortcut(.return, modifiers: [])
                .accessibilityLabel("Done speaking")
                .accessibilityIdentifier("speak.done")
            } else {
                VoiceButton(variant: .primary, fill: !wide, wide: wide, action: model.listen) { speakAgain }
                    .disabled(model.busy || model.hearing || model.spent || model.starting)
                    .accessibilityIdentifier("speak.again")
            }
        }
        .padding(.horizontal, wide ? 24 : 16)
        .padding(.top, wide ? 12 : 8)
        .padding(.bottom, bottom)
        .frame(maxWidth: .infinity)
    }

    private var speakAgain: some View {
        HStack(spacing: 8) {
            Orb(size: 20)
            Text("Speak again")
        }
    }

    // MARK: Adding

    /// What was sorted becomes tasks, in the order it was said; one Undo takes all of them back.
    private func add() {
        guard let ready = model.add() else { return }
        if let notice = store.addDrafts(ready, today: clock.today) {
            if let step = notice.undo {
                toaster.show(notice.message, action: "Undo") { [store] in _ = store.undo(step) }
            } else {
                toaster.show(notice.message)
            }
        }
        UINotificationFeedbackGenerator().notificationOccurred(.success)
        dismiss()
    }
}

/// "Listening · 0:12", "Writing it down…", "Sorting into tasks…": its own view, so the clock ticking redraws only it.
private struct Caption: View {
    let model: SpeakModel

    var body: some View {
        Text(model.caption)
            .font(.token(Tokens.Typography.caption))
            .monospacedDigit()
            .foregroundStyle(Color.ink3)
            .frame(minHeight: 18)
    }
}
