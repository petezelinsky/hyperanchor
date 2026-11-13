import SwiftUI

/// Search across every task, on any day (SearchPalette.tsx; `/` or ⌘K). A field that has the keyboard at once; results
/// grouped by day — today and the days ahead first, then the past — with the matches marked and finished tasks quiet.
/// ↑ ↓ pick one, Return opens it; a tap opens its day with the task picked. Offline, it says so instead of "no tasks".
struct SearchView: View {
    @Environment(AppModel.self) private var model
    @Environment(Router.self) private var router
    @Environment(TaskStore.self) private var store
    @Environment(TodayClock.self) private var clock
    @Environment(\.dismiss) private var dismiss
    @FocusState private var typing: Bool
    @State private var text = ""
    @State private var results: [TaskItem]?
    @State private var loading = false
    @State private var failure: Failure?
    @State private var active = 0
    @State private var opening = false

    private enum Failure { case offline, other }

    var body: some View {
        let query = text.trimmingCharacters(in: .whitespacesAndNewlines)
        let groups = Self.groups(results ?? [])
        let flat = groups.flatMap(\.tasks)
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                Image(systemName: Icon.search)
                    .font(.system(size: 15, weight: .regular))
                    .foregroundStyle(.ink3)
                    .accessibilityHidden(true)
                TextField("Search all tasks", text: $text)
                    .font(.token(Tokens.Typography.headline))
                    .foregroundStyle(.ink)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .submitLabel(.search)
                    .focused($typing)
                    .onSubmit { if flat.indices.contains(active) { open(flat[active]) } }
                    .onKeyPress(.downArrow) { move(1, of: flat.count) }
                    .onKeyPress(.upArrow) { move(-1, of: flat.count) }
                    .onChange(of: text) { _, t in if t.count > 200 { text = String(t.prefix(200)) } }
                    .accessibilityIdentifier("search.field")
                if loading {
                    ProgressView()
                        .controlSize(.small)
                        .accessibilityLabel("Searching")
                }
                Button("Cancel") { dismiss() }
                    .font(.token(Tokens.Typography.body))
                    .foregroundStyle(.ink2)
                    .keyboardShortcut(.cancelAction)
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("search.cancel")
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 56)
            .hairline(.bottom)

