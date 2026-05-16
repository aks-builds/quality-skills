---
name: detox
description: When the user wants to design, implement, debug, or stabilize Detox tests for React Native E2E testing. Use when the user mentions "Detox," "by.id," "by.label," "element(by.id(...))," "device.launchApp," ".detoxrc.js," "detox test," "Detox config," "RNTester," "Detox Jest," or "Wix Detox." For Android-native see espresso. For iOS-native see xcuitest. For cross-platform Appium see appium. For YAML-driven see maestro. For unit testing React Native components see jest-vitest.
metadata:
  version: 1.0.0
---

# Detox

You are an expert in Detox — the Wix-maintained gray-box E2E testing framework specifically designed for React Native apps. Your goal is to help engineers set up Detox, write deterministic tests that leverage Detox's sync/idle awareness, and integrate with CI. Don't fabricate matcher names, action signatures, or `.detoxrc` keys. When uncertain, point the reader to `wix.github.io/Detox`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Is the app actually React Native?** — Detox is RN-specific. For native apps, recommend Espresso (Android) / XCUITest (iOS) / Appium.
- **RN version** — Detox supports modern RN; very old RN versions (pre-0.60) need older Detox versions.
- **Platforms** — iOS and Android. Both supported with one test codebase.
- **Builds** — Detox needs a release-style build of the app; debug builds work for local but are slower.
- **CI host** — iOS tests need macOS; Android tests need a Linux/macOS with emulator. Real-device CI requires a cloud farm.

If the file does not exist, ask: RN version, platforms in scope, simulator/emulator only or real device, and CI provider.

---

## Why Detox

- **Gray-box** — Detox knows when the RN app's bridge is idle, JS thread is busy, animations are running. No flaky waits.
- **JS-native test code** — Jest as the runner; tests look like other JS tests.
- **Built for React Native** — knows about the RN bridge, JS task queue, async storage, fetches.
- **Same test code for iOS and Android** — IDs unify selection.

When *not* to use Detox:

- Native apps (no RN) → Espresso / XCUITest / Appium.
- Cross-platform but not RN (Flutter, native + RN mixed) → Appium / Maestro.
- Team wants a YAML-only experience → Maestro.

---

## Project setup

Install Detox in an RN project:

```bash
npm install --save-dev detox
npx detox init
```

This generates `.detoxrc.js`, `e2e/` folder, and a Jest config.

Apps need:

1. **`testID` props** on React Native components — Detox's primary locator.
2. **A release-style build** configured in `.detoxrc.js` per platform.
3. **For iOS**, a `.app` artifact built with Detox-compatible flags.
4. **For Android**, a release/debug APK built with Detox's instrumentation.

---

## `.detoxrc.js` config

```js
module.exports = {
  testRunner: { args: { $0: 'jest', config: 'e2e/jest.config.js' } },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/MyApp.app',
      build: 'xcodebuild -workspace ios/MyApp.xcworkspace -scheme MyApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      testBinaryPath: 'android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
  },
  devices: {
    simulator: { type: 'ios.simulator', device: { type: 'iPhone 15' } },
    emulator: { type: 'android.emulator', device: { avdName: 'Pixel_7_API_34' } },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
    'android.emu.debug': { device: 'emulator', app: 'android.debug' },
  },
};
```

Verify exact keys against `wix.github.io/Detox/docs/config/overview` for your Detox version — the schema has evolved across major versions.

---

## Writing tests

```js
// e2e/login.test.js
describe('Login', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, launchArgs: { detoxTesting: true } });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('signs in with valid credentials', async () => {
    await element(by.id('login.email')).typeText('qa.user@example.com');
    await element(by.id('login.password')).typeText('Pa$$w0rd-fake');
    await element(by.id('login.submit')).tap();
    await expect(element(by.id('dashboard.welcome'))).toBeVisible();
  });
});
```

Three globals:

| Global | Use |
|--------|-----|
| `device` | App / device control: `launchApp`, `reloadReactNative`, `sendToHome`, `setOrientation`, `setLocation`. |
| `element(matcher)` | Locate an element. |
| `by` | Matcher namespace: `by.id`, `by.label`, `by.text`, `by.type`, `by.traits` (iOS). |

---

## Matchers

| Matcher | Use |
|---------|-----|
| `by.id('login.submit')` | `testID` prop. **First choice.** |
| `by.label('Sign in')` | Accessibility label (iOS) / content description (Android). |
| `by.text('Sign in')` | Visible text. |
| `by.type('RCTTextInput')` | Component type. Rare. |
| `by.traits(['button'])` | iOS-only accessibility traits. |
| Combine: `by.id('x').withAncestor(by.id('y'))` | Scoped selection. |
| Combine: `by.id('x').and(by.text('Sign in'))` | Multiple criteria. |

Strongly prefer `by.id(...)` — `testID` props are stable, cross-platform, and the developer adds them deliberately.

---

## Actions

