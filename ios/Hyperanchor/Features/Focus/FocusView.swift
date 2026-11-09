import SwiftUI

/// Focus mode: one task at a time, on the top card of a small stack — the edges peeking out below are what's
/// left. Done lifts the card away and the next one rises into place; Not now sends it to the back. The rest of
/// the day is one quiet line, so there is nothing else to choose between. Made with ADHD in mind.
struct FocusView: View {
    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(\.dismiss) private var dismiss
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// "Not now": sent to the back of the queue for this session.
    @State private var later: [String] = []
    /// Just ticked off: stays on top while its check plays.
    @State private var settling: Set<String> = []
    /// The card that just left the top, kept for a moment (as it last looked) so it can animate away.
    @State private var departure: Departure?
    @State private var thought = ""
    @State private var confetti = 0
    /// The height of everything on screen, for centering it.
    @State private var contentHeight: CGFloat = 0
    @FocusState private var capturing: Bool
    /// The screen itself has keyboard focus (for → and Esc) whenever the field doesn't.
    @FocusState private var keysHere: Bool
    /// A hardware key was pressed here, so there is a keyboard (key hints show on iPad).
    @State private var keysUsed = false
    /// VoiceOver moves on to the next task's title when the card on top changes.
    @AccessibilityFocusState private var spoken: String?

    private var day: DayKey { router.selected }

    var body: some View {
        let all = store.tasks(on: day)
        let queue = queue(all)
        let task = queue.first
        let next = queue.dropFirst().first
        let done = all.count(where: \.done)

        NavigationStack {
            GeometryReader { geo in
                ScrollViewReader { proxy in
                    ScrollView {
                        VStack(spacing: 0) {
                            if let task {
                                FocusProgress(done: done, total: all.count)
                                stack(task, hasNext: next != nil, waiting: queue.count - 1)
                                    .padding(.top, 24)
                                upNext(next, after: max(0, queue.count - 2))
                                    .padding(.top, 40)
                            } else if !all.isEmpty {
                                AllDone(isToday: day == clock.today) { dismiss() }
                            } else {
                                Text("Nothing is planned for this day.")
                                    .font(.body)
                                    .foregroundStyle(.ink2)
                                    .multilineTextAlignment(.center)
                                    .modifier(Arrival(.rise))
                            }

                            capture
                                .padding(.top, 32)
                                .id("capture")
                        }
                        .padding(.horizontal, 20)
                        .padding(.vertical, 24)
                        .frame(maxWidth: 600)
                        // Centered on screen. When the next card is taller or shorter, its top edge stays where the
                        // last one was (so it rises into the same place) and then everything glides back to the middle
                        // (with Reduce Motion it simply re-centers).
                        .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { height in
                            if contentHeight == 0 || reduceMotion {
                                contentHeight = height
                            } else {
                                withAnimation(.smooth(duration: 0.4)) { contentHeight = height }
                            }
                        }
                        .padding(.top, contentHeight > 0 ? max(0, (geo.size.height - contentHeight) / 2) : 0)
                        .frame(maxWidth: .infinity, minHeight: geo.size.height, alignment: contentHeight > 0 ? .top : .center)
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    .scrollDismissesKeyboard(.interactively)
                    // A hardware keyboard, as on the web: → puts the task off, Esc leaves (Space and N come from the
                    // app's menu commands). The screen holds keyboard focus whenever the field doesn't, so the keys
                    // reach it before the system's focus navigation does.
                    .focusable()
                    .focusEffectDisabled()
                    .focused($keysHere)
                    .onKeyPress(keys: [.rightArrow, .escape]) { press in
                        keysUsed = true
                        if capturing {
                            // Typing: arrows move the caret; Esc leaves the field (as on the web), not focus mode.
                            guard press.key == .escape else { return .ignored }
                            capturing = false
                            return .handled
                        }
                        if press.key == .escape {
                            dismiss()
                        } else if let task, next != nil, !task.done {
                            putOff(task)
                        }
                        return .handled
                    }
                    .onAppear { keysHere = true }
                    .onChange(of: capturing) { _, now in
                        guard now else {
                            keysHere = true
                            return
                        }
                        Task {
                            try? await Task.sleep(for: .milliseconds(350))
                            withAnimation { proxy.scrollTo("capture", anchor: .bottom) }
                        }
                    }
                }
            }
            .background(.canvas)
            .overlay { ConfettiView(trigger: confetti) }
            .navigationTitle(Dates.relative(day, today: clock.today) ?? Dates.dowFull[day.weekday])
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // In focus the header keeps one way out; new thoughts go into the field under the card.
                ToolbarItem(placement: .topBarTrailing) { ExitButton { dismiss() } }
            }
            .toastHost()
        }
        .tint(.ink)
        .readsHardwareKeyboard(used: keysUsed)
        .onChange(of: task == nil && !all.isEmpty) { was, now in
            if now, !was { confetti += 1 }
        }
        // Space and N, from the app's keyboard commands.
        .onChange(of: router.focusCompleteRequest) { _, _ in
            keysUsed = true
            if let task { complete(task) }
        }
        .onChange(of: router.focusCaptureRequest) { _, _ in
            keysUsed = true
            capturing = true
        }
    }

