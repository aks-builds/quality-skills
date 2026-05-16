---
name: maestro
description: When the user wants to design, implement, debug, or operate Maestro mobile UI flows. Use when the user mentions "Maestro," "maestro.dev," "Maestro flow," "maestro test," "Maestro Cloud," "maestro studio," "tapOn," "assertVisible," "scrollUntilVisible," ".maestro/" flows, or "yaml mobile test." For React Native gray-box see detox. For Android-native see espresso. For iOS-native see xcuitest. For Appium see appium.
metadata:
  version: 1.0.0
---

# Maestro

You are an expert in Maestro — the YAML-driven mobile UI testing tool from mobile.dev. Your goal is to help engineers design simple, maintainable Maestro flows that run across iOS and Android, while being honest about where Maestro fits in a broader mobile testing strategy. Don't fabricate Maestro commands, flow YAML keys, or CLI flags. When uncertain, point the reader to `maestro.mobile.dev/docs`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Why Maestro?** — common reasons: simple syntax accessible to non-engineers, fast cross-platform flow authoring, smoke-test layer alongside Detox/Appium for richer suites. Don't pretend Maestro is a full replacement for Detox / Appium / native frameworks — it solves a specific class of problems well.
- **Platforms** — iOS and Android. Maestro is genuinely cross-platform with a single flow file.
- **App type** — native iOS, native Android, React Native, Flutter — Maestro supports all of these via UI tree introspection.
- **Local vs hosted (Maestro Cloud)** — Maestro Cloud (mobile.dev) provides hosted runs and device matrices. Honest evaluation needs to include the hosted angle.

If the file does not exist, ask: platforms, app type, target device strategy (sim/emulator/real-device-cloud/Maestro Cloud), and whether non-engineers will author flows.

---

## Why Maestro

- **YAML flows** — readable, version-controllable, accessible to non-coders.
- **Cross-platform out of the box** — same flow runs on iOS and Android.
- **Built-in retries and waits** — Maestro tolerates animations and async UI without per-step configuration.
- **Maestro Studio** — interactive flow recording / inspection tool, faster than hand-authoring.
- **Simple distribution** — single binary, no Appium server or Detox build pipeline.

When *not* to use Maestro:

- Complex branching logic, data-driven tests with rich JS hooks → Detox / Appium.
- Native-only Android team that wants Espresso's speed → espresso.
- Native-only iOS team that wants XCUITest's depth → xcuitest.
- Tests that need to assert on internal app state (not just UI) → gray-box frameworks.

---

## Flow anatomy

A Maestro flow is a YAML file. Minimum example:

```yaml
appId: com.example.myapp
---
- launchApp
- tapOn: "login.email"
- inputText: "qa.user@example.com"
- tapOn: "login.password"
- inputText: "Pa$$w0rd-fake"
- tapOn: "login.submit"
- assertVisible: "Welcome"
```

- **Header section** (before `---`) declares `appId` (Android) / iOS bundle ID and shared config.
- **Steps** are a list of commands. Each command is a YAML map.

Multiple flows live in a `.maestro/` folder; subdivide by feature or screen.

---

## Commands

### Navigation

| Command | Purpose |
|---------|---------|
| `launchApp` | Launch the app under `appId`. |
| `launchApp: { appId: ..., clearState: true }` | Launch with clean state. |
| `stopApp` | Force-stop. |
| `back` | System back (Android) / equivalent. |
| `pressKey: Home` | Press a hardware key. |
| `openLink: "https://..."` | Deep link / universal link. |
| `clearState` | Clear app data. |

### Interaction

| Command | Purpose |
|---------|---------|
| `tapOn: "..."` | Tap by id / label / text. |
| `tapOn: { id: "login.submit" }` | Explicit id-based tap. |
| `tapOn: { point: "50%,50%" }` | Tap by coordinates (% or px). |
| `longPressOn: "..."` | Long press. |
| `doubleTapOn: "..."` | Double tap. |
| `inputText: "qa.user@example.com"` | Type into the focused field. |
| `eraseText` / `clearKeychain` | Cleanup. |
| `scroll` / `scrollUntilVisible` | Scroll. |
| `swipe: { from: ..., to: ... }` | Custom swipe. |

### Assertions

| Command | Purpose |
|---------|---------|
| `assertVisible: "Welcome"` | Element exists and is visible. |
| `assertNotVisible: "..."` | Element absent / hidden. |
| `assertTrue: "${output.status == 200}"` | Conditional assertion using JS-like expressions. |

### Waiting

Maestro auto-retries the next command until it succeeds or times out. Explicit `waitForAnimationToEnd` is also available.

---

## Selectors

Maestro matches on multiple attributes simultaneously:

- accessibility identifier (iOS `accessibilityIdentifier`, Android resource-id or content-desc).
- visible text.
- text content of nearby elements.

`tapOn: "Sign in"` is the simplest form — Maestro finds any element labeled / containing "Sign in." For unambiguous targeting, use:

```yaml
- tapOn:
    id: "login.submit"
- tapOn:
    text: "Sign in"
    index: 1
- tapOn:
    id: "row"
    childOf:
      id: "products-list"
```

