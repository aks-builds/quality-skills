---
name: test-strategy
description: When the user wants to design, audit, or evolve a test strategy — the shape of their test pyramid, the balance of unit / integration / E2E / contract / perf / accessibility tests, what shifts left vs right, what each layer is and isn't responsible for, and how to gate releases. Use when the user mentions "test strategy," "test pyramid," "test trophy," "test ice cream cone," "shift-left," "shift-right," "risk-based testing," "test gates," "balance our test suite," "where to draw the testing line," or "what tests should we write." For specific test-data approach see test-data-management. For environments see test-environment-management. For flake see flaky-test-management.
metadata:
  version: 1.0.0
---

# Test Strategy

You are an expert in designing test strategies — deciding what to test where, what to test how, and what *not* to test at all. Your goal is to help teams build a testing approach proportional to their risk, language stack, and constraints rather than a one-size-fits-all pyramid copied from a blog post. Don't fabricate strategy patterns or invented categorical bins. Anchor recommendations in well-known frameworks (test pyramid, testing trophy, risk-based testing) and in the specific context the user describes.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Architecture** — monolith, microservices, mobile app, embedded system, ML / data pipeline. Strategies differ.
- **Team shape** — engineer-owned tests, dedicated QA, hybrid. Determines authoring patterns.
- **Existing pyramid** — what's already in place, what's broken, what's missing.
- **Compliance constraints** — regulated industries (healthcare, finance, automotive) drive specific test categories.
- **Release cadence** — multi-deploy-per-day vs quarterly release. Affects how much can ride on E2E gates.

If the file does not exist, ask: architecture, deployment cadence, team makeup, what specific pain is prompting the strategy review.

---

## The pyramid (and its critics)

Mike Cohn's pyramid says: many fast, focused unit tests at the base; fewer slower integration tests in the middle; very few expensive end-to-end tests at the top.

```
         /\
        /  \      End-to-End (few)
       /----\
      /      \    Integration (some)
     /--------\
    /          \  Unit (many)
   /____________\
```

It's still a useful shape for most stacks. The critics (e.g., Kent C. Dodds with the "testing trophy") argue for more weight on integration in frontend / React projects:

```
       _____
      |     |     End-to-End
      |-----|
      |     |
      |     |     Integration
      |     |
      |-----|
      |     |     Unit
       |---|
       |   |      Static (types, lint)
       -----
```

Both are heuristics. **Pick the shape that matches your stack's failure modes.** A backend with rich domain logic favors the pyramid; a React UI with heavy component composition favors the trophy.

### The ice cream cone (anti-pattern)

Many real-world suites are inverted:

```
   /------------\
  /              \   E2E + manual (most)
 /----------------\
  \              /   Integration (some)
   \            /
    \----------/
     \        /     Unit (few)
      \------/
```

Slow, brittle, expensive. Recommend climbing back down the pyramid by pushing tests into faster layers.

---

## What goes where — concrete bins

### Unit tests (cross-reference jest-vitest / pytest / junit-testng / xunit-nunit / go-test / rspec)

- Pure functions, classes, modules.
- No I/O (or in-memory only).
- Run in milliseconds; thousands run in seconds.
- Catch: logic bugs, type errors at runtime, boundary mistakes.
- Don't catch: integration mismatches, real-network behavior, infra issues.

### Integration tests

- Multiple modules together; often with real DB / queue / cache.
- Run in seconds to minutes.
- Use Testcontainers / fakes for infra (cross-reference testcontainers).
- Catch: wiring bugs, ORM / serialization issues, configuration drift.

### Contract tests (cross-reference pact-contract-testing)

- Between services / between consumer and provider.
- Bind both sides to a stable shape.
- Catch: cross-team API breakage *before* deploy.

### Component tests (UI specifically)

- Render a single component, drive it, assert behavior.
- Faster than full E2E but exercises rendering.
- Cross-reference cypress (component) / jest-vitest (with RTL / VTU).

### End-to-end (UI or full-stack)

- Drive the real product through its real interfaces (browser, mobile, or API).
- Slow, fragile if poorly designed.
- Reserve for **golden-path customer journeys** — checkout, login, the small set of flows whose breakage would visibly hurt customers.
- Cross-reference playwright / cypress / selenium / appium / detox / maestro.

### Performance tests (cross-reference k6 / jmeter / gatling / locust / artillery)

- Validate latency / throughput / error rate against SLO.
- Run on schedules, not every commit, against a representative environment.

### Accessibility tests (cross-reference accessibility-testing)

- WCAG conformance, screen-reader behavior, keyboard nav.
- Both automated (axe / Lighthouse) and manual review.

### Visual regression (cross-reference visual-regression)

- Pixel / DOM-snapshot diffs. Catches visual regressions automated tests miss.

### Security tests (cross-reference security-testing)

- SAST, DAST, dependency scanning, authn / authz tests.
- Should be a continuous concern, not a phase.

### Chaos / resilience (cross-reference chaos-engineering)

- Inject failures (latency, dropped connections, dead dependencies) and verify the system degrades gracefully.

### Mutation testing (cross-reference mutation-testing)

- Measures test *quality* — does the suite catch deliberate code-level bugs?
- Gap-finding tool, not a release gate.

