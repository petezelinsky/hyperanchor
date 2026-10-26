# Hyperanchor

One product, two clients: the web app (Next.js, repo root, deployed at hyperanchor.app) and the native
iPhone/iPad app (`ios/`, SwiftUI). Both talk to the same API (`src/app/api`) and show the same tasks.

## Rule: every interface change lands in both

- Any change to the interface — copy, layout, behavior, colors, a new screen or control — is made **in the web
  and in iOS** in the same piece of work. The web is the reference for behavior; iOS follows it with native
  interactions (swipes, context menus, sheets) rather than copying web widgets.
- Colors, radii and shadows live in `design/tokens.json`. Change them there and run `npm run tokens`, which
  rewrites the token block in `src/app/globals.css` and `ios/Hyperanchor/Design/Tokens.swift`. Never edit the
  generated parts by hand.
- Calculations shared by both (dates, sorting, analytics in `src/lib/dates.ts`, `tasks.ts`, `stats.ts`) have Swift
  ports in `ios/Hyperanchor/Model/`. Change both and keep the unit tests in `ios/HyperanchorTests` in step.
- Verify both before calling it done:
  - Web: `npm run typecheck` and `npm run build`; look at the change in a browser (light and dark, phone width).
  - iOS: build and run the tests (below), run it in the simulator and look at the screens you touched in light
    and dark, on a small iPhone and on iPad.

## Commands

```bash
npm run typecheck && npm run build        # web
npm run tokens                            # regenerate design tokens for web + iOS
```

Xcode lives at `~/Downloads/Xcode.app` (the system `xcode-select` points at the Command Line Tools), so prefix
Xcode commands with `DEVELOPER_DIR`:

```bash
export DEVELOPER_DIR=~/Downloads/Xcode.app/Contents/Developer
xcodebuild -project ios/Hyperanchor.xcodeproj -scheme Hyperanchor -destination 'platform=iOS Simulator,name=iPhone 17' build
xcodebuild -project ios/Hyperanchor.xcodeproj -scheme Hyperanchor -destination 'platform=iOS Simulator,name=iPhone 17' test
```

The app accepts launch arguments for working without a server: `-demo` (signed in, sample tasks, in-memory
backend) and `-uitest` (the same, reset on every launch; used by the UI tests).

## Conventions

- Web: see `README.md` (stack, API, env). Server changes must not break the web: run typecheck and build.
- iOS: Swift 6, SwiftUI, iOS 17+, no third-party dependencies. Design rules from the README apply: neutral grays,
  black primary buttons, one accent that means today / done / progress; red only for destructive actions and
  drops, green only for rises in analytics; never color body text with the accent.
