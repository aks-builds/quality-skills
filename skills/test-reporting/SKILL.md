---
name: test-reporting
description: When the user wants to design, integrate, or improve test reporting — JUnit XML aggregation, HTML dashboards, Allure, Cucumber Reports, screenshots / videos / traces, failure triage, and historical analytics. Use when the user mentions "test reports," "JUnit XML," "Allure," "mochawesome," "Cucumber Reports," "Datadog CI Visibility," "Buildkite Test Analytics," "test result aggregation," "trace / artifacts on failure," "test dashboard," or "trend analysis." For CI orchestration see ci-test-orchestration. For flake analytics see flaky-test-management.
metadata:
  version: 1.0.0
---

# Test Reporting

You are an expert in test reporting — turning raw test results into actionable signal for engineers, QA, and management. Your goal is to help teams pick the right report format(s), aggregate sharded results, capture failure artifacts, and build trend analysis without over-investing in dashboard infrastructure that no one looks at. Don't fabricate reporter features or library versions. When uncertain, point the reader to the reporter's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **CI provider** — many CIs have built-in test result views (GitHub Actions check runs, GitLab CI test reports, CircleCI Test Insights). Don't reinvent if the built-in suffices.
- **Test runners in use** — each emits its own native format; JUnit XML is the lowest common denominator.
- **Audience** — engineers debugging a failure, QA triaging a flake, management looking at trends. Different audiences need different views.
- **Sharding / parallelism** — if tests run sharded, reports need aggregation.
- **Compliance / regulatory** — some industries require auditable test evidence.

If the file does not exist, ask: CI provider, runners, audiences (devs / QA / mgmt), sharding strategy, compliance needs.

---

## Layers of reporting

```
Trend analytics      ← Datadog CI / BK Test Analytics / Allure server / hand-rolled
       ↑
HTML dashboard       ← Allure / mochawesome / Cucumber Reports / Playwright HTML
       ↑
CI's native view     ← GH Actions check runs, GitLab CI test reports, CircleCI Insights
       ↑
JUnit XML            ← Cross-runner, cross-CI universal format
       ↑
Native runner output ← console output, single-format reporter (terminal)
```

Most teams need: JUnit XML for CI (always), a richer HTML report for triage (often), and a trend analytics layer eventually.

---

## JUnit XML (the universal format)

Every CI provider can read JUnit XML. Every test runner can emit it. **Always emit JUnit XML in CI**, even if you also use a richer reporter.

| Runner | How to emit JUnit XML |
|--------|----------------------|
| Jest | `--reporters=default --reporters=jest-junit` (with `jest-junit` package) |
| Vitest | `--reporter=junit --outputFile=results.xml` |
| pytest | `--junitxml=report.xml` |
| Playwright | `reporter: [['junit', { outputFile: 'results.xml' }]]` |
| Cypress | `cypress run --reporter junit --reporter-options "mochaFile=results-[hash].xml"` |
| JUnit 5 / Surefire | Surefire emits JUnit XML by default to `target/surefire-reports/` |
| Gradle test | XML in `build/test-results/test/` by default |
| Go | `go test -json | gotestsum --junitfile report.xml` |
| RSpec | `rspec_junit_formatter` gem |
| .NET | `dotnet test --logger "junit;LogFilePath=results.xml"` (via `JunitXml.TestLogger` package) |

Verify against your installed runner's docs — naming and flag conventions evolve.

CI providers' UIs render JUnit XML into per-PR test result views with failures highlighted. **This is the minimum bar.**

---

## HTML dashboards

For richer per-run reports (screenshots, stack traces, videos, logs):

| Reporter | Use |
|----------|-----|
| **Allure** | Cross-runner; rich step-level reporting; supports almost every language. |
| **mochawesome** | Mocha (and Cypress via cypress-mochawesome-reporter). |
| **Cucumber Reports** (HTML / `@cucumber/html-formatter`) | Cucumber-specific. |
| **Playwright HTML** | Built into Playwright; trace viewer integration. |
| **Newman htmlextra** | Postman / Newman runs. |
| **PIT (mutation) HTML** | Mutation-testing reports. |
| **Gatling HTML** | Gatling perf runs. |

For most teams: pick **one** richer reporter and stick with it across the suite. Mixing creates triage friction.

### Allure (cross-runner)

Allure has adapters for many runners (`allure-pytest`, `allure-junit5`, `allure-cucumberjs`, etc.). Outputs raw JSON results that the Allure CLI / Allure server renders into HTML.

```bash
# generate results during test run
pytest --alluredir=allure-results

# render HTML
allure generate allure-results -o allure-report
allure open allure-report
```

For trend analysis over time, Allure can be deployed as a server (Allure TestOps is the commercial version).

---

## Failure artifacts — the most important reporting investment

A failure without context is unsolvable. **Every test failure must produce:**

| Artifact | Audience |
|----------|----------|
| Stack trace / error message | Engineer |
| Logs (test runner + service) | Engineer |
| Screenshot (UI tests) | Engineer + QA |
| Video (E2E flakes) | Engineer + QA |
| Trace / HAR (network) | Engineer |
| Test result XML | CI dashboard |

Without artifacts, every flake is a guessing game. Wire these into the test framework's hook system:

- Playwright: `trace: 'on-first-retry', screenshot: 'only-on-failure', video: 'retain-on-failure'`.
- Cypress: video on by default; screenshot-on-failure default.
- Selenium / WDIO: capture in `afterTest` / `@After` hook.
- API tests: log request / response on failure.