    // MARK: Pieces

    /// The task on top of the stack; the edges under it are the tasks still waiting.
    private func stack(_ task: TaskItem, hasNext: Bool, waiting: Int) -> some View {
        FocusCard(task: task, hasNext: hasNext, spoken: $spoken, done: { complete(task) }, later: { putOff(task) })
            .modifier(Arrival(departure == nil ? .none : .next))
            .id(task.id)
            .background(alignment: .bottom) { StackEdges(waiting: waiting) }
            // Above the new card, so a taller one leaving never shows its edge from under it.
            .overlay(alignment: .top) {
                if let departure { departing(departure) }
            }
    }

    private func departing(_ departure: Departure) -> some View {
        FocusCard(task: departure.task, hasNext: departure.hasNext, live: false)
            .fixedSize(horizontal: false, vertical: true)
            .modifier(Leave(finished: departure.finished))
            .id(departure.id)
            .allowsHitTesting(false)
            .accessibilityHidden(true)
    }

    @ViewBuilder
    private func upNext(_ next: TaskItem?, after: Int) -> some View {
        Group {
            if let next {
                Text("Up next: ").foregroundStyle(.ink3)
                    + Text(next.title).foregroundStyle(.ink2)
                    + Text(after > 0 ? " · \(after) more after that" : "").foregroundStyle(.ink3)
            } else {
                Text("This is the last one.").foregroundStyle(.ink3)
            }
        }
        .font(.footnote)
        .lineLimit(typeSize.isAccessibilitySize ? 3 : 1)
        .multilineTextAlignment(.center)
        .padding(.horizontal, 16)
    }

    /// "Something else on your mind?" — a task for later, without leaving focus. A tap anywhere in the box types.
    private var capture: some View {
        CaptureField(thought: $thought, capturing: $capturing, submit: captureThought)
            .frame(maxWidth: 420)
    }

    // MARK: Queue

    /// Open tasks in list order, "Not now" ones last; a task just ticked off stays first while its check plays.
    private func queue(_ all: [TaskItem]) -> [TaskItem] {
        let list = TaskSorting.sorted(all.filter { !$0.done || settling.contains($0.id) }, by: router.sort)
        let deferred = later.compactMap { id in list.first { $0.id == id } }
        return list.filter { !later.contains($0.id) } + deferred
    }

    /// Changes the queue; when that changes the card on top, the old card stays a moment (as it looked) to animate away.
    private func advance(_ change: () -> Void) {
        let before = queue(store.tasks(on: day))
        change()
        let after = queue(store.tasks(on: day))
        guard let was = before.first, was.id != after.first?.id else { return }
        let leaving = Departure(task: was, hasNext: before.count > 1)
        departure = leaving
        Task {
            try? await Task.sleep(for: .milliseconds(450))
            if departure?.id == leaving.id { departure = nil }
        }
        if let now = after.first, UIAccessibility.isVoiceOverRunning {
            Task {
                try? await Task.sleep(for: .milliseconds(500))
                spoken = now.id
            }
        }
    }

