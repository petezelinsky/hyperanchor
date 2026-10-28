import SwiftUI

// The sign-in screen's showcase, as on the web (src/components/landing/Showcase.tsx): the same five scenes, timings
// and captions. Each slide is a short scene drawn from its own clock `t` (milliseconds since the slide appeared), so a
// scene can be replayed, frozen while it fades out, or shown finished (Reduce Motion) just by choosing `t`.
private let step = 50
private let ease = Animation.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.6)

// MARK: - 1 · Today: the list ticks itself off, then celebrates

private let todayTasks = [
    (title: "Plan the week", note: "Three things that matter most"),
    (title: "Send the proposal to Dana", note: ""),
    (title: "Gym, 45 minutes", note: ""),
    (title: "Pick up flowers for Sam", note: "Peonies, if they have them"),
]
private let tickAt = [1600, 2550, 3500, 4450]

private struct TodayScene: View {
    let t: Int
    /// The two floating cards, when the panel is wide enough for them.
    let chips: Bool

    var body: some View {
        let done = tickAt.count { t >= $0 }
        let all = done == todayTasks.count
        VStack(alignment: .leading, spacing: 0) {
            HStack(alignment: .top, spacing: 16) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Today")
                        .font(.system(size: 20, weight: .bold))
                        .tracking(-0.4)
                    Text(all ? "All done. Nice work!" : "\(done) of \(todayTasks.count) done")
                        .font(.system(size: 13, weight: all ? .medium : .regular))
                        .monospacedDigit()
                        .foregroundStyle(all ? .ink : .ink3)
                        .animation(.easeOut(duration: 0.3), value: all)
                }
                Spacer(minLength: 0)
                Burst(active: all, radius: 26) {
                    ProgressRing(value: Double(done) / Double(todayTasks.count), size: 36, lineWidth: 3.5)
                }
            }
            .padding(.bottom, 16)
            ForEach(todayTasks.indices, id: \.self) { i in
                HStack(alignment: .top, spacing: 12) {
                    CheckCircle(checked: i < done)
                    VStack(alignment: .leading, spacing: 0) {
                        Text(todayTasks[i].title)
                            .font(.system(size: 14))
                            .foregroundStyle(i < done ? .ink3 : .ink)
                            .frame(minHeight: 20)
                            .animation(.easeOut(duration: 0.3), value: i < done)
                        if !todayTasks[i].note.isEmpty {
                            Text(todayTasks[i].note).font(.system(size: 12.5)).foregroundStyle(.ink3)
                        }
                    }
                    .lineLimit(1)
                    Spacer(minLength: 0)
                }
                .padding(.vertical, 10)
                .overlay(alignment: .top) { Rectangle().fill(.line).frame(height: 1) }
            }
            HStack(spacing: 12) {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .medium))
                    .frame(width: 20)
                Text("Add a task")
            }
            .font(.system(size: 14))
            .foregroundStyle(.ink3)
            .padding(.top, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .overlay(alignment: .top) { Rectangle().fill(.line).frame(height: 1) }
        }
        .padding(20)
        .sceneCard()
        .overlay(alignment: .topLeading) {
            if chips {
                StreakChip()
                    .offset(x: -56, y: -30 + float(t, period: 6000))
                    .animation(.linear(duration: Double(step) / 1000), value: t)
            }
        }
        .overlay(alignment: .topTrailing) {
            if chips {
                KeyChip(t: t)
                    .offset(x: 70, y: 196 + float(t, period: 7000, delay: 1000))
                    .animation(.linear(duration: Double(step) / 1000), value: t)
            }
        }
    }

    /// Bobs up 8 points and back once a period (the web's `float-y`).
    private func float(_ t: Int, period: Int, delay: Int = 0) -> CGFloat {
        guard t > delay else { return 0 }
        return -4 * (1 - cos(2 * .pi * Double(t - delay) / Double(period)))
    }
}

