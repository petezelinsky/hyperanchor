import SwiftUI
import UIKit

/// Summaries kept on this device, per account and period (localStorage on the web), so coming back to a period costs
/// nothing. Each remembers the fingerprint of the data it was written from.
@MainActor
@Observable
final class SummaryArchive {
    struct Saved: Codable, Equatable {
        var hash: String
        var summary: AISummary
        var tokens: Int
        var at: Date
    }

    static let shared = SummaryArchive()

    /// UI tests start clean every launch (`-uitest`): nothing is read from or written to disk then.
    @ObservationIgnored private let persists = !ProcessInfo.processInfo.arguments.contains("-uitest")
    /// Periods whose summary is being written now (it carries on if the page is left meanwhile).
    private(set) var writing: Set<String> = []
    private var cache: [String: Saved] = [:]
    @ObservationIgnored private var looked: Set<String> = []
    @ObservationIgnored private let defaults = UserDefaults.standard

    static func key(account: String, period: Stats.Period, start: DayKey) -> String {
        "summary:\(account):\(period.rawValue):\(start)"
    }

    func saved(_ key: String) -> Saved? {
        if !looked.contains(key) {
            looked.insert(key)
            if persists, let data = defaults.data(forKey: key), let saved = try? JSONDecoder().decode(Saved.self, from: data), !saved.summary.headline.isEmpty {
                cache[key] = saved
            }
        }
        return cache[key]
    }

    func began(_ key: String) { writing.insert(key) }
    func ended(_ key: String) { writing.remove(key) }

    func save(_ saved: Saved, for key: String) {
        looked.insert(key)
        cache[key] = saved
        if persists, let data = try? JSONEncoder().encode(saved) { defaults.set(data, forKey: key) }
    }
}

extension AIFailure {
    /// What the summary says when it couldn't be written (`PROBLEMS` in AiSummary.tsx).
    var summaryProblem: String {
        switch self {
        case .limit: "That’s all of today’s AI tokens. More tomorrow."
        case .notConfigured: "The summary isn’t set up on this server yet."
        case .refused: "This one couldn’t be summarized."
        case .busy: "Claude is busy right now. Try again in a moment."
        case .offline: "You’re offline. Try again when you’re back."
        case .failed, .tooLong: "The summary didn’t come through. Try again."
        }
    }
}

/// The AI summary at the top of Progress (AiSummary.tsx): a few lines on how the period went, written by Claude from
/// the page's own numbers and task titles, within the day's token allowance. It is kept on this device for the
/// period; one written before the data changed says so and can be written again. The press that asks for it sends a
/// ring of liquid glass over the page while Claude reads.
struct SummaryPanel: View {
    let input: SummaryInput
    /// Where this period's summary is kept.
    let key: String
    /// "week", "month", "year".
    let noun: String
    /// Today's tokens left (nil until the server says).
    @Binding var left: Int?
    let lens: LensDriver

    @Environment(AppModel.self) private var model
    @Environment(TaskStore.self) private var store
    @Environment(\.progressLayout) private var layout
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var problem: String?

    /// About what a summary costs (the server sets this much aside, and counts what it really cost).
    private static let about = 3000

    var body: some View {
        let archive = SummaryArchive.shared
        let saved = archive.saved(key)
        let hash = Stats.fingerprint(input)
        let busy = archive.writing.contains(key)
        let stale = saved.map { $0.hash != hash } ?? false
        let short = (left ?? .max) < Self.about

        VStack(spacing: 0) {
            head(saved: saved, stale: stale, busy: busy, short: short, hash: hash)
            if let problem, !busy {
                Text(problem)
                    .type(Tokens.Typography.footnote)
                    .foregroundStyle(.ink2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, layout.padding)
                    .padding(.vertical, 12)
                    .hairline(.top)
                    .transition(.opacity)
            }
            if let saved {
                written(saved)
                    .opacity(busy || stale ? 0.55 : 1)
                    .animation(Motion.choose(Motion.out(), reduceMotion: reduceMotion), value: busy || stale)
                    .hairline(.top)
                    .transition(.opacity)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .progressPanel()
        .onChange(of: key) { problem = nil }
        .accessibilityElement(children: .contain)
    }

    // MARK: The head: what it is, and the button

    @ViewBuilder
    private func head(saved: SummaryArchive.Saved?, stale: Bool, busy: Bool, short: Bool, hash: String) -> some View {
        let text = VStack(alignment: .leading, spacing: 2) {
            Text("AI summary")
                .type(Tokens.Typography.body, weight: .semibold)
                .foregroundStyle(.ink)
                .accessibilityAddTraits(.isHeader)
            Text(subtitle(saved: saved, stale: stale, busy: busy))
                .type(Tokens.Typography.footnote)
                .foregroundStyle(.ink3)
                .monospacedDigit()
                .fixedSize(horizontal: false, vertical: true)
                .contentTransition(.opacity)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        let button = summarizeButton(saved: saved, stale: stale, busy: busy, short: short, hash: hash)

        Group {
            if layout.phone {
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 16) {
                        mark
                        text
                    }
                    button
                }
            } else {
                HStack(spacing: 16) {
                    mark
                    text
                    button
                }
            }
        }
        .padding(.horizontal, layout.padding)
        .padding(.vertical, 20)
    }

    private var mark: some View {
        Image(systemName: Icon.summary)
            .font(.system(size: 15, weight: .regular))
            .foregroundStyle(.ink)
            .frame(width: 36, height: 36)
            .background(.surface2, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: 10, style: .continuous).strokeBorder(.line, lineWidth: 1))
            .accessibilityHidden(true)
    }

