import SwiftUI

// The pieces Settings is made of (SettingsSheet.tsx): sections named, not painted — a small capital heading, then rows
// split by hairlines, the setting's name (and a hint) on the left and its control on the right.

/// The page's side margin: 16 pt on iPhone, 24 in the iPad window.
struct SettingsMargin: EnvironmentKey {
    static let defaultValue: CGFloat = 16
}

extension EnvironmentValues {
    var settingsMargin: CGFloat {
        get { self[SettingsMargin.self] }
        set { self[SettingsMargin.self] = newValue }
    }
}

/// A section's name: small capitals, no color.
struct SettingsBand: View {
    let title: String
    @Environment(\.settingsMargin) private var margin

    var body: some View {
        Text(title.uppercased())
            .font(.token(Tokens.Typography.caption2, weight: .semibold))
            .tracking(0.06 * 11)
            .foregroundStyle(.ink3)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, margin)
            .padding(.top, 20)
            .padding(.bottom, 6)
            .accessibilityAddTraits(.isHeader)
    }
}

/// One setting: its name (and a hint, wrapping beside the control) on the left, the control on the right; at the
/// largest text sizes the control goes under the name. A hairline under it unless it's the last of its section.
struct SettingsRow<Control: View>: View {
    let title: String
    var hint: String?
    var last = false
    @ViewBuilder let control: Control
    @Environment(\.settingsMargin) private var margin
    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 10) {
                    words
                    control
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            } else {
                HStack(spacing: 16) {
                    words.frame(maxWidth: .infinity, alignment: .leading)
                    control.fixedSize()
                }
            }
        }
        .padding(.horizontal, margin)
        .padding(.vertical, 8)
        .frame(minHeight: hint == nil ? 52 : 64)
        .overlay(alignment: .bottom) {
            if !last { Rectangle().fill(.line).frame(height: 1) }
        }
        .accessibilityElement(children: .contain)
    }

    private var words: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.token(Tokens.Typography.body, weight: .medium))
                .foregroundStyle(.ink)
            if let hint {
                Text(hint)
                    .font(.token(Tokens.Typography.caption))
                    .foregroundStyle(.ink3)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

/// A line that opens a page one level down: its name (a hint under it, something before it), and a framed chevron.
struct SettingsGoRow<Lead: View>: View {
    let title: String
    var hint: String?
    var top = false
    var last = false
    @ViewBuilder let lead: Lead
    @Environment(\.settingsMargin) private var margin

    var body: some View {
        HStack(spacing: 16) {
            HStack(spacing: 12) {
                lead
                VStack(alignment: .leading, spacing: 0) {
                    Text(title)
                        .font(.token(Tokens.Typography.body, weight: .medium))
                        .foregroundStyle(.ink)
                    if let hint {
                        Text(hint)
                            .font(.token(Tokens.Typography.caption))
                            .foregroundStyle(.ink3)
                    }
                }
                .lineLimit(1)
                .truncationMode(.middle)
            }
            Spacer(minLength: 0)
            Image(systemName: Icon.next)
                .font(.system(size: 12, weight: .medium))
                .foregroundStyle(.ink2)
                .frame(width: 28, height: 28)
                .overlay(RoundedRectangle(cornerRadius: 7, style: .continuous).strokeBorder(.line2, lineWidth: 1))
                .accessibilityHidden(true)
        }
        .padding(.horizontal, margin)
        .padding(.vertical, 8)
        .frame(minHeight: hint == nil ? 52 : 64)
        .overlay(alignment: .top) {
            if top { Rectangle().fill(.line).frame(height: 1) }
        }
        .overlay(alignment: .bottom) {
            if !last { Rectangle().fill(.line).frame(height: 1) }
        }
        .contentShape(Rectangle())
    }
}

extension SettingsGoRow where Lead == EmptyView {
    init(title: String, hint: String? = nil, top: Bool = false, last: Bool = false) {
        self.init(title: title, hint: hint, top: top, last: last) { EmptyView() }
    }
}

/// A choice among several (the web's Pick): a framed button showing the current one; it opens the list, the current one
/// ticked. Native menu, the web's look.
struct SettingsPick<Value: Hashable>: View {
    let label: String
    let options: [(value: Value, label: String)]
    @Binding var selection: Value
    /// What the button says (by default the picked option's label).
    var value: String?
    /// A divider after the first option (the language list: Automatic, then the languages).
    var dividerAfterFirst = false

    var body: some View {
        Menu {
            Picker(label, selection: $selection) {
                ForEach(Array(options.prefix(dividerAfterFirst ? 1 : options.count).enumerated()), id: \.offset) { _, o in
                    Text(o.label).tag(o.value)
                }
            }
            if dividerAfterFirst {
                Divider()
                Picker(label, selection: $selection) {
                    ForEach(Array(options.dropFirst().enumerated()), id: \.offset) { _, o in
                        Text(o.label).tag(o.value)
                    }
                }
            }
        } label: {
            HStack(spacing: 8) {
                Text(value ?? options.first { $0.value == selection }?.label ?? "")
                    .lineLimit(1)
                    .frame(maxWidth: .infinity)
                Image(systemName: "chevron.down")
                    .font(.system(size: 11, weight: .medium))
                    .foregroundStyle(.ink3)
            }
            .font(.token(Tokens.Typography.footnote, weight: .medium))
            .foregroundStyle(.ink)
            .padding(.leading, 12)
            .padding(.trailing, 10)
            .frame(width: 176)
            .frame(minHeight: 32)
            .background(.surface, in: RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Tokens.Radius.sm, style: .continuous).strokeBorder(.line2, lineWidth: 1))
            .contentShape(TallerShape(by: 6))
        }
        .menuOrder(.fixed)
        .accessibilityLabel(label)
        .accessibilityValue(value ?? options.first { $0.value == selection }?.label ?? "")
    }
}