private struct StreakChip: View {
    @Environment(\.palette) private var palette

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "flame.fill")
                .font(.system(size: 15))
                .foregroundStyle(palette.accent)
                .frame(width: 32, height: 32)
                .background(.surface3, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 0) {
                Text("12-day streak").font(.system(size: 13, weight: .semibold))
                Text("Keep it going").font(.system(size: 11.5)).foregroundStyle(.ink3)
            }
        }
        .padding(.leading, 10)
        .padding(.trailing, 14)
        .padding(.vertical, 10)
        .chip()
    }
}

/// "N  New task", the key pressing itself every few seconds (iPad has the same shortcut as the web).
private struct KeyChip: View {
    let t: Int

    var body: some View {
        // Down over 0.2 s, back up over 0.25 s, every 3.2 s after the first 1.2 s (the web's `key-press`).
        let phase = t < 1200 ? 3200 : (t - 1200) % 3200
        let down: CGFloat = phase < 192 ? CGFloat(phase) / 192 : phase < 448 ? 1 - CGFloat(phase - 192) / 256 : 0
        HStack(spacing: 10) {
            Text("N")
                .font(.system(size: 13, weight: .semibold))
                .frame(minWidth: 28, minHeight: 28)
                .background(.surface, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(down > 0.5 ? Color.ink : Color.line2, lineWidth: 1)
                }
                .background {
                    RoundedRectangle(cornerRadius: 7, style: .continuous).fill(down > 0.5 ? Color.ink : Color.line2).offset(y: 3 - 2 * down)
                }
                .offset(y: 2 * down)
            Text("New task").font(.system(size: 13, weight: .medium))
        }
        .padding(.leading, 10)
        .padding(.trailing, 14)
        .padding(.vertical, 9)
        .chip()
    }
}

// MARK: - 2 · Capture: a task types itself, Return lights up, it drops into the list

private let phrase = "Book flights to Lisbon"
private let charAt: [Int] = {
    var at = 500
    return (0..<phrase.count).map { k in
        at += 45 + (k % 4) * 18
        return at
    }
}()
private let enterAt = charAt[charAt.count - 1] + 450
private let addedAt = enterAt + 320

private struct CaptureScene: View {
    let t: Int
    @Environment(\.palette) private var palette

    var body: some View {
        let typed = charAt.count { t >= $0 }
        let added = t >= addedAt
        let pressed = t >= enterAt && !added
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Image(systemName: "plus")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(.ink3)
                HStack(spacing: 1) {
                    if added {
                        Text("New task").foregroundStyle(.ink3)
                    } else {
                        Text(phrase.prefix(typed))
                        // The caret blinks once a second.
                        Rectangle()
                            .fill(palette.accent)
                            .frame(width: 1.5, height: 16)
                            .opacity((t / 500) % 2 == 0 ? 1 : 0)
                    }
                }
                .font(.system(size: 14))
                .lineLimit(1)
                .frame(maxWidth: .infinity, alignment: .leading)
                Image(systemName: "return")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(pressed ? .onAccent : .ink2)
                    .frame(width: 26, height: 26)
                    .background(pressed ? palette.accent : .surface3, in: RoundedRectangle(cornerRadius: 7, style: .continuous))
                    .offset(y: pressed ? 1 : 0)
                    .animation(.easeOut(duration: 0.15), value: pressed)
            }
            .padding(.leading, 14)
            .padding(.trailing, 10)
            .frame(height: 48)
            .background(.surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(.line2, lineWidth: 1) }