    private func subtitle(saved: SummaryArchive.Saved?, stale: Bool, busy: Bool) -> String {
        let leftText = left.map { "\(Self.count($0)) tokens left today" }
        if busy { return "Claude is reading your \(noun)…" }
        if let saved {
            if stale { return ["Written before your latest changes.", leftText].compactMap { $0 }.joined(separator: " ") }
            return [Self.when(saved.at), "\(Self.count(saved.tokens)) tokens", leftText].compactMap { $0 }.joined(separator: " · ")
        }
        return "How this \(noun) went, in a few lines, written by Claude. Uses about \(Self.count(Self.about)) tokens\(left.map { " of your \(Self.count($0)) left today" } ?? "")."
    }

    private func summarizeButton(saved: SummaryArchive.Saved?, stale: Bool, busy: Bool, short: Bool, hash: String) -> some View {
        let enabled = !busy && !short
        let quiet = saved != nil && !stale
        return Button {
            // The ring goes out from where the button was pressed; without a finger (VoiceOver, a keyboard), a light
            // one from its middle.
            if !reduceMotion {
                if lens.holding { lens.release() } else { lens.tap() }
            }
            write(hash: hash)
        } label: {
            HStack(spacing: 8) {
                if busy {
                    Spinner()
                } else {
                    Image(systemName: Icon.summary)
                        .font(.system(size: 13, weight: .regular))
                        .accessibilityHidden(true)
                }
                Text(busy ? "Writing…" : saved != nil ? "Write again" : "Summarize")
                    .lineLimit(1)
            }
        }
        .buttonStyle(SummaryButtonStyle(quiet: quiet, fill: layout.phone))
        .disabled(!enabled)
        .pressesLens(lens, enabled: enabled)
        .modifier(ProgressTip(text: short ? "Not enough tokens left today" : nil))
        .accessibilityHint(short ? "Not enough tokens left today" : "")
    }

    // MARK: The summary itself

