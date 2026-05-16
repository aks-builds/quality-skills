---
name: ai-augmented-testing
description: When the user wants to evaluate, adopt, or operate AI-augmented testing tools and approaches — autonomous test generation, self-healing locators, AI-assisted authoring, vision-based testing, agentic test runners. Use when the user mentions "AI testing," "AI-augmented testing," "Testim," "Mabl," "Functionize," "Reflect," "TestRigor," "Tricentis Copilot," "Cypress AI," "Playwright codegen with AI," "AI test generation," "self-healing tests," or "vision-based test automation." For LLM-product evals see llm-eval-testing. For overall strategy see test-strategy.
metadata:
  version: 1.0.0
---

# AI-Augmented Testing

You are an expert in AI-augmented testing — tools that use ML / LLMs to generate, maintain, or run tests. Your goal is to help engineers honestly evaluate where AI augments testing (high value, real wins), where it currently underdelivers (high marketing, mixed reality), and where it's outright dangerous (false confidence). Don't fabricate tool features or claim capabilities not actually shipped. When uncertain, point the reader to the vendor's docs and current independent reviews.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **What problem are you solving?** — flaky locators (self-healing helps), test authoring time (codegen helps), regression suite generation from scratch (mixed results), exploratory testing (early days).
- **Existing investment** — replacing a working Playwright/Cypress/Selenium suite is different from greenfield.
- **Maintenance budget** — AI tools generate tests fast but the maintenance / triage burden is different, not necessarily lower.
- **Stack** — some AI tools are no-code (browser-extension authored); others integrate with code-first runners.
- **Data sensitivity** — vendor AI tools usually send screenshots / DOM / prompts to a vendor cloud. Compliance matters.

If the file does not exist, ask: problem being solved, existing test infrastructure, who authors tests, compliance constraints on sending data to vendor AI.

---

## What AI-augmented testing actually does today

This is a fast-moving space. As of early 2026, real capabilities cluster into:

### 1. AI-assisted authoring (genuine win)

- **Playwright codegen / Cypress Studio**: record-and-edit, with smart locator suggestions.
- **Claude / GPT-driven test generation in IDE**: write a description, get scaffolded test code. Useful as a starting point; review heavily.
- **`Playwright MCP` / `Browser Use` / `playwright-codegen-llm`**: agentic tools that drive a browser to produce test code.

**Reality**: speeds up the first draft. Tests still need human review — generated locators are often wrong, assertions are often weak, the test may exercise the happy path but miss edge cases.

### 2. Self-healing locators (mixed)

- **Testim, Mabl, Functionize**: claim to auto-fix locators when the UI changes.

**Reality**: works when the change is a class/ID swap with no semantic shift. Breaks down when the UI restructures meaningfully. Worse, **self-healing can hide regressions** — a locator that "heals" to a different button silently passes tests that should have failed. Investigate every heal.

### 3. Visual / DOM-based AI testing

- **Applitools Eyes**, **Percy**, **Chromatic**, **TestRigor** (claims visual + plain-English steps).