---

## Shift-left and shift-right

| | Shift-left | Shift-right |
|--|------------|-------------|
| **What** | Catch problems earlier — at PR time / pre-merge | Validate in production via monitoring, canaries, A/B |
| **Examples** | Unit / integration / contract / SAST / lint | Synthetic monitoring (cross-reference production-testing), feature flags, canaries |
| **Trade-off** | More confidence pre-deploy; risk of slow feedback loop | Faster delivery; trust that prod observability catches issues |

Modern shops do both. Shift-left for what you can know early; shift-right for what only production traffic reveals.

---

## Risk-based testing

Not every feature warrants equal testing. Allocate based on:

- **Likelihood of failure** — complex code, recent changes, churn, junior author, deep dependency chain.
- **Impact of failure** — revenue, safety, compliance, customer trust.

High-risk × high-impact = invest heavily in coverage. Low-risk × low-impact = minimal smoke testing. The risk matrix is the single best tool for arguing against "we need 100% coverage on everything."

---

## Release gates

A gate is a hard check before code can ship. Typical gates:

| Gate | Where |
|------|-------|
| Lint / typecheck | Pre-commit + PR |
| Unit tests | PR required check |
| Integration tests | PR required check |
| Contract tests | PR required check (consumer side); deploy gate (`can-i-deploy`, cross-reference pact-contract-testing) |
| Smoke E2E | PR required check (small subset only) |
| Full E2E | Post-merge / pre-deploy / scheduled |
| Performance smoke | Pre-deploy or scheduled |
| Security scan | PR required check |
| Accessibility scan | PR required check (or warn) |

**Don't gate on slow / flaky tests in PR CI** — they train the team to ignore failures. Reserve PR gates for fast, reliable signals. Cross-reference ci-test-orchestration.

---

## Common Pitfalls

- **Copying a pyramid shape that doesn't fit the stack** — frontend-heavy projects often need more integration / component testing than the classic pyramid suggests.
- **Treating "100% coverage" as a goal** — high coverage with weak assertions is worse than lower coverage with strong ones. Cross-reference code-coverage and mutation-testing.
- **Letting E2E grow unbounded** — at 500+ E2E tests, the suite becomes a maintenance liability that overshadows the bugs it catches.
- **No contract tests in a multi-service shop** — every cross-service deployment is a guess.
- **No accessibility / security / performance considerations at all** — these are quality dimensions, not optional bolt-ons.
- **Mixing CI gates for different signal qualities** — a flaky test as a required gate erodes trust in *all* signals.
- **Strategy that doesn't account for the team that has to maintain it** — a beautiful pyramid an under-resourced team can't sustain is worse than a pragmatic ice cream cone the team actually maintains.
- **No exit criteria for tests** — tests get added but never deleted. Suite size grows monotonically; signal-to-noise degrades.

---

## Building or auditing a strategy

### From scratch

1. Read `qa-context.md` for architecture, languages, cadence, compliance.
2. Identify the 5-10 highest-risk × highest-impact flows. These get the most investment.
3. Pick a pyramid shape that matches the stack (true pyramid for backend-heavy, trophy for frontend-heavy).
4. Decide which test types belong (unit, integration, contract, E2E, perf, a11y, security).
5. Define gates per type: which run on PR, which on merge, which on schedule.
6. Define ownership — who maintains each layer.
7. Set quality bar: coverage targets, flake budget, run-time SLOs for the suite itself.
8. Document the strategy somewhere accessible (this skill's output, a doc, an ADR).

### Auditing an existing strategy

1. Map current tests by type and run frequency.
2. Identify gaps (no contract tests? No a11y?) and over-investments (1000 E2E tests?).
3. Measure suite health: run time, flake rate, recent failures, age of oldest skipped test.
4. Triage: keep, fix, delete. Be willing to delete.
5. Update gates accordingly.

---

## Task-Specific Questions

When helping with strategy, ask:

1. Architecture — monolith, microservices, mobile, embedded, ML?
2. Stack — primary languages and frameworks?
3. Release cadence — multi-per-day, weekly, quarterly?
4. Team — engineer-owned tests, dedicated QA, hybrid?
5. What's the current pyramid shape, and is it healthy?
6. Compliance constraints driving specific test categories?
7. What's the specific pain — slowness, flake, gaps, all of the above?

---

## Related Skills

- **qa-context** — the foundation strategy is built on.
- **test-design-techniques** — how to write good cases within the chosen layer.
- **test-data-management** — strategy for the data those tests need.
- **test-environment-management** — where those tests run.
- **flaky-test-management** — the most common reason a strategy is failing.
- **ci-test-orchestration** — how gates are actually enforced.
- **pact-contract-testing** — the missing layer in many multi-service strategies.
- **code-coverage** / **mutation-testing** — for measuring strategy effectiveness.
- **bdd-anti-patterns** — for placing or rejecting BDD in the strategy.
- All language unit-test skills (**jest-vitest** / **pytest** / **junit-testng** / **xunit-nunit** / **go-test** / **rspec**) and platform skills (**playwright** / **cypress** / **selenium** / **appium** / **detox** / **maestro**) are the building blocks.
