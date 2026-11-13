import XCTest
@testable import Hyperanchor

/// Speak your tasks: the language guess, when listening ends by itself, the meter, the drafts and the screen's steps.
final class VoiceTests: XCTestCase {
    // MARK: Spoken language

    /// The expected values are what the web's `guessLanguage` (src/components/voice/dictation.ts) answers for the same
    /// samples and languages.
    func testLanguageIsGuessedLikeTheWeb() {
        let cases: [([String], [String], String)] = [
            (["Call the bank", "Buy oat milk", "Book the flights"], ["en-US"], "en-US"),
            (["Позвонить в банк", "Купить молоко"], ["en-US", "ru-RU"], "ru-RU"),
            (["Позвонить в банк", "Купить молоко"], ["en-US"], "ru-RU"),
            (["Зустріч із лікарем", "Купити хліб"], ["en-US"], "uk-UA"),
            (["Зустріч із лікарем", "Купити хліб", "Съесть ещё"], ["en-US"], "ru-RU"),
            (["銀行に電話する", "牛乳を買う", "友達にメールを送る"], ["en-US"], "en-US"),
            (["東京駅で会議資料を印刷", "新幹線予約"], ["en-US"], "ja-JP"),
            (["给银行打电话", "买牛奶和面包"], ["en-US"], "zh-CN"),
            (["Hi"], ["ru"], "ru-RU"),
            (["Позвонить", "Call the bank today"], ["de-DE"], "de-DE"),
            ([], [], "en-US"),
            (["Позвонить в банк", "Купить молоко"], ["uk-UA", "en-US"], "uk-UA"),
            (["Kup mleko i chleb", "Zadzwoń do banku"], ["pl-PL", "ru-RU"], "pl-PL"),
            (["Позвонить в банк", "Купить молоко"], ["en-GB", "ru-US"], "ru-US"),
            (["Позвонить в банк", "Купить молоко"], ["en", "ru"], "ru-RU"),
        ]
        for (sample, preferred, expected) in cases {
            XCTAssertEqual(SpokenLanguage.guess(sample: sample, preferred: preferred), expected, "\(sample) \(preferred)")
        }
    }

    func testOnlyAPickedLanguageGoesToTheServer() {
        XCTAssertNil(SpokenLanguage.picked(nil))
        XCTAssertNil(SpokenLanguage.picked(""))
        XCTAssertEqual(SpokenLanguage.picked("ru"), "ru")
        XCTAssertEqual(SpokenLanguage.picked("ru-RU"), "ru")
        XCTAssertEqual(SpokenLanguage.picked("zh-Hans-CN"), "zh")
        XCTAssertNil(SpokenLanguage.picked("auto-detect"))
        XCTAssertEqual(SpokenLanguage.withRegion("uk"), "uk-UA")
        XCTAssertEqual(SpokenLanguage.withRegion("pt-PT"), "pt-PT")
        XCTAssertEqual(SpokenLanguage.withRegion("xx"), "xx")
    }

    // MARK: When listening ends by itself

    func testARecordingWaitsWhileNoSoundComesThrough() {
        var watch = SilenceWatch(started: 0)
        for t in stride(from: 0.1, through: 60, by: 0.1) {
            XCTAssertNil(watch.update(level: 0, live: false, now: t).stop, "no telling a pause from a voice: wait for Done")
        }
        XCTAssertEqual(watch.update(level: 0, live: false, now: 270.1).stop, .limit)
    }

    func testNothingSaidEndsListeningAfterTwelveSeconds() {
        var watch = SilenceWatch(started: 0)
        XCTAssertNil(watch.update(level: 0.1, live: true, now: 11.9).stop, "0.1 is under the voice threshold")
        XCTAssertEqual(watch.update(level: 0.1, live: true, now: 12.1).stop, .silence)
    }

    func testAPauseAfterWordsEndsListeningAfterFiveSeconds() {
        var watch = SilenceWatch(started: 0)
        XCTAssertEqual(watch.update(level: 0.2, live: true, now: 1).speaking, true)
        // Once speaking, a voice only has to stay over the lower threshold.
        XCTAssertNil(watch.update(level: 0.1, live: true, now: 1.5).speaking)
        XCTAssertNil(watch.update(level: 0.05, live: true, now: 1.6).speaking, "held for a moment after the voice")
        XCTAssertEqual(watch.update(level: 0.05, live: true, now: 2.2).speaking, false)
        XCTAssertNil(watch.update(level: 0, live: true, now: 6.4).stop)
        XCTAssertEqual(watch.update(level: 0, live: true, now: 6.6).stop, .silence)
        XCTAssertTrue(watch.spoke)
    }

