---
name: flaky-test-management
description: When the user wants to detect, triage, root-cause, quarantine, or eliminate flaky tests. Use when the user mentions "flaky tests," "intermittent failures," "test instability," "retry strategy," "test quarantine," "deflaking," "test reliability," "skip flaky test," "test that passes locally fails in CI," or "tests pass on rerun." For deeper environment causes see test-environment-management. For data-related flake see test-data-management. For strategy-level coverage see test-strategy.
metadata:
  version: 1.0.0
---

# Flaky Test Management

You are an expert in diagnosing and eliminating test flakiness — tests that fail intermittently for reasons unrelated to the production code they purport to validate. Your goal is to help engineers detect flakes early, triage them honestly, root-cause the underlying issue rather than mask it with retries, and maintain a healthy test suite long-term. Don't fabricate flake-detection tooling or invented categorical bins.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Current flake rate** — % of CI runs that have at least one flake. Anything above ~2-3% erodes team trust in the suite.
- **Layer where flakes concentrate** — E2E flakes (most common), integration flakes, unit flakes (rare; usually concurrency or randomness).
- **Detection mechanism** — explicit flake-detection tooling, or eyeballed by humans who notice patterns.
- **Retry policy** — none, retry-on-failure (masks flake), retry-with-classification (better).
- **Quarantine policy** — `@flaky` tags piling up, scheduled re-triage, or no policy at all.

If the file does not exist, ask: current flake rate, layer where flakes concentrate, retry policy, and what specific pain is driving the conversation.

---

## What flake actually is

A test is flaky if **running the same test against the same code produces different results**. Same input, same code, different outcome — that's flake. By definition, flaky tests provide zero signal about the code under test.

Three categories:

1. **Genuinely flaky test** — the test code itself has a race / timing / order dependence. Fixing the test removes the flake.
2. **Test exposing a real bug** — the production code has a race / timing issue. The test is correctly detecting it. Fixing the *production code* removes the flake.
3. **Environmental flake** — the test is fine, the production code is fine, but the environment (network, CI host, shared resource) is unreliable.

The single most common mistake is treating #2 as #1.

---

## Sources of flake

### Async / timing

- `sleep(2)` instead of waiting on a condition.
- Polling without a generous timeout.
- Assertions on intermediate state in a fast UI.
- Race between event handler and assertion.

Cross-reference: every UI / E2E skill (**playwright**, **cypress**, **selenium**, **webdriverio**, **detox**, **appium**, **espresso**, **xcuitest**, **maestro**) has its own auto-wait or wait pattern. **Sleep is almost always wrong.**

### Order dependence

- Test A sets global state; test B reads it.
- Per-class fixtures mutated by tests.
- Shared DB rows with mutable state.

Detect: run with random order. `pytest-randomly`, `rspec config.order = :random`, `vitest --shuffle`. If randomization surfaces failures, the tests are order-dependent.

### Parallel-execution races

- Two workers create the same identifier.
- Shared port, shared file path, shared cache.
- Test data not partitioned by worker (cross-reference test-data-management).

Detect: run with `pytest -n auto`, `jest --maxWorkers=8`, etc. If serial passes but parallel flakes, isolation is the issue.

### Data leakage

- Previous test's data still present.
- Production data accidentally pulled in via a fixture.
- Faker without a seed producing colliding values.

Cross-reference test-data-management.

### Network / external services

- Calling a real third-party API that throttles.
- Tests against a real staging that's intermittently down.
- DNS resolution variance.

Fix at source: mock externals (cross-reference wiremock, pytest-api response mocking) or use Testcontainers for local-equivalent infra.

### Environment

- CI host slower than dev laptop (timeouts hit).
- `/dev/shm` small in containers (Chromium / Postgres misbehave).
- Concurrent jobs on shared CI box compete for CPU.

Cross-reference test-environment-management.

### Real concurrency bugs in production code

- Race conditions revealed by tests touching the same data structure.
- Cache invalidation races.
- Connection pool exhaustion under parallel load.

These are the ones you should be grateful the test caught. **Don't disable the test — fix the bug.**

---

## Detection

### CI-level flake detection

Tools that mark a test as flaky when it passes after a retry:

- **Datadog CI Visibility / Test Optimization** — commercial, language-agnostic.
- **Buildkite Test Analytics** — Buildkite-specific.
- **CircleCI Test Insights**.
- **GitHub Actions** — manual reporting via JUnit XML aggregators (Trunk, etc.).
- **Hand-rolled**: track JUnit XML per build, alert when a test's pass/fail history is inconsistent on the same commit.

The key metric: **flake rate per test**. A test that fails 3% of the time is meaningfully worse than a test that fails 0.1% of the time.

### Local detection

Run the suspect test 100 times locally:

```bash
pytest --count=100 path/to/test.py::test_thing
jest --testPathPattern=login --runInBand --reporters=default --silent  # rerun manually
mvn -Dtest=LoginTest -Dinvocation.count=100 test
go test -count=100 -run TestThing ./...
```

If it ever fails, it's flaky. If it consistently passes for 100 runs but flakes in CI, the CI environment is contributing — investigate there.

---

## Triage policy

When a flake is detected:

1. **Capture artifacts** — failure stack trace, logs, screenshots, traces. Required for any chance of root-cause.
2. **Categorize**:
   - Real bug in production code → file a bug, leave the test in.
   - Test bug → fix the test.
   - Environment issue → investigate infra.
   - Cause unknown → quarantine WITH tracking issue + owner + deadline.
3. **Don't just retry-and-forget** — retry hides the signal.

---

## Retry strategies — when they help, when they hurt

| Retry style | When it's OK |
|-------------|--------------|
| **No retries** | Ideal. Forces flakes to be fixed. |
| **Retry per test, max 1** | Acceptable for known-noisy environments; report flakes separately. |
| **Retry per test, max 3+** | Almost always wrong. Masks systemic issues. |
| **Retry whole suite** | Wrong. Hides ordering / state bugs. |
| **Smart retry (only specific error classes)** | Useful for known-flaky network glue. |

If you must retry, ensure the retry is **observable**: a passed-on-retry test is reported as "passed but flaky" in CI, not as a clean pass. Otherwise the flake signal disappears.

---

## Quarantine — necessary but dangerous

Quarantine = mark a test `@flaky` or skip it temporarily so it doesn't block CI. **Quarantine without a policy is just deletion in slow motion.**

A working quarantine policy:

1. Every quarantined test has a tracking issue.
2. Every quarantined test has an assigned owner.
3. Every quarantined test has a deadline.
4. Past deadline: re-evaluate (un-quarantine + fix, or delete the test).
5. Monthly: review the quarantine list.

Otherwise, the quarantine list grows monotonically and becomes invisible debt.

---

## Root-cause patterns

### Pattern 1: `sleep` instead of wait

```ts
// Bad
await page.click('#submit');
await new Promise(r => setTimeout(r, 2000));
expect(await page.textContent('#welcome')).toBe('Welcome');

// Good
await page.click('#submit');
await expect(page.getByTestId('welcome')).toHaveText('Welcome');
```

Cross-reference: every UI skill.

### Pattern 2: Time-of-day or DST

Test fails on certain dates / hours. Fix with frozen time (cross-reference test-data-management).

### Pattern 3: Cleanup didn't happen

Test A creates a user; test B asserts `users.count == 0`. Add per-test cleanup or transactional rollback.

### Pattern 4: Concurrency in production code

Test pounds a service; sometimes a request hits a moment where two writes interleave. The test correctly detects a real concurrency bug. Fix the production code, not the test.

### Pattern 5: Browser / driver / Node version drift

Test passed on Playwright 1.40, fails intermittently on 1.45. Pin versions, check release notes.

### Pattern 6: Shared resource exhaustion

Connection pool, file descriptors, ports. Increase limits or partition.

### Pattern 7: External service variance

API latency variance hits a timeout. Either raise the timeout (if realistic) or mock the call.

---

## A flake-elimination workflow

1. **Detect** — flake-detection tooling reports a test failing X% of the time.
2. **Reproduce locally** — run with `--count=100` or equivalent. If it never repros locally, suspect environment.
3. **Capture** — failure must include logs, stack trace, screenshots, environment info.
4. **Categorize** — test bug, prod bug, or env.
5. **Fix at the right layer** — don't fix the test if the bug is in prod.
6. **Verify** — run the fixed test 100 times consecutively, must pass every time.
7. **Land** — close tracking issue, remove `@flaky` tag.

If a test has been quarantined for 90+ days, the honest move is usually to delete it — by that point, no one trusts it, no one's actively maintaining it, and the team is implicitly relying on other coverage.

---

## Common Pitfalls

- **Calling everything "flaky"** — sometimes the production code is racy. Don't blame the test reflexively.
- **High retry limits** — masks the signal you need.
- **Quarantine without policy** — tests pile up, signal degrades, eventually the suite is half-quarantined.
- **No artifact capture** — every flake is a black box.
- **Disabling a flaky test that catches a real bug** — production incident waiting to happen. Verify the cause before disabling.
- **Ignoring environment as a cause** — slow CI hosts, small `/dev/shm`, shared resources cause real flake.
- **Running flake-finder once and declaring victory** — flakes recur; detection is continuous, not one-shot.
- **Treating flake rate as a vanity metric** — it's a leading indicator of suite health. Track it; aim for sub-1%.
- **Letting `--retries 3` become CI's default** — the team stops investigating; flakes never get fixed.

---

## Task-Specific Questions

When helping with flake, ask:

1. What's the current flake rate?
2. Layer the flakes concentrate at — unit / integration / E2E?
3. Current retry policy — none, per-test, per-suite, smart?
4. Existing quarantine count — and is there a policy?
5. Detection tooling — vendor, hand-rolled, none?
6. Pattern: failing locally too, or only in CI?
7. Are flakes correlated with time of day, parallelism level, specific environments?

---

## Related Skills

- **test-data-management** — data leakage / collision is a top flake cause.
- **test-environment-management** — environment as flake source.
- **ci-test-orchestration** — for retry policies, shard config, smart routing.
- **test-strategy** — sometimes flake is a sign the strategy is wrong (too much E2E, too few units).
- All E2E skills (**playwright** / **cypress** / **selenium** / **webdriverio** / **detox** / **appium** / **espresso** / **xcuitest** / **maestro**) — most flake hides at this layer.
- **wiremock** / **pact-contract-testing** — mocking externals removes a class of flake.
- **chaos-engineering** — controlled chaos as a way to surface latent race conditions before production does.
