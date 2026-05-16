---
name: xcuitest
description: When the user wants to design, implement, debug, or stabilize XCUITest tests for native iOS UI automation. Use when the user mentions "XCUITest," "XCTest," "XCUIApplication," "XCUIElement," "XCUIElementQuery," "accessibilityIdentifier," "Xcode UI test target," "xcodebuild test," "xcrun simctl," "test plans (Xcode)," or "Xcode Cloud." For cross-platform mobile see appium. For Android-native see espresso. For React Native see detox. For YAML-driven mobile see maestro.
metadata:
  version: 1.0.0
---

# XCUITest (iOS)

You are an expert in XCUITest — Apple's native UI testing framework, built on XCTest. Your goal is to help engineers write fast, reliable iOS UI tests, design accessible apps that test well, and run XCUITest at scale. Don't fabricate XCTest assertion names, XCUIApplication methods, or `xcodebuild`/`simctl` flags. When uncertain, point the reader to Apple's developer documentation.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **iOS only?** — XCUITest is iOS/iPadOS-specific. For cross-platform, mention Appium (which uses the XCUITest driver under the hood on iOS).
- **Language** — Swift is standard; Objective-C is supported but rare for new tests.
- **App architecture** — UIKit vs SwiftUI affects accessibility traits and element identification.
- **Build system** — Xcode project / SPM / Tuist / xcconfig matrix.
- **CI host** — macOS-only. Xcode Cloud, GitHub Actions macOS runner, Bitrise, CircleCI Mac, BrowserStack / Sauce / AWS Device Farm.

If the file does not exist, ask: deployment target / minimum iOS version, UIKit / SwiftUI / mixed, simulator-only or real-device, CI host.

---

## Why XCUITest

- **Native to Apple's toolchain** — integrates with Xcode, runs on real devices and simulators, included in the iOS developer kit.
- **Black-box but fast** — runs out-of-process from the app, but Apple's instrumentation is well-tuned.
- **Accessibility-driven** — the same identifiers that make the app accessible make tests stable.
- **Built into Xcode** — record interactions, view element trees, snapshot tests in Xcode's Test Navigator.

When *not* to use XCUITest:

- Cross-platform team → Appium.
- React Native team → Detox.
- Headless / non-Mac CI → impossible; XCUITest requires macOS.
- Simple repetitive flows where YAML is more practical → Maestro.

---

## Project setup

A UI test target sits alongside the app target in Xcode:

```
MyApp.xcodeproj
├── MyApp                (app target)
├── MyAppTests           (unit tests — XCTest)
└── MyAppUITests         (UI tests — XCTest + XCUITest)
```

The UI test target depends on the app's release/debug build. Tests run against a launched instance of the app via `XCUIApplication`.

A new UI test class typically looks like:

```swift
import XCTest

final class LoginUITests: XCTestCase {
  let app = XCUIApplication()

  override func setUpWithError() throws {
    continueAfterFailure = false
    app.launchArguments = ["-uiTesting", "1"]
    app.launchEnvironment = ["MOCK_API": "true"]
    app.launch()
  }

  func test_sign_in_with_valid_credentials() {
    app.textFields["login.email"].tap()
    app.textFields["login.email"].typeText("qa.user@example.com")

    app.secureTextFields["login.password"].tap()
    app.secureTextFields["login.password"].typeText("Pa$$w0rd-fake")

    app.buttons["login.submit"].tap()

    XCTAssertTrue(app.staticTexts["dashboard.welcome"].waitForExistence(timeout: 5))
  }
}
```

Use `accessibilityIdentifier` (set in the app code) for stable element selection — *not* `accessibilityLabel`, which is user-visible text that may localize.

---

## Element queries

`XCUIElementQuery` exposes elements by type and predicates:

| Query | Example |
|-------|---------|
| `app.buttons["id"]` | Button with accessibility id "id". |
| `app.textFields["..."]` | Text field. |
| `app.cells.element(boundBy: 2)` | Third cell. |
| `app.cells.containing(.staticText, identifier: "Widget").element` | Cell containing a specific element. |
| `app.descendants(matching: .button).matching(NSPredicate(format: "label CONTAINS 'Sign'"))` | Predicate-based. |

`XCUIElement` lazy-evaluates — the query runs when you access `.exists` / `.label` / `.tap()`.

---

## Waiting

XCUITest doesn't auto-wait the way Espresso does. Use `waitForExistence(timeout:)`:

```swift
XCTAssertTrue(app.staticTexts["dashboard.welcome"].waitForExistence(timeout: 5))
```

For more flexible polling, use `XCTNSPredicateExpectation`:

```swift
let pred = NSPredicate(format: "exists == true")
let exp = expectation(for: pred, evaluatedWith: app.staticTexts["loaded"])
wait(for: [exp], timeout: 5)
```

Avoid `sleep(N)` — same anti-pattern as Selenium/Appium.

---

## Accessibility identifiers (the right way)

