---
name: visual-regression
description: When the user wants to design, integrate, or operate visual regression testing — pixel diffs, DOM snapshots, AI-powered visual diffs, baseline management, dynamic-content masking. Use when the user mentions "visual regression," "visual testing," "screenshot testing," "Percy," "Applitools," "Chromatic," "BackstopJS," "Playwright snapshots," "loki," "happo," "argos," "visual diff," "snapshot baseline," or "image comparison." For broader test strategy see test-strategy. For accessibility see accessibility-testing.
metadata:
  version: 1.0.0
---

# Visual Regression Testing

You are an expert in visual regression testing — automated screenshot / DOM-snapshot comparisons that catch UI regressions automated functional tests miss. Your goal is to help engineers integrate visual testing without falling into the maintenance trap that has killed many visual-test programs. Don't fabricate tool features or pricing. When uncertain, point the reader to the vendor's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Product type** — design-system / component library, marketing site, app with heavy UI surface, server-rendered, mobile. Approaches differ.
- **Existing test stack** — Playwright / Cypress / Storybook / Selenium / Detox. Integration patterns vary.
- **Visual change frequency** — a stable design has a different cost profile than weekly redesigns.
- **Baselines storage** — committed to repo, vendor-managed, or both.
- **Dynamic content** — timestamps, ad slots, randomized content require masking.
- **Cross-browser need** — Chrome only or all-engines.

If the file does not exist, ask: product type, existing test stack, design cadence, dynamic content extent, cross-browser requirement.

---

## Why visual regression testing

Automated functional tests assert on selectors, text content, and state. They don't catch:

- CSS regression (margin: 10px → 100px).
- Z-index conflicts hiding elements visually.
- Theme / dark-mode breakage.
- Misaligned components.
- Font fallback chains rendering differently.
- Color shifts.
- New unintended whitespace.

Visual regression compares rendered output (screenshots or DOM snapshots) against a baseline; differences flag as failures for review.

When *not* to invest:

- Heavy redesign in progress — every test fails every day.
- Small team that won't have capacity to triage baseline changes.
- Pure backend / API project with no UI.

---

## Approaches

### 1. Pixel-diff (full screenshot comparison)

Capture a screenshot, compare pixel-by-pixel to baseline, flag differences.

**Pros:** simple, catches anything visual.

**Cons:** sensitive to anti-aliasing, font rendering differences across OS / browser, flaky under any rendering variance. Every minor pixel shift fails the test until a human approves.

### 2. DOM snapshot comparison

Capture the DOM state (HTML + computed styles) and compare to baseline.

**Pros:** deterministic — same DOM = same snapshot.

**Cons:** misses purely visual issues that don't show in the DOM (z-index conflicts, CSS rendering quirks, font fallback issues, GPU rendering artifacts).

### 3. AI / perceptual visual diff

Use ML to ignore "acceptable" differences (anti-aliasing variance, minor animation states) and flag actual regressions.

**Pros:** dramatically lower false-positive rate; usable in CI without endless re-baselining.

**Cons:** vendor-dependent; data goes to vendor cloud; pricing scales with usage.

Most modern visual-testing platforms (Applitools, Percy, Chromatic) use a mix of pixel + perceptual + DOM comparison.

---

## Tools

| Tool | Notes |
|------|-------|
| **Applitools Eyes** | AI-powered visual diff. Industry leader on quality. Commercial. |
| **Percy (BrowserStack)** | Mature, cross-browser, AI-assisted. Commercial. |
| **Chromatic** | Built for Storybook / component testing. Commercial. |
| **Playwright snapshots** | Built into Playwright; `expect(page).toHaveScreenshot()`. Free, lower-tech. |
| **BackstopJS** | Open-source, self-hosted, full-page screenshots. |
| **Loki** | Open-source for Storybook. |
| **Happo** | Multi-browser snapshots; mid-tier price. |
| **Argos CI** | Open-source platform + commercial cloud. |
| **`reg-suit`** | Lightweight Node.js screenshot regression. |

For most teams: start with Playwright's built-in snapshots or Chromatic (if Storybook-based) before moving to Applitools / Percy if scale or quality demands it.

---

## Where in the stack

### Component-level (recommended starting point)

Snapshot each component in isolation. Catches regressions at the source before they propagate to every page.

- **Storybook + Chromatic**: each story is a snapshot. Strongest fit.
- **Storybook + Loki**: open-source alternative.
- **Component tests in Cypress / Playwright with snapshots**: viable for small libraries.

### Page-level

Snapshot critical pages at key states. Catches regressions automated functional tests don't.

- Playwright `await expect(page).toHaveScreenshot('home.png')`.
- Cypress + Percy / Applitools plugins.
- Visual snapshots from E2E tests.

### Mobile

- Detox / Appium screenshots compared via Applitools / Percy.
- iOS / Android native snapshot testing (XCUITest snapshots, Espresso screenshot testing).
- Cross-reference detox / xcuitest / espresso.

---

## Setting up Playwright snapshots (simplest path)

```ts
import { test, expect } from '@playwright/test';

test('home page visual', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('home.png');
});

// Element-specific
test('hero visual', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('banner')).toHaveScreenshot('hero.png');
});
```

Baselines are committed to the repo (`__screenshots__/...`). When a screenshot fails, Playwright shows the diff. To accept new baselines: `npx playwright test --update-snapshots`.

Pitfalls:

- Anti-aliasing varies across OS — baselines from a Mac will fail on Linux CI. Always generate baselines on CI to ensure consistency.
- Font rendering varies — use containerized CI (same Linux image every time).
- Dynamic content (timestamps, random IDs) causes false failures — mask:

```ts
await expect(page).toHaveScreenshot('home.png', {
  mask: [page.locator('.timestamp'), page.locator('.user-avatar')],
});
```