    func testListeningStopsAtFourAndAHalfMinutes() {
        var watch = SilenceWatch(started: 10)
        var t = 10.0
        while t < 279 {
            t += 1
            XCTAssertNil(watch.update(level: 0.5, live: true, now: t).stop)
        }
        XCTAssertEqual(watch.update(level: 0.5, live: true, now: 280.1).stop, .limit)
    }

    func testWhatIsWorthSending() {
        XCTAssertTrue(SilenceWatch.worthSending(reason: .stopped, seconds: 3, bytes: 900, live: true, spoke: false), "Done: a quiet voice may be there")
        XCTAssertFalse(SilenceWatch.worthSending(reason: .silence, seconds: 12, bytes: 900, live: true, spoke: false), "only silence")
        XCTAssertTrue(SilenceWatch.worthSending(reason: .silence, seconds: 9, bytes: 900, live: true, spoke: true))
        XCTAssertTrue(SilenceWatch.worthSending(reason: .limit, seconds: 270, bytes: 900, live: false, spoke: false), "no meter to go by")
        XCTAssertFalse(SilenceWatch.worthSending(reason: .stopped, seconds: 0.5, bytes: 900, live: true, spoke: true), "too short")
        XCTAssertFalse(SilenceWatch.worthSending(reason: .stopped, seconds: 3, bytes: 0, live: true, spoke: true), "nothing recorded")
    }

    func testListeningOnTheDeviceGoesByTheWords() {
        var watch = WordsWatch(started: 0)
        XCTAssertNil(watch.stop(at: 11.9, anything: false))
        XCTAssertEqual(watch.stop(at: 12.1, anything: false), .silence)
        watch.heard(at: 3)
        XCTAssertTrue(watch.speaking(at: 3.6))
        XCTAssertFalse(watch.speaking(at: 3.8))
        XCTAssertNil(watch.stop(at: 7.4, anything: true))
        XCTAssertEqual(watch.stop(at: 7.6, anything: true), .silence)
        XCTAssertEqual(watch.stop(at: 270.1, anything: true), .limit)
    }

    func testListeningClock() {
        XCTAssertEqual(listeningClock(0), "0:00")
        XCTAssertEqual(listeningClock(12.9), "0:12")
        XCTAssertEqual(listeningClock(65.7), "1:05")
        XCTAssertEqual(listeningClock(270), "4:30")
    }

    // MARK: The meter

    func testSilenceMovesNothingAndAVoiceFillsTheRange() {
        var meter = LevelNormalizer()
        let quiet = meter.read(rms: 0, raw: SIMD16(repeating: 0.3), dt: 1 / 60)
        XCTAssertEqual(quiet.level, 0)
        XCTAssertEqual(quiet.bands, .zero, "the hiss of an open microphone moves nothing")
        XCTAssertFalse(meter.live)
        var loud = Heard.silence
        for _ in 0..<30 { loud = meter.read(rms: 0.2, raw: SIMD16(repeating: 0.5), dt: 1 / 60) }
        XCTAssertTrue(meter.live)
        XCTAssertGreaterThan(loud.level, 0.9)
        XCTAssertEqual(loud.bands[0], 1, accuracy: 0.001, "the loudest band so far is the top")
    }

    func testTheMeterHearsWhereASoundIs() throws {
        let rate = 48_000.0
        let analyzer = try XCTUnwrap(SpectrumAnalyzer(sampleRate: rate))
        let edges = SpectrumAnalyzer.bandEdges(sampleRate: rate)
        XCTAssertEqual(edges.count, 17)
        XCTAssertEqual(edges.first, 4)
        XCTAssertEqual(edges.last, 213)
        XCTAssertEqual(edges, edges.sorted())

        // A 1 kHz tone lands in the band that covers 1 kHz (FFT bin 42.7 at 48 kHz).
        let tone = (0..<9600).map { Float(0.5 * sin(2 * .pi * 1000 * Double($0) / rate)) }
        var last = Heard.silence
        var readings = 0
        tone.withUnsafeBufferPointer { samples in
            analyzer.feed(samples.baseAddress!, count: samples.count) { _, heard in
                last = heard
                readings += 1
            }
        }
        XCTAssertEqual(readings, 9600 / SpectrumAnalyzer.hop)
        let band = try XCTUnwrap(edges.indices.dropLast().first { edges[$0] <= 42 && 42 < edges[$0 + 1] })
        let loudest = (0..<16).max { last.bands[$0] < last.bands[$1] }
        XCTAssertEqual(loudest, band)
        XCTAssertGreaterThan(last.level, 0.5)
        XCTAssertTrue(analyzer.live)
    }

    // MARK: Drafts

    private let today = DayKey("2026-11-13")! // a Friday

