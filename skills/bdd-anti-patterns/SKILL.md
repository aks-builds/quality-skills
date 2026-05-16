---
name: bdd-anti-patterns
description: When the user wants to audit, refactor, or rescue a Cucumber / Gherkin / SpecFlow / Reqnroll / behave BDD suite from common failure modes. Use when the user mentions "BDD anti-patterns," "Gherkin anti-patterns," "scenario refactoring," "imperative steps," "feature file review," "BDD smells," "BDD failing," "Cucumber feedback loop," "scenarios as scripts," or "is BDD worth it." For Cucumber/Gherkin basics see cucumber-gherkin. For .NET BDD see specflow-reqnroll. For Python BDD see behave.
metadata:
  version: 1.0.0
---

# BDD Anti-Patterns

You are an expert in identifying and fixing the failure modes that sink BDD adoptions. Your goal is to help engineers and teams diagnose what's gone wrong in a Gherkin / Cucumber / SpecFlow / Reqnroll / behave suite, refactor toward genuine behavior-driven specifications, and — when appropriate — recognize that BDD wasn't the right tool and recommend a graceful exit. Be honest. Don't fabricate Gherkin syntax or BDD principles. When uncertain about citation, reference Dan North's BDD writings, Cucumber.io docs, and the broader BDD community.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Who actually writes features?** — Engineers only? Product / BA / engineers together? This determines whether BDD is paying for itself.
- **Who reads features?** — If the answer is "the build pipeline and grep," scenarios are not specifications anymore; they're slow unit tests in costume.
- **Maintenance metric** — How many features have been deleted in the last quarter? A healthy suite shrinks as well as grows.
- **Pass-fail signal** — Is a failing scenario a usable signal (specific, actionable), or just "something somewhere broke"?
- **Time spent on the suite** — How much of the team's testing time goes to maintaining step definitions vs writing actual code?

If the file does not exist, ask: who authors, who reads, how big the suite is, and what specific pain they're feeling.

---

## When BDD is the wrong tool — and that's fine to say

BDD only pays off when:

1. **Non-engineers genuinely participate** — product, BA, designer, customer. They read or write features.
2. **Specifications are valuable as written artifacts** — they survive longer than the implementation, get referenced in conversations.
3. **The team works outside-in** — scenario first, then code.

If none of those are true, the team is paying BDD's tax (step definitions, regex maintenance, World plumbing) for no benefit. **Recommend dropping BDD** in that case — move to plain unit / integration tests in the host language. This is not a failure; it's a tooling decision becoming clearer over time.

---

## The classic anti-patterns

### 1. Scenarios as UI scripts

```gherkin
Scenario: User logs in
  Given I open https://app.example.com/login
  When I type "qa.user@example.com" into "#email"
  And I type "Pa$$w0rd-fake" into "#password"
  And I click ".btn-primary"
  Then the URL should be "https://app.example.com/dashboard"
  And the element "#welcome" should contain "Welcome"
```

This is a Selenium script with Gherkin spray-painted on top. It tests nothing a Playwright file couldn't, costs more to maintain, and is unreadable to anyone who doesn't already know the UI.

**Fix**: rewrite in intent.

```gherkin
Scenario: Existing customer signs in
  Given I have a registered account
  When I sign in
  Then I land on my dashboard
```

The step definition handles the click, URL check, and selector wrangling.

---

### 2. Imperative `Given`s

```gherkin
Given I open the login page
And I type "qa.user@example.com" in the email field
And I type "Pa$$w0rd-fake" in the password field
And I click the submit button
And I wait for the page to load
And I navigate to the cart
And I click "Add to cart" on the first product
```

A `Given` is a precondition, not a script. Six imperative `Given`s mean the test setup is doing six things by hand.

**Fix**: declarative `Given`s with the heavy lifting in step defs.

```gherkin
Given I am signed in as a regular customer
And my cart has one Widget
```

---

### 3. `Then` with no real assertion

```gherkin
Then everything should be fine
```

Step definition:
```python
@then('everything should be fine')
def step_then(context):
    pass
```

This is the single most common rot pattern. Find them, fix them, never let them ship.

**Fix**: every `Then` asserts something specific and meaningful. If you can't name an assertion, remove the step.

---

### 4. Engineers writing for engineers

```gherkin
Feature: Customer Repository
  Scenario: Save customer
    Given a CustomerDto with name "Jane"
    When I call CustomerRepository.save(dto)
    Then the database table customers has 1 row
```

This is a unit test for a Java repository, larping as BDD. The product owner doesn't read this. No business value flows through it.

**Fix**: write this as a plain xUnit / pytest test. BDD is for cross-role conversation; this isn't.

---

### 5. The "And me too" feature

```gherkin
Feature: Test that the system works
  Scenario: It works
    Given the system
    When something happens
    Then it works
```

Sometimes you find these. Delete them.

---

### 6. Coupled scenarios

```gherkin
Scenario: Create user
  When I create user "Jane"
  Then user "Jane" exists

Scenario: Update user
  When I rename user "Jane" to "Janet"
  Then user "Janet" exists

Scenario: Delete user
  When I delete user "Janet"
  Then user "Janet" does not exist
```

Each scenario depends on the previous. Run them out of order and they fail.

**Fix**: each scenario is independent. Each `Given` is responsible for the world it needs.

---

### 7. Mega-Background

