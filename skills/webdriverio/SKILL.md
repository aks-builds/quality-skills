---
name: webdriverio
description: When the user wants to design, implement, debug, or scale WebdriverIO tests. Use when the user mentions "WebdriverIO," "WDIO," "wdio.conf.js," "wdio.conf.ts," "Appium service," "wdio services," "$()," "$$()," "browser.execute," "wdio runner," "@wdio/cli," or "browser.url." For Selenium-specific guidance see selenium. For Appium native mobile patterns see appium. For Cypress see cypress. For Playwright see playwright. For CI parallelism see ci-test-orchestration.
metadata:
  version: 1.0.0
---

# WebdriverIO

You are an expert in WebdriverIO (WDIO). Your goal is to help engineers design, implement, and stabilize WebdriverIO test suites — config, services, runners, locators, sync vs. async, mobile via Appium — without fabricating service names, capability fields, or CLI flags. When uncertain, point the reader to `webdriver.io` for the version they are running.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Languages used for tests** — WebdriverIO is JavaScript/TypeScript only. If the team's primary test language is something else, surface that constraint.
- **WebdriverIO version** — v7 vs v8+ differs significantly (v8 dropped CommonJS sync mode entirely; async/await is the only mode). Confirm before guiding.
- **What's being tested** — web only, mobile only, or both. WebdriverIO is one of the few mainstream tools designed for both browser and native mobile from a single config.
- **Test framework underneath** — Mocha, Jasmine, or Cucumber. The runner config differs.
- **Services in use** — `@wdio/appium-service`, `@wdio/selenium-standalone-service`, `@wdio/sauce-service`, `@wdio/browserstack-service`, etc.

If the file does not exist, ask: language, WDIO version, web/mobile/both, framework (Mocha/Jasmine/Cucumber), and where tests run (local, Selenium Grid, Sauce, BrowserStack, Appium).

---

## Why WebdriverIO

- **Web + mobile in one runner** — drive Chrome/Firefox/Edge/Safari plus iOS/Android via the same config and service layer (Appium service).
- **Services architecture** — pluggable services (Appium, Selenium Standalone, Sauce, BrowserStack, visual diff providers) snap into config without rewriting tests.
- **W3C WebDriver under the hood** — same protocol as Selenium, so it works with every grid and cloud provider that speaks W3C WebDriver.
- **First-class Cucumber/Mocha/Jasmine integration** — no manual glue.

When *not* to use WebdriverIO:

- Single-stack JS/TS team that wants the modern Playwright trace viewer and auto-wait ergonomics → Playwright.
- In-browser time-travel debugging → Cypress.
- Java/Python/C#/Ruby team — use Selenium directly with the language-native bindings.

---

## Core Concepts

### Browser object

`browser` is the global session object inside tests. It exposes commands like `browser.url(...)`, `browser.execute(...)`, `browser.waitUntil(...)`.

### Element selection

| Selector | Use |
|----------|-----|
| `$('selector')` | First match. Supports CSS, XPath (with `//`), and link text. |
| `$$('selector')` | All matches as an array. |
| `$('selector').$('child')` | Chained queries. |
| `$('=Sign in')` | Element with exact text "Sign in". |
| `$('*=Sign')` | Element containing the substring "Sign". |

```ts
await $('[data-test="email"]').setValue('qa.user@example.com');
await $('[data-test="password"]').setValue('Pa$$w0rd-fake');
await $('[data-test="sign-in"]').click();
```

### Async/await (v8+)

All commands return promises. `await` every command. The legacy sync mode from v7 was removed.

```ts
const button = await $('[data-test="sign-in"]');
await button.waitForClickable();
await button.click();
```

### Waiting

Built into element methods: `waitForExist()`, `waitForDisplayed()`, `waitForClickable()`, `waitForEnabled()`. For arbitrary conditions, `browser.waitUntil(fn, { timeout })`.

---

## Configuration (`wdio.conf.ts`)

Real fields, real semantics. Verify against your installed version.

```ts
export const config: WebdriverIO.Config = {
  runner: 'local',
  specs: ['./test/specs/**/*.spec.ts'],
  exclude: [],
  maxInstances: 5,
  capabilities: [{
    browserName: 'chrome',
    'goog:chromeOptions': {
      args: ['--headless=new', '--window-size=1280,720'],
    },
  }],
  logLevel: 'info',
  baseUrl: 'https://staging.example.com',
  waitforTimeout: 10000,
  connectionRetryTimeout: 120000,
  connectionRetryCount: 3,
  services: ['selenium-standalone'],
  framework: 'mocha',
  reporters: ['spec', ['junit', { outputDir: './reports' }]],
  mochaOpts: { ui: 'bdd', timeout: 60000 },
  before: async () => { /* hooks */ },
};
```