    private func complete(_ task: TaskItem) {
        guard !task.done else { return }
        settling.insert(task.id)
        store.setDone(task.id, true)
        Task {
            try? await Task.sleep(for: .milliseconds(900))
            advance { _ = settling.remove(task.id) }
        }
    }

    private func putOff(_ task: TaskItem) {
        guard !task.done else { return }
        advance { later = later.filter { $0 != task.id } + [task.id] }
    }

    /// Adds a task on this day without leaving focus; it waits at the end of the queue.
    private func captureThought() {
        let title = thought.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !title.isEmpty else { return }
        let task = store.create(title: String(title.prefix(TaskItem.titleMax)), date: day)
        later.append(task.id)
        thought = ""
        toaster.show("Added for later")
    }
}

/// The card that just left the top of the stack.
private struct Departure: Identifiable {
    let id = UUID()
    let task: TaskItem
    /// It showed Not now as well; it keeps its buttons while it animates away.
    let hasNext: Bool
    /// Done lifts it away; Not now sends it to the back.
    var finished: Bool { task.done }
}

// MARK: - The card

private struct FocusCard: View {
    let task: TaskItem
    let hasNext: Bool
    /// The card on top. The one leaving is a still copy: no shortcuts, no identifiers.
    var live = true
    var spoken: AccessibilityFocusState<String?>.Binding?
    var done: () -> Void = {}
    var later: () -> Void = {}

    @Environment(\.horizontalSizeClass) private var sizeClass
    @Environment(\.dynamicTypeSize) private var typeSize
    @Environment(\.showsKeyHints) private var keyHints

    private var regular: Bool { sizeClass == .regular }