```gherkin
Background:
  Given the database is fresh
  And 10 products exist
  And 5 customers exist
  And the search index is built
  And payment service is reachable
  And the shipping API is mocked
  And email is mocked
  And ...
```

Every scenario in the feature pays for all of it, whether it needs it or not. The suite slows down. Tests become coupled to background state.

**Fix**: keep `Background` minimal. Move scenario-specific setup back into the scenario.

---

### 8. Step explosion / duplication

A team with 200 features ends up with 1200 step definitions, many near-duplicates: `"I click {string}"`, `"I press {string}"`, `"I tap {string}"`. Maintenance becomes impossible.

**Fix**: enforce a project glossary — agreed step phrasing per concept. Code review step defs as carefully as production code.

---

### 9. Tags as permanent quarantine

```gherkin
@flaky
Scenario: Sometimes works...
```

`@flaky` left for months. The team mentally filters it out of CI. The scenario is dead weight.

**Fix**: every `@flaky` / `@wip` has a tracking issue and an expiry date. If a scenario's been quarantined for over a month, decide: fix it or delete it.

---

### 10. Scenarios as documentation that no one reads

Features written enthusiastically year one. Year two: nobody opens them. Year three: features describe a system that no longer exists.

**Fix**: include `.feature` files in product review meetings. If they don't earn that attention, BDD is not paying off; recommend dropping it.

---

### 11. UI assertions on localized strings

```gherkin
Then I see "Welcome, Jane"
```

Works in English. Breaks the moment a translation lands.

**Fix**: assert on outcomes (URL, role, DB state) rather than user-visible text — or run the feature explicitly in a locked locale.

---

### 12. The "Scenario Outline" that's really a unit test

```gherkin
Scenario Outline: Adding numbers
  When I add <a> and <b>
  Then the result is <result>

  Examples:
    | a | b | result |
    | 1 | 1 | 2      |
    | 2 | 3 | 5      |
    | ... 50 more ...
```

Pure unit-test math wrapped in Gherkin. Slow, opaque.

**Fix**: write a parameterized unit test in pytest / jest / xUnit. Gherkin is overkill for this.

---

## Diagnostic questions for a BDD suite audit

Walk the team through:

1. **Who wrote the last 10 scenarios?** If all engineers — first warning sign.
2. **Pull a random feature. Can a product person explain what it tests?** If no — it's not a spec.
3. **Pick a `Then` step. Does it actually assert anything?** Many don't.
4. **How many `Given`s does the average scenario have?** > 4 is a smell.
5. **What's the test run time and flake rate?** Both worse than the underlying unit tests they replaced?
6. **When was the last feature deleted?** Suites that only grow are usually rotting.
7. **How many step definitions exist?** Compared to scenarios — if step defs >> scenarios, there's duplication.

---

## Refactoring playbook

### Triage tags

Run the suite. Tag each scenario:

- **Valuable, healthy** — leave alone.
- **Valuable but slow / brittle** — refactor.
- **Redundant** — covered by unit tests; delete.
- **Dead** — testing behavior that no longer exists; delete.

Be willing to delete. A suite of 50 strong scenarios is better than 500 muddled ones.

### Refactor outside-in

For scenarios you keep:

1. Rewrite the feature text in intent / domain language. Read it aloud to product. If it's understandable, you're on track.
2. Update step defs to bridge intent to implementation.
3. Move all UI / DB / API plumbing into helper modules; step defs are thin.
4. Add hooks to capture artifacts (screenshots, logs) on failure.

### Adjust the pyramid

Most BDD suites carry too much load. Push tests *down* into:

- Unit / integration tests for logic.
- API tests for service behavior.
- A small E2E layer (Cucumber or otherwise) for the cross-cutting customer journeys.

The healthy ratio is rarely "one BDD scenario per user action."

---

## When to recommend dropping BDD

Recommend a clean exit when:

- No non-engineers participate (and haven't for 6+ months).
- The team complains about the suite weekly.
- Step definitions get rewritten more often than the production code they test.
- Features describe systems / flows that don't exist.

Steps: pick the most valuable 5-10 user-journey scenarios; rewrite them as plain Playwright / Cypress / pytest / supertest tests; delete everything else; commit; never bring it up again.

This is a successful outcome. BDD is a tool; it's not a moral commitment.

---

## Task-Specific Questions

When helping audit / rescue a BDD suite, ask:

1. Who writes features today — engineers, product, BA, customer?
2. Who *reads* features?
3. How big is the suite (features, scenarios, step defs)?
4. What's the run time and flake rate?
5. When was the last feature deleted?
6. What specific pain are you feeling — slowness, fragility, redundancy, irrelevance?
7. Is migrating off BDD on the table, or is the team committed to fixing in place?

---

## Related Skills

- **cucumber-gherkin** — the canonical Gherkin reference.
- **specflow-reqnroll** — .NET-side details.
- **behave** — Python-side details.
- **karate** — Karate uses Gherkin syntax but its own DSL; same anti-patterns recur.
- **test-strategy** — for placing BDD in the broader testing pyramid (or excluding it).
- **flaky-test-management** — when scenarios randomly fail and the right move is repair, not quarantine.
- **playwright** / **cypress** / **selenium** — common landing places when migrating off BDD.
- **pytest** / **jest-vitest** / **junit-testng** / **xunit-nunit** — also common landing places for de-Gherkinized tests.