    func testDraftsAreEditedInPlace() throws {
        var list = DraftList()
        list.append([
            TaskDraft(title: "Call the dentist", notes: "About the crown", date: today.adding(days: 1)),
            TaskDraft(title: "Buy oat milk", date: today.adding(days: 1)),
            TaskDraft(title: "Book the flights", notes: "Window seat", date: today),
        ])
        let ids = list.items.map(\.id)
        XCTAssertEqual(list.count, 3)

        list.setTitle(ids[0], "Call the\ndentist  again")
        XCTAssertEqual(list.items[0].title, "Call the dentist  again", "a title is one line")
        list.setTitle(ids[1], String(repeating: "a", count: 600))
        XCTAssertEqual(list.items[1].title.count, TaskItem.titleMax)
        list.setNotes(ids[2], "Window seat\nNo red-eye")
        XCTAssertEqual(list.items[2].notes, "Window seat\nNo red-eye")
        list.move(ids[2], to: today.adding(days: 3))
        XCTAssertEqual(list.items[2].date, today.adding(days: 3))

        list.leaveOut(ids[1])
        XCTAssertEqual(list.items.map(\.id), [ids[0], ids[2]])

        // Speaking more adds to the ones already there.
        list.append([TaskDraft(title: "Water the plants", date: today)])
        XCTAssertEqual(list.items.count, 3)
        XCTAssertEqual(list.items.last?.title, "Water the plants")
    }

    func testAddSavesTidyTitlesAndSkipsClearedOnes() {
        var list = DraftList()
        list.append([
            TaskDraft(title: "  Call   the bank ", notes: " Before 6 pm \n", date: today),
            TaskDraft(title: "Clear me", date: today),
        ])
        list.setTitle(list.items[1].id, "   ")
        XCTAssertEqual(list.count, 1)
        let ready = list.ready
        XCTAssertEqual(ready.map(\.title), ["Call the bank"])
        XCTAssertEqual(ready.map(\.notes), ["Before 6 pm"])
        XCTAssertEqual(ready.map(\.date), [today])
    }

    func testTheDayMenuOffersTheWeekAheadAndNextWeek() {
        let saved = DayKey.weekStart
        defer { DayKey.weekStart = saved }

        DayKey.weekStart = 1
        XCTAssertEqual(DraftDays.choices(for: today.adding(days: 1), today: today).map(\.label), [
            "Today", "Tomorrow", "Sun, Nov 15", "Mon, Nov 16 · next week", "Tue, Nov 17", "Wed, Nov 18", "Thu, Nov 19",
        ])
        // A day further out is offered too, in its place.
        XCTAssertEqual(DraftDays.choices(for: DayKey("2026-12-03")!, today: today).map(\.label).last, "Thu, Dec 3")

        DayKey.weekStart = 0
        XCTAssertEqual(DraftDays.choices(for: today, today: today).map(\.label)[2], "Sun, Nov 15 · next week")

        // On a Monday, next week's Monday is past the week ahead: it comes last.
        DayKey.weekStart = 1
        let monday = DayKey("2026-11-16")!
        XCTAssertEqual(DraftDays.choices(for: monday, today: monday).map(\.label).last, "Mon, Nov 23 · next week")
        XCTAssertEqual(DraftDays.label(today.adding(days: 2), today: today), "Sun, Nov 15")
    }

    // MARK: What is offered and said

    func testSpeakingIsOfferedUnlessTheServerSaysNo() {
        let features = { (voice: Bool) in Usage(today: .init(used: 0, left: 10_000, limit: 10_000), features: .init(voice: voice, transcribe: true, summary: true)) }
        XCTAssertTrue(SpeakButton.isOffered(usage: nil))
        XCTAssertTrue(SpeakButton.isOffered(usage: Usage(today: .init(used: 0, left: 1, limit: 1), features: nil)))
        XCTAssertTrue(SpeakButton.isOffered(usage: features(true)))
        XCTAssertFalse(SpeakButton.isOffered(usage: features(false)))
    }

    func testEachStepWordsItsFailures() {
        XCTAssertEqual(VoiceCopy.hearing(.busy), "Couldn’t write that down right now. Try again in a moment.")
        XCTAssertEqual(VoiceCopy.sorting(.busy), "The sorter is busy right now.")
        XCTAssertEqual(VoiceCopy.hearing(.limit), VoiceCopy.sorting(.limit))
        XCTAssertEqual(VoiceCopy.sorting(.offline), "You’re offline. What you said is kept: try again when you’re back.")
        XCTAssertEqual(VoiceCopy.stopped(.silence), "Nothing was heard. Try again a little closer to the microphone.")
        XCTAssertEqual(VoiceCopy.tasks(1), "1 task")
        XCTAssertEqual(VoiceCopy.tasks(3), "3 tasks")
    }
}

// MARK: - The screen's steps