**Reality**: visual diff with ML to ignore acceptable changes (e.g., animations, dynamic data) is genuinely useful. Plain-English test authoring (TestRigor's pitch) is partially working — it handles simple flows well, complex flows still need fallback code.

### 4. Autonomous test generation

- **Reflect**, **TestSigma**, vendor "AI builds your suite" pitches.

**Reality**: as of early 2026, autonomous full-suite generation is **not** delivering on the hype. Generated tests tend to be:

- Brittle (literal selectors, no abstraction).
- Happy-path only (no boundary / error coverage).
- Hard to maintain (no domain language).

Use for the first 60% of coverage if you're truly greenfield; expect to throw away the bottom 30% over time.

### 5. Vision-based testing

- **Applitools Visual AI**, **TestRigor vision**, **Percy AI**.

**Reality**: catches visual regressions reliably, especially for layout / styling bugs that DOM-based tests miss. Pair with DOM-based tests; don't replace.

### 6. AI for triage / flake analysis

- **Trunk Flaky Tests**, **Datadog CI Test Optimization**, **Launchable**.

**Reality**: clear win. AI classification of failure patterns and flake clusters is genuinely faster than human triage at scale.

---

## When AI-augmented testing is the right call

| Situation | Recommend |
|-----------|-----------|
| Greenfield project, no test investment | Codegen-as-starting-point (Playwright codegen, AI-assisted); review heavily |
| Existing tests with rapidly-changing UI | Self-healing might help; investigate every heal |
| Visual regression on a styled product | Applitools / Percy / Chromatic visual AI |
| Large suite with significant flake | AI flake-analysis (Trunk, Datadog) |
| Non-coder QA team writing tests | Plain-English authoring (TestRigor, Reflect) — accept the limits |
| Big suite, no triage capacity | AI-assisted failure classification |
| Highly-regulated industry where every test must be auditable | Stick with code-first; AI tools are harder to audit |
| Sensitive data flows (PHI, PCI, etc.) | Verify vendor data-handling; many won't pass compliance |

---

## When NOT to use AI-augmented testing

- **You think AI will eliminate the QA function.** It won't. Tools shift work, not eliminate it.
- **You don't have time to review what AI produces.** Generated tests need critique. If you'd merge them unreviewed, you're shipping liability.
- **You're hoping AI will fix bad tests.** Bad tests stay bad. AI augments good practice; it doesn't fix bad practice.
- **You can't afford the vendor cost without ROI clarity.** "AI testing" pricing is often per-test or per-run; bills compound.
- **Compliance prohibits sending data to vendor clouds.** Verify before pilot.

---

## Practical adoption patterns

### Codegen as starter

Use Playwright codegen / Cypress Studio / similar to get a working draft of a test, then rewrite manually:

```bash
npx playwright codegen https://staging.example.com
# Click through the flow; Playwright emits code; refactor.
```

What to fix after codegen:

- Replace literal selectors (`.btn.primary`) with semantic ones (`getByRole('button', { name: 'Save' })`).
- Replace inline `await page.waitForTimeout(1000)` with proper auto-waiting assertions.
- Refactor common flows into helper functions.
- Add edge-case scenarios codegen doesn't capture.

### LLM-assisted authoring

Prompt an LLM with: "Given this React component file, generate Playwright tests covering normal and error paths." Review:

- Selector quality.
- Assertion strength.
- Edge cases included.
- Brittle assumptions (hardcoded text, locale-specific values).

LLM-generated test code is a draft, not a finished product. Treat like a junior engineer's first pass.

### Self-healing pilot

If trialing Testim / Mabl / etc.:

1. Use it on a stable, important flow first.
2. Track every "self-heal" event — was the heal correct?
3. Investigate any test that passes after a heal — could it have hidden a real regression?
4. Compare maintenance time vs. a code-first suite over a quarter.

If self-heals are mostly correct, the tool earns its place. If you're investigating most of them anyway, you're not saving time.

### Visual AI

Visual AI tools (Applitools / Percy / Chromatic) integrate as a layer over existing tests:

```ts
import { test } from '@playwright/test';
import { Eyes } from '@applitools/eyes-playwright';

test('home page visual', async ({ page }) => {
  const eyes = new Eyes();
  await eyes.open(page, 'My App', 'home page');
  await page.goto('https://staging.example.com');
  await eyes.checkWindow('full page');
  await eyes.close();
});
```

Cross-reference visual-regression for the deeper trade-off discussion.

---

## Cost realities

AI testing pricing models:

- Per test / per run (Testim, Mabl).
- Per "visual checkpoint" (Applitools, Percy).
- Per analyzed minute / session (TestRigor).
- Flat tier (Reflect, Functionize).

Bills can scale faster than expected — every PR running every visual test multiplies. Set budget alerts.

For a clear-eyed evaluation: write down current testing cost (CI minutes + maintenance time + flake remediation), pilot the AI tool on a subset, measure 60 days, compare honestly. Many pilots reveal the AI tool *adds* cost without proportional benefit.

---

## What to ask vendors

When evaluating:

1. **Data handling** — where does test data go? Retained for how long? Compliance attestations (SOC 2, HIPAA, FedRAMP)?
2. **Determinism** — does the same test, same input, produce the same result? (Some "AI" tests have non-deterministic step interpretation.)
3. **Audit trail** — for a failing test, can you see exactly what action / assertion ran?
4. **Maintenance ownership** — who owns AI-generated tests? Vendor or you?
5. **Lock-in** — can tests be exported as code (e.g., Playwright JS) if you leave?
6. **Pricing model and growth** — what does the bill look like at 10x current usage?
7. **Failure mode** — when the AI is wrong, how does the failure manifest? Loud (fail-loud) or silent (hidden heal)?

---

## Common Pitfalls

- **Treating AI as a replacement for engineering judgment.** It's an augmentation.
- **Not reviewing AI-generated tests.** Generates volume; quality unreviewed = liability.
- **Trusting self-healing without auditing heals.** Hides regressions silently.
- **Sending PHI / PCI to vendor AI without compliance review.** Possible compliance breach.
- **Locking in to a no-code vendor.** Migration cost when the vendor changes or fails.
- **Paying per-test fees on a growing suite without budget alerts.** Bills compound silently.
- **Confusing "AI in marketing" with "AI in product."** Many vendors are renaming feature flag heuristics as "AI."
- **Replacing engineers with AI tools.** Test infrastructure still needs engineers — just different work.
- **Using AI to mask test-strategy problems.** Bad strategy → bad coverage → no AI tool fixes that.

---

## Building an evaluation plan

1. **Identify the specific pain** the AI tool would address — authoring time, flake, visual regression, triage.
2. **Define success metrics** in advance — not "feels faster" but "saved X hours / week."
3. **Pilot on a non-critical flow** for 30-60 days.
4. **Track outcomes**: tests authored, tests maintained, bugs found, bugs missed, time saved, cost incurred.
5. **Compare honestly** to current approach.
6. **Decide adopt / drop based on data**, not vendor narrative.

---

## Task-Specific Questions

When helping with AI-augmented testing, ask:

1. What pain are you solving?
2. Existing test investment?
3. Compliance constraints on vendor data flows?
4. Who authors tests today — engineers, QA, mix?
5. Pricing budget for AI tools?
6. Specific tools being evaluated?
7. Decision timeline?

---

## Related Skills

- **llm-eval-testing** — different topic (testing LLM *products*); often confused with this skill.
- **visual-regression** — visual AI specifically is its own sub-area.
- **flaky-test-management** — AI flake analysis is the strongest current AI testing win.
- **test-strategy** — AI tools belong in the strategy, but don't reshape it for you.
- **playwright** / **cypress** / **selenium** / **webdriverio** — code-first alternatives that AI tools often pitch against.
- **production-testing** — synthetic monitoring with AI-driven anomaly detection.
- **ci-test-orchestration** — for the CI integration patterns.
