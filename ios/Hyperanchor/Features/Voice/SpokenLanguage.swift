import Foundation

/// The language someone will most likely speak, without asking them (`guessLanguage` in src/components/voice/dictation.ts).
/// A recognizer can't tell a language from its sound, so it is read from what the person writes: the script of their
/// latest tasks picks among the languages the device lists (someone whose phone is in English but whose tasks are in
/// Russian speaks Russian). With no tasks to go by, it is the device's first language.
///
/// The speech model on the server works the language out by itself (mixed ones too), so it is told one only when the
/// person picked it in Settings; the guess is for listening on the device.
enum SpokenLanguage {
    enum Script: CaseIterable, Sendable {
        case latin, cyrillic, greek, hebrew, arabic, devanagari, thai, kana, hangul, han

        /// The letters of the script (the web's character classes).
        func contains(_ v: UInt32) -> Bool {
            switch self {
            case .latin: (0x41...0x5A).contains(v) || (0x61...0x7A).contains(v) || (0xC0...0x24F).contains(v)
            case .cyrillic: (0x400...0x4FF).contains(v)
            case .greek: (0x370...0x3FF).contains(v)
            case .hebrew: (0x590...0x5FF).contains(v)
            case .arabic: (0x600...0x6FF).contains(v)
            case .devanagari: (0x900...0x97F).contains(v)
            case .thai: (0xE00...0xE7F).contains(v)
            case .kana: (0x3040...0x30FF).contains(v)
            case .hangul: (0xAC00...0xD7AF).contains(v)
            case .han: (0x4E00...0x9FFF).contains(v)
            }
        }

        /// The most widely spoken language written in it, for a person whose device doesn't list one.
        var defaultLanguage: String {
            switch self {
            case .latin: "en-US"
            case .cyrillic: "ru-RU"
            case .greek: "el-GR"
            case .hebrew: "he-IL"
            case .arabic: "ar-SA"
            case .devanagari: "hi-IN"
            case .thai: "th-TH"
            case .kana: "ja-JP"
            case .hangul: "ko-KR"
            case .han: "zh-CN"
            }
        }
    }

    /// The script of the common languages that aren't written in Latin letters.
    private static let scriptOf: [String: Script] = [
        "ru": .cyrillic, "uk": .cyrillic, "be": .cyrillic, "bg": .cyrillic, "sr": .cyrillic, "mk": .cyrillic, "kk": .cyrillic,
        "ky": .cyrillic, "mn": .cyrillic, "el": .greek, "he": .hebrew, "ar": .arabic, "fa": .arabic, "ur": .arabic,
        "hi": .devanagari, "mr": .devanagari, "ne": .devanagari, "th": .thai, "ja": .kana, "ko": .hangul, "zh": .han,
    ]

    /// A region for a bare language ("ru" → "ru-RU"): recognizers are surer with one.
    private static let region: [String: String] = [
        "en": "en-US", "es": "es-ES", "pt": "pt-BR", "fr": "fr-FR", "de": "de-DE", "it": "it-IT", "ru": "ru-RU", "uk": "uk-UA",
        "pl": "pl-PL", "tr": "tr-TR", "nl": "nl-NL", "ar": "ar-SA", "hi": "hi-IN", "zh": "zh-CN", "ja": "ja-JP", "ko": "ko-KR",
        "he": "he-IL", "el": "el-GR", "th": "th-TH", "sv": "sv-SE", "cs": "cs-CZ", "da": "da-DK", "fi": "fi-FI", "nb": "nb-NO",
        "ro": "ro-RO", "hu": "hu-HU", "bg": "bg-BG", "sr": "sr-RS", "id": "id-ID", "vi": "vi-VN",
    ]

    /// "ru-RU" → "ru" (and "zh-Hans-CN" → "zh").
    static func base(_ tag: String) -> String {
        String(tag.split(separator: "-").first ?? Substring(tag)).lowercased()
    }

    /// A tag with a region: "ru" → "ru-RU"; tags that already have one stay as they are.
    static func withRegion(_ tag: String) -> String {
        tag.contains("-") ? tag : (region[tag.lowercased()] ?? tag)
    }

    /// The script most of `text` is written in; nil when there is too little to tell.
    static func script(of text: String) -> Script? {
        var counts: [Script: Int] = [:]
        var total = 0
        for scalar in text.unicodeScalars {
            for s in Script.allCases where s.contains(scalar.value) {
                counts[s, default: 0] += 1
                total += 1
                break
            }
        }
        // The first script with the most letters, as the web walks them in order.
        var best: Script?
        var most = 0
        for s in Script.allCases where counts[s, default: 0] > most {
            best = s
            most = counts[s, default: 0]
        }
        guard total >= 12, Double(most) / Double(total) >= 0.6 else { return nil }
        // Japanese is written in kana and Han characters together: any real share of kana means Japanese.
        if best == .han, Double(counts[.kana, default: 0]) / Double(total) > 0.1 { return .kana }
        return best
    }

    /// The language to listen in: the script of `sample` (the latest task titles) picks among `preferred` (the device's
    /// languages, first is first); without enough to go by, the first of them.
    static func guess(sample: [String], preferred: [String]) -> String {
        let prefs = preferred.isEmpty ? ["en-US"] : preferred
        let text = sample.joined(separator: " ")
        guard let script = script(of: text) else { return withRegion(prefs[0]) }
        if let listed = prefs.first(where: { (scriptOf[base($0)] ?? .latin) == script }) { return withRegion(listed) }
        if script == .cyrillic, text.range(of: "[іїєґ]", options: [.regularExpression, .caseInsensitive]) != nil,
           text.range(of: "[ыэъё]", options: [.regularExpression, .caseInsensitive]) == nil {
            return "uk-UA"
        }
        return script.defaultLanguage
    }

    /// The language to tell the speech model: the one picked in Settings, as a bare code ("ru"); nil lets it work the
    /// language out (the web's `?lang=`).
    static func picked(_ setting: String?) -> String? {
        guard let setting, !setting.isEmpty else { return nil }
        let code = base(setting)
        return code.range(of: "^[a-z]{2,3}$", options: .regularExpression) != nil ? code : nil
    }
}