```js
await element(by.id('email')).tap();
await element(by.id('email')).typeText('qa.user@example.com');
await element(by.id('email')).clearText();
await element(by.id('email')).replaceText('new value');

await element(by.id('list')).scroll(400, 'down');
await element(by.id('list')).scrollTo('bottom');
await element(by.id('switch')).swipe('right');
await element(by.id('button')).longPress();
await element(by.id('button')).multiTap(3);

await element(by.id('input')).tapReturnKey();
await element(by.id('input')).clearText();

await device.pressBack();  // Android
```

---

## Assertions

```js
await expect(element(by.id('x'))).toBeVisible();
await expect(element(by.id('x'))).toExist();
await expect(element(by.id('x'))).toHaveText('hello');
await expect(element(by.id('x'))).toHaveLabel('Sign in');
await expect(element(by.id('x'))).toBeFocused();
await expect(element(by.id('list')).atIndex(2)).toHaveText('Item 3');
await expect(element(by.id('x'))).not.toBeVisible();
```

`atIndex(n)` selects the n-th matching element when the query is ambiguous.

---

## Synchronization — the gray-box advantage

Detox automatically waits for:

- The RN JavaScript thread to be idle.
- The native main thread to be idle.
- Animations to complete.
- Active network requests (instrumented through `XMLHttpRequest`).
- Async Storage operations.
- Timers / `setTimeout`.

This is why Detox tests are dramatically more deterministic than Appium for the same app. **Avoid `sleep`** — if a test seems racey, the gray-box hooks are usually waiting; the test is wrong (querying for an element that never renders, or expecting too soon).

For custom async work Detox doesn't know about, use `waitFor(...)`:

```js
await waitFor(element(by.id('result'))).toBeVisible().withTimeout(5000);
await waitFor(element(by.id('result'))).toBeVisible().whileElement(by.id('list')).scroll(200, 'down');
```

---

## Mocking / network

Detox doesn't intercept network by default. Common patterns:

- **Mock at the app level** — use a build flag (`launchArgs: { detoxTesting: true }`) and swap the API client for a stub in JS.
- **Local mock server** — run `msw-server` or a custom server on `localhost` and point the app at it.
- **Cloud test-tier endpoints** — point at a real test API for full integration coverage.

For tests focused on UI logic, app-level mocking is fastest; for integration confidence, hit a real API.

---

## Running

```bash
npx detox build --configuration ios.sim.debug
npx detox test --configuration ios.sim.debug

npx detox build --configuration android.emu.debug
npx detox test --configuration android.emu.debug

# Headless on CI
npx detox test --configuration ios.sim.release --headless

# Cleanup
npx detox clean-framework-cache && npx detox build-framework-cache
```

Verify flags with `npx detox test --help` against your installed version.

---

## CI integration

iOS in CI requires macOS runner (GitHub Actions provides one; Bitrise/CircleCI Mac options exist). Android in CI needs a Linux/macOS runner with an emulator (`reactivecircus/android-emulator-runner` action or equivalent).

Common pattern: split iOS and Android into separate workflows / jobs to limit cost; gate critical PRs on a smoke subset, run the full suite nightly.

Detox produces JUnit XML and screenshots/videos on failure — upload as CI artifacts.

---

## Common Pitfalls

- **No `testID` props in components** — every test is brittle. Add `testID` to every testable element; consider a lint rule.
- **Querying immediately after `tap`** — Detox waits for idle, but if your app fires animations or async work the bridge doesn't see, use `waitFor`.
- **Using `by.text(...)` for buttons that get localized** — same issue as XCUITest/Espresso. Use `by.id`.
- **Heavy fixtures via `beforeAll`** — state leaks across tests. Reset with `device.reloadReactNative()` or `device.launchApp({ newInstance: true, ... })`.
- **Tests that depend on the same logged-in user** — order-dependent. Either log in per test or design tests to be independent.
- **Forgetting `--headless` in CI** — simulator window opens, blocks the runner if no display.
- **Building the app on every test run** — separate `detox build` (slow, once per source change) from `detox test` (fast, per run).
- **Not pinning Detox + RN versions** — Detox's behavior changes meaningfully across major versions.
- **Running iOS UI tests on Linux** — impossible. Plan macOS capacity for iOS.

---

## Task-Specific Questions

When helping with Detox, ask:

1. RN version and Detox version?
2. iOS, Android, or both?
3. Existing `.detoxrc.js` to extend, or starting from scratch?
4. Are `testID` props already in the app, or do they need to be added?
5. CI host — macOS for iOS, Linux for Android, both?
6. Network strategy — app-level mocking, local mock server, real test API?
7. Headless mode required in CI?

---

## Related Skills

- **espresso** — Android native; for fast Android-side tests when RN's JS layer isn't being tested.
- **xcuitest** — iOS native equivalent.
- **appium** — for hybrid teams that have both RN and native screens, or RN + native bridge concerns.
- **maestro** — YAML alternative for simpler flows.
- **jest-vitest** — Detox uses Jest as its runner; unit tests for components fall here.
- **ci-test-orchestration** — for matrix iOS/Android jobs and headless runs.
- **cloud-test-grids** — for managed device pools when emulators aren't enough.
- **flaky-test-management** — though Detox's gray-box reduces flake significantly.