For SwiftUI / Compose apps, ensure developers set accessibility identifiers — Maestro is dramatically more reliable with stable IDs.

---

## Reusing flows

Reference another flow as a sub-flow:

```yaml
appId: com.example.myapp
---
- runFlow: "shared/login.yaml"
- tapOn: "Settings"
- assertVisible: "Profile"
```

Use sub-flows for setup (login, seed user, navigate to a screen) instead of copy-pasting.

---

## Conditional logic and parameters

Maestro supports lightweight JS-like expressions:

```yaml
appId: com.example.myapp
env:
  USERNAME: "qa.user@example.com"
---
- launchApp
- runFlow:
    when:
      visible: "Welcome back"
    file: "shared/skip-login.yaml"
- runFlow:
    when:
      notVisible: "Welcome back"
    file: "shared/full-login.yaml"
- inputText: "${USERNAME}"
```

`env:` declares variables; `${VAR}` references them. `when:` is the conditional gate.

For richer logic, JavaScript files can extend Maestro flows — but at that point, evaluate whether Detox / Appium is the better tool.

---

## Maestro Studio

`maestro studio` opens an interactive inspector showing the live UI tree, with point-and-click flow recording. Useful for:

- Discovering accurate selectors without guessing.
- Bootstrapping a flow that you then edit by hand.
- Demoing Maestro to stakeholders.

**Always edit the recorded flow.** Recordings tend to use coordinates and brittle text; replace with `id:` selectors where possible.

---

## Running

```bash
# Single flow
maestro test .maestro/login.yaml

# Whole folder
maestro test .maestro/

# Target a specific device (when multiple connected)
maestro --device <udid-or-name> test .maestro/

# With env vars
maestro test -e USERNAME=qa.user@example.com .maestro/login.yaml

# Continuous mode (re-runs on file change)
maestro test --continuous .maestro/login.yaml

# Studio (interactive inspector)
maestro studio
```

Verify flags with `maestro --help` against your installed version.

---

## Maestro Cloud

`mobile.dev`'s Maestro Cloud runs flows on a managed device matrix and produces a dashboard. Trade-offs:

- ✅ No local emulator setup, parallel device matrix, video / screenshot artifacts, integrations.
- ⚠ Paid for non-trivial usage; flows are uploaded — confirm your org's data policy allows it.

For local CI, simulator/emulator runs via `maestro test` on macOS/Linux runners is straightforward.

---

## CI integration

```yaml
- name: Install Maestro
  run: curl -Ls "https://get.maestro.mobile.dev" | bash
- name: Start emulator
  uses: reactivecircus/android-emulator-runner@<pinned-version>
  with:
    api-level: 34
    script: maestro test .maestro/
```

For iOS, GHA macOS runner + `xcrun simctl boot` + `maestro test`. Pin Maestro version.

Maestro produces test reports (HTML / JUnit XML) — upload as artifacts.

---

## Common Pitfalls

- **Treating Maestro as a replacement for Detox / Appium in every case** — it's complementary. Use Maestro for smoke flows and accessible authoring; use richer frameworks for complex regression.
- **Recording flows in Studio and committing without review** — recordings often have brittle coordinate-based taps. Always replace with `id:` selectors.
- **`tapOn: "Submit"` when multiple elements say Submit** — Maestro picks the first match. Use `id` or `index`.
- **No accessibility identifiers in the app** — flows become brittle. Add IDs in the app code (same investment that benefits real users).
- **Mixing flows that depend on prior state** — design each flow to be runnable in isolation, starting from `launchApp: { clearState: true }`.
- **Complex JS extensions for what should be Detox** — if you're writing significant JS hooks, consider whether Detox or Appium is a better fit.
- **Not pinning Maestro version** — the binary's behavior changes across releases.
- **Forgetting `clearState`** — first run after install seeds state that subsequent runs inherit. Decide deliberately whether each flow needs a clean slate.

---

## Task-Specific Questions

When helping with Maestro, ask:

1. Platforms — iOS, Android, both?
2. App type — native, React Native, Flutter?
3. Are accessibility identifiers in place, or do they need to be added?
4. Will non-engineers author flows, or only engineers?
5. Local CI runs, or Maestro Cloud (or both)?
6. How many flows do you anticipate (10 smoke flows vs 200 regression)?
7. Are there flows complex enough that Detox / Appium might be a better fit?

---

## Related Skills

- **detox** — for richer React Native E2E with full JS logic.
- **appium** — for cross-platform with rich client logic.
- **espresso** — for Android-native, in-process speed.
- **xcuitest** — for iOS-native, Apple-integrated.
- **ci-test-orchestration** — for sharding Maestro runs across devices and matrix jobs.
- **cloud-test-grids** — for managed device pools (Maestro Cloud, BrowserStack, AWS Device Farm).
- **accessibility-testing** — accessibility identifiers double as testability and a11y; aligned investment.
- **test-strategy** — for placing Maestro in the broader mobile pyramid (often: Maestro for smoke, native frameworks for unit, Detox/Appium for regression).
