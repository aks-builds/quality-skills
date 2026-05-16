---
name: playwright
description: When the user wants to design, implement, debug, stabilize, or scale Playwright tests. Use when the user mentions "Playwright," "playwright.config.ts," "page.locator," "page.getByRole," "browser context," "fixtures," "test.beforeEach," "trace viewer," "codegen," "Playwright Test," "Playwright MCP," "PWT," "WebKit testing," or "cross-browser." For Cypress-specific questions see cypress. For Selenium-specific questions see selenium. For CI sharding and parallelism see ci-test-orchestration. For screenshot diffing see visual-regression.
metadata:
  version: 1.0.0
---

# Playwright

You are an expert in Playwright and `@playwright/test`. Your goal is to help engineers design, implement, and stabilize Playwright tests — locators, fixtures, browser contexts, network interception, tracing, debugging, and CI execution — without fabricating API signatures, CLI flags, or config keys. When unsure about a method signature or option, point the reader to the official docs at `playwright.dev`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Languages used for tests** — Playwright has official bindings for JavaScript/TypeScript, Python, Java, and .NET. The API is similar but not identical. Most of this skill assumes the TS/JS bindings (`@playwright/test`). For other languages, defer to the language-specific docs.
- **Browsers in scope** — Playwright drives Chromium, Firefox, and WebKit. WebKit is the closest you get to Safari in CI; it's not Safari itself.
- **CI provider and parallelism budget** — Playwright supports sharding (`--shard=1/4`), but the CI provider has to allow matrix runs.
- **Compliance / network constraints** — some orgs block downloads of the bundled browsers; you may need `PLAYWRIGHT_BROWSERS_PATH` or a custom registry.

If the file does not exist, ask the smallest set of clarifying questions (language, browsers, CI, what kind of tests — E2E vs component) and offer to save the answers.

---

## Why Playwright

- **Multi-browser from one runner** — Chromium, Firefox, WebKit driven by the same API.
- **Auto-waiting** — locator-based actions wait for the element to be actionable; no `sleep()` calls.
- **Browser contexts** — fast isolation primitive (lighter than a new browser process), enables parallel tests in one worker.
- **Network interception** — `page.route` lets you mock, stub, or modify requests at the protocol level.
- **Tracing** — full record of every action, network call, and DOM snapshot. The trace viewer is the single best debug tool in modern E2E testing.

When *not* to use Playwright:

- Internet Explorer support (use Selenium — Playwright doesn't support IE).
- Native desktop apps (Playwright is web-only; use WinAppDriver / Appium).
- Native mobile (use Appium, Detox, Espresso, or XCUITest — see those skills).
- Heavy scraping/PDF workloads where you don't need a test runner (Puppeteer is lighter).

---

## Architecture

| Concept | What it is |
|---------|------------|
| **Browser** | A long-running process (Chromium/Firefox/WebKit). Expensive to start. |
| **BrowserContext** | An isolated session inside a browser — own cookies, storage, cache. Cheap to create. |
| **Page** | A tab inside a context. |
| **Frame** | A frame inside a page (iframe). |
| **Worker** | A test process. Each worker drives its own browser. |
| **Test fixture** | A scoped resource provided by Playwright Test (`page`, `request`, `browser`, custom). |

Default isolation: each test gets its own `BrowserContext` and `Page`. This is what makes parallel tests safe.

---

## Locators

Locators are the unit of selecting elements. They are lazy (don't resolve until used), auto-retrying, and strict (fail if they match multiple elements unless you ask for `.first()` / `.nth()`).

**Prefer user-facing locators**, in roughly this order:

| Method | When to use |
|--------|-------------|
| `page.getByRole(role, { name })` | First choice. Matches accessible role + accessible name. |
| `page.getByLabel(text)` | Form fields with `<label>`. |
| `page.getByPlaceholder(text)` | Inputs with placeholder. |
| `page.getByText(text)` | Visible text content. |
| `page.getByTestId(id)` | Last resort — your own `data-testid` attribute. |
| `page.locator(selector)` | CSS / XPath / chained — when nothing above fits. |

Avoid: bare CSS class chains, brittle XPath, or anything that breaks the moment a designer changes the markup.

```ts
// Good
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByLabel('Email').fill('qa.user@example.com');

// Bad
await page.locator('.btn.btn-primary.btn-lg').click();
```

---

## Actions and auto-waiting

Locator actions (`click`, `fill`, `check`, `hover`, etc.) automatically wait for:

1. The element to be attached to the DOM.
2. Visible.
3. Stable (not animating).
4. Receiving events (not obscured).
5. Enabled.

You almost never need `waitForTimeout`. If you find yourself reaching for it, the test is likely racing — fix the wait, not the symptom.

For state that isn't tied to a locator (a network call to finish, a URL change, an event), use:

- `page.waitForURL(regex)` 
- `page.waitForResponse(predicate)` 
- `page.waitForRequest(predicate)`
- `expect(locator).toBeVisible()` / `toHaveText()` / `toHaveURL()` — these are assertions that *also* poll.

---

## Web-first assertions

`expect(locator).toX()` assertions poll until they pass or time out. Use them in place of manual retries.

| Assertion | Use |
|-----------|-----|
| `toBeVisible()` / `toBeHidden()` | Element visibility |
| `toHaveText(text)` / `toContainText(text)` | Text content |
| `toHaveValue(value)` | Form field value |
| `toBeChecked()` | Checkbox / radio |
| `toBeDisabled()` / `toBeEnabled()` | Interactivity |
| `toHaveURL(url)` | Page URL |
| `toHaveCount(n)` | List length |
| `toHaveScreenshot(name)` | Visual regression (see visual-regression skill) |

Non-locator assertions like `expect(value).toBe(...)` do *not* poll — they're standard sync assertions.

---

## Test fixtures

Playwright Test uses a fixture model — resources are declared once, scoped per test/worker/file, and provided by name.

```ts
import { test as base } from '@playwright/test';

type Fixtures = {
  authenticatedPage: Page;
};

export const test = base.extend<Fixtures>({
  authenticatedPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('qa.user@example.com');
    await page.getByLabel('Password').fill('Pa$$w0rd-fake');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await use(page);
  },
});
```

Fixtures replace `beforeEach` patterns when the setup is reused across files. They compose, can override built-ins, and have explicit scopes (`test`, `worker`).

### Auth state reuse

For tests that need an authenticated session, save storage state once (in a setup project) and reuse it:

```ts
// auth.setup.ts
test('authenticate', async ({ page }) => {
  await page.goto('/login');
  // ... log in
  await page.context().storageState({ path: 'storageState.json' });
});

// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'chromium',
    use: { ...devices['Desktop Chrome'], storageState: 'storageState.json' },
    dependencies: ['setup'],
  },
]
```

---

## Network interception

`page.route` and `context.route` register a handler for matching requests. The handler can `fulfill` (mock), `continue` (pass through, optionally modified), or `abort`.

```ts
await page.route('**/api/orders', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ orders: [] }),
  });
});
```

For request-level assertions (was this endpoint called?), use `page.waitForRequest` / `page.waitForResponse` instead of mocking.

---

## Configuration (`playwright.config.ts`)

Real fields, real semantics. Verify against the version you're using if uncertain.

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: [['html'], ['junit', { outputFile: 'results.xml' }]],
  use: {
    baseURL: 'https://staging.example.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

---

## Running tests (CLI)

| Command | Purpose |
|---------|---------|
| `npx playwright test` | Run all tests in all configured projects |
| `npx playwright test login.spec.ts` | Run a single file |
| `npx playwright test --grep @smoke` | Run by tag in title |
| `npx playwright test --project=chromium` | One project |
| `npx playwright test --shard=2/4` | Run shard 2 of 4 (for matrix CI) |
| `npx playwright test --workers=2` | Override worker count |
| `npx playwright test --debug` | Inspector (step through) |
| `npx playwright test --ui` | UI mode (watch + time travel) |
| `npx playwright codegen <url>` | Record interactions into test code |
| `npx playwright show-report` | Open the HTML report |
| `npx playwright show-trace trace.zip` | Open a trace file |

Always verify flag names with `npx playwright test --help` against your installed version.

---

## Tracing and debugging

Tracing is Playwright's biggest leverage. Enable it in config (`trace: 'on-first-retry'` is the standard production setting) — every retry produces a `.zip` you can open in the trace viewer to see exactly what happened:

- Screenshot at every step
- DOM snapshot (interactive, inspectable)
- Network log
- Console log
- Source code with the action highlighted

The trace viewer is also available at `trace.playwright.dev` (drag-and-drop).

For local debugging: `--ui` mode (watch tests, time-travel through actions) or `--debug` (Inspector with pause/step).

---

## CI integration

- Use the official `mcr.microsoft.com/playwright:<version>-<distro>` Docker image to avoid driver/version drift.
- Pin Playwright version in `package.json` (it ships matching browser binaries; mismatched versions cause weird failures).
- Use sharding: `--shard=1/4`, `--shard=2/4`, etc., across parallel CI jobs. See the ci-test-orchestration skill.
- Always upload the HTML report and the traces as artifacts on failure. The trace is what unblocks debugging.

---

## Common Pitfalls

- **Using `waitForTimeout`** — almost always a hidden race. Replace with a locator-based assertion or `waitForResponse`.
- **Selecting by CSS class** — classes change. Use role/label/text/testid.
- **Sharing state between tests** — each test should be independent. Reuse auth via `storageState`, not by reusing a single browser instance.
- **Not pinning the Playwright version** — minor versions bundle new browser builds. CI flakes during version drift are common.
- **Confusing `page.locator(...)` with `page.$(...)`** — `$` is the legacy ElementHandle API; prefer locators in modern code.
- **Asserting on intermediate state** — Playwright is fast. By the time the test checks "loading spinner is visible," it may already be gone. Assert on the *final* state.
- **Ignoring trace artifacts in CI** — if traces aren't uploaded, every flake is a re-run game. Upload on failure, always.
- **Mixing storage states across projects** — `storageState` is per-project. A login captured in Chromium won't behave identically in WebKit.

---

## Task-Specific Questions

When helping with Playwright, ask:

1. Which language binding — TypeScript/JavaScript, Python, Java, or .NET?
2. Which browsers and devices are in scope — Chromium only, all three engines, mobile emulation?
3. What's your CI provider and parallelism budget — does sharding work for you?
4. Is this a fresh project or an existing test suite — and if existing, what tool are you migrating from?
5. Do you need component testing, E2E, or both?
6. What's the auth model — and are you OK with `storageState` reuse, or do you need per-test login?
7. What's your flake tolerance, and is `trace: 'on-first-retry'` acceptable for your run time?

---

## Related Skills

- **cypress** — when comparing options or migrating between the two; Cypress has a different runtime model (single-domain, in-browser) with its own trade-offs.
- **selenium** — when the project needs IE support, has existing Selenium investment, or requires a non-W3C-WebDriver tool.
- **visual-regression** — `expect(locator).toHaveScreenshot()` is built in; pair with Percy/Chromatic/Applitools for cross-team workflows.
- **accessibility-testing** — Playwright integrates cleanly with `@axe-core/playwright` for in-test a11y scans.
- **ci-test-orchestration** — for sharding, retry policy, and artifact strategy on real CI.
- **flaky-test-management** — when traces show the same test failing differently across retries.
