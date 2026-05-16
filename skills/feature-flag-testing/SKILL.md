---
name: feature-flag-testing
description: When the user wants to test code controlled by feature flags — variation coverage, flag combinations, canary / progressive rollout, A/B test correctness, kill-switch behavior. Use when the user mentions "feature flags," "feature toggles," "LaunchDarkly," "Split.io," "Unleash," "ConfigCat," "Flagsmith," "Optimizely," "Statsig," "canary," "progressive delivery," "ramp," "A/B test," "kill switch," "flag combinations," or "dark launch." For production-side verification see production-testing. For overall strategy see test-strategy.
metadata:
  version: 1.0.0
---

# Feature Flag Testing

You are an expert in testing feature-flag-driven code — verifying that each variation works, that flag combinations don't collide, that gradual rollouts behave as designed, and that kill-switches reliably stop bad code. Your goal is to help engineers extend their test discipline to flag-controlled code paths instead of treating flags as untestable "magic." Don't fabricate vendor APIs or flag-evaluation rules. When uncertain, point the reader to the vendor's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Vendor / library** — LaunchDarkly, Split.io, Unleash, ConfigCat, Flagsmith, Statsig, Optimizely, or self-hosted. SDKs and evaluation semantics differ.
- **Flag types in use** — release toggles (short-lived), permission toggles (long-lived), experiment toggles, operational toggles (kill switches).
- **Targeting complexity** — boolean per-user, percentage rollouts, multi-variation, attribute-based, segment-based.
- **Flag count** — 50 flags is manageable; 500 flags is its own discipline.
- **Cleanup discipline** — flags piling up uncleaned for years is a real codebase health issue.

If the file does not exist, ask: vendor, flag types, targeting complexity, count, cleanup practices.

---

## Why flag testing is non-obvious

Flag-controlled code introduces hidden complexity:

- **Variation coverage**: a flag with 2 values has 2 paths to test. 5 flags with 2 values = 32 combinations.
- **Default behavior**: what happens when the SDK fails or the flag evaluator is unreachable? Tests rarely cover this.
- **Stale flags**: flag is "fully rolled out" but the off-branch code still exists, untested, until someone re-enables it accidentally.
- **Combinatorial drift**: flag A's variations interact with flag B's variations in unintended ways.
- **Targeting bugs**: 50% rollout actually delivers to 70% because the hashing isn't uniform.

Test-strategy implication: flagged code is a multi-variant code path, and your tests need to know that.

---

## What to test

### 1. Each variation independently

For every flag, write tests covering each variation:

```ts
describe('checkout flow', () => {
  test('shows new design when newCheckout=true', async () => {
    setFlag('newCheckout', true);
    // ... assert new design renders
  });

  test('shows old design when newCheckout=false', async () => {
    setFlag('newCheckout', false);
    // ... assert old design renders
  });
});
```

`setFlag(...)` is whatever your SDK exposes for test overrides (LaunchDarkly's `TestData`, Split's `localhostMode`, etc.).

### 2. Default / fallback behavior

What happens when the SDK can't reach the server? Tests should verify:

- The default value (compiled into the code) is used.
- The system doesn't crash or hang waiting for the SDK.
- Errors are logged but don't propagate to user-visible failures.

This is a real production-incident class — flag service outages have caused real outages.

### 3. Flag combinations (selectively)

You can't test all 2^N combinations. Test the meaningful ones:

- The combinations expected in production (e.g., new checkout + new payment).
- Combinations that should be mutually exclusive (assert one is impossible if both are on).
- Combinations historical bugs revealed.

Use pairwise testing if you have many flags (cross-reference test-design-techniques).

### 4. Targeting rules

If a flag uses targeting (50% rollout, "users in segment X get variation Y"):

- Verify the assignment is stable per user (same user gets the same variation across sessions).
- Verify percentage distributions over a sample (e.g., 1000 simulated users; ~500 should get variation A).
- Verify segment membership rules.

Targeting tests are often integration tests against a real SDK in test mode.

### 5. Kill switch behavior

Operational kill switches (e.g., "disable_payments=true") must work reliably and fast. Test:

- Flipping the flag halts the targeted behavior within the SDK refresh window.
- Already-in-progress requests handle the flip gracefully.
- Failing back is also tested — re-enabling restores normal behavior.

Cross-reference chaos-engineering for the runtime resilience aspect.

---

## How to override flags in tests

| Vendor | Test mechanism |
|--------|----------------|
| **LaunchDarkly** | `TestData` data source or `LDClient.builder().offline(true).testData(...)`. |
| **Split.io** | Local mode (`Split.LOCALHOST = true`) with a YAML file. |
| **Unleash** | `InMemoryBackup` strategy or test client with hardcoded toggles. |
| **ConfigCat** | `ManualPollingMode` with local override file. |
| **Flagsmith** | Local override / offline mode. |
| **Statsig** | Local mode / `bootstrap` with mock data. |
| **Custom flag service** | Provide an in-memory implementation of the flag-evaluation interface. |

The right pattern is **dependency injection at the flag-client level** — production uses the real client, tests substitute a controllable one. Cross-reference jest-vitest / pytest / junit-testng for the DI patterns.

