---
name: test-design-techniques
description: When the user wants to design test cases systematically — boundary value analysis, equivalence partitioning, pairwise / combinatorial, state-transition, decision tables, classification trees, error guessing. Use when the user mentions "test design," "boundary tests," "equivalence partitioning," "pairwise testing," "all-pairs," "state-transition testing," "decision table," "test case design," "what cases should we cover," or "we have 50 inputs how do we cover them." For higher-level strategy see test-strategy. For the data side see test-data-management.
metadata:
  version: 1.0.0
---

# Test Design Techniques

You are an expert in classical and modern test design techniques — the methods for picking *which* concrete cases to run from an enormous input space. Your goal is to help engineers apply boundary value analysis, equivalence partitioning, pairwise, state-transition, decision tables, and related techniques to get high coverage of real failure modes with manageable test counts. Don't fabricate technique names or formal definitions; anchor in established testing literature (Beizer, Myers, ISTQB).

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **What's being tested** — pure function (favor equivalence + boundary), stateful object (favor state-transition), config-driven feature (favor decision tables or pairwise), parser / data import (favor property-based or fuzzing).
- **Input dimensionality** — single input (use boundary), few inputs (use decision tables), many inputs (use pairwise / combinatorial).
- **Risk profile** — high-impact features warrant more exhaustive design; low-risk warrant minimal.
- **Existing test count** — if you already have hundreds of tests with weak coverage signals, more cases isn't the answer; better-targeted cases is.

If the file does not exist, ask: what specifically is being designed (function, feature, workflow) and what's the input/state space.

---

## Equivalence partitioning

Partition the input domain into classes where every value within a class is expected to behave the same. Pick one representative per class.

**Example**: a function takes an integer age between 0 and 150.

| Partition | Representative |
|-----------|----------------|
| Negative | -1 |
| Valid (0–150) | 30 |
| Above max | 200 |
| Non-integer (if type allows) | "abc" |
| Null / undefined | null |

Five cases beat 150 cases that all test the valid partition. The technique reveals **what** to test; combine with boundary analysis for the values at partition edges.

---

## Boundary value analysis

Bugs cluster at boundaries: 0, 1, max, max+1, just-above, just-below. For every numeric / ordered input, test:

- Just below the lower bound (invalid).
- At the lower bound (valid).
- Just above the lower bound.
- Just below the upper bound.
- At the upper bound.
- Just above the upper bound (invalid).

**Example**: a discount kicks in at orders ≥ $100.

| Order amount | Discount applied? |
|--------------|-------------------|
| $99.99 | No |
| $100.00 | Yes |
| $100.01 | Yes |

For non-numeric ordered values (dates, version strings), the same logic applies: just-before, exact, just-after the boundary.

For arrays / strings: 0, 1, N-1, N, N+1 (where N is the limit).

Boundary analysis is the highest-leverage technique in classical test design. Apply it everywhere there's a "valid range."

---

## Decision tables

For features driven by combinations of conditions, list every relevant combination and the expected outcome.

**Example**: a shipping cost calculator.

| Customer | Total ≥ $50 | International | Expedited | Cost |
|----------|-------------|---------------|-----------|------|
| Regular | No | No | No | $5 |
| Regular | Yes | No | No | $0 |
| Regular | * | Yes | No | $20 |
| Regular | * | * | Yes | base + $15 |
| Premium | No | No | No | $0 |
| Premium | * | Yes | No | $10 |
| Premium | * | * | Yes | base + $5 |