    private func written(_ saved: SummaryArchive.Saved) -> some View {
        let headline = VStack(alignment: .leading, spacing: 16) {
            Text(saved.summary.headline)
                .font(.system(.title3, weight: .semibold))
                .tracking(-0.32)
                .foregroundStyle(.ink)
                .fixedSize(horizontal: false, vertical: true)
                .modifier(Rise(delay: 0))
            if !saved.summary.next.isEmpty {
                (Text("Next \(noun): ").fontWeight(.semibold).foregroundStyle(.ink) + Text(saved.summary.next).foregroundStyle(.ink2))
                    .type(Tokens.Typography.body)
                    .fixedSize(horizontal: false, vertical: true)
                    .modifier(Rise(delay: 0))
            }
        }
        let points = VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(saved.summary.points.enumerated()), id: \.offset) { i, point in
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    Circle().fill(.ink3).frame(width: 6, height: 6)
                        .alignmentGuide(.firstTextBaseline) { $0[.bottom] + 2 }
                        .accessibilityHidden(true)
                    Text(point)
                        .type(Tokens.Typography.body)
                        .foregroundStyle(.ink)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.top, i == 0 ? 0 : 10)
                .padding(.bottom, i == saved.summary.points.count - 1 ? 0 : 10)
                .overlay(alignment: .bottom) {
                    if i < saved.summary.points.count - 1 { Rectangle().fill(.line).frame(height: 1) }
                }
                .modifier(Rise(delay: 0.08 + Double(i) * 0.07))
            }
        }

        return Group {
            if layout.wide {
                FractionRow(fractions: [5, 7], spacing: 40) {
                    headline
                    points
                }
            } else {
                VStack(alignment: .leading, spacing: 20) {
                    headline
                    points
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, layout.padding)
        .padding(.top, 20)
        .padding(.bottom, 24)
        // A new summary comes in fresh: its lines rise again.
        .id(saved.at)
    }

    // MARK: Writing

    private func write(hash: String) {
        let archive = SummaryArchive.shared
        guard !archive.writing.contains(key) else { return }
        let key = self.key
        let input = self.input
        let backend = model.session.backend
        let animation = Motion.choose(Motion.settle, reduceMotion: reduceMotion)
        archive.began(key)
        withAnimation(animation) { problem = nil }
        Task {
            do {
                let answer = try await backend.summarize(input)
                withAnimation(animation) {
                    archive.save(.init(hash: hash, summary: answer.summary, tokens: answer.tokens, at: .now), for: key)
                }
                left = answer.left
                UIAccessibility.post(notification: .announcement, argument: answer.summary.headline)
            } catch let failure as AIFailure {
                withAnimation(animation) { problem = failure.summaryProblem }
                if failure == .limit { left = 0 }
                UIAccessibility.post(notification: .announcement, argument: failure.summaryProblem)
            } catch APIError.unauthorized {
                store.onUnauthorized?()
            } catch {
                withAnimation(animation) { problem = AIFailure.failed.summaryProblem }
            }
            archive.ended(key)
        }
    }

    private static func count(_ n: Int) -> String {
        n.formatted(.number.locale(Locale(identifier: "en_US")))
    }

    /// "Written at 3:28 PM" today, "Written on Nov 12" before.
    private static func when(_ date: Date) -> String {
        Calendar.current.isDateInToday(date)
            ? "Written at \(date.formatted(date: .omitted, time: .shortened))"
            : "Written on \(date.formatted(.dateTime.month(.abbreviated).day().locale(Locale(identifier: "en_US"))))"
    }
}

/// Black (white in dark mode) to ask for a summary; a quiet outlined one once it's written and up to date.
private struct SummaryButtonStyle: ButtonStyle {
    let quiet: Bool
    /// The whole width (phones).
    var fill = false
    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .type(Tokens.Typography.footnote, weight: .medium)
            .foregroundStyle(quiet ? Color.ink : .onPrimary)
            .padding(.horizontal, 14)
            .frame(maxWidth: fill ? .infinity : nil, minHeight: 34)
            .background(quiet ? (configuration.isPressed ? Color.surface3 : .surface) : .primaryFill, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .overlay {
                if quiet { RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1) }
            }
            .opacity(isEnabled ? 1 : 0.4)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: Tokens.Motion.press), value: configuration.isPressed)
            .padding(.vertical, 5)
            .contentShape(Rectangle())
            .padding(.vertical, -5)
    }
}

/// The small turning ring on the button while Claude writes (still with Reduce Motion).
private struct Spinner: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var turning = false

    var body: some View {
        ZStack {
            Circle().stroke(.foreground.opacity(0.3), lineWidth: 1.5)
            Circle()
                .trim(from: 0, to: 0.25)
                .stroke(.foreground, style: StrokeStyle(lineWidth: 1.5, lineCap: .round))
                .rotationEffect(.degrees(turning ? 360 : 0))
        }
        .frame(width: 13, height: 13)
        .onAppear {
            guard !reduceMotion else { return }
            withAnimation(.linear(duration: 0.8).repeatForever(autoreverses: false)) { turning = true }
        }
        .accessibilityHidden(true)
    }
}

/// A line of the summary arriving: up 8 points and in (the web's `animate-rise`); a fade with Reduce Motion.
private struct Rise: ViewModifier {
    let delay: Double
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var shown = false

    func body(content: Content) -> some View {
        content
            .opacity(shown ? 1 : 0)
            .offset(y: shown || reduceMotion ? 0 : 8)
            .onAppear {
                withAnimation(Motion.choose(Motion.out(), reduceMotion: reduceMotion).delay(reduceMotion ? 0 : delay)) { shown = true }
            }
    }
}
