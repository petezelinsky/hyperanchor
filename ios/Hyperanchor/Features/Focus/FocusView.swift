import SwiftUI
import UIKit

/// Focus: the whole screen for one task (the web's FocusPanel). The task is a small card, a row of the list grown large —
/// its box and its words — lying on a deck whose edges are the tasks still waiting. Ticking it draws the tick and crosses
/// the words out, then the card turns to dust while the next one rises into its place; Later slips it to the back. Where
/// the day stands and the timer sit in the bar above; a thought that comes up goes on the line below, kept for later
/// without leaving. Leaving says how many were done here.
struct FocusView: View {
    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(Preferences.self) private var prefs
    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.palette) private var palette
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.legibilityWeight) private var legibilityWeight
    @Environment(\.displayScale) private var displayScale

    /// Put off for later: at the back of the queue, in the order they were put off (thoughts jotted down too).
    @State private var later: [String] = []
    /// Ticked just now: the card stays on top while its tick plays, then turns to dust.
    @State private var finishing: String?
    /// Put off beyond the deck: sinking behind it.
    @State private var sinking: TaskItem?
    @State private var dust: [Dust] = []
    /// Where the card on top lies on the screen.
    @State private var topFrame: CGRect = .zero
    /// Tasks finished here, for the word on leaving.
    @State private var doneHere = 0
    @State private var putOffs = 0
    @State private var thought = ""
    /// "Added for later", said on the line itself for a moment.
    @State private var kept = 0
    @FocusState private var capturing: Bool
    /// A key was pressed here, so there is a keyboard (key hints show on iPad).
    @State private var keysUsed = false
    @State private var bottomInset: CGFloat = 0
    /// VoiceOver moves on to the card that comes up (or to the finish).
    @AccessibilityFocusState private var spoken: String?

    private var day: DayKey { router.selected }
    private var regular: Bool { sizeClass == .regular }
    /// Where VoiceOver goes when nothing is left.
    fileprivate static let finished = "focus.finished"

    var body: some View {
        let all = store.tasks(on: day)
        let queue = queue(all)
        let waiting = Set(queue.map(\.id))
        let done = all.count { $0.done && !waiting.contains($0.id) }

        VStack(spacing: 0) {
            FocusBar(done: done, total: all.count, finished: queue.isEmpty, leave: leave)
            stage(queue: queue, done: done, total: all.count)
            ThoughtLine(text: $thought, capturing: $capturing, kept: kept > 0, regular: regular, submit: jot)
                .padding(.bottom, bottomInset > 80 ? 8 : max(0, (regular ? 32 : 16) - bottomInset))
        }
        .background {
            Color.canvas
                .ignoresSafeArea()
                .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.bottom } action: { bottomInset = $0 }
        }
        .background {
            FocusKeys(active: !capturing, press: key)
                .accessibilityHidden(true)
        }
        .overlay { DustLayer(clouds: dust) }
        // Messages (an error, an undo) show above the line at the foot.
        .overlay(alignment: .bottom) { ToastOverlay().padding(.bottom, regular ? 84 : 56) }
        .readsHardwareKeyboard(used: keysUsed)
        .sensoryFeedback(.impact(flexibility: .soft, intensity: 0.8), trigger: doneHere)
        .sensoryFeedback(.selection, trigger: putOffs)
        .sensoryFeedback(.impact(weight: .light), trigger: kept) { _, now in now > 0 }
        .onDisappear {
            if doneHere > 0 { toaster.show("\(doneHere) done in focus.") }
        }
        // Space and N from the app's own key commands, for a moment when the screen doesn't hold the keyboard (after a menu).
        .onChange(of: router.focusCompleteRequest) { _, _ in
            keysUsed = true
            finishTop()
        }
        .onChange(of: router.focusCaptureRequest) { _, _ in
            keysUsed = true
            capturing = true
        }
        // Another day (today after midnight): its own queue.
        .onChange(of: day) { _, _ in
            later = []
            sinking = nil
        }
        .task(id: kept) {
            guard kept > 0 else { return }
            try? await Task.sleep(for: .seconds(2))
            if !Task.isCancelled { kept = 0 }
        }
        // Writing the next thought: the line stops saying the last one was kept.
        .onChange(of: thought) { _, now in
            if !now.isEmpty { kept = 0 }
        }
        .accessibilityAction(.escape) { leave() }
    }

    // MARK: The stage

    private func stage(queue: [TaskItem], done: Int, total: Int) -> some View {
        GeometryReader { geo in
            ScrollView(.vertical) {
                content(queue: queue, done: done, total: total)
                    .padding(.horizontal, regular ? 40 : 16)
                    .padding(.bottom, 40)
                    .frame(maxWidth: .infinity, minHeight: geo.size.height)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
        }
    }

    /// The deck with the two ways on under it; when nothing is left, where things stand.
    @ViewBuilder
    private func content(queue: [TaskItem], done: Int, total: Int) -> some View {
        if let top = queue.first {
            let putOff: ((TaskItem) -> Void)? = queue.count > 1 ? { putOff($0) } : nil
            VStack(spacing: 48) {
                FocusDeck(cards: Array(queue.prefix(3)), finishing: finishing, sinking: sinking,
                          position: "Task \(min(done + 1, total)) of \(total)", spoken: $spoken,
                          tick: { finish($0) }, later: putOff, placed: { topFrame = $0 })
                // The two ways on, quiet, under the deck (the box on the card finishes the task too).
                FocusActions(canPutOff: queue.count > 1, done: { finish(top) }, later: { self.putOff(top) })
            }
        } else if total > 0 {
            AllDone(isToday: day == clock.today, spoken: $spoken, back: leave)
        } else {
            Text("Nothing is planned for this day.")
                .font(.token(Tokens.Typography.callout))
                .foregroundStyle(.ink2)
                .multilineTextAlignment(.center)
        }
    }

    /// A key from a keyboard (FocusKeys).
    private func key(_ key: FocusKeys.Key) {
        keysUsed = true
        switch key {
        case .done: finishTop()
        case .later: putOffTop()
        case .jot: capturing = true
        case .leave: leave()
        }
    }

    // MARK: The queue

    /// What focus works through: the day's open tasks in the list's order, those put off last. A task just ticked stays
    /// on top while its tick plays.
    private func queue(_ all: [TaskItem]) -> [TaskItem] {
        let open = TaskSorting.sorted(all.filter { !$0.done || $0.id == finishing }, by: prefs.sort)
        let deferred = later.compactMap { id in open.first { $0.id == id } }
        return open.filter { !later.contains($0.id) } + deferred
    }

    private var current: [TaskItem] { queue(store.tasks(on: day)) }

    // MARK: Done

    private func finishTop() {
        if let top = current.first { finish(top) }
    }

    /// Ticks the task (Undo can take it back): the tick draws and the words are crossed out, then the card turns to dust
    /// and the next one rises into its place.
    private func finish(_ task: TaskItem) {
        guard finishing == nil, store.task(task.id)?.done == false, current.first?.id == task.id else { return }
        doneHere += 1
        store.toggle(task.id)
        finishing = task.id
        UIAccessibility.post(notification: .announcement, argument: "“\(task.title)” is done")
        Task {
            try? await Task.sleep(for: .seconds(reduceMotion ? Tokens.Motion.reduced : Tokens.Motion.base))
            turnToDust(task.id)
        }
    }

    private func turnToDust(_ id: String) {
        guard finishing == id else { return }
        let cloud = store.task(id).flatMap { $0.done ? picture(of: $0) : nil }
        withTransaction(Transaction(animation: reduceMotion ? nil : Motion.travel)) {
            finishing = nil
            if let cloud { dust.append(cloud) }
        }
        if let cloud {
            Task {
                try? await Task.sleep(for: .seconds(cloud.duration))
                dust.removeAll { $0.id == cloud.id }
            }
        }
        speakNext()
    }

    /// The card as it was when it went (its face, its box ticked, its words crossed out), as a picture to turn to dust.
    private func picture(of task: TaskItem) -> Dust? {
        let frame = topFrame
        guard frame.width > 4, frame.height > 4 else { return nil }
        // A picture of a very tall card is drawn a little coarser (it's coming apart anyway).
        let scale = min(displayScale, (1_500_000 / (frame.width * frame.height)).squareRoot())
        let card = FocusCardFace(task: task, finished: true)
            .frame(width: frame.width, height: frame.height, alignment: .top)
            .background { FocusCardSurface(depth: 0, lifted: false) }
            .environment(\.colorScheme, colorScheme)
            .environment(\.palette, palette)
            .environment(\.dynamicTypeSize, typeSize)
            .environment(\.horizontalSizeClass, sizeClass)
            .environment(\.legibilityWeight, legibilityWeight)
            .environment(\.displayScale, scale)
        let renderer = ImageRenderer(content: card)
        renderer.scale = scale
        renderer.isOpaque = false
        renderer.proposedSize = ProposedViewSize(frame.size)
        guard let image = renderer.cgImage else { return nil }
        return Dust(image: image, scale: scale, frame: frame, face: colorScheme == .dark ? Tokens.surface.dark : Tokens.surface.light,
                    reduced: reduceMotion)
    }

    // MARK: Later

    private func putOffTop() {
        if let top = current.first { putOff(top) }
    }

    /// Slips the card to the back of the deck (behind it, when more are waiting than the deck shows).
    private func putOff(_ task: TaskItem) {
        let queue = current
        guard finishing == nil, !task.done, queue.count > 1, queue.first?.id == task.id else { return }
        let beyond = queue.count > 3 && !reduceMotion
        withAnimation(reduceMotion ? nil : Motion.travel) {
            later = later.filter { $0 != task.id } + [task.id]
            if beyond { sinking = task }
        }
        putOffs += 1
        if beyond {
            Task {
                try? await Task.sleep(for: .milliseconds(420))
                if sinking?.id == task.id { sinking = nil }
            }
        }
        speakNext()
    }

    /// VoiceOver: on to the card that came up, or to the finish.
    private func speakNext() {
        guard UIAccessibility.isVoiceOverRunning else { return }
        Task {
            try? await Task.sleep(for: .milliseconds(600))
            spoken = current.first?.id ?? Self.finished
        }
    }

    // MARK: A thought for later

    /// Adds the task on this day without leaving focus; it waits at the back of the queue. The line itself says it's kept.
    private func jot() {
        let title = thought.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let task = store.create(title: String(title.prefix(TaskItem.titleMax)), date: day)
        later.append(task.id)
        thought = ""
        kept += 1
        UIAccessibility.post(notification: .announcement, argument: "Added for later")
    }

    // MARK: Leaving

    private func leave() {
        router.focus = false
    }
}

