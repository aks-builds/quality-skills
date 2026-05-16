---
name: code-coverage
description: When the user wants to measure, interpret, or improve code coverage — line, branch, function, statement, condition, MC/DC coverage. Use when the user mentions "code coverage," "test coverage," "Istanbul," "c8," "JaCoCo," "coverage.py," "Coverlet," "lcov," "Codecov," "Coveralls," "branch coverage," "MC/DC," or "coverage threshold." For test-quality signal beyond coverage see mutation-testing. For strategy framing see test-strategy.
metadata:
  version: 1.0.0
---

# Code Coverage

You are an expert in code coverage — how to measure it, what the numbers actually mean, and how to use them as a *signal* rather than a goal. Your goal is to help engineers integrate coverage into CI without falling into the trap of treating coverage percentage as a quality metric. Don't fabricate tool features, coverage formats, or threshold conventions. When uncertain, point the reader to the tool's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Language** — coverage tools are language-specific.
- **Existing coverage baseline** — is there one? What's the number?
- **How coverage is being used** — gap-finding (recommended) or hard gate (often a trap).
- **Coverage strategy alignment** — is the team treating coverage as a goal or a measurement?
- **Risk profile** — coverage matters more for high-stakes code (billing, auth) than glue code.

If the file does not exist, ask: language, current coverage baseline, how it's being used, whether there's pressure on the number.

---

## Coverage types — they are NOT all the same

| Type | What it measures |
|------|------------------|
| **Line** | Did any test execute this line? |
| **Statement** | Did any test execute this statement? (Lines can have multiple statements.) |
| **Function / method** | Did any test call this function? |
| **Branch** | For each `if` / `switch` / `?:`, did tests cover both outcomes? |
| **Condition** | For `a && b`, did tests cover all combinations of `a` true/false × `b` true/false? |
| **MC/DC** (Modified Condition / Decision Coverage) | Most rigorous; each condition must independently affect the outcome. Required by DO-178B for aerospace. |
| **Path** | Did tests cover every execution path? (Combinatorial explosion in practice.) |

**Line coverage is the easiest to game.** Branch coverage is meaningfully more useful. MC/DC is rigorous but rare outside regulated industries.

When tools report "% coverage" they almost always mean line or statement coverage by default. Specify branch coverage explicitly if you want the stronger signal.

---

## Tools by language

| Language | Tool | Notes |
|----------|------|-------|
| **JS / TS** | Istanbul (`nyc`), c8 (V8 native) | Default. Vitest uses V8 by default; Jest uses Istanbul. |
| **Python** | `coverage.py` | Standard; `pytest-cov` for pytest integration. |
| **Java / JVM** | **JaCoCo** | De facto. Gradle / Maven plugins. |
| **.NET** | **Coverlet** | Standard. `dotnet test --collect:"XPlat Code Coverage"`. |
| **Go** | Built-in (`go test -coverprofile`) | Native. `go tool cover -html` for HTML. |
| **Ruby** | **SimpleCov** | Standard. |
| **Rust** | `cargo-tarpaulin` / `grcov` | Two valid options. |
| **PHP** | **PHPUnit + Xdebug** (or pcov) | Built-in. |
| **C / C++** | `gcov` / `lcov` | Compiler-driven; mature. |
| **Swift** | Xcode coverage | Built-in. |
| **Kotlin** | JaCoCo | Same as Java. |

For cross-language aggregation, the **lcov / cobertura** XML formats are widely understood — every major service (Codecov, Coveralls, SonarQube, Datadog) accepts one of them.

---

## Why coverage is a *signal*, not a goal

A test like `assert thing is not None` gives 100% line coverage on the function it calls, but tells you nothing about correctness. Coverage measures execution, not assertion strength.

Consequences of treating coverage as a goal:

- **100% becomes a cargo-culted target.** Teams write tests that hit every line without meaningfully asserting on behavior.
- **Over-mocking surges.** "Just mock everything and run the function."
- **Refactor resistance.** A change that doesn't affect behavior but moves lines causes coverage to drop and PR CI to fail.
- **Coverage gaming.** Tests with no assertions, tests that catch every exception, tests that "just call" the code.

Coverage is most valuable as a **gap-finder**: "we never test this branch — is that intentional or an oversight?"

For real test *quality* signal, use mutation testing (cross-reference mutation-testing).

---

## What coverage doesn't measure

- **Whether assertions are meaningful.** Mutation testing does.
- **Whether tests catch real production bug shapes.** Production incident review does.
- **Whether tests run in realistic conditions.** Integration / E2E does.
- **Whether tests are reliable.** Flake rate measures that.
- **Whether dead code exists.** Coverage can find it; not all uncovered code is dead.

---

## Setting up coverage

### JS / TS (Jest / Vitest)

```js
// jest.config.js
module.exports = {
  collectCoverage: true,
  coverageProvider: 'v8',
  coverageReporters: ['text', 'lcov', 'html'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx,js,jsx}',
    '!src/**/*.d.ts',
    '!src/index.ts',
  ],
};
```

Vitest:

```js
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: { provider: 'v8', reporter: ['text', 'lcov', 'html'] },
  },
});
```

