import SwiftUI

/// Focus mode: one task at a time, large, with a single obvious next step. The rest of the day is reduced
/// to one quiet line ("Up next"), so there is nothing else to choose between. Made with ADHD in mind.
struct FocusView: View {
    @Environment(TaskStore.self) private var store
    @Environment(Router.self) private var router
    @Environment(TodayClock.self) private var clock
    @Environment(Toaster.self) private var toaster
    @Environment(\.palette) private var palette
    @Environment(\.dismiss) private var dismiss

    /// "Not now": sent to the back of the queue for this session.
    @State private var later: [String] = []
    /// Just ticked off: stays first while its check plays.
    @State private var settling: Set<String> = []
    @State private var thought = ""
    @State private var confetti = 0
    @FocusState private var capturing: Bool

    private var day: DayKey { router.selected }

    var body: some View {
        let all = store.tasks(on: day)
        let queue = queue(all)
        let task = queue.first
        let next = queue.dropFirst().first
        let done = all.count(where: \.done)

        NavigationStack {
            GeometryReader { geo in
            ScrollView {
                VStack(spacing: 0) {
                    Text("ONE THING AT A TIME")
                        .font(.caption.weight(.medium))
                        .tracking(0.8)
                        .foregroundStyle(.ink3)
                        .padding(.top, 24)

                    if let task {
                        card(task, hasNext: next != nil)
                            .padding(.top, 20)
                            .id(task.id)
                            .transition(.asymmetric(insertion: .move(edge: .bottom).combined(with: .opacity), removal: .opacity))
                        Group {
                            if let next {
                                let after = max(0, queue.count - 2)
                                (Text("Up next: ").foregroundStyle(.ink3) + Text(next.title).foregroundStyle(.ink2) + Text(after > 0 ? " · \(after) more after that" : "").foregroundStyle(.ink3))
                            } else {
                                Text("This is the last one.").foregroundStyle(.ink3)
                            }
                        }
                        .font(.footnote)
                        .lineLimit(1)
                        .padding(.top, 20)
                        .padding(.horizontal, 16)
                    } else if !all.isEmpty {
                        AllDone(isToday: day == clock.today)
                            .padding(.top, 40)
                    } else {
                        Text("Nothing is planned for this day.")
                            .font(.body)
                            .foregroundStyle(.ink2)
                            .padding(.top, 40)
                    }

                    if !all.isEmpty {
                        HStack(spacing: 12) {
                            GeometryReader { g in
                                Capsule().fill(palette.accentTrack)
                                    .overlay(alignment: .leading) {
                                        Capsule().fill(palette.accent).frame(width: g.size.width * Double(done) / Double(all.count))
                                    }
                            }
                            .frame(height: 6)
                            Text("\(done) of \(all.count) done")
                                .font(.caption)
                                .foregroundStyle(.ink3)
                                .monospacedDigit()
                                .fixedSize()
                        }
                        .frame(maxWidth: 280)
                        .padding(.top, 32)
                        .animation(.easeOut(duration: 0.7), value: done)
                        .accessibilityElement(children: .ignore)
                        .accessibilityLabel("\(done) of \(all.count) done")
                    }

                    capture
                        .padding(.top, 32)
                }
                .padding(.horizontal, 20)
                .padding(.bottom, 32)
                .frame(maxWidth: 600)
                .frame(maxWidth: .infinity, minHeight: geo.size.height * 0.85)
                .animation(.spring(duration: 0.45, bounce: 0.15), value: task?.id)
            }
            }
            .scrollDismissesKeyboard(.interactively)
            .background(.canvas)
            .overlay { ConfettiView(trigger: confetti) }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Exit Focus") { dismiss() }
                        .accessibilityIdentifier("focus.exit")
                }
            }
            .toastHost()
        }
        .tint(.ink)
        .onChange(of: task == nil && !all.isEmpty) { was, now in
            if now, !was { confetti += 1 }
        }
        .onChange(of: router.focusCompleteRequest) { _, _ in
            if let task { complete(task) }
        }
        .onChange(of: router.focusCaptureRequest) { _, _ in capturing = true }
    }

    /// Open tasks in list order, "Not now" ones last; a task just ticked off stays first while its check plays.
    private func queue(_ all: [TaskItem]) -> [TaskItem] {
        let list = TaskSorting.sorted(all.filter { !$0.done || settling.contains($0.id) }, by: router.sort)
        let deferred = later.compactMap { id in list.first { $0.id == id } }
        return list.filter { !later.contains($0.id) } + deferred
    }

    private func card(_ task: TaskItem, hasNext: Bool) -> some View {
        VStack(alignment: .leading, spacing: 24) {
            HStack(alignment: .top, spacing: 16) {
                TaskCheckbox(task: task, size: 26) { complete(task) }
                    .padding(-9)
                    .padding(.top, 2)
                VStack(alignment: .leading, spacing: 8) {
                    Text(task.title)
                        .font(.title2.weight(.semibold))
                        .tracking(-0.4)
                        .foregroundStyle(task.done ? .ink3 : .ink)
                        .fixedSize(horizontal: false, vertical: true)
                    if !task.notes.isEmpty {
                        Text(task.notes)
                            .font(.body)
                            .foregroundStyle(.ink2)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
            HStack(spacing: 8) {
                Button { complete(task) } label: {
                    Label("Done", systemImage: "checkmark")
                        .fontWeight(.semibold)
                }
                .buttonStyle(PrimaryButtonStyle(height: 46, fill: false))
                .disabled(task.done)
                .accessibilityIdentifier("focus.done")
                if hasNext {
                    Button("Not now") {
                        withAnimation { later = later.filter { $0 != task.id } + [task.id] }
                    }
                    .buttonStyle(SecondaryButtonStyle(height: 46))
                    .disabled(task.done)
                    .accessibilityIdentifier("focus.later")
                }
            }
            .padding(.leading, 42)
        }
        .padding(24)
        .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.focus, style: .continuous))
        .elevation(Tokens.Shadow.float, cornerRadius: Tokens.Radius.focus)
    }

    private var capture: some View {
        HStack(spacing: 8) {
            Image(systemName: "plus").foregroundStyle(.ink3)
            TextField("Something else on your mind? Jot it down", text: $thought)
                .focused($capturing)
                .submitLabel(.done)
                .onSubmit(captureThought)
                .accessibilityLabel("Add a task for later")
                .accessibilityIdentifier("focus.capture")
        }
        .font(.subheadline)
        .padding(.horizontal, 14)
        .frame(height: 44)
        .background(capturing ? .surface : .surface2, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(capturing ? palette.accent : Color.line))
        .frame(maxWidth: 420)
    }

    private func complete(_ task: TaskItem) {
        guard !task.done else { return }
        settling.insert(task.id)
        store.setDone(task.id, true)
        Task {
            try? await Task.sleep(for: .milliseconds(900))
            withAnimation { _ = settling.remove(task.id) }
        }
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

private struct AllDone: View {
    let isToday: Bool
    @Environment(\.palette) private var palette
    @State private var cheer = false

    var body: some View {
        VStack(spacing: 0) {
            Burst(active: cheer, radius: 40) {
                Image(systemName: "checkmark")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(.onAccent)
                    .frame(width: 56, height: 56)
                    .background(palette.accent, in: Circle())
            }
            Text(isToday ? "All done for today." : "Everything on this day is done.")
                .font(.title3.weight(.semibold))
                .tracking(-0.3)
                .padding(.top, 20)
            Text("Nice work. Take a breath.")
                .font(.body)
                .foregroundStyle(.ink2)
                .padding(.top, 6)
        }
        .multilineTextAlignment(.center)
        .accessibilityElement(children: .combine)
        .onAppear { cheer = true }
    }
}