    var body: some View {
        VStack(alignment: .leading, spacing: 28) {
            HStack(alignment: .top, spacing: 16) {
                TaskCheckbox(task: task, size: 28, toggle: done)
                    .padding(-8)
                    .padding(.top, regular ? 4 : 1)
                VStack(alignment: .leading, spacing: 8) {
                    title
                    if !task.notes.isEmpty {
                        Text(task.notes)
                            .font(.subheadline)
                            .lineSpacing(4)
                            .foregroundStyle(.ink2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            buttons
        }
        .padding(regular ? 28 : 20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.surface, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .elevation(Tokens.Shadow.float, cornerRadius: 24)
    }

    @ViewBuilder
    private var title: some View {
        let text = Text(task.title)
            .font(regular ? .title.weight(.semibold) : .title2.weight(.semibold))
            .tracking(regular ? -0.7 : -0.55)
            .foregroundStyle(task.done ? .ink3 : .ink)
            .fixedSize(horizontal: false, vertical: true)
            .animation(.easeOut(duration: 0.3), value: task.done)
            .accessibilityAddTraits(.isHeader)
        if let spoken {
            text.accessibilityFocused(spoken, equals: task.id)
        } else {
            text
        }
    }

    /// Phones: two equal halves (Done takes the whole width for the last task); iPad: in a row under the title.
    /// At the largest text sizes they stack.
    @ViewBuilder
    private var buttons: some View {
        let stacked = typeSize.isAccessibilitySize
        let fill = !regular || stacked
        let layout = stacked ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 8))
        layout {
            Button(action: done) {
                HStack(spacing: 8) {
                    Image(systemName: "checkmark").font(.footnote.weight(.bold))
                    Text("Done")
                    if keyHints { KeyHint(key: "Space", tone: .onPrimary).padding(.leading, 2) }
                }
                .padding(.vertical, 6) // room once large text outgrows the button's height
            }
            .buttonStyle(PrimaryButtonStyle(height: 46, fill: fill))
            .disabled(task.done)
            .accessibilityLabel("Done")
            .accessibilityIdentifier(live ? "focus.done" : "")
            if hasNext {
                Button(action: later) {
                    HStack(spacing: 8) {
                        Text("Not now")
                        if keyHints { KeyHint(key: "→", tone: .onSecondary).padding(.leading, 2) }
                    }
                    .padding(.vertical, 6)
                    .frame(maxWidth: fill ? .infinity : nil)
                }
                .buttonStyle(SecondaryButtonStyle(height: 46))
                .disabled(task.done)
                .accessibilityLabel("Not now")
                .accessibilityHint("Puts the task at the end of the queue")
                .accessibilityIdentifier(live ? "focus.later" : "")
            }
        }
        .padding(.leading, fill ? 0 : 44)
    }
}

/// The edges of the cards still waiting, peeking out under the one on top.
private struct StackEdges: View {
    let waiting: Int

    var body: some View {
        GeometryReader { geo in
            let w = geo.size.width
            ZStack(alignment: .bottom) {
                if waiting > 1 {
                    edge(radius: 20, fill: .surface2)
                        .padding(.horizontal, w * 0.09)
                        .offset(y: 18)
                        .transition(.opacity)
                }
                if waiting > 0 {
                    edge(radius: 22, fill: .surface)
                        .padding(.horizontal, w * 0.045)
                        .offset(y: 9)
                        .transition(.opacity)
                }
            }
            .frame(width: w, height: geo.size.height, alignment: .bottom)
        }
        .animation(.easeOut(duration: 0.3), value: waiting)
        .accessibilityHidden(true)
    }

    private func edge(radius: CGFloat, fill: Color) -> some View {
        RoundedRectangle(cornerRadius: radius, style: .continuous)
            .fill(fill)
            .frame(height: 64)
            .elevation(Tokens.Shadow.lift, cornerRadius: radius)
    }
}

// MARK: - Progress

/// Where you are in the day: one segment per task (a plain bar for long days), the current one half-lit.
private struct FocusProgress: View {
    let done: Int
    let total: Int
    @Environment(\.palette) private var palette
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        let label = "Task \(min(done + 1, total)) of \(total)"
        let layout = typeSize.isAccessibilitySize ? AnyLayout(VStackLayout(spacing: 8)) : AnyLayout(HStackLayout(spacing: 12))
        layout {
            Group {
                if total <= 12 {
                    HStack(spacing: 4) {
                        ForEach(0..<total, id: \.self) { i in
                            Capsule()
                                .fill(i < done ? palette.accent : i == done ? palette.accent.opacity(0.45) : palette.accentTrack)
                                .frame(minWidth: 4, maxWidth: 20)
                                .frame(height: 6)
                        }
                    }
                } else {
                    Capsule()
                        .fill(palette.accentTrack)
                        .frame(width: 160, height: 6)
                        .overlay(alignment: .leading) {
                            Capsule().fill(palette.accent).frame(width: 160 * Double(done) / Double(total))
                        }
                }
            }
            .accessibilityHidden(true)
            Text(label)
                .font(.footnote)
                .foregroundStyle(.ink3)
                .monospacedDigit()
                .fixedSize()
        }
        .animation(.easeOut(duration: 0.5), value: done)
        .accessibilityElement(children: .combine)
    }
}

// MARK: - Capture

private struct CaptureField: View {
    @Binding var thought: String
    var capturing: FocusState<Bool>.Binding
    let submit: () -> Void

    @Environment(\.palette) private var palette
    @Environment(\.showsKeyHints) private var keyHints

    var body: some View {
        let shape = RoundedRectangle(cornerRadius: 12, style: .continuous)
        let focused = capturing.wrappedValue
        HStack(spacing: 8) {
            Image(systemName: "plus")
                .font(.footnote.weight(.medium))
                .foregroundStyle(.ink3)
                .allowsHitTesting(false)
                .accessibilityHidden(true)
            TextField("Something else on your mind? Jot it down", text: $thought)
                .focused(capturing)
                .submitLabel(.done)
                .onSubmit(submit)
                .accessibilityLabel("Add a task for later")
                .accessibilityIdentifier("focus.capture")
            if keyHints, !focused { KeyHint(key: "N").allowsHitTesting(false) }
        }
        .font(.subheadline)
        .padding(.leading, 14)
        .padding(.trailing, 10)
        .frame(minHeight: 44)
        // The text field is one line tall; a tap anywhere else in the box starts typing too.
        .background {
            shape.fill(focused ? Color.surface : Color.surface2)
                .onTapGesture { capturing.wrappedValue = true }
        }
        .overlay(shape.strokeBorder(focused ? palette.accent : Color.line).allowsHitTesting(false))
        // The soft halo around the field while typing, as on the web.
        .background {
            if focused {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(palette.accentSoft, lineWidth: 4)
                    .padding(-4)
            }
        }
        .animation(.easeOut(duration: 0.15), value: focused)
    }
}

// MARK: - All done

private struct AllDone: View {
    let isToday: Bool
    let back: () -> Void
    @Environment(\.palette) private var palette
    @State private var cheer = false

    var body: some View {
        VStack(spacing: 0) {
            VStack(spacing: 0) {
                Burst(active: cheer, radius: 46) {
                    Image(systemName: "checkmark")
                        .font(.system(size: 24, weight: .bold))
                        .foregroundStyle(.onAccent)
                        .frame(width: 64, height: 64)
                        .background(palette.accent, in: Circle())
                        .background(palette.accentSoft, in: Circle().inset(by: -8))
                }
                Text(isToday ? "All done for today." : "Everything on this day is done.")
                    .font(.title2.weight(.semibold))
                    .tracking(-0.44)
                    .foregroundStyle(.ink)
                    .padding(.top, 28)
                Text("Nice work. Take a breath.")
                    .font(.subheadline)
                    .foregroundStyle(.ink2)
                    .padding(.top, 6)
            }
            .accessibilityElement(children: .combine)
            Button("Back to the list", action: back)
                .buttonStyle(SecondaryButtonStyle())
                .padding(.top, 24)
                .accessibilityIdentifier("focus.back")
        }
        .multilineTextAlignment(.center)
        .modifier(Arrival(.rise))
        .onAppear { cheer = true }
    }
}

// MARK: - Header

/// "Exit focus" — the one way out, in the header (Esc on a keyboard).
private struct ExitButton: View {
    let action: () -> Void
    @Environment(\.showsKeyHints) private var keyHints

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Text("Exit focus")
                if keyHints { KeyHint(key: "Esc") }
            }
        }
        .accessibilityLabel("Exit focus")
        .accessibilityIdentifier("focus.exit")
    }
}

