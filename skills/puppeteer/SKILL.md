---
name: puppeteer
description: When the user wants to design, implement, debug, or scale Puppeteer scripts for browser automation, scraping, PDF generation, or screenshot capture. Use when the user mentions "Puppeteer," "puppeteer-core," "Chromium," "page.goto," "page.evaluate," "page.screenshot," "page.pdf," "browser.launch," or "headless Chrome." For test-runner-flavored E2E, see playwright (same Microsoft team, more test-focused). For Cypress see cypress. For Selenium see selenium.
metadata:
  version: 1.0.0
---

# Puppeteer

You are an expert in Puppeteer — Chromium browser automation via the DevTools Protocol. Your goal is to help engineers design and debug Puppeteer scripts for the use cases Puppeteer is genuinely good at (scraping, screenshot/PDF generation, scripted browser tasks, low-level CDP work) and to guide migration toward Playwright when the user's goal is actually a test suite. Do not fabricate method signatures, options, or CLI flags. When uncertain, point the reader to `pptr.dev`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **What is the user actually trying to do?** — Puppeteer is *not* a test framework. If the goal is a test suite, recommend Playwright instead. If the goal is scraping, PDF generation, screenshots, or scripted automation, Puppeteer is a reasonable choice.
- **Languages used** — Puppeteer is a Node.js library (JS/TS). For Python, redirect to `pyppeteer` (community port) or recommend Playwright Python.
- **Browsers in scope** — Puppeteer is Chromium-first. Firefox support exists but lags Chromium. Safari is not supported.
- **Deployment** — long-running service (web scraper / PDF service)? CI script? Both have different concerns (resource leaks, browser lifecycle).

If the file does not exist, ask: what's the use case (scraping, PDF, testing), Node version, target site (single-domain, multi-domain, login required), and whether output is a one-off script or a long-running service.

---

## Why Puppeteer

- **Chromium-native, low overhead** — direct DevTools Protocol communication, no WebDriver layer.
- **PDF generation** — `page.pdf()` is the canonical reason to pick Puppeteer over Playwright.
- **Screenshots and visual capture** — full page, element-scoped, with control over emulated devices.
- **Scraping** — for sites that require JavaScript execution before content is in the DOM.

When *not* to use Puppeteer:

- You want a **test runner** with fixtures, retries, parallel workers, traces, and assertions → use Playwright. Same authors, same lineage, far more test-shaped.
- You need **cross-browser coverage including WebKit/Firefox** → Playwright.
- You need **Safari** → no current tool except real Safari (Selenium with `safaridriver`).

---

## Core Concepts

### Launching

```ts
import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: 'new',                       // 'new' headless, 'shell' for old headless, false for headed
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 720 },
});
const page = await browser.newPage();
await page.goto('https://staging.example.com', { waitUntil: 'networkidle2' });
// ... do work
await browser.close();
```

`puppeteer-core` is the same library without the bundled Chromium download — use it when you bring your own Chrome/Chromium binary.

### Navigation and waits

| Method | Purpose |
|--------|---------|
| `page.goto(url, options)` | Navigate. `waitUntil`: `load`, `domcontentloaded`, `networkidle0`, `networkidle2`. |
| `page.waitForSelector(sel, opts)` | Wait for an element. |
| `page.waitForFunction(fn, opts)` | Wait for arbitrary JS predicate. |
| `page.waitForResponse(predicate)` | Wait for a matching response. |
| `page.waitForNavigation()` | Wait for navigation triggered by another action (deprecated in favor of explicit waits where possible). |

### Selecting and interacting

```ts
await page.click('[data-test="sign-in"]');
await page.type('[data-test="email"]', 'qa.user@example.com');
const text = await page.$eval('[data-test="welcome"]', el => el.textContent);
const allTexts = await page.$$eval('.product-card', els => els.map(e => e.textContent));
```

`page.$` returns one ElementHandle, `page.$$` returns all. `page.$eval` / `page.$$eval` runs a function inside the page context and returns the serialized result.

### Page context vs Node context

Code inside `page.evaluate(fn)` runs in the browser. It cannot reference Node variables directly — pass them as arguments:

```ts
const result = await page.evaluate((id) => document.getElementById(id)?.textContent, 'cart');
```

---

## PDF generation

`page.pdf()` is one of Puppeteer's strongest use cases.