---

## Setting up Chromatic (Storybook)

```bash
# Initial setup
npx chromatic --project-token=<your-token>

# CI: every PR
- run: npx chromatic --exit-zero-on-changes
```

Chromatic captures every story, diffs against baseline, shows changes as a PR review surface. Strongest fit for component-library teams.

---

## Setting up Applitools / Percy

These plug into existing test runs:

```ts
// Applitools (Playwright)
import { Eyes } from '@applitools/eyes-playwright';

test('home visual', async ({ page }) => {
  const eyes = new Eyes();
  await eyes.open(page, 'My App', 'home page');
  await page.goto('/');
  await eyes.checkWindow('full page');
  await eyes.close();
});
```

Visual diffs go to the vendor cloud for review. Baselines are managed in the vendor dashboard.

---

## Baseline management

**Baselines are code.** They need to be:

- **Committed or vendor-managed.** Don't lose them.
- **Updated deliberately.** "Update all baselines" without reviewing = approving regressions.
- **Reviewed per change.** Every baseline update is a code-review concern.

Process for accepted changes:

1. Engineer makes a UI change.
2. Visual tests fail with diff.
3. Engineer reviews diff — is this the intended change?
4. If yes, regenerate baselines (`--update-snapshots` for Playwright, "approve" in Chromatic dashboard).
5. Commit the new baselines or get them approved in the vendor's PR-review UI.
6. Code review verifies the baseline change is intentional.

---

## Handling dynamic content

The biggest source of false positives:

| Type | Approach |
|------|----------|
| Timestamps | Mask via `mask:` option or replace with fixed value in test setup |
| Random IDs in attributes | Mask or replace |
| User avatars (varying) | Use a fixed test avatar |
| Ad slots / third-party widgets | Mask or stub the API |
| Animations / loading spinners | Wait for stable state OR disable animations in test mode |
| Custom fonts loading | Wait for `document.fonts.ready` |
| Geolocation / locale-dependent | Pin locale; set fixed geolocation |

For Playwright:

```ts
await page.addStyleTag({
  content: `*, *::before, *::after {
    animation-duration: 0s !important;
    transition-duration: 0s !important;
  }`,
});
await page.evaluate(() => document.fonts.ready);
await expect(page).toHaveScreenshot('home.png');
```

This pre-flight is the single most impactful investment for stable visual tests.

---

## Cross-browser visual testing

Visual diffs across browsers differ for legitimate reasons:

- Anti-aliasing differs (Chrome / Firefox / Safari render fonts differently).
- Default form-control styles differ.
- Font fallback chains differ.

Strategies:

- **One canonical browser** for visual testing (typically Chromium); test cross-browser functionally but not visually.
- **Per-browser baselines** — Applitools / Percy manage this transparently; with Playwright snapshots, name baselines per browser.

---

## CI integration

```yaml
# Playwright snapshots
- run: npx playwright test
- if: failure()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-report
    path: playwright-report/
```

Failed visual tests produce a diff artifact; reviewers download and compare.

For Chromatic / Applitools / Percy, the vendor's PR-review UI is the primary surface. CI integration is a status check + link.

---

## Common Pitfalls

- **Generating baselines on a developer machine, running tests on CI.** Different OS / fonts → guaranteed flake.
- **No animation / font / dynamic-content control.** False positives everywhere.
- **Approving baselines wholesale to "fix" CI.** Approves regressions.
- **One giant page screenshot.** Any small change requires full review. Prefer many small screenshots.
- **Visual tests in PR CI for every minor UI change.** Constant churn; team disables them.
- **No baseline review workflow.** Engineers update locally and push without team review.
- **Snapshots of pages with feature flags varying.** Visual diff depends on flag state; flake.
- **Pixel-diff thresholds set too tolerant.** Real regressions hide as "minor pixel differences."
- **No mobile visual coverage** — most visual programs are web-only.
- **Vendor lock-in without exit plan.** Baselines stored only in vendor; migration costly.
- **Treating visual diff as accessibility coverage.** They're different (cross-reference accessibility-testing).

---

## Building a visual-test program

1. **Pick scope** — component-level (recommended start), page-level smoke, or both.
2. **Pick tool** — Playwright snapshots (free, low-ceiling), Chromatic (Storybook), Applitools / Percy (AI diff at cost).
3. **Stabilize the environment** — disable animations, wait for fonts, mask dynamic content, run in containerized CI.
4. **Generate baselines on CI**, not on developer machines.
5. **Integrate as a soft gate first** — warn on diff, don't block — for the first 30 days while you tune.
6. **Mature into a hard gate** — diffs require review and explicit approval.
7. **Process for baseline updates** — code review, not "approve all."
8. **Audit periodically** — are tests catching real regressions, or just generating noise?

---

## Task-Specific Questions

When helping with visual regression testing, ask:

1. Product type — design system, marketing, app, mobile?
2. Existing test framework?
3. Storybook in use?
4. Dynamic content (timestamps, user-specific, third-party)?
5. Cross-browser requirement?
6. Budget for commercial tooling, or open-source preferred?
7. Team capacity for baseline review?

---

## Related Skills

- **playwright** / **cypress** — common runners for visual integration.
- **selenium** / **webdriverio** — possible runners, less common for visual.
- **detox** / **xcuitest** / **espresso** — mobile visual testing.
- **accessibility-testing** — distinct but complementary; both catch UI issues automated functional tests miss.
- **ai-augmented-testing** — visual AI is the most-delivered AI-testing win to date.
- **test-strategy** — visual is a quality dimension; place in strategy.
- **ci-test-orchestration** — for gate hygiene and artifact handling.
- **flaky-test-management** — visual flake is its own subcategory.