In CI, upload artifacts to the provider's artifact store (`actions/upload-artifact`, GitLab CI's `artifacts:`).

---

## Aggregating sharded results

When tests run sharded (cross-reference ci-test-orchestration), each shard produces its own report. Aggregation patterns:

### Option 1: Native CI aggregation

GitHub Actions check runs, GitLab CI test reports — these aggregate JUnit XML from multiple jobs automatically if you upload them under the right path.

### Option 2: Downstream aggregator job

```yaml
test:
  strategy:
    matrix:
      shard: [1, 2, 3, 4]
  steps:
    - run: npx playwright test --shard=${{ matrix.shard }}/4
    - if: always()
      uses: actions/upload-artifact@v4
      with:
        name: results-shard-${{ matrix.shard }}
        path: results/

aggregate:
  needs: test
  if: always()
  runs-on: ubuntu-latest
  steps:
    - uses: actions/download-artifact@v4
    - run: |
        npx playwright merge-reports --reporter html ./results-shard-*
```

Playwright's `merge-reports`, `junit-merge` (npm), `pytest-html` aggregation, or Allure's directory-merge handle this.

### Option 3: Service-side aggregation

Push to Datadog CI Visibility / Buildkite Test Analytics / Trunk / Allure server — they aggregate across all shards / runs / branches.

---

## Trend analytics

Beyond per-run reports: tracking metrics over time.

Useful trends:

- Suite runtime (regressing?).
- Flake rate per test (cross-reference flaky-test-management).
- Failure count per file / module (where do most failures cluster?).
- Test count growth.
- Coverage trend (cross-reference code-coverage).
- Pass rate by author / by area.

Tools that do this:

- **Datadog CI Visibility / Test Optimization** — commercial, language-agnostic.
- **Buildkite Test Analytics** — Buildkite-only.
- **Trunk** — multi-CI, opinionated about flake.
- **Allure TestOps** — commercial Allure-based.
- **Launchable** — TIA + flake analytics.
- **Hand-rolled** — your CI's API + a database + Grafana. Works for small teams.

Don't build the dashboard before you have an audience for it. A trend dashboard no one looks at is dead infrastructure.

---

## What to put on a team-level dashboard

If you build one:

- Suite runtime (last 30 days).
- Flake rate (last 7 / 30 days).
- Top-10 flakiest tests.
- PRs blocked by failing tests.
- Coverage by module.
- Quarantined / `@flaky` test count over time.
- Mean time to merge (delay introduced by test failures).

Avoid:

- Vanity metrics that don't drive decisions.
- Aggregate pass rate (always ~95%+, not actionable).
- Coverage percentage with no module breakdown.

---

## Failure triage flow

A good reporting setup supports this flow:

1. PR fails CI.
2. Author clicks "test results" in CI UI.
3. Sees the failing test name, error message, link to artifacts.
4. Opens HTML report / trace / video to see what happened.
5. Reproduces locally (with the seed / data the report captured).
6. Fixes; reruns.

If any of these steps is missing or painful, fix the reporting before optimizing anything else. Bad reports = team that ignores failures = entire QA strategy collapses.

---

## Common Pitfalls

- **No artifact capture** — every failure becomes a black box.
- **Reports in 7 formats nobody reads** — pick fewer, integrate better.
- **Dashboards built and never visited** — find an audience first.
- **JUnit XML not emitted** — CI's native test view doesn't work.
- **Sharded runs without aggregation** — CI shows N partial reports, none complete.
- **Failure artifacts not uploaded on success** — fine; but missing them on failure is the trap.
- **Artifact storage filling up** — set retention policy.
- **Screenshots/videos for thousands of passing tests** — wasted storage; failure-only is the default.
- **Treating green tests as "all good"** — green tests with weak assertions or hidden retries can hide bugs.
- **Hand-rolling a dashboard before evaluating off-the-shelf** — most teams reinvent something that exists.
- **No correlation between CI build, session, and test result** — dashboards turn into needle-in-haystack searches without a linking ID.

---

## Building a reporting strategy

1. **Always emit JUnit XML.** Use the CI's native view as the baseline.
2. **Capture failure artifacts** — screenshots, videos, traces, logs. Upload on failure.
3. **Pick one rich HTML reporter** (Allure, Playwright HTML, mochawesome, etc.) for triage.
4. **Aggregate across shards** via merge-reports or service-side aggregation.
5. **Defer trend analytics** until there's an audience asking for it.
6. **Wire the build ID** into every artifact name / session label so triage is a click, not a search.
7. **Maintain it like product code** — broken reporting hurts more than a missing one.

---

## Task-Specific Questions

When helping with test reporting, ask:

1. CI provider — what built-in views exist?
2. Test runners in use?
3. Sharded or single-job runs?
4. Audience — engineers, QA, management?
5. Failure artifacts captured today? Where?
6. Trend analytics needed, or just per-PR triage?
7. Compliance / audit retention requirements?

---

## Related Skills

- **ci-test-orchestration** — for the sharding side of aggregation.
- **flaky-test-management** — flake analytics is a major reporting use case.
- **All test runner skills** — for runner-specific reporter integration.
- **playwright** / **cypress** / **selenium** — for UI artifact patterns (screenshots, videos, traces).
- **postman-newman** — Newman's htmlextra report is the postman-specific reporting story.
- **code-coverage** — coverage reporting is its own dashboard area.
- **mutation-testing** — mutation reporting is its own niche.
- **test-strategy** — the audience for reporting flows out of strategy.