---

## Patterns

### Unit test pattern

```ts
import { TestData } from 'launchdarkly-node-server-sdk';

let flags: TestData;

beforeEach(() => {
  flags = TestData();
  ldClient = LaunchDarkly.init('sdk-key', { updateProcessor: flags });
});

test('feature on', () => {
  flags.update(flags.flag('newCheckout').valueForAll(true));
  // ... test
});

test('feature off', () => {
  flags.update(flags.flag('newCheckout').valueForAll(false));
  // ... test
});
```

### Integration test pattern

Run the actual SDK in a test mode against a mock backend or a real backend with a known config. Validates SDK behavior, not just the code that calls it.

### E2E test pattern

For E2E with flags:

- Set the flag for the test user via SDK API or admin API.
- Run the test.
- Reset the flag (or use a per-test target user that won't affect others).

Avoid global flag changes during E2E — they affect parallel tests and other users.

---

## Canary / progressive rollout testing

For gradual rollouts:

- **Pre-deploy**: tests cover both `on` and `off` paths.
- **Initial deploy at 0%**: production deploys with flag off. No user effect. Verify the code is in place via internal endpoint or admin flag flip for a test user.
- **1% rollout**: monitor closely. Compare metrics (error rate, latency, conversion) between flagged and non-flagged users.
- **Gradual ramp**: 5% → 25% → 50% → 100%. Each step is a checkpoint.
- **Kill-switch ready**: at any point, flipping the flag off must halt user exposure within SDK refresh window (typically seconds-to-minutes).

Cross-reference production-testing for the monitoring side.

---

## A/B test correctness

A/B tests are flag-driven experiments. Testing concerns:

- **Random assignment is actually random.** Hash-based assignment can have surprising distributions.
- **Same user gets the same variation** across sessions (sticky assignment).
- **No spillover**: variation A users don't see variation B's behavior partway through their session.
- **Metric attribution**: events from variation A are tagged with variation A even if the user's variation changes.
- **Statistical significance** is the analyst's domain, but tests should ensure the *infrastructure* doesn't bias the experiment.

---

## Cleaning up flags

The dirty secret of feature-flag use: most teams accumulate flags faster than they remove them. Tests on dead flag branches add cost without value.

Patterns:

- **Flag inventory** — quarterly audit. Each flag has an owner, a state (rolling out / fully on / fully off / sunset), and a removal date.
- **Lint rule** — flags referenced in code but with no recent reads in the flag service. Or vice versa.
- **Vendor-provided "stale flag" detection** — LaunchDarkly, Statsig, others surface unused flags.
- **Removal PRs include**: dead variation removal, tests on dead variations deleted, monitoring updated.

A 500-flag codebase with 50 active and 450 dead is a maintenance disaster.

---

## Common Pitfalls

- **Only testing the "on" path.** The "off" path is also production code; test it.
- **No default-value tests.** SDK outage = silent failure.
- **Hardcoded flag values in tests bypassing the SDK.** Tests pass; real SDK integration breaks in production.
- **Shared flag state between parallel tests.** Test A flips the flag; test B sees the flipped value.
- **Untested flag combinations.** Flag A + Flag B = an unintended bug class.
- **Dead flag branches.** Code that hasn't run in production for 18 months; latent bug if the flag is re-enabled.
- **E2E tests changing global flag state.** Breaks other parallel runs and possibly other users.
- **No monitoring tied to flag flips.** Flip happens, metrics not correlated, regressions hard to attribute.
- **Treating flags as untestable.** They're testable; just need explicit override mechanisms.
- **Kill switch never tested.** When you need it, it silently doesn't work.

---

## Building a flag-testing discipline

1. **Inventory current flags.** Categorize by type (release / permission / experiment / operational).
2. **Identify flags lacking variation tests.** Add tests for the off path.
3. **Add a default-fallback test pattern.** SDK unreachable → expected behavior.
4. **Set up SDK test mode** so tests can deterministically override flags.
5. **Pair release flags with monitoring.** Cross-reference production-testing for the runtime metrics.
6. **Schedule a quarterly flag cleanup.**
7. **Add a CI lint** that catches new flags without tests (or flag-referencing PRs without test coverage).

---

## Task-Specific Questions

When helping with feature flag testing, ask:

1. Vendor or library?
2. Flag count, growing or stable?
3. Flag types — release / permission / experiment / operational?
4. Targeting complexity?
5. SDK test mode in use?
6. Cleanup discipline today?
7. Production monitoring tied to flag flips?

---

## Related Skills

- **production-testing** — for the runtime side of progressive rollout.
- **test-strategy** — flagged code is multi-path code; strategy needs to account for that.
- **test-design-techniques** — pairwise for flag-combination coverage.
- **chaos-engineering** — kill-switch behavior is a resilience concern.
- **ci-test-orchestration** — for running flag-variation matrices.
- **flaky-test-management** — flags + shared state is a major flake source.
- All language unit-test skills for the test-side override mechanisms.
- **llm-eval-testing** — flag-controlled prompts / models need eval coverage across variations.