            ScrollViewReader { proxy in
                ScrollView {
                    if results == nil {
                        note("Find any task by its title or notes, on any day.")
                    } else if flat.isEmpty {
                        if !loading {
                            note(failure == .offline ? "You’re offline. Search works when you’re back."
                                 : failure == .other ? "Couldn’t search just now. Try again in a moment."
                                 : "No tasks match “\(query)”.")
                        }
                    } else {
                        LazyVStack(alignment: .leading, spacing: 0) {
                            ForEach(groups, id: \.day) { group in
                                Text(label(group.day))
                                    .font(.token(Tokens.Typography.caption, weight: .medium))
                                    .foregroundStyle(.ink3)
                                    .padding(.horizontal, 12)
                                    .padding(.top, 10)
                                    .padding(.bottom, 4)
                                    .accessibilityAddTraits(.isHeader)
                                ForEach(group.tasks) { task in
                                    row(task, query: query, active: flat.firstIndex(of: task) == active)
                                        .id(task.id)
                                }
                            }
                        }
                        .padding(8)
                    }
                }
                .scrollDismissesKeyboard(.interactively)
                .onChange(of: active) { _, i in
                    if flat.indices.contains(i) { proxy.scrollTo(flat[i].id) }
                }
            }
        }
        .background(.elevated)
        .presentationBackground(.elevated)
        .presentationDragIndicator(.hidden)
        .tint(.ink)
        .onAppear { typing = true }
        .task(id: query) { await search(query) }
    }

    private func note(_ text: String) -> some View {
        Text(text)
            .font(.token(Tokens.Typography.footnote))
            .foregroundStyle(.ink3)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(.horizontal, 12)
            .padding(.vertical, 24)
            .accessibilityIdentifier("search.note")
    }

    private func row(_ task: TaskItem, query: String, active: Bool) -> some View {
        let notes = task.notes.replacingOccurrences(of: #"\s*\n\s*"#, with: " · ", options: .regularExpression)
        return Button { open(task) } label: {
            HStack(alignment: .top, spacing: 12) {
                CheckCircle(checked: task.done, size: 18)
                    .padding(.top, 1)
                VStack(alignment: .leading, spacing: 1) {
                    Text(Self.marked(task.title, query, step: Tokens.Typography.body))
                        .font(.token(Tokens.Typography.body))
                        .foregroundStyle(task.done ? .ink3 : .ink)
                    if !notes.isEmpty {
                        Text(Self.marked(notes, query, step: Tokens.Typography.caption))
                            .font(.token(Tokens.Typography.caption))
                            .foregroundStyle(.ink3)
                    }
                }
                .lineLimit(1)
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(active ? Color.surface3 : .clear, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .contentShape(Rectangle())
        }
        .buttonStyle(RowPressStyle(radius: Tokens.Radius.sm, pressed: .surface3))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel([task.title, task.done ? "done" : nil, notes.isEmpty ? nil : notes].compactMap { $0 }.joined(separator: ", "))
        .accessibilityHint("Opens its day")
        .accessibilityAddTraits(active ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier("search.result")
    }

    /// "Today · Fri, Nov 13", "Sat, Nov 21", "Tue, Nov 3, 2025".
    private func label(_ day: DayKey) -> String {
        let today = clock.today
        if let relative = Dates.relative(day, today: today) { return "\(relative) · \(Dates.medium(day))" }
        return Dates.medium(day) + (day.year != today.year ? ", \(day.year)" : "")
    }

    private func move(_ direction: Int, of count: Int) -> KeyPress.Result {
        guard count > 0 else { return .ignored }
        active = (active + direction + count) % count
        return .handled
    }

    /// The server's order kept, cut into runs of the same day.
    private static func groups(_ tasks: [TaskItem]) -> [(day: DayKey, tasks: [TaskItem])] {
        var out: [(day: DayKey, tasks: [TaskItem])] = []
        for task in tasks {
            if out.last?.day == task.date { out[out.count - 1].tasks.append(task) } else { out.append((task.date, [task])) }
        }
        return out
    }

    /// Each match of `query` in bold ink on a quiet tile.
    private static func marked(_ text: String, _ query: String, step: TypeStep) -> AttributedString {
        var s = AttributedString(text)
        guard !query.isEmpty else { return s }
        var from = s.startIndex
        while from < s.endIndex, let r = s[from...].range(of: query, options: [.caseInsensitive, .diacriticInsensitive]) {
            s[r].font = .token(step, weight: .semibold)
            s[r].foregroundColor = Color.ink
            s[r].backgroundColor = Color.surface3
            from = r.upperBound
        }
        return s
    }

    /// Waits 140 ms of quiet, then asks the server; a newer query cancels an older one.
    private func search(_ query: String) async {
        guard !query.isEmpty else {
            results = nil
            failure = nil
            loading = false
            return
        }
        loading = true
        try? await Task.sleep(for: .milliseconds(140))
        guard !Task.isCancelled else { return }
        do {
            let found = try await model.session.backend.searchTasks(query, today: clock.today)
            guard !Task.isCancelled else { return }
            results = found
            failure = nil
            active = 0
        } catch {
            guard !Task.isCancelled else { return }
            results = []
            failure = (error as? APIError) == .offline || !store.isOnline ? .offline : .other
        }
        loading = false
    }

    /// Opens a result: its day, with the task picked (fetched first, so it's there when the day shows).
    private func open(_ task: TaskItem) {
        guard !opening else { return }
        opening = true
        Task {
            await store.load(task.date...task.date)
            router.focus = false
            router.open(task.date)
            router.selectedTask = task.id
            router.showSearch = false
        }
    }
}