            // Four rows in a three-row window: the new task slides the list down into view.
            VStack(spacing: 2) {
                row(phrase, done: false)
                    .background(added && t < addedAt + 1600 ? Color.surface3 : .clear, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .animation(.easeOut(duration: 0.8), value: t < addedAt + 1600)
                    .opacity(added ? 1 : 0)
                    .animation(.easeOut(duration: 0.35), value: added)
                row("Renew passport", done: true).foregroundStyle(.ink3)
                row("Pack for the weekend", done: false)
                row("Water the plants", done: false)
            }
            .offset(y: added ? 0 : -38)
            .animation(.easeOut(duration: 0.45), value: added)
            .frame(height: 112, alignment: .top)
            .clipped()
        }
        .padding(14)
        .sceneCard()
    }

    private func row(_ title: String, done: Bool) -> some View {
        HStack(spacing: 10) {
            CheckCircle(checked: done, size: 18)
            Text(title).lineLimit(1)
        }
        .font(.system(size: 13.5))
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, minHeight: 36, maxHeight: 36, alignment: .leading)
    }
}

// MARK: - 3 · Focus: one task; Done is pressed, it's ticked, the next one slides in

private let queue = ["Send the proposal to Dana", "Gym, 45 minutes", "Pick up flowers for Sam"]
private let focusStep = 2800
private let focusDone = 1900

private struct FocusScene: View {
    let t: Int
    @Environment(\.palette) private var palette