/// The accent, as four swatches (iOS keeps a choice of accent; the web is graphite only): the picked one ringed.
struct AccentSwatches: View {
    @Binding var selection: AccentChoice

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AccentChoice.allCases) { choice in
                let on = choice == selection
                Button {
                    selection = choice
                } label: {
                    Circle()
                        .fill(choice.palette.accent.color)
                        .frame(width: 22, height: 22)
                        .overlay(Circle().strokeBorder(.line2, lineWidth: 1).opacity(choice == .graphite ? 1 : 0))
                        .padding(3)
                        .overlay(Circle().strokeBorder(.ink, lineWidth: 1.5).opacity(on ? 1 : 0))
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(PressableStyle())
                .accessibilityLabel(choice.label)
                .accessibilityAddTraits(on ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Accent")
    }
}

/// The languages speech can be heard in, and the guess when none is named (dictation.ts): the device's own languages
/// first, then other widely spoken ones; the guess reads the script of the person's latest tasks.
enum SpokenLanguages {
    struct Language: Hashable {
        let tag: String
        let name: String
    }

    private static let more = ["en-US", "es-ES", "pt-BR", "fr-FR", "de-DE", "it-IT", "ru-RU", "uk-UA", "pl-PL", "tr-TR", "nl-NL",
                               "ar-SA", "hi-IN", "zh-CN", "ja-JP", "ko-KR"]

    /// The device's languages first, then the widely spoken ones; one entry per language.
    static func all(preferred: [String] = Locale.preferredLanguages) -> [Language] {
        var seen = Set<String>()
        var list: [Language] = []
        for tag in (preferred.isEmpty ? ["en-US"] : preferred) + more {
            let b = base(tag)
            guard !seen.contains(b) else { continue }
            seen.insert(b)
            list.append(Language(tag: tag, name: name(tag)))
        }
        return list
    }

    /// "Russian", "English".
    static func name(_ tag: String) -> String {
        Locale(identifier: "en_US").localizedString(forLanguageCode: base(tag)) ?? tag
    }

    /// The language someone most likely speaks: the script of their latest tasks picks among the device's languages;
    /// with too little to go by, the device's first language.
    static func guess(_ sample: [String], preferred: [String] = Locale.preferredLanguages) -> String {
        let prefs = preferred.isEmpty ? ["en-US"] : preferred
        let text = sample.joined(separator: " ")
        guard let script = script(of: text) else { return withRegion(prefs[0]) }
        if let listed = prefs.first(where: { (scriptOf[base($0)] ?? .latin) == script }) { return withRegion(listed) }
        if script == .cyrillic, text.range(of: "[іїєґІЇЄҐ]", options: .regularExpression) != nil,
           text.range(of: "[ыэъёЫЭЪЁ]", options: .regularExpression) == nil { return "uk-UA" }
        return defaultFor[script] ?? "en-US"
    }

    private enum Script: CaseIterable { case latin, cyrillic, greek, hebrew, arabic, devanagari, thai, kana, hangul, han }

    private static func ranges(_ s: Script) -> [ClosedRange<UInt32>] {
        switch s {
        case .latin: [0x41...0x5A, 0x61...0x7A, 0xC0...0x24F]
        case .cyrillic: [0x400...0x4FF]
        case .greek: [0x370...0x3FF]
        case .hebrew: [0x590...0x5FF]
        case .arabic: [0x600...0x6FF]
        case .devanagari: [0x900...0x97F]
        case .thai: [0xE00...0xE7F]
        case .kana: [0x3040...0x30FF]
        case .hangul: [0xAC00...0xD7AF]
        case .han: [0x4E00...0x9FFF]
        }
    }

    private static let scriptOf: [String: Script] = [
        "ru": .cyrillic, "uk": .cyrillic, "be": .cyrillic, "bg": .cyrillic, "sr": .cyrillic, "mk": .cyrillic, "kk": .cyrillic,
        "ky": .cyrillic, "mn": .cyrillic, "el": .greek, "he": .hebrew, "ar": .arabic, "fa": .arabic, "ur": .arabic,
        "hi": .devanagari, "mr": .devanagari, "ne": .devanagari, "th": .thai, "ja": .kana, "ko": .hangul, "zh": .han,
    ]

    private static let defaultFor: [Script: String] = [
        .latin: "en-US", .cyrillic: "ru-RU", .greek: "el-GR", .hebrew: "he-IL", .arabic: "ar-SA", .devanagari: "hi-IN",
        .thai: "th-TH", .kana: "ja-JP", .hangul: "ko-KR", .han: "zh-CN",
    ]

    private static let region: [String: String] = [
        "en": "en-US", "es": "es-ES", "pt": "pt-BR", "fr": "fr-FR", "de": "de-DE", "it": "it-IT", "ru": "ru-RU", "uk": "uk-UA",
        "pl": "pl-PL", "tr": "tr-TR", "nl": "nl-NL", "ar": "ar-SA", "hi": "hi-IN", "zh": "zh-CN", "ja": "ja-JP", "ko": "ko-KR",
        "he": "he-IL", "el": "el-GR", "th": "th-TH", "sv": "sv-SE", "cs": "cs-CZ", "da": "da-DK", "fi": "fi-FI", "nb": "nb-NO",
        "ro": "ro-RO", "hu": "hu-HU", "bg": "bg-BG", "sr": "sr-RS", "id": "id-ID", "vi": "vi-VN",
    ]

    private static func base(_ tag: String) -> String {
        String(tag.split(separator: "-").first ?? Substring(tag)).lowercased()
    }

    private static func withRegion(_ tag: String) -> String {
        tag.contains("-") ? tag : region[tag.lowercased()] ?? tag
    }

    /// The script most of `text` is written in; nil when there's too little to tell.
    private static func script(of text: String) -> Script? {
        var counts: [Script: Int] = [:]
        for scalar in text.unicodeScalars {
            for s in Script.allCases where ranges(s).contains(where: { $0.contains(scalar.value) }) {
                counts[s, default: 0] += 1
                break
            }
        }
        let total = counts.values.reduce(0, +)
        var best: Script?
        var most = 0
        for s in Script.allCases where counts[s, default: 0] > most {
            best = s
            most = counts[s, default: 0]
        }
        guard let best, total >= 12, Double(most) / Double(total) >= 0.6 else { return nil }
        // Japanese is written in kana and Han characters together: any real share of kana means Japanese.
        if best == .han, Double(counts[.kana] ?? 0) / Double(total) > 0.1 { return .kana }
        return best
    }
}