Set them in the app code:

```swift
// SwiftUI
Button("Sign in") { ... }.accessibilityIdentifier("login.submit")

// UIKit
signInButton.accessibilityIdentifier = "login.submit"
```

**Identifiers are for tests; labels are for users.** Tests should use identifiers; assertions on visible text can be done via `label`, but be aware of localization.

For SwiftUI specifically, the identifier survives recomposition and is the most reliable hook.

---

## Test plans

Xcode test plans (`.xctestplan`) let you run the same target with different configurations: locale, language, environment variables, code coverage, parallelism.

```
SmokeTests.xctestplan
  - environment: STAGING_URL=...
  - locale: en_US, de_DE, ja_JP
  - parallelizable: true
```

Test plans are the standard way to run the same suite across locales / environments in CI.

---

## Running

| Command | Purpose |
|---------|---------|
| `xcodebuild test -project MyApp.xcodeproj -scheme MyAppUITests -destination 'platform=iOS Simulator,name=iPhone 15,OS=17.0'` | Run UI tests. |
| `xcodebuild test -workspace MyApp.xcworkspace -scheme MyApp -testPlan SmokeTests` | Run via test plan. |
| `xcrun simctl list devices` | List simulators. |
| `xcrun simctl boot <udid>` | Boot a simulator. |
| `xcrun simctl push <udid> com.example.MyApp payload.json` | Push notification (works on modern simulators). |
| `xcodebuild -resultBundlePath result.xcresult` | Save the result bundle for analysis. |

Verify flags against `xcodebuild -h` for your installed Xcode.

---

## Result bundles and reporting

Xcode produces an `.xcresult` bundle on every run. Open in Xcode to see per-test status, screenshots, attachments. For CI:

- `xcresulttool` extracts JSON / HTML summaries.
- `xchtmlreport` (community tool) generates a friendlier HTML report.
- For CI integration, JUnit XML is producible from xcresult via tooling — verify which one your CI consumes.

---

## Snapshot / record mode

Xcode's Test Navigator has a record button that captures interactions as code. Useful for bootstrapping locators — **always review the generated code**. Recordings tend to be brittle (literal index-based queries) and need to be rewritten to use accessibility identifiers.

---

## Real device vs simulator

| Concern | Simulator | Real device |
|---------|-----------|-------------|
| Most UI tests | ✅ | ✅ |
| Push notifications | ✅ (modern Xcode + `simctl push`) | ✅ |
| Apple Pay | ⚠ Mock only | ✅ |
| Biometric auth | ✅ via `XCUIDevice.shared.perform(...)` and Hardware menu (manual) | ✅ |
| Camera / mic / sensors | Limited | ✅ |
| Performance numbers | Misleading | Accurate |

Use simulators for the bulk; real devices for capabilities that simulators can't realistically replicate.

---

## Common Pitfalls

- **Using `accessibilityLabel` for locators** — labels are user-visible and localized. Use `accessibilityIdentifier`.
- **Long index-based queries from recording** — `cells.element(boundBy: 4)` breaks on minor list changes. Replace with identifier-based queries.
- **`sleep(5)` for timing** — use `waitForExistence(timeout:)`.
- **Not setting `continueAfterFailure = false`** — first failure cascades into ten more, drowning the report.
- **Forgetting `launchArguments` / `launchEnvironment` for test-mode toggles** — app should detect test mode and stub external services or disable animations.
- **One mega-test method** — split by behavior. Each test should set up and verify one outcome.
- **Letting localization randomness affect tests** — set `app.launchArguments += ["-AppleLanguages", "(en)"]` if you need a locked locale.
- **Running on simulator-only when business logic depends on real hardware** — biometric, camera, NFC.
- **Not using test plans for locale matrix** — easy way to multiply coverage without copy-pasting test files.

---

## Task-Specific Questions

When helping with XCUITest, ask:

1. Minimum iOS version target?
2. UIKit, SwiftUI, or mixed?
3. Have accessibility identifiers been added to the testable elements?
4. Are tests running locally, on Xcode Cloud, GitHub Actions macOS, Bitrise, BrowserStack, etc.?
5. Are test plans in use for locale / environment matrix?
6. Real-device-required scenarios (biometric, camera, push)?
7. How are results captured — xcresult, xchtmlreport, JUnit XML for CI?

---

## Related Skills

- **appium** — cross-platform alternative (uses XCUITest driver under the hood).
- **espresso** — Android-native equivalent.
- **detox** — React Native gray-box alternative.
- **maestro** — YAML-driven, simpler.
- **xunit-nunit** / **junit-testng** — different ecosystems but conceptually similar test patterns.
- **ci-test-orchestration** — for parallelizing on macOS runners and Xcode Cloud setups.
- **cloud-test-grids** — BrowserStack / Sauce / AWS Device Farm for managed iOS device pools.
- **accessibility-testing** — accessibility identifiers double as test hooks and accessibility features; aligned investment.