/// Done and Later under the deck, with their keys on a keyboard: on iOS 26 two buttons of glass (Done the prominent
/// one); before it, and with Reduce Transparency, quiet words as on the web.
private struct FocusActions: View {
    let canPutOff: Bool
    let done: () -> Void
    let later: () -> Void
    @Environment(\.showsKeyHints) private var keyHints
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency
    @Environment(\.palette) private var palette

    var body: some View {
        if #available(iOS 26.0, *) {
            if reduceTransparency { quiet } else { glass }
        } else {
            quiet
        }
    }

    @available(iOS 26.0, *)
    private var glass: some View {
        GlassEffectContainer(spacing: 12) {
            HStack(spacing: 12) {
                Button(action: done) {
                    HStack(spacing: 6) {
                        Image(systemName: "checkmark")
                            .font(.footnote.weight(.semibold))
                            .accessibilityHidden(true)
                        Text("Done")
                        if keyHints { KeyHint(key: "Space", tone: .onPrimary) }
                    }
                    // The accent's own ink on it: white on black, black on the light accent of dark mode.
                    .foregroundStyle(palette.onAccent)
                    .padding(.horizontal, 4)
                }
                .buttonStyle(.glassProminent)
                .tint(palette.accent)
                .accessibilityLabel("Done")
                .accessibilityIdentifier("focus.done")
                if canPutOff {
                    Button(action: later) {
                        HStack(spacing: 6) {
                            Text("Later")
                            if keyHints { KeyHint(key: "→") }
                        }
                        .foregroundStyle(.ink)
                        .padding(.horizontal, 4)
                    }
                    .buttonStyle(.glass)
                    .accessibilityLabel("Later")
                    .accessibilityHint("Puts the task at the end of the queue")
                    .accessibilityIdentifier("focus.later")
                }
            }
        }
        .font(.subheadline.weight(.semibold))
        .lineLimit(1)
        .controlSize(.large)
    }

    private var quiet: some View {
        HStack(spacing: 4) {
            Button(action: done) {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 10, weight: .semibold))
                        .accessibilityHidden(true)
                    Text("Done")
                    if keyHints { KeyHint(key: "Space") }
                }
            }
            .buttonStyle(QuietButtonStyle())
            .accessibilityLabel("Done")
            .accessibilityIdentifier("focus.done")
            if canPutOff {
                Button(action: later) {
                    HStack(spacing: 8) {
                        Text("Later")
                        if keyHints { KeyHint(key: "→") }
                    }
                }
                .buttonStyle(QuietButtonStyle())
                .accessibilityLabel("Later")
                .accessibilityHint("Puts the task at the end of the queue")
                .accessibilityIdentifier("focus.later")
            }
        }
    }
}

