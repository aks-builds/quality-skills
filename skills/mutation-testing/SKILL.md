---
name: mutation-testing
description: When the user wants to measure or improve the *quality* of their existing test suite via mutation testing. Use when the user mentions "mutation testing," "mutation score," "Stryker," "PIT," "PITest," "mutmut," "go-mutesting," "Mutmut," "mutator," "killed mutant," "surviving mutant," "mutation coverage," or "is our coverage strong." For line coverage see code-coverage. For overall strategy see test-strategy.
metadata:
  version: 1.0.0
---

# Mutation Testing

You are an expert in mutation testing — a technique that measures how much your test suite actually *catches* by introducing small bugs (mutations) into your production code and checking whether tests fail. Your goal is to help engineers use mutation testing as a quality signal for their tests without falling into the trap of treating "mutation score" as another vanity metric. Don't fabricate mutation operators or tool features. When uncertain, point the reader to the relevant tool's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Language** — mutation tools are language-specific. The maturity varies (Java/.NET have the most mature tools; Python and Go are workable; some languages have weak ecosystems).
- **Test suite size and runtime** — mutation testing runs the suite once per mutation. A 5-minute suite × 1000 mutations = a long run.
- **Coverage baseline** — mutation testing on uncovered code finds nothing. Cover the code first, then assess test quality.
- **Goal** — gap-finding (recommended) or release gate (rarely a good idea).

If the file does not exist, ask: language, current suite runtime, coverage baseline, and what motivated the mutation-testing question.

---

## What mutation testing is

Mutation testing introduces small, semantically-meaningful bugs (called *mutations*) into your production code and runs the test suite. Each mutation falls into one of three outcomes:

| Outcome | Meaning |
|---------|---------|
| **Killed** | At least one test failed. Good — tests caught the bug. |
| **Survived** | All tests still passed. **Bad** — the mutation went undetected. |
| **No coverage** | The mutation is in code with no test coverage at all. Mutation testing isn't the right tool yet; cover first. |
| **Timeout / error** | Mutation caused infinite loop or runtime error. Usually informational. |

**Mutation score** = killed / (killed + survived). Higher is better. But — same as line coverage — chasing a number without understanding the cause is a trap.

---

## Why it's a better quality signal than line coverage

Line coverage measures whether tests *execute* the code. Mutation testing measures whether tests *detect changes* to the code.

You can have 100% line coverage with tests like `assert result is not None` — the line executes, but the test wouldn't notice if the implementation changed dramatically. A surviving mutation reveals that no assertion meaningfully checks the behavior at that point.

The classic example:

```python
def discount(price, member):
    if member:
        return price * 0.9
    return price

# Test
def test_discount():
    assert discount(100, True) is not None  # 100% line coverage
```

Replace `0.9` with `0.5` (mutation). The test still passes. Surviving mutation = the test isn't actually validating the discount calculation.

---

## Common mutation operators

Mutation tools apply a fixed set of *operators* — small code transformations:

| Operator | Example |
|----------|---------|
| Arithmetic | `+` → `-`, `*` → `/` |
| Conditional | `>` → `>=`, `==` → `!=` |
| Boolean | `&&` → `\|\|`, `!x` → `x` |
| Constants | `1` → `0`, `"x"` → `""`, `true` → `false` |
| Return | `return x` → `return null` / `return 0` / `return x + 1` |
| Branch | remove `if` block, swap branches |
| Method call removal | `void f(x); g(x)` → `g(x)` |
| Increment / decrement | `x++` → `x--` |
| Negation | `-x` → `x` |

