import SwiftUI

/// The window with the tasks: up as soon as sorting starts, with lines filling in while it works, then the tasks, each
/// one editable in place (its title, and its note when it has one), movable to another day, or left out; no
/// checkboxes. Add them, speak (or type) more, or leave, which asks first while tasks are in hand. A card at the foot
/// of the screen on iPhone, in the middle on iPad.
struct ReviewWindow: View {
    @Bindable var model: SpeakModel
    let wide: Bool
    let today: DayKey
    /// The screen's bottom inset: the home bar (the card sits on its line, as on the web), or the keyboard.
    let bottomInset: CGFloat
    let add: () -> Void

    @Environment(\.showsKeyHints) private var keyHints
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var listHeight: CGFloat = 0
    @State private var risen = false

    var body: some View {
        ZStack(alignment: wide ? .center : .bottom) {
            Color.scrim
                .ignoresSafeArea()
                .contentShape(Rectangle())
                .onTapGesture { model.discard() }
                .accessibilityHidden(true)
            card
                .frame(maxWidth: 560)
                .padding(.horizontal, wide ? 24 : 8)
                .padding(.top, wide ? 24 : 8)
                .padding(.bottom, wide ? 24 : bottomInset > 100 ? 8 : max(0, 8 - bottomInset))
                .offset(y: risen || reduceMotion ? 0 : 8)
                .opacity(risen ? 1 : 0)
        }
        .onAppear {
            withAnimation(reduceMotion ? Motion.reduced : Motion.out()) { risen = true }
        }
    }

    private var card: some View {
        let shape = RoundedRectangle(cornerRadius: Tokens.Radius.card, style: .continuous)
        return VStack(spacing: 0) {
            header
            ScrollView {
                list.onGeometryChange(for: CGFloat.self) { $0.size.height } action: { listHeight = $0 }
            }
            .frame(maxHeight: listHeight)
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            footer
        }
        .background(Color.elevated, in: shape)
        .clipShape(shape)
        .contentShape(shape)
        .elevation(Tokens.Shadow.float, in: shape)
        .accessibilityElement(children: .contain)
        .accessibilityAddTraits(.isModal)
        .accessibilityIdentifier("speak.window")
    }

    // MARK: Header

    private var header: some View {
        let n = model.count
        return HStack(spacing: 12) {
            if model.busy { RingSpinner() }
            Text(model.busy ? "Sorting into tasks…" : n > 0 ? "\(VoiceCopy.tasks(n)) to add" : "Nothing to add yet")
                .font(.token(Tokens.Typography.headline, weight: .semibold))
                .foregroundStyle(Color.ink)
                .lineLimit(2)
                .frame(maxWidth: .infinity, alignment: .leading)
                .accessibilityAddTraits(.isHeader)
            VoiceIconButton(symbol: Icon.close, label: "Close", ringed: true) { model.discard() }
                .keyboardShortcut(model.confirming ? nil : .cancelAction)
                .accessibilityIdentifier("speak.close")
        }
        .padding(.leading, 20)
        .padding(.trailing, 6)
        .frame(minHeight: 56)
        .hairline()
    }

    // MARK: The tasks