/// The web's plain button: gray words that darken when pressed, no frame.
private struct QuietButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.footnote.weight(.medium))
            .foregroundStyle(configuration.isPressed ? Color.ink : Color.ink2)
            .lineLimit(1)
            .padding(.leading, 10)
            .padding(.trailing, 8)
            .frame(minHeight: 32)
            .background(configuration.isPressed ? Color.line : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .tapTarget()
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
    }
}

/// The line at the foot: a thought that comes up on the way is written down here and kept for later, without leaving.
/// When it's kept, the line says so itself for a moment.
private struct ThoughtLine: View {
    @Binding var text: String
    var capturing: FocusState<Bool>.Binding
    let kept: Bool
    let regular: Bool
    let submit: () -> Void

    @Environment(\.showsKeyHints) private var keyHints
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        let focused = capturing.wrappedValue
        HStack(spacing: 10) {
            ZStack {
                if kept {
                    Image(systemName: "checkmark")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(.ink)
                        .transition(reduceMotion ? .opacity : .opacity.combined(with: .scale(scale: 0.96)).combined(with: .offset(y: -3)))
                } else {
                    Image(systemName: Icon.plus)
                        .font(.system(size: 13, weight: .light))
                }
            }
            .frame(width: 16, height: 16)
            .accessibilityHidden(true)
            TextField("", text: $text)
                .focused(capturing)
                .foregroundStyle(.ink)
                .submitLabel(.done)
                .onSubmit(submit)
                // Esc while typing leaves the line, not focus (as on the web).
                .onKeyPress(.escape) {
                    capturing.wrappedValue = false
                    return .handled
                }
                .onChange(of: text) { _, now in
                    if now.count > TaskItem.titleMax { text = String(now.prefix(TaskItem.titleMax)) }
                }
                .accessibilityLabel("Add a task for later")
                .accessibilityIdentifier("focus.capture")
                // The words on the empty line, in the ink as on the web; "Added for later" once a thought is kept.
                .background(alignment: .leading) {
                    if text.isEmpty {
                        Text(kept ? "Added for later" : "Jot something down for later")
                            .foregroundStyle(.ink)
                            .lineLimit(1)
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                }
                .font(regular ? .footnote : .callout)
            if keyHints, !focused { KeyHint(key: "N") }
        }
        .foregroundStyle(focused ? Color.ink2 : Color.ink3)
        .modifier(ThoughtSurface(focused: focused))
        .onTapGesture { capturing.wrappedValue = true }
        .frame(maxWidth: 400)
        .padding(.horizontal, 12)
        .animation(Motion.out(Tokens.Motion.fast), value: focused)
        .animation(reduceMotion ? Motion.reduced : Motion.out(Tokens.Motion.fast), value: kept)
    }
}