### Python (pytest)

```bash
pytest --cov=myproject --cov-report=term --cov-report=xml --cov-report=html
```

### JVM (Gradle + JaCoCo)

```kotlin
plugins { jacoco }
tasks.test { finalizedBy(tasks.jacocoTestReport) }
tasks.jacocoTestReport {
    reports {
        xml.required.set(true)
        html.required.set(true)
    }
}
```

### Go

```bash
go test -coverprofile=cover.out ./...
go tool cover -html=cover.out -o cover.html
```

### .NET (Coverlet)

```bash
dotnet test --collect:"XPlat Code Coverage"
# generates cobertura.xml under TestResults/*/
```

---

## Coverage in CI

```yaml
- run: <test command with coverage>
- if: always()
  uses: codecov/codecov-action@v4
  with:
    files: coverage/lcov.info  # or cobertura.xml / coverage.xml
```

Codecov / Coveralls / SonarCloud all accept standard formats and report coverage in PRs.

**Useful patterns:**

- **Coverage delta on PR.** "This PR drops coverage by X%." Often more useful than absolute number.
- **Coverage of changed files only.** Don't fail a PR because old uncovered code exists.
- **Per-module coverage targets.** High-risk modules (billing, auth) → 90%+. Glue code → no target.

---

## Setting coverage thresholds (carefully)

If you must gate on coverage:

- **Don't gate on a high absolute number.** 100% is unreachable in practice; chasing it creates noise.
- **Gate on coverage of changed lines.** ~80% is a common, achievable target.
- **Don't gate on coverage in code-review-only modules** (generated code, schemas, migrations).
- **Allow override with rationale.** A PR that removes 50 lines of dead code shouldn't fail because coverage dropped 0.3%.
- **Pair with mutation testing on critical modules.** Coverage gate + mutation gate gives real signal.

### Example threshold setup

```js
// jest.config.js
coverageThreshold: {
  global: { lines: 70, branches: 60 },
  './src/billing/': { lines: 90, branches: 80 },
}
```

Per-module thresholds reflect risk. Don't apply the same gate everywhere.

---

## Visualizing coverage

HTML coverage reports show line-by-line:

- Green: covered.
- Red: not covered.
- Yellow: branch partially covered.

Useful for finding gaps. Less useful as a daily metric — engineers don't open the HTML report on every commit.

Tools like Codecov / Coveralls / SonarCloud annotate PR diffs directly: changed lines that are uncovered show as PR comments. This is the most actionable surface.

---

## Common Pitfalls

- **Treating "100% coverage" as a goal.** Drives test gaming and rejects valuable refactors.
- **Gating on coverage of the whole codebase.** A PR that touches one file shouldn't fail because some other file is uncovered.
- **Ignoring branch coverage.** Line coverage alone hides untested if/else paths.
- **Measuring coverage on generated code, vendored libs, migrations.** Configure excludes.
- **Failing to instrument E2E tests.** Coverage from E2E layer is interesting but usually combined with unit/integration coverage. Some tools (Istanbul-instrument + headless browsers) support it; many teams skip it.
- **No baseline before adding a gate.** Sudden enforcement breaks every PR; team disables the gate.
- **No allowlist / override mechanism.** Legitimate exceptions need a documented escape hatch.
- **Mixing coverage reports from different runs.** Aggregation must merge properly (lcov / cobertura support this).
- **Showing coverage in CI without acting on it.** Vanity metric.
- **Ignoring uncovered branches in error-handling paths.** Often the most important code to test.

---

## Building a coverage strategy

1. **Measure** without gating for 30 days. Establish baseline.
2. **Decide audience and use.** Gap-finder (most teams) or gate (regulated industry, high-risk modules)?
3. **If gating**: pick coverage-of-changed-lines, not absolute total. Set a realistic threshold (~80% on changed lines is common).
4. **Per-module risk-tier targets.** Critical billing / auth code higher than glue code.
5. **Pair with mutation testing** on critical modules for the deeper quality signal.
6. **Surface coverage in PR diffs** (Codecov / equivalent), not in standalone dashboards.
7. **Periodically audit** what's uncovered — distinguish "test gap" from "intentionally untestable" from "dead code."

---

## Task-Specific Questions

When helping with coverage, ask:

1. Language and current tool?
2. Existing baseline coverage number?
3. How is coverage being used today — gate, dashboard, gap-finder?
4. Per-module risk-tier targets, or one global number?
5. PR-time vs scheduled measurement?
6. Codecov / Coveralls / SonarCloud / Datadog / hand-rolled?
7. Compliance constraints (DO-178B, etc.)?

---

## Related Skills

- **mutation-testing** — the deeper quality signal beyond coverage.
- **test-strategy** — coverage is one of several quality dimensions.
- **test-design-techniques** — better-designed tests achieve coverage *and* catch bugs.
- All language unit-test skills (**jest-vitest** / **pytest** / **junit-testng** / **xunit-nunit** / **go-test** / **rspec**) for runner-specific coverage integration.
- **ci-test-orchestration** — for wiring coverage into the gate stack.
- **flaky-test-management** — flaky tests pollute coverage numbers across runs.
