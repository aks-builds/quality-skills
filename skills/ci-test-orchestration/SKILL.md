---
name: ci-test-orchestration
description: When the user wants to design, audit, or optimize how tests run in CI — sharding, matrix builds, parallelism, retry policy, test selection, artifact handling, and gate strategy. Use when the user mentions "CI test orchestration," "test sharding," "matrix builds," "parallel tests in CI," "GitHub Actions matrix," "GitLab CI parallel," "Buildkite parallelism," "test selection," "test impact analysis," "CI retries," "test artifacts," or "speeding up CI." For environment specifics see test-environment-management. For cloud-grid mobile/browser see cloud-test-grids. For Grid see selenium-grid.
metadata:
  version: 1.0.0
---

# CI Test Orchestration

You are an expert in orchestrating tests within CI/CD pipelines — sharding, matrix builds, retry policy, test selection, artifact handling, and gate enforcement. Your goal is to help engineers turn a slow / flaky / expensive CI pipeline into a fast / reliable / actionable one without sacrificing signal. Don't fabricate CI provider features or YAML keys. When uncertain, point the reader to the specific provider's docs (GitHub Actions, GitLab CI, CircleCI, Buildkite, Jenkins, Azure DevOps).

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **CI provider** — GitHub Actions, GitLab CI, CircleCI, Buildkite, Jenkins, Azure DevOps. Capabilities and syntax differ.
- **Current pain** — runtime, cost, flake, gate hygiene, queueing.
- **Test distribution** — split between unit / integration / E2E / contract / perf. Different layers need different orchestration.
- **Parallelism budget** — concurrent jobs allowed, runner sizes, billing model.
- **Existing artifacts** — what gets uploaded, what gets thrown away.

If the file does not exist, ask: CI provider, current pipeline runtime, biggest pain point, runner constraints.

---

## The orchestration spectrum

```
   Single sequential job
     ↓ split into stages
   Stages (build → test → deploy)
     ↓ parallelize within stage
   Parallel jobs per test category
     ↓ shard each category
   Sharded matrix execution
     ↓ smart selection
   Test impact analysis (run only affected tests)
```

Most CI starts at "single job" and grows toward "sharded matrix" as it scales. Test impact analysis is the last optimization most teams reach.

---

## Sharding

**Sharding** = splitting one test suite into N subsets, running each on a separate worker, aggregating results.

### Native tool support

| Runner | Sharding |
|--------|----------|
| Jest | `--shard=1/4`, `--shard=2/4`, etc. |
| Vitest | `--shard=1/4` |
| Playwright | `--shard=1/4` |
| pytest | `pytest-xdist` for in-process; for cross-machine, use `--collect-only` + split + run subset |
| Cypress | Via Cypress Cloud (auto-parallelization with `--record --parallel`) or via `cypress-split` plugin |
| Go | `go test -p N` (in-process); cross-machine via package partitioning |
| RSpec | `parallel_tests` gem; or split by file list |
| Maven / Gradle | Test-runner-level parallelism plus per-module CI matrix |

### Matrix integration

```yaml
# GitHub Actions
jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npx playwright test --shard=${{ matrix.shard }}/4
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: results-shard-${{ matrix.shard }}
          path: results/
```

Pattern is similar in GitLab (`parallel: 4` + `CI_NODE_INDEX` / `CI_NODE_TOTAL`), CircleCI (`parallelism: 4` + `circleci tests split`), Buildkite (`parallelism: 4`).

### Sharding pitfalls

- **Uneven distribution** — some shards finish in 2 min, others in 15. Causes: file-based splits hit large files; tests with large skew. Use the test runner's built-in sharding (which tries to balance) over hand-split lists.
- **Shared state across shards** — DB rows, shared S3 buckets, identical email addresses. Cross-reference test-data-management and flaky-test-management.
- **Aggregating reports** — each shard produces a JUnit XML; aggregate with a downstream job. Cross-reference test-reporting.

---

## Matrix builds

Test the same code against multiple versions / platforms.

```yaml
strategy:
  matrix:
    node: [18, 20, 22]
    os: [ubuntu-latest, macos-latest, windows-latest]
    exclude:
      - { node: 18, os: macos-latest }
```

Matrix dimensions worth considering:

- Node / Python / JVM / .NET version.
- Operating system.
- Database version (Postgres 14 / 15 / 16).
- Browser (chromium / firefox / webkit).
- Locale.

Don't matrix everything — each cell costs CI minutes. Pick matrix axes where compatibility actually matters.

---

## Retry policy

The single most consequential CI decision: **what do you do when a test fails?**

| Policy | Effect |
|--------|--------|
| No retries | Strict signal. Best for healthy suites. Surfaces real flake. |
| Retry once on failure | Acceptable if flake is reported separately (not silently hidden). |
| Retry 3+ times | Almost always wrong. Masks systemic issues. |
| Retry only on specific error patterns | Acceptable for known-flaky network glue. |

If retry is necessary:

- **Mark retried tests as flaky** in the report — don't show them as clean passes.
- **Track flake rate per test** over time (cross-reference flaky-test-management).
- **Set a budget** — if flake rate stays above 1-2%, escalate.

Cross-reference flaky-test-management.

---

## Required vs optional gates

```
PR gates (must pass to merge):
- Lint / typecheck (fast, deterministic)
- Unit tests (fast, deterministic)
- SAST scan (fast subset)
- Smoke E2E (5-10 critical flows)
- Contract tests (consumer side)

Soft gates (warn but don't block):
- Coverage delta
- Performance microbenchmark
- Accessibility scan

Post-merge / scheduled:
- Full E2E suite
- Full perf suite
- Full DAST scan
- Mutation testing on changed files
```

Cross-reference test-strategy for the placement reasoning.