/// The line's surface: on iOS 26 a capsule of glass; before it, and with Reduce Transparency, the web's quiet line, white
/// with a hairline while it's being typed in.
private struct ThoughtSurface: ViewModifier {
    let focused: Bool
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            if reduceTransparency { quiet(content) } else { glass(content) }
        } else {
            quiet(content)
        }
    }

    private func quiet(_ content: Content) -> some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
        return content
            .padding(.leading, 12)
            .padding(.trailing, 8)
            .frame(minHeight: 40)
            .background { shape.fill(focused ? Color.surface : .clear) }
            .overlay { shape.strokeBorder(focused ? Color.line2 : .clear, lineWidth: 1) }
            .contentShape(shape)
    }

    @available(iOS 26.0, *)
    private func glass(_ content: Content) -> some View {
        GlassEffectContainer {
            content
                .padding(.leading, 16)
                .padding(.trailing, 12)
                .frame(minHeight: 44)
                .glassEffect(.regular.interactive(), in: Capsule())
                .contentShape(Capsule())
        }
    }
}

/// Everything is done: where things stand, plainly, and the way back.
private struct AllDone: View {
    let isToday: Bool
    var spoken: AccessibilityFocusState<String?>.Binding
    let back: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            Text(isToday ? "That was the last one." : "Everything on this day is done.")
                .font(.token(Tokens.Typography.title2, weight: .semibold))
                .tracking(-0.02 * Tokens.Typography.title2.size)
                .foregroundStyle(.ink)
                .accessibilityAddTraits(.isHeader)
                .accessibilityFocused(spoken, equals: FocusView.finished)
            Text(isToday ? "Today’s list is finished." : "Nothing is left open here.")
                .font(.token(Tokens.Typography.body))
                .foregroundStyle(.ink2)
                .padding(.top, 4)
            Button(action: back) {
                Text("Back to the list")
            }
            .buttonStyle(OutlinedButtonStyle())
            .padding(.top, 24)
            .accessibilityIdentifier("focus.back")
        }
        .multilineTextAlignment(.center)
    }
}

/// The web's secondary button: white with a hairline frame.
private struct OutlinedButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
        configuration.label
            .font(.footnote.weight(.medium))
            .foregroundStyle(.ink)
            .padding(.horizontal, 12)
            .frame(minHeight: 32)
            .background(configuration.isPressed ? Color.surface3 : .surface, in: shape)
            .overlay(shape.strokeBorder(.line2, lineWidth: 1))
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .tapTarget()
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
    }
}
