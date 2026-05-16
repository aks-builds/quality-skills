---
name: appium
description: When the user wants to design, implement, debug, or scale Appium tests for iOS and Android mobile automation. Use when the user mentions "Appium," "Appium 2," "UiAutomator2," "XCUITest driver," "appium:capabilities," "AppiumServer," "accessibility id," "TouchAction," "W3C Actions," "Appium inspector," "real device cloud," or "App Center / BrowserStack / Sauce mobile." For Android-native frameworks see espresso. For iOS-native see xcuitest. For React Native specifically see detox. For YAML-driven mobile flows see maestro. For desktop web automation see selenium / playwright / webdriverio.
metadata:
  version: 1.0.0
---

# Appium

You are an expert in Appium 2.x for cross-platform mobile UI automation (iOS, Android, plus optional Mac/Windows desktop). Your goal is to help engineers set up Appium drivers, choose the right locator strategies, and structure tests that survive across OS versions and device farms. Don't fabricate capabilities, driver names, or Appium server flags. When uncertain, point the reader to `appium.io` and the specific driver's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Platform target** — iOS only, Android only, or both. Drivers and capabilities differ entirely.
- **App type** — native, hybrid (WebView wrapper), or mobile web (browser). Locators and contexts differ.
- **Test client language** — Appium speaks W3C WebDriver, so any language with a WebDriver binding works (Java, JS/Node via WebdriverIO, Python, C#, Ruby). Most teams use Java or WebdriverIO.
- **Device strategy** — simulators / emulators only, real devices on-prem, real device cloud (BrowserStack, Sauce, LambdaTest, AWS Device Farm).
- **Appium 1 vs 2** — Appium 2 is the current generation; drivers are separate packages installed via the Appium CLI. Older Appium 1 setups have very different installation patterns.

If the file does not exist, ask: platforms, app type (native / hybrid / web), test language, device target (sim / real / cloud).

---

## Why Appium

- **Cross-platform** — one tool, two platforms; share infrastructure and test design patterns.
- **W3C WebDriver protocol** — works with any WebDriver client library.
- **Real-device-friendly** — works with on-prem devices, simulators, and every major cloud farm.
- **Native + hybrid + web** — handles all three via context switching.

When *not* to use Appium:

- Android-only team that values speed and reliability → espresso (in-process, gray-box).
- iOS-only team → xcuitest (Apple-native).
- React Native team that wants fast feedback → detox (gray-box, JS-native).
- Simple YAML-driven flows for any mobile UI → maestro.
- Mobile web-only → desktop browser testing tools (Playwright/Selenium) with device emulation often suffice.

---

## Appium 2 architecture

```
   Test code (Java / WDIO / Python / C#)
              │  W3C WebDriver protocol
              ▼
       Appium Server (Node.js, port 4723 by default)
              │  driver plugin API
              ▼
      Driver  ──  UiAutomator2 (Android) / XCUITest (iOS)
                  Espresso (Android, optional)
                  Mac2 / WindowsAppDriver (desktop)
                  Flutter (community)
                  Chromium (mobile web)
                  …
              │
              ▼
        Device / Simulator
```

Appium 2 made drivers **independent packages**:

```bash
appium driver install uiautomator2
appium driver install xcuitest
appium driver list
```

Each driver carries its own capabilities under the `appium:` namespace.

---

## Capabilities (W3C)

```js
// WebdriverIO example
const capabilities = {
  platformName: 'Android',
  'appium:platformVersion': '14',
  'appium:deviceName': 'Pixel_7_API_34',
  'appium:automationName': 'UiAutomator2',
  'appium:app': '/path/to/app-debug.apk',
  'appium:noReset': false,
};
```

For iOS:

```js
const capabilities = {
  platformName: 'iOS',
  'appium:platformVersion': '17.0',
  'appium:deviceName': 'iPhone 15',
  'appium:automationName': 'XCUITest',
  'appium:app': '/path/to/MyApp.app',
};
```

Important capability namespaces:

- `appium:` — required prefix for non-W3C-standard caps in Appium 2.
- `bstack:options` / `sauce:options` / `lt:options` — cloud-vendor caps when using respective providers.

---

## Locator strategies

| Strategy | iOS | Android |
|----------|-----|---------|
| **Accessibility ID** | `XCUIElementType*` with accessibility identifier | resource-id or content-desc |
| **iOS class chain / predicate** | Powerful native locators (`**/XCUIElementTypeButton[\`name == "Login"\`]`) | n/a |
| **UiAutomator (Android)** | n/a | `new UiSelector().resourceId("...").text("...")` |
| **XPath** | Available on both | Available on both — **slow on large hierarchies** |
| **ID** | n/a (use accessibility id) | resource-id |
| **CSS selector** | n/a for native | n/a for native |

**Strongly prefer Accessibility ID.** It's stable, performant, and the same attribute drives accessibility on real devices. XPath should be the last resort — Appium's XPath traversal can be very slow on complex screens.

```ts
// WDIO example
await $('~login-button').click();           // accessibility id
await $('android=new UiSelector().text("Login")').click();
await $('-ios class chain:**/XCUIElementTypeButton[`name == "Login"`]').click();
```

---

## Contexts (native vs WebView)

For hybrid apps, switch between native and WebView contexts:

```ts
const contexts = await driver.getContexts();
// ['NATIVE_APP', 'WEBVIEW_com.example.app']
await driver.switchContext('WEBVIEW_com.example.app');
// now drive the WebView like a regular browser
await $('#submit').click();
await driver.switchContext('NATIVE_APP');
```

WebView debugging requires Chrome DevTools (Android) or Safari Web Inspector (iOS); set up `webviewDebugProxyPort` or equivalent capability for the driver to find the WebView pages.

---

## Gestures (W3C Actions)

Modern Appium uses W3C-spec touch actions:

```ts
await driver.action('pointer', { parameters: { pointerType: 'touch' } })
  .move({ x: 200, y: 1200 })
  .down()
  .pause(100)
  .move({ duration: 500, x: 200, y: 400 })
  .up()
  .perform();
```

Many client libraries also expose convenience methods (`tap`, `longPress`, `swipe`, `pinch`) — verify against your specific client library docs. The deprecated `TouchAction` / `MultiTouchAction` APIs should be replaced where they still appear.

---

## Page Object pattern

```java
public class LoginScreen {
    private final AppiumDriver driver;
    @AndroidFindBy(accessibility = "login-email") private MobileElement email;
    @AndroidFindBy(accessibility = "login-password") private MobileElement password;
    @AndroidFindBy(accessibility = "login-submit") private MobileElement submit;

    public LoginScreen(AppiumDriver d) {
        this.driver = d;
        PageFactory.initElements(new AppiumFieldDecorator(d), this);
    }

    public HomeScreen signInAs(String e, String p) {
        email.sendKeys(e);
        password.sendKeys(p);
        submit.click();
        return new HomeScreen(driver);
    }
}
```

Use `@AndroidFindBy` / `@iOSXCUITFindBy` paired annotations for cross-platform tests. For WDIO, the pattern is the same as desktop POs but with mobile selectors.

---

## Appium Inspector

Appium Inspector is the GUI for inspecting the live device's element tree. Use it during locator development — it shows the exact accessibility id, resource-id, class chain, etc., for each element. **Do not write locators by guess; use Inspector first**.

---

## Running the server

```bash
# Install Appium
npm install -g appium
appium driver install uiautomator2
appium driver install xcuitest

# Run server
appium                                                # default port 4723
appium --port 4724 --base-path /wd/hub                # alternative port + base path
appium --relaxed-security                             # allow ADB shell / arbitrary commands (dev only)
```

Pin Appium and driver versions in CI; major version bumps can change capability defaults.

---

## CI integration

For Android in CI:
- Run a headless emulator (`emulator -no-window`) — slow startup, slow execution, but workable for smoke.
- Or use a managed runner with `react-native-android` / similar pre-baked images.
- Or push to a real device cloud (BrowserStack / Sauce / AWS Device Farm) — usually the right answer at scale.

For iOS in CI:
- macOS-only host. Use a Mac runner (GitHub Actions provides macOS), or a Mac cloud.
- Simulators are fine for most logic tests; real devices for camera / Apple Pay / push.

---

## Common Pitfalls

- **XPath everywhere** — slow on big hierarchies. Use Accessibility ID first.
- **Capabilities without `appium:` prefix in Appium 2** — fails or silently ignored.
- **Single-instance Appium server for parallel tests** — Appium 2 supports parallel sessions, but real-device pools / simulator names must be unique per session.
- **Forgetting to reset state between tests** — `noReset: true` + shared user accounts → order-dependent flake. Decide per-test.
- **Hardcoded device names** — `Pixel_7_API_34` works on your machine, not CI. Parameterize.
- **Conflating sim/emulator and real device behavior** — push notifications, biometric auth, camera, NFC all behave differently. Test critical paths on real devices.
- **Long implicit waits** — same anti-pattern as Selenium. Use explicit waits.
- **Letting the test wait for animations** — disable animations on Android (`adb shell settings put global window_animation_scale 0` etc.) or stub them in the app for tests.
- **Not pinning Appium / driver versions** — major version drift breaks suites silently.

---

## Task-Specific Questions

When helping with Appium, ask:

1. iOS, Android, or both?
2. Native, hybrid, or mobile web?
3. Test client language and library (Java + Appium client, WDIO, Python, C#, etc.)?
4. Appium 1 or 2?
5. Simulator/emulator only, real devices, or device cloud (which one)?
6. Existing test patterns — page objects, accessibility ids in the app's source, recording tools?
7. CI host — macOS for iOS, Linux for Android, both?

---

## Related Skills

- **espresso** — Android-native, in-process, gray-box. Much faster than Appium for Android-only.
- **xcuitest** — iOS-native equivalent.
- **detox** — React Native gray-box.
- **maestro** — YAML-driven, simpler than Appium for many flows.
- **webdriverio** — common Appium client in JS/TS stacks.
- **selenium** — Appium speaks WebDriver; Selenium client patterns transfer.
- **cloud-test-grids** — BrowserStack / Sauce / LambdaTest / AWS Device Farm have mobile farms.
- **ci-test-orchestration** — for parallel device allocation and matrix runs.