    var body: some View {
        let i = min(queue.count - 1, t / focusStep)
        let local = t - i * focusStep
        let done = local >= focusDone
        let pressed = local >= focusDone - 220 && !done
        let progress = CGFloat(i + (done ? 1 : 0)) / CGFloat(queue.count)
        VStack(alignment: .leading, spacing: 0) {
            HStack {
                Text("NOW")
                    .font(.system(size: 11, weight: .medium))
                    .tracking(0.66)
                    .foregroundStyle(.ink3)
                Spacer(minLength: 16)
                Capsule()
                    .fill(palette.accentTrack)
                    .frame(width: 96, height: 4)
                    .overlay(alignment: .leading) {
                        Capsule().fill(palette.accent).frame(width: 96 * progress)
                    }
                    .animation(.easeOut(duration: 0.5), value: progress)
            }
            ZStack(alignment: .topLeading) {
                HStack(alignment: .top, spacing: 14) {
                    CheckCircle(checked: done, size: 24)
                    Text(queue[i])
                        .font(.system(size: 20, weight: .semibold))
                        .tracking(-0.4)
                        .foregroundStyle(done ? .ink3 : .ink)
                        .animation(.easeOut(duration: 0.3), value: done)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .id(i)
                .transition(.asymmetric(insertion: .opacity.combined(with: .offset(y: 8)), removal: .opacity.animation(.easeOut(duration: 0.1))))
            }
            .animation(.timingCurve(0.2, 0.8, 0.2, 1, duration: 0.32), value: i)
            .padding(.top, 16)

            HStack(spacing: 8) {
                HStack(spacing: 6) {
                    Image(systemName: "checkmark").font(.system(size: 10, weight: .bold))
                    Text("Done")
                }
                .foregroundStyle(.onPrimary)
                .padding(.leading, 12)
                .padding(.trailing, 14)
                .frame(height: 36)
                .background(pressed ? Tokens.primaryHover.color : .primaryFill, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                .scaleEffect(pressed ? 0.95 : 1)
                .animation(.easeOut(duration: 0.15), value: pressed)
                Text("Not now")
                    .padding(.horizontal, 14)
                    .frame(height: 36)
                    .background(.surface, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
                    .elevation(Tokens.Shadow.lift, cornerRadius: 10)
            }
            .font(.system(size: 13.5, weight: .medium))
            .padding(.leading, 38)
            .padding(.top, 20)

            (Text("Up next: ").foregroundStyle(.ink3) + Text(queue[(i + 1) % queue.count]).foregroundStyle(.ink2))
                .font(.system(size: 13))
                .lineLimit(1)
                .padding(.top, 14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .overlay(alignment: .top) { Rectangle().fill(.line).frame(height: 1) }
                .padding(.top, 20)
        }
        .padding(24)
        .sceneCard()
    }
}

// MARK: - 4 · Week: the days fill in one by one

/// true = done, false = still open; Thursday is "today".
private let week: [[Bool]] = [[true, true], [true, true, true], [true, false], [true, true, false], [false, false], [false], []]
private let weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
private let todayIndex = 3

private struct WeekScene: View {
    let t: Int
    @Environment(\.palette) private var palette

    var body: some View {
        let shown = t < 500 ? 0 : (t - 500) / 140 + 1
        HStack(spacing: 4) {
            ForEach(week.indices, id: \.self) { d in
                let today = d == todayIndex
                // How many bars come before this day's.
                let before = week[..<d].reduce(0) { $0 + $1.count }
                VStack(spacing: 6) {
                    Text(weekdays[d])
                        .font(.system(size: 11, weight: .medium))
                        .foregroundStyle(today ? palette.accentInk : .ink3)
                    Text("\(19 + d)")
                        .font(.system(size: today ? 14 : 15, weight: .semibold))
                        .foregroundStyle(today ? .onAccent : .ink2)
                        .frame(width: today ? 28 : nil, height: 28)
                        .background { if today { Circle().fill(palette.accent) } }
                    VStack(spacing: 5) {
                        ForEach(week[d].indices, id: \.self) { j in
                            let visible = before + j < shown
                            Capsule()
                                .fill(week[d][j] ? palette.accent : palette.accentTrack)
                                .frame(height: 7)
                                .scaleEffect(visible ? 1 : 0.75)
                                .opacity(visible ? 1 : 0)
                                .animation(.easeOut(duration: 0.3), value: visible)
                        }
                    }
                    .padding(.top, 6)
                    Spacer(minLength: 0)
                }
                .padding(.horizontal, 4)
                .padding(.top, 12)
                .frame(maxWidth: .infinity)
                .frame(height: 152)
                .background(today ? Color.surface3 : .clear, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            }
        }
        .padding(14)
        .sceneCard()
    }
}

// MARK: - 5 · Progress: the ring fills, the bars grow, the trend pops in

private let bars = [3, 5, 2, 6, 4, 7, 5]

private struct ProgressScene: View {
    let t: Int
    @Environment(\.palette) private var palette

    var body: some View {
        // Side by side where they fit, the chart under the ring where they don't.
        ViewThatFits(in: .horizontal) {
            HStack(spacing: 36) { ring; chart }
            VStack(spacing: 20) { ring; chart }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 24)
        .padding(.vertical, 28)
        .sceneCard()
    }

    private var fill: Bool { t >= 150 }

    private var ring: some View {
        let p = min(1, max(0, Double(t - 150) / 1200))
        return ZStack {
            Group {
                Circle().stroke(palette.accentTrack, lineWidth: 9)
                Circle()
                    .trim(from: 0, to: fill ? 0.78 : 0)
                    .stroke(palette.accent, style: StrokeStyle(lineWidth: 9, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .opacity(fill ? 1 : 0)
                    .animation(fill ? .timingCurve(0.2, 0.8, 0.2, 1, duration: 1.2) : nil, value: fill)
            }
            .padding(9)
            VStack(spacing: 0) {
                Text("\(Int((78 * (1 - pow(1 - p, 3))).rounded()))%")
                    .font(.system(size: 24, weight: .bold))
                    .tracking(-0.48)
                    .monospacedDigit()
                Text("done").font(.system(size: 11)).foregroundStyle(.ink3)
            }
        }
        .frame(width: 108, height: 108)
    }

    private var chart: some View {
        let trend = t >= 900
        return VStack(alignment: .leading, spacing: 10) {
            (Text("▲ 18% ").fontWeight(.semibold) + Text("vs last week").foregroundStyle(.ink2))
                .font(.system(size: 12))
                .padding(.horizontal, 9)
                .padding(.vertical, 3)
                .background(.surface3, in: Capsule())
                .opacity(trend ? 1 : 0)
                .offset(y: trend ? 0 : 6)
                .animation(.easeOut(duration: 0.4), value: trend)
            HStack(alignment: .bottom, spacing: 7) {
                ForEach(bars.indices, id: \.self) { i in
                    UnevenRoundedRectangle(topLeadingRadius: 4, topTrailingRadius: 4, style: .continuous)
                        .fill(i == 5 ? palette.accent : palette.accentTrack)
                        .frame(width: 14, height: 88 * CGFloat(bars[i]) / 7)
                        .scaleEffect(x: 1, y: fill ? 1 : 0, anchor: .bottom)
                        .animation(fill ? .timingCurve(0.2, 0.8, 0.2, 1, duration: 0.7).delay(0.1 + Double(i) * 0.07) : nil, value: fill)
                }
            }
            .frame(height: 88, alignment: .bottom)
            HStack(spacing: 7) {
                ForEach(Array("MTWTFSS".enumerated()), id: \.offset) { _, d in
                    Text(String(d)).font(.system(size: 10)).foregroundStyle(.ink3).frame(width: 14)
                }
            }
        }
    }
}

// MARK: - The carousel

private struct Slide {
    let name: String
    let title: String
    let text: String
    let ms: Int
}

private let slides = [
    Slide(name: "Your day", title: "Your day, calm and clear", text: "Everything planned for today on one quiet list. Tick things off and watch the ring fill.", ms: 7600),
    Slide(name: "Quick capture", title: "Capture in a blink", text: "Press N anywhere, type, hit Enter. Every change can be undone.", ms: 6200),
    Slide(name: "Focus mode", title: "One thing at a time", text: "Focus mode shows just the next task. Finish it or set it aside — the rest waits quietly.", ms: 5400),
    Slide(name: "Your week", title: "Your week at a glance", text: "Every day side by side. Move anything to tomorrow or next week in a tap.", ms: 5000),
    Slide(name: "Progress", title: "Progress you can feel", text: "Completion rate, streaks and your strongest days — clear numbers that stay private.", ms: 5600),
]
/// Quick capture on iPhone, where there's no N key.
private let captureByTouch = "Tap +, type, hit return. Every change can be undone."

private func finished(_ i: Int) -> Int { slides[i].ms - step }

/// The sign-in screen's showcase: short animated scenes of the app, one at a time, each with a caption. It moves on by
/// itself; swipe or use the dots to pick a slide. The pause button stops all motion on the screen (the headline's word
/// too, through `paused`). While VoiceOver is on it, the scene replays instead of moving on. With Reduce Motion it
/// shows each scene finished and only changes slides when asked.
struct Showcase: View {
    @Binding var paused: Bool

    @Environment(\.accessibilityReduceMotion) private var still
    @Environment(\.horizontalSizeClass) private var widthClass
    @State private var slide = 0
    @State private var t = 0
    /// 1: the next slide comes in from the right; -1: from the left (going back).
    @State private var direction: CGFloat = 1
    @State private var wide = false
    @AccessibilityFocusState private var focus: Part?

    private enum Part: Hashable { case caption, dots, pause }

    private var autoplay: Bool { !still && !paused }
    /// The web holds while keyboard focus is inside; here, while VoiceOver is.
    private var held: Bool { focus != nil }
    private var regular: Bool { widthClass == .regular }

    var body: some View {
        ZStack {
            slideView(slide)
                .id(slide)
                .transition(transition)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .padding(.horizontal, regular ? 32 : 20)
        .padding(.top, regular ? 64 : 48)
        .padding(.bottom, regular ? 96 : 80)
        .background { DotGrid() }
        .background(.canvas)
        .overlay(alignment: .bottom) {
            controls.padding(.bottom, regular ? 22 : 18)
        }
        .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
        .contentShape(Rectangle())
        .onHorizontalSwipe { forward in
            let n = slides.count
            show(forward ? (slide + 1) % n : (slide + n - 1) % n, direction: forward ? 1 : -1)
        }
        .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
        .onGeometryChange(for: Bool.self) { $0.size.width >= 576 } action: { wide = $0 }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("What Hyperanchor does")
        .task(id: autoplay) { await run() }
    }

    private func slideView(_ i: Int) -> some View {
        let s = slides[i]
        let text = i == 1 && UIDevice.current.userInterfaceIdiom != .pad ? captureByTouch : s.text
        return VStack(spacing: 0) {
            Group {
                switch i {
                case 0: TodayScene(t: t, chips: wide)
                case 1: CaptureScene(t: t)
                case 2: FocusScene(t: t)
                case 3: WeekScene(t: t)
                default: ProgressScene(t: t)
                }
            }
            .accessibilityHidden(true)

            VStack(spacing: 8) {
                Text(s.title)
                    .font(.title3.weight(.semibold))
                    .tracking(-0.4)
                    .foregroundStyle(.ink)
                Text(text)
                    .font(.subheadline)
                    .lineSpacing(3)
                    .foregroundStyle(.ink2)
                    .frame(maxWidth: 340)
            }
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.top, 36)
            .accessibilityElement(children: .combine)
            .accessibilityFocused($focus, equals: .caption)
        }
        .frame(maxWidth: 400)
    }

    /// Playing: the new slide slides in as the old one leaves the other way. Otherwise a plain cross-fade.
    private var transition: AnyTransition {
        guard autoplay else { return .opacity }
        return .asymmetric(
            insertion: .offset(x: 28 * direction).combined(with: .opacity).animation(ease),
            removal: .offset(x: -28 * direction).combined(with: .opacity).animation(.easeInOut(duration: 0.45))
        )
    }

    private var controls: some View {
        ZStack {
            dots
            if !still {
                Button(paused ? "Play the slideshow" : "Pause the slideshow", systemImage: paused ? "play.fill" : "pause.fill") {
                    // Playing again starts the scene over.
                    if paused { t = 0 }
                    paused.toggle()
                }
                .labelStyle(.iconOnly)
                .font(.system(size: 11))
                .foregroundStyle(.ink3)
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
                .buttonStyle(.plain)
                .accessibilityFocused($focus, equals: .pause)
                .frame(maxWidth: .infinity, alignment: .trailing)
                .padding(.trailing, regular ? 14 : 6)
            }
        }
    }

    private var dots: some View {
        let fill = autoplay && !held ? min(1, CGFloat(t) / CGFloat(slides[slide].ms)) : 1
        return HStack(spacing: 0) {
            ForEach(slides.indices, id: \.self) { i in
                Button { pick(i) } label: {
                    Capsule()
                        .fill(.ink3)
                        .frame(width: i == slide ? 28 : 6, height: 6)
                        .overlay(alignment: .leading) {
                            if i == slide {
                                Capsule().fill(.ink).frame(width: 28 * fill)
                                    .animation(.linear(duration: Double(step) / 1000), value: fill)
                            }
                        }
                        .clipShape(Capsule())
                        .padding(.horizontal, 5)
                        .frame(height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .animation(.easeOut(duration: 0.35), value: slide)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Slide")
        .accessibilityValue("\(slide + 1) of \(slides.count): \(slides[slide].name)")
        .accessibilityAdjustableAction { change in
            switch change {
            case .increment: show((slide + 1) % slides.count, direction: 1)
            case .decrement: show((slide + slides.count - 1) % slides.count, direction: -1)
            @unknown default: break
            }
        }
        .accessibilityFocused($focus, equals: .dots)
    }

    // MARK: Clock

    private func run() async {
        guard autoplay else {
            if still { t = finished(slide) }
            return
        }
        while !Task.isCancelled {
            try? await Task.sleep(for: .milliseconds(step))
            guard !Task.isCancelled else { return }
            t += step
            if t >= slides[slide].ms {
                // Held: replay the scene instead of moving on.
                if held { t = 0 } else { show((slide + 1) % slides.count, direction: 1) }
            }
        }
    }

    private func pick(_ i: Int) {
        show(i, direction: i > slide ? 1 : -1)
    }

    /// Playing, the new slide starts from the beginning; paused or with Reduce Motion, it's shown finished.
    private func show(_ i: Int, direction d: CGFloat) {
        guard i != slide else { return }
        let change = {
            withAnimation(autoplay ? ease : .easeInOut(duration: 0.2)) {
                slide = i
                t = autoplay ? 0 : finished(i)
            }
        }
        if d == direction {
            change()
        } else {
            // The leaving slide picks up the new direction first, so it exits the right way.
            direction = d
            Task { @MainActor in change() }
        }
    }
}

/// A faint dot grid that fades out toward the edges (the web's `dot-grid` under a radial mask).
private struct DotGrid: View {
    var body: some View {
        Canvas { context, size in
            let center = CGPoint(x: size.width * 0.5, y: size.height * 0.45)
            let radius = CGSize(width: size.width * 0.6, height: size.height * 0.55)
            for x in stride(from: 12.0, through: size.width, by: 24) {
                for y in stride(from: 12.0, through: size.height, by: 24) {
                    let d = hypot((x - center.x) / radius.width, (y - center.y) / radius.height)
                    // Opaque to 20% of the way out, gone by 78%.
                    let alpha = 1 - min(1, max(0, (d - 0.2) / 0.58))
                    guard alpha > 0 else { continue }
                    var dot = context
                    dot.opacity = alpha
                    dot.fill(Path(ellipseIn: CGRect(x: x - 1, y: y - 1, width: 2, height: 2)), with: .color(.ink4))
                }
            }
        }
        .accessibilityHidden(true)
    }
}

/// A sideways swipe (`true`: to the left, i.e. forward) that leaves vertical drags to the scroll view around it.
/// Since iOS 18 a SwiftUI drag gesture inside a scroll view stops it scrolling, so there it's a UIKit pan that only
/// begins when the movement is mostly horizontal.
private struct HorizontalSwipe: ViewModifier {
    let action: (Bool) -> Void

    func body(content: Content) -> some View {
        if #available(iOS 18, *) {
            content.gesture(SidewaysPan(action: action))
        } else {
            content.simultaneousGesture(
                DragGesture(minimumDistance: 20).onEnded { drag in
                    if let forward = swipeDirection(drag.translation) { action(forward) }
                }
            )
        }
    }
}

/// Far enough and clearly sideways: whether it went forward (to the left); nil if it wasn't a swipe.
private func swipeDirection(_ move: CGSize) -> Bool? {
    guard abs(move.width) > 40, abs(move.width) > abs(move.height) * 1.5 else { return nil }
    return move.width < 0
}

@available(iOS 18, *)
private struct SidewaysPan: UIGestureRecognizerRepresentable {
    let action: (Bool) -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator { Coordinator() }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let pan = UIPanGestureRecognizer()
        pan.delegate = context.coordinator
        return pan
    }

    func handleUIGestureRecognizerAction(_ pan: UIPanGestureRecognizer, context: Context) {
        guard pan.state == .ended else { return }
        let move = pan.translation(in: pan.view)
        if let forward = swipeDirection(CGSize(width: move.x, height: move.y)) { action(forward) }
    }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ recognizer: UIGestureRecognizer) -> Bool {
            guard let pan = recognizer as? UIPanGestureRecognizer else { return true }
            let velocity = pan.velocity(in: pan.view)
            return abs(velocity.x) > abs(velocity.y)
        }

        func gestureRecognizer(_: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith _: UIGestureRecognizer) -> Bool { true }
    }
}

private extension View {
    func onHorizontalSwipe(_ action: @escaping (Bool) -> Void) -> some View {
        modifier(HorizontalSwipe(action: action))
    }

    /// A scene's card, like the app's: the surface with the floating shadow.
    func sceneCard() -> some View {
        background(.surface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .elevation(Tokens.Shadow.float, cornerRadius: 22)
    }

    /// The floating cards over the Today scene.
    func chip() -> some View {
        background(.elevated, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
            .elevation(Tokens.Shadow.float, cornerRadius: 14)
            .fixedSize()
    }
}