`maxInstances` controls parallel sessions on this machine. For CI, use this to bound concurrency; for cross-machine parallelism see ci-test-orchestration.

---

## Services

Services hook into the WDIO lifecycle (`before`, `beforeSession`, `beforeTest`, etc.) without changing test code.

| Service | What it does |
|---------|--------------|
| `@wdio/appium-service` | Starts/stops Appium for mobile tests. |
| `@wdio/selenium-standalone-service` | Starts/stops Selenium Standalone locally. |
| `@wdio/sauce-service` | Sauce Labs integration (capabilities, results upload). |
| `@wdio/browserstack-service` | BrowserStack integration. |
| `@wdio/visual-service` | Built-in visual diff support. |
| `wdio-chromedriver-service` | Starts ChromeDriver directly (no Selenium Standalone). |

Services are configured by name in the `services` array. Each accepts its own options object: `services: [['sauce', { region: 'us-west-1' }]]`.

---

## Mobile via Appium

Set Appium capabilities and the Appium service handles the rest.

```ts
capabilities: [{
  platformName: 'Android',
  'appium:deviceName': 'emulator-5554',
  'appium:platformVersion': '14',
  'appium:automationName': 'UiAutomator2',
  'appium:app': '/path/to/app.apk',
}],
services: [['appium', { command: 'appium', args: { /* CLI args */ } }]],
```

The Appium-namespaced capabilities (`appium:*`) are required under W3C. See the appium skill for native locator strategies and gesture APIs.

---

## Page Object pattern

Page objects are plain classes; no PageFactory needed.

```ts
class LoginPage {
  get email() { return $('[data-test="email"]'); }
  get password() { return $('[data-test="password"]'); }
  get signIn() { return $('[data-test="sign-in"]'); }

  async signInAs(email: string, password: string) {
    await this.email.setValue(email);
    await this.password.setValue(password);
    await this.signIn.click();
  }
}

export default new LoginPage();
```

Tests import the singleton and call domain methods.

---

## Running tests (CLI)

| Command | Purpose |
|---------|---------|
| `npx wdio run wdio.conf.ts` | Run with the named config. |
| `npx wdio run wdio.conf.ts --spec ./test/specs/login.spec.ts` | One spec. |
| `npx wdio run wdio.conf.ts --suite smoke` | Run a named suite (defined in config `suites`). |
| `npx wdio config` | Run the interactive generator. |
| `npx wdio repl chrome` | Interactive REPL against a live browser. |

Verify flags with `npx wdio run --help` against your installed version.

---

## Reporters

- `spec` — terminal-friendly, default.
- `junit` — for CI integration (JUnit XML).
- `allure` — rich HTML reports.
- `dot` — minimal.
- `mochawesome` — HTML+JSON (when using Mocha).

Multiple reporters can be configured simultaneously.

---

## Common Pitfalls

- **Forgetting `await`** — v8+ is async/await only. A missing await silently returns a Promise and the next command may run against a stale element. ESLint rules help.
- **Mixing sync (v7) and async (v8) patterns** — pick one. If on v8+, all examples should be async.
- **Brittle CSS class selectors** — use `data-test` / `data-testid` consistently.
- **Setting `waitforTimeout` too high to mask flake** — the test passes once and hides the underlying race. Triage the race, then lower the timeout.
- **Putting assertions in page objects** — keep them in tests.
- **Running everything in one giant config** — split with `wdio.web.conf.ts` and `wdio.mobile.conf.ts` when web and mobile diverge.
- **Not pinning service versions** — services are independent packages and can change behavior between minor releases.
- **Confusing `browser.waitUntil` with `element.waitFor*`** — element-specific waits are usually clearer; use `waitUntil` for arbitrary predicates only.

---

## Task-Specific Questions

When helping with WebdriverIO, ask:

1. WebdriverIO version — v7, v8, or v9?
2. Web only, mobile only, or both?
3. Test framework — Mocha, Jasmine, or Cucumber?
4. Which services are in use (Appium, Selenium Standalone, Sauce, BrowserStack)?
5. What's your parallelism budget — `maxInstances` locally and matrix on CI?
6. Where do tests run — local, Selenium Grid, cloud provider, Appium farm?
7. Reporter requirements — JUnit XML for CI, Allure for humans, or both?

---

## Related Skills

- **selenium** — WDIO speaks W3C WebDriver; Selenium patterns and gotchas largely apply.
- **appium** — for native mobile capability details, locator strategies, and gesture APIs.
- **cloud-test-grids** — Sauce / BrowserStack / LambdaTest service configurations.
- **selenium-grid** — for self-hosted W3C-compatible Grid setups.
- **ci-test-orchestration** — for cross-machine sharding (WDIO `maxInstances` is in-process only).
- **flaky-test-management** — when high waitforTimeout values are masking the real issue.
- **playwright** / **cypress** — for the trade-off conversation if the team is reconsidering tooling.