```ts
await page.pdf({
  path: 'invoice.pdf',
  format: 'A4',
  printBackground: true,
  margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
  displayHeaderFooter: true,
  headerTemplate: '<div style="font-size: 9px; margin-left: 15mm">Invoice #INV-1001</div>',
  footerTemplate: '<div style="font-size: 9px; margin-left: 15mm"><span class="pageNumber"></span> / <span class="totalPages"></span></div>',
});
```

PDF generation requires **headless** Chrome. It will fail or produce a screenshot-only output in headed mode.

---

## Screenshots

```ts
await page.screenshot({ path: 'home.png', fullPage: true });
const elementHandle = await page.$('[data-test="hero"]');
await elementHandle?.screenshot({ path: 'hero.png' });

// Device emulation
await page.emulate(puppeteer.KnownDevices['iPhone 13']);
await page.screenshot({ path: 'home-iphone.png' });
```

For pixel-stable screenshots: disable animations, use a fixed viewport, mask dynamic regions, and pin the Chrome version.

---

## Network interception

```ts
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().includes('/analytics')) {
    req.abort();
  } else if (req.url().includes('/api/orders')) {
    req.respond({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ orders: [] }),
    });
  } else {
    req.continue();
  }
});
```

Heavier than Playwright's `page.route` because every request must be handled. For test-suite-like interception, Playwright is cleaner.

---

## CDP (Chrome DevTools Protocol)

Direct CDP gives you raw access — network throttling, geolocation override, performance traces.

```ts
const client = await page.target().createCDPSession();
await client.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 200,
  downloadThroughput: 1.6 * 1024 * 1024 / 8,
  uploadThroughput: 750 * 1024 / 8,
});
```

Use when the high-level Puppeteer API doesn't expose what you need.

---

## Resource management

Puppeteer in long-running services is the most common place to leak memory. Rules:

- Always `await browser.close()` (or `page.close()`) in a `try/finally`.
- Reuse a single browser process across requests where you can; create fresh contexts (`browser.createBrowserContext()`) per job for isolation.
- Watch the Chromium process count — orphan processes are a sign of an unhandled exception path.
- Set a per-job timeout outside Puppeteer and force-kill the browser on timeout.

---

## Common Pitfalls

- **Treating Puppeteer as a test framework** — it isn't. There are no fixtures, no parallel runners, no retry policy, no reporter ecosystem. Use Playwright if you want those.
- **Forgetting `await`** — every Puppeteer method is async. ESLint's `no-floating-promises` helps.
- **Confusing page context with Node context** — `page.evaluate` runs in the browser. Variables don't carry across.
- **`waitForNavigation` race conditions** — calling it after the navigation already started leaves you waiting forever. Use the `Promise.all([page.waitForNavigation(), action])` pattern, or prefer `page.waitForResponse` / `waitForURL` style waits.
- **Headless detection** — some sites detect headless Chrome and serve different content. The user-agent and `navigator.webdriver` flag are the common tells. Stealth plugins exist (community) but the right answer is often "stop scraping a site that doesn't want to be scraped."
- **Leaking browsers in long-running services** — guard with try/finally and process-level timeouts.
- **Hardcoded sleeps** — `await new Promise(r => setTimeout(r, 2000))` is the worst kind of fix. Use `waitFor*` methods.
- **Using `page.waitForTimeout`** — deprecated. Use the explicit `wait` methods or a real promise-based delay only as last resort.

---

## Task-Specific Questions

When helping with Puppeteer, ask:

1. What's the actual goal — scraping, PDF, screenshots, automation, testing?
2. If "testing," should we use Playwright instead?
3. Node version and Puppeteer version (major versions can change defaults like headless mode).
4. One-off script or long-running service?
5. Target site — public, behind login, behind CAPTCHA?
6. Output requirements — PDF format, screenshot resolution, scraped fields?
7. Deployment — local dev, CI, container, serverless (Lambda has its own quirks)?

---

## Related Skills

- **playwright** — strongly recommended whenever the goal is a test suite. Same team, test-shaped API, traces, multi-browser.
- **cypress** — when comparing for in-browser test ergonomics.
- **selenium** — when the goal is cross-browser including Safari/IE-mode.
- **visual-regression** — Puppeteer screenshots can feed Percy, BackstopJS, Applitools workflows.
- **ci-test-orchestration** — when running Puppeteer scripts as part of a pipeline at scale.
- **production-testing** — synthetic monitoring with Puppeteer is workable but Playwright is the more common pick now.