// MARK: - Icon

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

// MARK: - Motion

/// How a card or message comes in. Reduce Motion: a plain fade, no movement.
private struct Arrival: ViewModifier {
    enum Kind {
        /// No animation (the first card: the screen itself slides up).
        case none
        /// The next card rises into place on the stack.
        case next
        /// A message rises a little (all done, nothing planned).
        case rise
    }

    let kind: Kind
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown: Bool

    init(_ kind: Kind) {
        self.kind = kind
        _shown = State(initialValue: kind == .none)
    }

    func body(content: Content) -> some View {
        let still = shown || reduceMotion
        content
            .opacity(shown ? 1 : 0)
            .scaleEffect(still || kind != .next ? 1 : 0.97)
            .offset(y: still ? 0 : kind == .next ? 14 : 8)
            .onAppear {
                guard !shown else { return }
                let ease: Animation = kind == .next
                    ? .timingCurve(0.2, 0.8, 0.2, 1, duration: reduceMotion ? 0.3 : 0.45).delay(0.08)
                    : .timingCurve(0.2, 0.8, 0.2, 1, duration: 0.32)
                withAnimation(ease) { shown = true }
            }
    }
}

/// The card leaving the top: Done lifts it away, Not now sinks it to the back. Reduce Motion: it fades.
private struct Leave: ViewModifier {
    let finished: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var gone = false

    func body(content: Content) -> some View {
        let moving = gone && !reduceMotion
        content
            .opacity(gone ? 0 : 1)
            .scaleEffect(moving ? (finished ? 0.98 : 0.94) : 1)
            .offset(y: moving ? (finished ? -28 : 16) : 0)
            .onAppear {
                let ease: Animation = reduceMotion
                    ? .easeOut(duration: 0.25)
                    : finished ? .timingCurve(0.2, 0.8, 0.2, 1, duration: 0.4) : .easeIn(duration: 0.34)
                withAnimation(ease) { gone = true }
            }
    }
}