    private var list: some View {
        let items = model.drafts.items
        return VStack(spacing: 0) {
            ForEach(items) { draft in
                DraftRow(model: model, draft: draft, today: today, last: draft.id == items.last?.id && !model.busy && model.problem == nil)
                    .transition(reduceMotion ? .opacity : .opacity.combined(with: .offset(y: 8)))
            }
            // While it sorts: lines where the tasks will be.
            if model.busy { SkeletonRows() }
            if let problem = model.problem, !model.busy {
                Text(problem.message)
                    .font(.token(Tokens.Typography.body))
                    .foregroundStyle(Color.ink2)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, 20)
                    .padding(.vertical, 16)
            }
        }
        .animation(reduceMotion ? Motion.reduced : Motion.out(), value: items.map(\.id))
    }

    // MARK: Footer

    private var footer: some View {
        let n = model.count
        // Side by side, as on the web; one above the other at the largest text sizes.
        let stacked = typeSize.isAccessibilitySize
        return Group {
            if model.confirming {
                if stacked {
                    VStack(alignment: .leading, spacing: 10) { confirmation(n) }
                } else {
                    HStack(spacing: 8) { confirmation(n) }
                }
            } else if stacked {
                VStack(spacing: 8) { actions(n) }
            } else {
                HStack(spacing: 8) { actions(n) }
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 12)
        .frame(minHeight: 64)
        .hairline(.top)
    }

    @ViewBuilder
    private func confirmation(_ n: Int) -> some View {
        Text(n == 1 ? "Leave without adding this task?" : "Leave without adding these \(n) tasks?")
            .font(.token(Tokens.Typography.body))
            .foregroundStyle(Color.ink)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
        HStack(spacing: 8) {
            Button("Keep") { model.confirming = false }
                .buttonStyle(lg(.secondary, fill: typeSize.isAccessibilitySize))
                .keyboardShortcut(.cancelAction)
                .accessibilityIdentifier("speak.keep")
            Button("Leave", action: model.close)
                .buttonStyle(lg(.dangerQuiet, fill: typeSize.isAccessibilitySize))
                .accessibilityIdentifier("speak.leave")
        }
        .fixedSize(horizontal: !typeSize.isAccessibilitySize, vertical: false)
    }

    @ViewBuilder
    private func actions(_ n: Int) -> some View {
        if model.problem?.again != nil, !model.busy {
            Button("Try again", action: model.retry)
                .buttonStyle(lg(.secondary))
                .accessibilityIdentifier("speak.retry")
        } else {
            Button(action: model.more) {
                HStack(spacing: 8) {
                    if !model.typing { Orb(size: 20) }
                    Text(model.typing ? "Type more" : n > 0 ? "Speak more" : "Speak again")
                }
            }
            .buttonStyle(lg(.secondary))
            .disabled(model.busy || model.spent)
            .accessibilityIdentifier("speak.more")
        }
        if wide { Spacer(minLength: 0) }
        Button(action: add) {
            HStack(spacing: 8) {
                Text(n > 0 ? "Add \(VoiceCopy.tasks(n))" : "Add tasks")
                if n > 0, !model.busy, keyHints { KeyHint(key: "↵", tone: .onPrimary) }
            }
        }
        .buttonStyle(lg(.primary))
        .disabled(n == 0 || model.busy)
        .keyboardShortcut(.return, modifiers: [])
        .accessibilityIdentifier("speak.add")
    }

    private func lg(_ variant: VoiceButtonStyle.Variant, fill: Bool? = nil) -> VoiceButtonStyle {
        VoiceButtonStyle(variant: variant, size: .lg, fill: fill ?? !wide, wide: wide)
    }
}

/// One task to add: its title (and note) to reword in place, its day, and a way to leave it out.
private struct DraftRow: View {
    let model: SpeakModel
    let draft: TaskDraft
    let today: DayKey
    /// The last line of the list: the footer's own line is under it.
    let last: Bool

    @Environment(\.dynamicTypeSize) private var typeSize
    @FocusState private var field: Field?
    @State private var picking = false