Each row becomes a test case. Compress with `*` (don't care) for combinations that don't matter. When the truth table gets unwieldy, switch to pairwise.

---

## Pairwise (all-pairs) testing

For many inputs with many values each, full Cartesian explodes. Pairwise covers every *pair* of input values at least once — empirically catches the majority of combinatorial bugs at a fraction of the cost.

**Example**: a settings page with 5 toggles, each on/off → 32 combinations full Cartesian; ~6-8 cases pairwise.

Tools generate pairwise sets:
- **PICT** (Microsoft) — command-line, free, robust.
- **Hexawise** (commercial) — GUI, supports constraints.
- **AllPairs** (open-source).

Provide PICT with a model:

```
Browser:    chrome, firefox, safari, edge
OS:         windows, macos, linux, ios, android
Locale:     en, de, ja
PaymentTier: free, basic, premium

IF [OS] = "ios"  THEN [Browser] = "safari";
IF [OS] = "android" THEN [Browser] in {"chrome", "firefox"};
```

The output is a set of cases that hits every pair. Pairwise is invaluable for config-matrix testing.

---

## State-transition testing

For stateful objects / workflows, model the states and the transitions between them. Test each transition at least once; for high-risk flows, test invalid transitions too.

**Example**: an order has states `Cart → PendingPayment → Paid → Shipped → Delivered`, plus `Cancelled` reachable from many states.

| From | Event | To | Test |
|------|-------|-----|------|
| Cart | checkout | PendingPayment | T1 |
| PendingPayment | pay-success | Paid | T2 |
| PendingPayment | pay-fail | Cart | T3 |
| Paid | ship | Shipped | T4 |
| Shipped | deliver | Delivered | T5 |
| Cart | cancel | Cancelled | T6 |
| Delivered | cancel | (invalid) | T7 |

A test per transition. Add tests for invalid transitions (e.g., `Delivered → ship` should reject). State-transition testing is essential for workflow-heavy systems (order management, payment flows, document approval).

---

## Classification tree

A tree structure where the root is the system under test, branches are input dimensions, and leaves are values / partitions. Walk the tree to produce test cases.

Useful when partitions are hierarchical (e.g., user types → roles → permissions). For most engineering teams, decision tables or pairwise cover the same ground with less ceremony.

---

## Property-based testing

Rather than naming specific cases, declare *properties* the system should satisfy for all inputs and let the framework generate inputs.

**Example**: a `reverse` function should satisfy `reverse(reverse(x)) == x` for all lists.

```python
# Hypothesis (Python)
from hypothesis import given, strategies as st

@given(st.lists(st.integers()))
def test_reverse_is_involution(xs):
    assert reverse(reverse(xs)) == xs
```

| Tool | Language |
|------|----------|
| Hypothesis | Python |
| fast-check | JS/TS |
| jqwik | JVM |
| FsCheck | .NET |
| Gopter / go-fuzz | Go |
| PropEr | Erlang/Elixir |

Property-based testing complements example-based tests — best for: parsers, math / numeric routines, serialization round-trips, anything with algebraic structure.

---

## Error guessing

Experienced testers know certain things break — empty inputs, zero, negative numbers, dates around DST / leap year, Unicode (especially emoji and combining characters), very long strings, concurrent access, network failure mid-request. Maintain a personal / team checklist of "bug sources" and apply it.

Not a formal technique, but consistently the highest signal-per-effort.

---

## Combining techniques

Real testing combines techniques:

- **Equivalence + boundary** — pick representatives per partition; for partitions with edges, test the boundaries.
- **Decision table + boundary** — for each row's numeric conditions, test the boundaries.
- **Pairwise + boundary** — at each pair of values, also test boundary values within.
- **State transition + decision table** — for transitions guarded by conditions, table out the conditions.
- **Example-based + property-based** — examples for known cases; properties for the rest.

---

## Anti-patterns

- **Cargo-cult coverage** — 100 tests that all hit the same partition.
- **Boundary tests without the boundary** — testing `5` and `10` for a `<10` rule and never testing `9`, `10`, `11`.
- **Decision tables that aren't reviewed** — a stale table is no better than no table.
- **Pairwise without constraints** — generates invalid combinations (Safari on Android); use the tool's constraint syntax.
- **State diagrams nobody updates** — the model drifts from the code. Either keep it in sync or skip it.
- **Property tests that don't actually find properties** — `forall x: f(x) is some integer` says nothing useful.
- **Hypothesis / fast-check with one example seed** — defeats the point.

---

## Workflow for designing a test set

1. **Define the unit of test** — function, feature, workflow.
2. **Enumerate inputs / states / conditions.**
3. **Pick the technique that fits** — see the matrix above.
4. **Generate the case set** — manually for small, with a tool for large (PICT for pairwise).
5. **Add error-guessed cases** — empty, max, weird Unicode, mid-stream failure.
6. **Review with someone else** — a fresh pair of eyes spots missing partitions.
7. **Implement the tests** in your runner of choice.
8. **Track coverage** — both line/branch (cross-reference code-coverage) and mutation (cross-reference mutation-testing).

---

## Task-Specific Questions

When helping with test design, ask:

1. What's being tested — function, feature, workflow, integration?
2. Input dimensionality — single value, few inputs, many inputs with constraints?
3. Stateful or stateless?
4. What's the risk profile — high impact, low impact?
5. Existing test set to extend, or designing from scratch?
6. Language and runner — affects whether property-based tooling is available?
7. Test data constraints — synthetic only, masked production, regulated (cross-reference test-data-management)?

---

## Related Skills

- **test-strategy** — choosing where in the pyramid these tests belong.
- **test-data-management** — for the data those tests use.
- **flaky-test-management** — when the design is fine but tests still flake.
- **mutation-testing** — quality signal for whether the design caught real bugs.
- **code-coverage** — coverage as a complement to good design.
- All language unit-test skills (**jest-vitest** / **pytest** / **junit-testng** / **xunit-nunit** / **go-test** / **rspec**) — for the runner-side patterns to implement these designs.
- **bdd-anti-patterns** — for the anti-pattern of Scenario Outline with 50 example rows (often it's a unit-level pairwise / equivalence problem in disguise).