Tools usually let you enable / disable operators per project. Equivalent mutations (semantically identical to the original; tests can't distinguish) are a real problem — tools score them differently.

---

## Tools by language

| Language | Tool | Notes |
|----------|------|-------|
| **Java / JVM** | **PIT (PITest)** | Mature, fast (test-line-coverage-aware), Maven / Gradle plugins. The gold standard. |
| **JavaScript / TS** | **Stryker** | Active development, fast, supports Jest / Vitest / Mocha / Karma. |
| **C# / .NET** | **Stryker.NET** | Same Stryker family. |
| **Python** | **mutmut** | Workable; some teams use Cosmic Ray as alternative. |
| **Scala** | **Stryker4s** | |
| **Ruby** | **mutant** | Mature. |
| **Go** | **go-mutesting** / **gremlins.dev** | Younger ecosystem; coverage is patchy. |
| **PHP** | **Infection** | Mature. |
| **Rust** | **cargo-mutants** | Young. |
| **Swift / Kotlin** | Limited tooling | Manual or research-grade. |

Pick the language-native tool; cross-language mutation engines tend to be lower-quality.

---

## How to introduce mutation testing

The most common bad pattern: run mutation testing once, get a 60% score, declare it bad, never run it again.

Better pattern:

1. **Run on a small module first** — not the whole codebase.
2. **Triage surviving mutations** — for each one, ask: is this a real test gap, or an equivalent mutation, or code that doesn't need tests?
3. **Add tests for genuine gaps.**
4. **Suppress / disable operators that produce too many equivalents** (e.g., remove-method-call on logging code).
5. **Track mutation score per module** — improve over time, don't gate.
6. **Run on changed code per PR** — mutation testing on the diff (incremental) is much faster than the whole suite.

---

## When mutation testing is worth it

- High-risk core logic (billing, auth, calculation engines, parsers) where weak tests are dangerous.
- Mature codebase with reasonable line coverage where you've stopped getting value from coverage as a quality signal.
- Teams that want to measure improvement in test quality over time.

When it's *not* worth it:

- Brand new codebase — focus on writing tests at all.
- Low coverage — fix that first.
- Glue code with little logic — most mutations there are equivalent or trivial.
- Real-time systems with very strict performance requirements (mutation testing dramatically slows the suite during runs).

---

## CI integration

Don't run full mutation testing on every PR — it's too slow. Patterns:

| Pattern | When |
|---------|------|
| Run mutation tests on changed files only | PR CI (Stryker incremental, PIT scoped runs) |
| Full mutation run nightly | Catch regressions across the suite |
| Full mutation run weekly | For very slow suites |
| Mutation testing on demand | When investigating a specific module's test quality |

Tools support `--since` / `--diff` style flags to limit mutation to changed code. Use them.

---

## Common pitfalls

- **Treating mutation score as a release gate** — chasing 100% leads to over-specified tests that break on any refactor. Use as a gap-finder.
- **Running on uncovered code** — mutation testing assumes baseline coverage. Cover first.
- **Ignoring equivalent mutations** — surviving doesn't always mean "test gap"; sometimes it means "the mutation is equivalent." Triage by hand.
- **Running on every PR with a long suite** — kills developer velocity; reserve for scheduled runs.
- **No improvement loop** — running mutation testing without acting on findings is wasted CI.
- **Over-broad operator set** — every operator enabled produces noise; tune.
- **Mutation testing UI / config code** — mostly equivalents and noise. Limit scope to business logic.
- **Comparing mutation scores across projects** — operator sets and equivalent-mutation rates differ; not directly comparable.

---

## How to read the output

Mutation tool output typically shows, per source file:

- Mutations per line.
- Each mutation: killed, survived, or timeout.
- Aggregated score.

Triage routine:

1. **Filter by survived.**
2. **For each surviving mutation:**
   - Is the mutation in code that legitimately doesn't need tests (debug logging, dead-but-not-removed code)?
   - Is it an equivalent mutation (semantically identical)?
   - Is it a real test gap? → write a test.
3. **Update the test suite incrementally.**
4. **Re-run; verify mutations now killed.**

---

## Example: PIT (Java) workflow

```bash
mvn org.pitest:pitest-maven:mutationCoverage
# generates target/pit-reports/<date>/index.html

# Scope to a module
mvn -pl orders-service org.pitest:pitest-maven:mutationCoverage

# Compare to baseline (PIT supports historical reports)
```

PIT integrates with JUnit / TestNG. Mutation score per Java class is reported in HTML.

---

## Example: Stryker (JS / TS) workflow

```bash
# Initialize
npx stryker init

# Run
npx stryker run

# Run on changed files only (incremental)
npx stryker run --since=main
```

`stryker.conf.js` configures: mutators, test runner, coverage analysis mode, files to mutate.

---

## Task-Specific Questions

When helping with mutation testing, ask:

1. Language and tool?
2. Current line / branch coverage baseline?
3. Test suite runtime — full mutation run is realistic or needs incremental?
4. Goal — gap-finding, quality measurement, or release gate (and warn if release gate)?
5. Specific module / domain to focus on?
6. CI environment for running mutation tests (it's heavy)?
7. Is there management pressure on the metric? (If yes, watch for goal displacement.)

---

## Related Skills

- **code-coverage** — line/branch coverage is the prerequisite; mutation testing is the upgrade.
- **test-design-techniques** — better-designed tests catch more mutations. Mutation testing surfaces design gaps.
- **test-strategy** — mutation testing is a quality-measurement tool; place it in strategy as a periodic audit, not a constant gate.
- All language unit-test skills (**jest-vitest** / **pytest** / **junit-testng** / **xunit-nunit** / **go-test** / **rspec**) — for the runners that mutation tools drive.
- **ci-test-orchestration** — for scheduling mutation runs (nightly / weekly).
- **flaky-test-management** — flaky tests interfere with mutation testing (a mutation that "kills" a test via flake produces noise).