    private enum Field: Hashable { case title, note }

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 8) {
                    words
                    HStack(spacing: 4) {
                        day
                        Spacer(minLength: 0)
                        leaveOut
                    }
                }
                .padding(.vertical, 8)
            } else {
                HStack(spacing: 8) {
                    words
                    day
                    leaveOut
                }
            }
        }
        .padding(.leading, 20)
        .padding(.trailing, 6)
        .frame(minHeight: 52)
        .overlay(alignment: .bottom) {
            if !last { Rectangle().fill(Color.line).frame(height: 1) }
        }
        .accessibilityElement(children: .contain)
        .accessibilityAction(named: "Leave out") { model.drafts.leaveOut(draft.id) }
    }

    /// The title, and the note under it when there is one (or while it's being written).
    private var words: some View {
        let editing = field != nil
        return VStack(alignment: .leading, spacing: 2) {
            TextField("Task", text: titleBinding, axis: .vertical)
                .font(.callout)
                .foregroundStyle(Color.ink)
                .submitLabel(.done)
                .focused($field, equals: .title)
                .accessibilityLabel("Task")
                .accessibilityIdentifier("draft.title")
            if !draft.notes.isEmpty || field == .note {
                TextField("Note", text: Binding(get: { draft.notes }, set: { model.drafts.setNotes(draft.id, $0) }), axis: .vertical)
                    .font(.subheadline)
                    .foregroundStyle(Color.ink2)
                    .lineLimit(1...6)
                    .focused($field, equals: .note)
                    .accessibilityLabel("Note")
                    .accessibilityIdentifier("draft.note")
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 6)
        .background {
            RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous)
                .fill(editing ? Color.surface2 : .clear)
                .overlay {
                    if editing {
                        RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(Color.line2, lineWidth: 1)
                    }
                }
        }
        .padding(.leading, -8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .animation(.easeOut(duration: Tokens.Motion.fast), value: editing)
    }

    /// A title is one line: Return finishes the edit (as on the web), and lines pasted in join with spaces.
    private var titleBinding: Binding<String> {
        Binding(get: { draft.title }, set: { value in
            let breaks = value.filter(\.isNewline).count
            if breaks == 1, value.count == draft.title.count + 1 {
                field = nil
                model.drafts.setTitle(draft.id, value.filter { !$0.isNewline })
            } else {
                model.drafts.setTitle(draft.id, value)
            }
        })
    }

    /// The day it goes to: the week ahead, the first day of next week, or any date.
    private var day: some View {
        let label = DraftDays.label(draft.date, today: today)
        return Menu {
            Picker(selection: Binding(get: { draft.date }, set: { model.drafts.move(draft.id, to: $0) })) {
                ForEach(DraftDays.choices(for: draft.date, today: today)) { choice in
                    Text(choice.label).tag(choice.date)
                }
            } label: {
                Text("Day")
            }
            .pickerStyle(.inline)
            Button("Pick a date…", systemImage: "calendar") { picking = true }
        } label: {
            HStack(spacing: 4) {
                Text(label)
                Image(systemName: "chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .foregroundStyle(Color.ink3)
            }
            .font(.token(Tokens.Typography.footnote, weight: .medium))
            .foregroundStyle(Color.ink)
            .lineLimit(1)
            .padding(.leading, 10)
            .padding(.trailing, 8)
            .frame(minHeight: 28)
            .background(Color.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .overlay { RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(Color.line2, lineWidth: 1) }
            .tapTarget()
        }
        .menuOrder(.fixed)
        .fixedSize()
        .accessibilityLabel("Day")
        .accessibilityValue(label)
        .accessibilityHint("Changes the day")
        .accessibilityIdentifier("draft.day")
        .popover(isPresented: $picking, arrowEdge: .top) {
            DatePicker("Day", selection: Binding(get: { draft.date.date() }, set: {
                model.drafts.move(draft.id, to: DayKey($0))
                picking = false
            }), in: today.date()..., displayedComponents: .date)
                .datePickerStyle(.graphical)
                .labelsHidden()
                .tint(Color.ink)
                .frame(width: 320)
                .padding(8)
                .presentationCompactAdaptation(.popover)
        }
    }

    private var leaveOut: some View {
        VoiceIconButton(symbol: Icon.close, label: "Leave out “\(draft.title)”", size: 28, iconSize: 12) {
            model.drafts.leaveOut(draft.id)
        }
        .accessibilityIdentifier("draft.leaveOut")
    }
}
