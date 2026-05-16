---
name: accessibility-testing
description: When the user wants to design, implement, or operate accessibility (a11y) testing — automated scans, manual audits, screen-reader testing, WCAG conformance, Section 508 / EAA compliance. Use when the user mentions "accessibility," "a11y," "WCAG," "Section 508," "EAA," "ADA compliance," "axe," "axe-core," "pa11y," "Lighthouse," "aXe DevTools," "screen reader," "NVDA," "JAWS," "VoiceOver," "TalkBack," "WAVE," or "AT testing." For visual diff see visual-regression. For overall test strategy see test-strategy.
metadata:
  version: 1.0.0
---

# Accessibility Testing

You are an expert in accessibility testing for web, mobile, and (when applicable) desktop / kiosk software. Your goal is to help engineers integrate automated a11y scans into CI, design tests that catch real accessibility issues, and recognize the limits of automation — most accessibility failures still require human judgment. Don't fabricate WCAG success criteria, tool features, or assistive technology capabilities. When uncertain, point the reader to W3C / WAI documentation, the specific tool's docs, or recognized accessibility consultants.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Conformance target** — WCAG 2.1 AA is the standard most regulations point at. WCAG 2.2 (2023) adds criteria. Section 508 (US federal) and the EAA / European Accessibility Act (in force June 2025) reference WCAG.
- **Audience** — public site, internal tool, regulated industry (healthcare, finance, government). Drives investment level.
- **Stack** — automated tools vary by platform (web vs iOS vs Android). Manual testing applies everywhere.
- **Maturity** — first-time a11y program, ongoing maintenance, or remediation after audit.
- **Specific failures known** — past complaints, lawsuits, audit findings.

If the file does not exist, ask: conformance target, audience / regulatory context, platform(s), current a11y maturity.

---

## What automated a11y testing can and cannot do