/// A server for the voice screen: what it answers can be set per test.
private actor VoiceBackend: Backend {
    var drafts: [TaskDraft] = []
    var failure: AIFailure?
    private(set) var sorted: [String] = []

    func set(drafts: [TaskDraft]) { self.drafts = drafts }
    func set(failure: AIFailure?) { self.failure = failure }

    nonisolated func setToken(_ token: String?) {}
    func fetchTasks(from: DayKey, to: DayKey) async throws -> [TaskItem] { [] }
    func createTask(_ task: TaskItem) async throws {}
    func updateTask(id: String, patch: TaskPatch) async throws {}
    func deleteTask(id: String) async throws {}
    func signIn(provider: SignInProvider, idToken: String, nonce: String?, name: String?) async throws -> (token: String, user: AppUser) {
        ("t", AppUser(name: "", email: "", image: nil))
    }
    func deleteAccount(appleAuthorizationCode: String?) async throws {}

    func usage() async throws -> Usage {
        Usage(today: .init(used: 0, left: 10_000, limit: 10_000), features: .init(voice: true, transcribe: true, summary: true))
    }

    func parseTasks(text: String, today: DayKey, weekStart: Int) async throws -> (tasks: [TaskDraft], left: Int) {
        sorted.append(text)
        if let failure { throw failure }
        return (drafts, 9000)
    }
}

@MainActor
final class SpeakModelTests: XCTestCase {
    private let today = DayKey("2026-11-13")!
    private var backend: VoiceBackend!
    private var closed = 0

    override func setUp() async throws {
        backend = VoiceBackend()
        closed = 0
    }

    /// The screen, opened for typing (so nothing listens).
    private func typingModel() -> SpeakModel {
        let model = SpeakModel()
        model.open(SpeakModel.Context(
            backend: backend, today: { [today] in today }, weekStart: { 1 }, language: nil, sample: [],
            simulated: true, onDevice: false, unauthorized: {}, close: { [weak self] in self?.closed += 1 }))
        model.type(true)
        return model
    }

    func testTypedWordsComeBackAsTasksAndJoinTheOnesThere() async {
        await backend.set(drafts: [TaskDraft(title: "Call the bank", date: today)])
        let model = typingModel()
        model.text = "Tomorrow call the bank"
        await model.sort(model.text)
        XCTAssertEqual(model.phase, .idle)
        XCTAssertTrue(model.review, "the window is up from the moment sorting starts")
        XCTAssertEqual(model.count, 1)
        XCTAssertEqual(model.text, "", "the box is emptied for more")

        await backend.set(drafts: [TaskDraft(title: "Buy oat milk", date: today.adding(days: 1))])
        model.more()
        XCTAssertFalse(model.review)
        await model.sort("And buy oat milk tomorrow")
        XCTAssertEqual(model.drafts.items.map(\.title), ["Call the bank", "Buy oat milk"])
        XCTAssertEqual(model.add()?.map(\.title), ["Call the bank", "Buy oat milk"])
    }

    func testNothingToSortSaysSo() async {
        let model = typingModel()
        await model.sort("I had a long day")
        XCTAssertEqual(model.problem?.message, VoiceCopy.noTasks)
        XCTAssertNil(model.add(), "nothing to add")
    }

    func testABusySorterCanBeAskedAgain() async {
        await backend.set(failure: .busy)
        let model = typingModel()
        await model.sort("Call the bank")
        XCTAssertEqual(model.problem?.message, "The sorter is busy right now.")
        XCTAssertEqual(model.problem?.again, "Call the bank")

        await backend.set(failure: .limit)
        await model.sort("Call the bank")
        XCTAssertNil(model.problem?.again, "no point asking again today")
        XCTAssertTrue(model.spent)
    }

    func testTooMuchAtOnceIsNotSent() async {
        let model = typingModel()
        await model.sort(String(repeating: "Call the bank. ", count: 500))
        XCTAssertEqual(model.problem?.message, VoiceCopy.tooMuch)
        let sent = await backend.sorted
        XCTAssertTrue(sent.isEmpty)
    }

    func testLeavingWithTasksInHandAsksFirst() async {
        await backend.set(drafts: [TaskDraft(title: "Call the bank", date: today)])
        let model = typingModel()
        await model.sort("Call the bank")
        model.discard()
        XCTAssertTrue(model.confirming)
        XCTAssertEqual(closed, 0)
        model.discard()
        XCTAssertEqual(closed, 1)
    }

    func testLeavingTheStageShowsTheTasksFirst() async {
        await backend.set(drafts: [TaskDraft(title: "Call the bank", date: today)])
        let model = typingModel()
        model.leave()
        XCTAssertEqual(closed, 1, "nothing in hand: the screen closes")

        let other = typingModel()
        await other.sort("Call the bank")
        other.review = false
        other.leave()
        XCTAssertTrue(other.review, "the tasks are shown instead of lost")
        XCTAssertEqual(closed, 1)
    }
}