**Never gate on a slow, flaky check.** It trains the team to ignore failures.

---

## Test selection / impact analysis

Run only tests affected by the change.

- **Jest `--changedSince` / `vitest related`** — JS/TS, file-graph-based.
- **`pytest --testmon`** — Python, plugin-based.
- **CodeQL / Bazel** — heavyweight, exact dependency graph.
- **Per-language tools** — Knapsack Pro (Ruby), Test Impact Analyzer (.NET).
- **Commercial tools** — Launchable, CircleCI Test Insights, Datadog CI Test Optimization.

Trade-off: faster CI, but you can miss bugs that span unexpected coupling. Most teams use selection on PR runs and full suite on merge / nightly.

---

## Caching

Speed wins:

- **Dependency caches** — `~/.m2`, `~/.gradle`, `~/.npm`, `~/.cache/pip`, `~/.cargo`.
- **Build outputs** — Docker layer cache, Turborepo / Nx remote cache, Bazel.
- **Test result cache** — Jest's `--cache`, Vitest's cache.
- **Test fixture caches** — pre-baked Postgres / Redis dumps.

Cache keys must invalidate on dependency changes. `hashFiles('**/package-lock.json')` style keys are the standard pattern.

Common pitfall: cache keys that never invalidate → stale broken cache, mystery failures.

---

## Artifact handling

Every CI run should produce, on failure:

- **JUnit XML** — for CI's native test view.
- **HTML report** — for human triage (Allure, Playwright report, Cucumber report).
- **Screenshots / videos** — UI test failures need visual context.
- **Logs** — service logs, browser console, test runner verbose output.
- **Traces** — Playwright traces, distributed traces.

Upload as artifacts via the CI's artifact store. Set retention (most CIs default to 30-90 days; that's usually fine).

For broader cross-run analysis, push test results to a central tool (Datadog CI Visibility, Buildkite Test Analytics, Trunk, etc.).

---

## Caching test data

For integration tests that depend on a DB:

- Restore from a snapshot at job start instead of running migrations + seeds.
- Testcontainers with image-cache enabled (cross-reference testcontainers).
- Postgres `template` databases for sub-second clones.

For E2E:

- Reuse auth state across tests via storageState (Playwright) or `cy.session` (Cypress), rather than logging in per test.

---

## Reducing CI cost

| Lever | Effect |
|-------|--------|
| Right-size runners | Don't pay for 16-core when 4 will do. |
| Use spot / preemptible runners | 60-80% cheaper; tolerate occasional retry. |
| Cancel-on-new-push | Don't run obsolete commits. (`concurrency` group in GHA.) |
| Schedule heavy runs off-peak | Spot pricing + perceptible team latency. |
| Test selection on PR | Run only what changed. |
| Cache aggressively | Avoid re-downloading dependencies. |
| Smaller Docker images | Faster pulls. |
| Self-hosted runners | When volume justifies the ops cost. |

Cost discipline matters — uncontrolled CI bills creep into thousands per month silently.

---

## Common Pitfalls

- **Single giant job** — no parallelism, slow feedback.
- **Matrix explosion** — 5 node versions × 3 OS × 2 DB versions = 30 cells, most of them irrelevant.
- **Sharding with shared mutable state** — every PR's parallel jobs collide.
- **Required checks that are flaky** — team starts force-merging.
- **No `concurrency` / cancel-on-new-push** — every push spawns a new full run that races against the previous.
- **Artifacts never cleaned up** — storage bill grows.
- **Cache keys that never invalidate** — stale, mysterious failures.
- **CI minutes hidden in invisible places** — preview env provisioning, container builds.
- **Required test report aggregation that's not actually wired up** — shards run, results invisible because no aggregator.
- **Test impact analysis on first run** — adopted before the suite is healthy; broken signal.
- **Smart retry that retries everything** — turns flake-blocking gates into flake-tolerating gates silently.

---

## Auditing a slow CI pipeline

1. **Profile current runs** — what stage takes how long?
2. **Identify the long pole** — typically full E2E.
3. **Shard it.** — `--shard=1/N` on the long pole; matrix across N workers.
4. **Cache what's cacheable** — deps, Docker layers, test fixtures.
5. **Right-size matrix** — drop redundant cells.
6. **Move expensive checks out of PR** — schedule nightly.
7. **Add concurrency.cancel-on-new-push.**
8. **Measure again** — confirm savings before adding more complexity.

Don't optimize prematurely. A 15-min pipeline with strong signal beats a 3-min pipeline that hides flake.

---

## Task-Specific Questions

When helping with CI orchestration, ask:

1. CI provider — GitHub Actions, GitLab CI, CircleCI, Buildkite, Jenkins, Azure DevOps?
2. Current pipeline runtime and where the time goes?
3. Parallelism budget — concurrent job limit, runner sizes, billing model?
4. Test distribution — unit / integration / E2E / contract / perf ratios?
5. Existing retry policy and flake rate?
6. Self-hosted runners or cloud-hosted?
7. Cost constraints driving the optimization?

---

## Related Skills

- **test-strategy** — what gets gated where comes from strategy.
- **test-environment-management** — where tests run.
- **test-reporting** — for aggregating sharded results.
- **flaky-test-management** — for the retry policy decisions.
- **testcontainers** — for integration test infrastructure.
- **selenium-grid** — when self-hosting the grid for E2E.
- **cloud-test-grids** — when paying for managed grids.
- All UI test skills (**playwright** / **cypress** / **selenium** / **webdriverio** / **appium** / **detox** / **maestro**) for runner-specific sharding.
- All unit-test skills (**jest-vitest** / **pytest** / **junit-testng** / **xunit-nunit** / **go-test** / **rspec**) for the parallel patterns.
- **production-testing** — for the shift-right side of the gate ladder.