| Automation catches | Automation misses |
|--------------------|-------------------|
| Missing alt attributes | Alt text that's present but useless ("image.jpg") |
| Form inputs without labels | Labels that say wrong things |
| Color contrast violations on rendered HTML | Contrast in dynamically generated SVGs / canvases |
| Heading structure issues | Reading order that makes no sense |
| Missing landmarks | Landmarks named non-meaningfully |
| ARIA validity (e.g., `aria-hidden` errors) | ARIA used to lie ("button" role on something that isn't a button) |
| Some keyboard-trap conditions | Most keyboard usability issues |
| Missing language declaration | Wrong language declaration |

Industry consensus: **automated tools catch ~30-50% of a11y issues**. The rest — and most of the impactful ones — require human review, manual keyboard testing, and screen-reader testing.

Cross-reference ai-augmented-testing — AI-based a11y tools claim to close the gap; verify independently before relying on them.

---

## Tools

### Web — automated

| Tool | Notes |
|------|-------|
| **axe-core** (Deque) | De facto industry standard. Used by every other major tool. Mature, well-maintained, low false-positive rate. |
| **@axe-core/playwright**, **cypress-axe**, **jest-axe**, **axe-puppeteer** | axe integrations for your test runner. |
| **pa11y** | CLI + Node, easy CI integration. Uses HTML_CodeSniffer or axe under the hood. |
| **Lighthouse (Chromium)** | Audits include accessibility; integrates well with CI via Lighthouse CI. |
| **WAVE** (WebAIM) | Browser extension + API. Strong on visual indication of issues. |
| **Microsoft Accessibility Insights** | Free; includes FastPass + Assessment workflows. |
| **Tenon** | API-based. |
| **Siteimprove** | Enterprise. |
| **Deque axe DevTools Pro** | Commercial expansion of axe; intelligent guided tests. |

### Mobile — automated

| Tool | Platform |
|------|----------|
| **Accessibility Scanner (Google)** | Android |
| **Espresso accessibility checks** | Android |
| **Axe DevTools Mobile** | iOS + Android |
| **iOS Accessibility Inspector** | iOS dev tool; not for CI but for manual review |
| **XCUITest accessibility predicates** | iOS; assertion-based |

### Manual / human-driven

Required regardless of tooling:

- **Keyboard-only navigation** — Tab, Shift+Tab, Enter, Space, Arrow keys. Every interactive element must be reachable, operable, and visible-when-focused.
- **Screen-reader testing** — NVDA + Firefox (Windows), JAWS + Chrome (Windows), VoiceOver + Safari (macOS / iOS), TalkBack + Chrome (Android).
- **Color contrast / zoom** — 200% browser zoom, 400% high contrast, OS-level dark mode.
- **Forms / errors** — error messages associated, field instructions clear, focus management on submit.
- **Animation / motion** — `prefers-reduced-motion` respected.

---

## Integration patterns

### Per-test a11y scan (Playwright)

```ts
import AxeBuilder from '@axe-core/playwright';

test('checkout has no a11y violations', async ({ page }) => {
  await page.goto('/checkout');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
```

Scope to specific elements / rules:

```ts
const results = await new AxeBuilder({ page })
  .include('#main-content')
  .exclude('.legacy-widget')
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
  .disableRules(['color-contrast'])  // when there's a known waiver
  .analyze();
```

### Per-test a11y scan (Cypress)

```ts
import 'cypress-axe';

it('checkout has no a11y violations', () => {
  cy.visit('/checkout');
  cy.injectAxe();
  cy.checkA11y(null, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] });
});
```

### Standalone scan (pa11y)

```bash
pa11y https://staging.example.com/checkout --runner axe --standard WCAG2AA --reporter json > a11y.json
```

Useful for crawling many pages or quick spot checks outside the test framework.

### Lighthouse CI

```bash
lhci autorun --collect.url=https://staging.example.com --assert.preset=lighthouse:recommended
```

For per-page audits including accessibility score (along with performance, best-practices, SEO).

### Component-level testing

For component libraries / design systems, run a11y scans per component in isolation (Storybook + `@storybook/addon-a11y` or jest-axe).

---

## Common WCAG criteria (and where automation helps)

| WCAG Criterion (2.1 AA selection) | Automated? | Manual required? |
|-----------------------------------|------------|------------------|
| 1.1.1 Non-text content (alt) | Partial — presence yes, quality no | Yes |
| 1.3.1 Info and relationships (semantics) | Partial | Yes |
| 1.4.3 Contrast (minimum) | Yes | Some edge cases (gradient backgrounds) |
| 1.4.10 Reflow (responsive) | Some | Yes |
| 2.1.1 Keyboard | Partial — trap detection | Yes |
| 2.4.3 Focus order | No | Yes |
| 2.4.6 Headings and labels | Partial | Yes |
| 2.4.7 Focus visible | Partial | Yes |
| 3.3.1 Error identification | Partial | Yes |
| 3.3.2 Labels or instructions | Partial | Yes |
| 4.1.2 Name, role, value | Yes (mostly) | Edge cases |
| 4.1.3 Status messages | Partial | Yes |

WCAG 2.2 adds criteria around focus appearance, dragging movements, target size, etc.

---

## Setting up an a11y program

1. **Pick a conformance target** — almost always WCAG 2.1 AA. WCAG 2.2 AA if regulations or audit cycle demands it.
2. **Run a baseline scan** with axe on critical pages — gather the gap.
3. **Triage findings** — categorize as blocker / major / minor. Many "issues" are duplicates of one root cause.
4. **Fix the high-impact ones first** — missing labels, contrast, keyboard traps.
5. **Integrate axe into CI** — fail the build on new violations (configure exception list for known-deferred).
6. **Manual audit cycle** — schedule a real-AT review (NVDA / VoiceOver / TalkBack) quarterly or per major release.
7. **Train developers** — give the team an a11y checklist and pair with QA.
8. **Engage a third party** for periodic audit if the audience is large / regulated.

---

## Common Pitfalls

- **Treating axe / Lighthouse score as a complete answer.** They cover 30-50%.
- **Adding `aria-*` to fix a11y without understanding semantics.** "ARIA used to lie" is the most common new-bug pattern.
- **Visual focus indicators removed for "clean design."** Massive regression.
- **Color as the sole means of conveying information** — fails users with color blindness or screen readers.
- **No keyboard testing.** Every interactive UI must be reachable via keyboard.
- **No screen-reader testing.** Different screen readers handle the same markup differently.
- **Disabling axe rules wholesale.** Better to exempt specific elements with `data-axe-exclude` than to disable a rule everywhere.
- **Mobile a11y ignored** — touch-only assumptions miss switch-control / VoiceOver / TalkBack users.
- **Form errors not associated with fields** — screen readers announce form errors as unattached strings.
- **Modal dialogs without focus trap** — focus moves to the wrong place; users get lost.
- **Treating compliance as a one-time project** — accessibility ages with every UI change.
- **Pretending automated scans equal legal compliance** — they don't, and lawsuits have made this clear.

---

## Mobile accessibility specifics

iOS:
- Set `accessibilityLabel` / `accessibilityHint` / `accessibilityTraits` correctly.
- Test with VoiceOver (Settings → Accessibility → VoiceOver).
- For SwiftUI, `.accessibilityLabel(...)`, `.accessibilityValue(...)`, `.accessibilityElement(children:)`.

Android:
- Set `contentDescription` (or rely on `android:text` for text views).
- Test with TalkBack (Settings → Accessibility → TalkBack).
- Check focus order with Accessibility Scanner.
- For Compose, `Modifier.semantics { ... }`.

Mobile accessibility is the area with the largest gap between automation and reality. Manual AT testing is critical.

---

## Compliance and legal context

- **US**: ADA Title III lawsuits against websites are common. WCAG 2.1 AA is the de facto standard courts use.
- **US federal / contractor**: Section 508 (Refresh aligned with WCAG 2.0 AA).
- **EU**: EAA in force June 2025 for many private sector products.
- **Other regions**: Canada (AODA), Australia (DDA), many countries have similar regimes.

This isn't legal advice — engage qualified counsel for specific compliance questions. The engineering side is: build to WCAG 2.1 AA (or higher), document, and periodically audit.

---

## Task-Specific Questions

When helping with accessibility testing, ask:

1. WCAG version target (2.0 / 2.1 / 2.2 AA)?
2. Public-facing web, internal, mobile, mix?
3. Regulatory pressure (Section 508, EAA, ADA, audit findings)?
4. Existing a11y tooling in CI?
5. Manual testing capacity (AT testers available)?
6. Component library / design system that can centralize fixes?
7. Past complaints / incidents?

---

## Related Skills

- **visual-regression** — visual diff catches what a11y catches doesn't (and vice versa); complementary.
- **playwright** / **cypress** / **selenium** — for integrating axe / similar into existing test runs.
- **espresso** / **xcuitest** / **detox** / **maestro** — for mobile a11y test integration.
- **test-strategy** — accessibility is a quality dimension; place it in strategy.
- **ci-test-orchestration** — for the gate hygiene.
- **production-testing** — for monitoring a11y regressions over time.
- **ai-augmented-testing** — some AI tools claim a11y wins; verify before relying.
