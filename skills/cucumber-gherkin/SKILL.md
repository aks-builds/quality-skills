---
name: cucumber-gherkin
description: When the user wants to design, implement, debug, or evolve BDD scenarios using Cucumber and the Gherkin syntax across any language (Java, JS, Ruby, JVM, etc.). Use when the user mentions "Cucumber," "Gherkin," "Given/When/Then," ".feature file," "step definitions," "scenario outline," "data tables," "Cucumber hooks," "World," "Cucumber-JVM," "Cucumber.js," "Cucumber-Ruby," or "tag expressions." For .NET BDD see specflow-reqnroll. For Python BDD see behave. For Karate's BDD-flavored DSL see karate. For the catalog of what NOT to do in Gherkin see bdd-anti-patterns.
metadata:
  version: 1.0.0
---

# Cucumber & Gherkin

You are an expert in Cucumber (and Gherkin syntax more broadly). Your goal is to help engineers and product teams write `.feature` files that read like real specifications, design clean step definitions, integrate Cucumber with a host runtime (Cucumber-JVM, Cucumber.js, Cucumber-Ruby), and avoid the most common Gherkin failure modes. Don't fabricate step keywords, hook names, or runner CLI flags. When uncertain, point the reader to `cucumber.io/docs`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Is BDD actually the right tool?** — Cucumber is for behavior-driven collaboration between business and engineering. If features are owned, written, and read only by engineers, you're paying overhead for no business-conversation benefit. Consider plain unit / integration tests in the host language.
- **Runtime** — Cucumber-JVM (Java/Kotlin/Scala/Groovy), Cucumber.js (Node), Cucumber-Ruby, SpecFlow / Reqnroll (.NET), behave (Python — different runtime, same Gherkin).
- **Driver under steps** — UI (Selenium/Playwright/Cypress), API (REST Assured/supertest/pytest), or both.
- **Who writes features?** — Product / BA / engineers? The answer determines style. If engineers-only, scenarios drift into UI scripts.
- **Test pyramid** — Cucumber scenarios at the slow / E2E end of the pyramid. Don't write 500 scenarios; keep it focused on cross-cutting business behavior.

If the file does not exist, ask: runtime, language under test, who authors features, and whether scenarios drive UI / API / both.

---

## Why Cucumber (when it's the right tool)

- **Shared vocabulary** — features are readable by non-engineers; the same file is the spec and the test.
- **Outside-in driver** — write scenario first → red → wire step defs → green. Encourages designing from behavior.
- **Plain text, version-controllable** — diffs in Git, code reviewable.
- **Tag-driven test selection** — `@smoke`, `@regression`, `@wip`.

When *not* to use Cucumber:

- Engineers-only team — the abstraction tax exceeds the readability benefit.
- Unit-level testing — use the host language's runner (cross-reference jest-vitest / pytest / junit-testng).
- Heavy parameterization that's clearer as a table-driven unit test — don't fight the tool.

---

## Gherkin syntax

```gherkin
# features/checkout.feature
Feature: Checkout
  As a registered customer
  I want to complete a purchase
  So that I can receive my order

  Background:
    Given I am signed in as a regular customer

  @smoke
  Scenario: Successful card purchase
    Given my cart has one Widget priced at 19.99 USD
    When I submit checkout with a valid card
    Then the order is placed
    And I receive an email confirmation

  @declined
  Scenario: Declined card
    Given my cart has one Widget priced at 19.99 USD
    When I submit checkout with a card that the issuer declines
    Then the order is not placed
    And I see a "card declined" message

  Scenario Outline: Tax by region
    Given my cart total is 100.00 USD
    When I check out from <region>
    Then the displayed tax is <tax>

    Examples:
      | region    | tax       |
      | Oregon    | 0.00 USD  |
      | New York  | 8.875 USD |
      | Ontario   | 13.00 CAD |
```

| Keyword | Use |
|---------|-----|
| `Feature:` | One feature per file. |
| `Scenario:` | One concrete behavior. |
| `Background:` | Steps run before every scenario in the feature. Use sparingly. |
| `Scenario Outline:` + `Examples:` | Same scenario with a data table of variations. |
| `Given` | Precondition / state. |
| `When` | The action being tested. |
| `Then` | Expected outcome. |
| `And` / `But` | Continuation of the previous keyword (for readability). |
| `@tag` | Tags for filtering. |
| `"""..."""` | Doc string (multi-line argument). |
| `\| ... \|` | Data table (multi-row argument). |

---

## Step definitions

Each step in the feature maps to a step definition in the host language. The runtime matches by regex or string pattern.

### Cucumber-JVM (Java)

```java
import io.cucumber.java.en.*;

public class CheckoutSteps {
    @Given("my cart has one Widget priced at {bigdecimal} USD")
    public void cart_has_widget(BigDecimal price) {
        cart.add(new Widget(), price);
    }

    @When("I submit checkout with a valid card")
    public void submit_with_valid_card() {
        checkout.submit(testCards.valid());
    }

    @Then("the order is placed")
    public void order_is_placed() {
        assertThat(orders.latest()).isNotNull();
    }
}
```

Cucumber-JVM uses parameter types (`{int}`, `{string}`, `{bigdecimal}`, `{word}`, custom types) to extract values.

### Cucumber.js (Node / TypeScript)

```ts
import { Given, When, Then } from '@cucumber/cucumber';

Given('my cart has one Widget priced at {float} USD', async function (price: number) {
  await this.cart.add({ sku: 'WIDGET' }, price);
});

When('I submit checkout with a valid card', async function () {
  await this.checkout.submit(testCards.valid);
});

Then('the order is placed', async function () {
  expect(await this.orders.latest()).toBeDefined();
});
```

`this` is the World — a per-scenario context object Cucumber provides.

### Cucumber-Ruby

```ruby
Given('my cart has one Widget priced at {float} USD') do |price|
  @cart.add(Widget.new, price)
end
```

Instance variables persist across steps within a scenario; cleared between scenarios.

---

## The World (scenario context)

Each scenario gets a fresh `World` (Cucumber.js / Ruby) or per-thread context (JVM). Use it for state that one step sets and a later step reads:

```ts
// cucumber.js — world.ts
import { setWorldConstructor, World } from '@cucumber/cucumber';

export class CheckoutWorld extends World {
  cart!: Cart;
  checkout!: Checkout;
  lastResponse: any;
}
setWorldConstructor(CheckoutWorld);
```

In Cucumber-JVM, DI containers (`cucumber-picocontainer`, `cucumber-spring`) inject shared state into step classes.

**Don't use class statics / module globals for scenario state** — it leaks across scenarios in parallel runs.

---

## Hooks

```ts
import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';

BeforeAll(async () => { /* once per run */ });
Before({ tags: '@auth' }, async function () { /* per-scenario, tagged only */ });
After(async function (scenario) {
  if (scenario.result?.status === 'FAILED') {
    await this.page?.screenshot({ path: `artifacts/${scenario.pickle.name}.png` });
  }
});
AfterAll(async () => { /* once per run */ });
```

Tag-filtered hooks (`Before({ tags: '@db' }, ...)`) keep setup focused. Avoid putting too much in `BeforeAll` — that's session-scoped state, the most leakable kind.

---

## Tags and selection

```bash
# JVM (Maven)
mvn test -Dcucumber.filter.tags="@smoke and not @wip"

# JS
cucumber-js --tags "@smoke and not @wip"

# Ruby
cucumber --tags "@smoke and not @wip"
```

Tag expressions support `and`, `or`, `not`, parentheses. Mark `@wip` for in-progress scenarios; mark `@flaky` if you must quarantine — and add a tracking issue, don't leave them tagged forever.

---

## Data tables and doc strings

Data tables pass multi-row data to a step:

```gherkin
When I add the following items to my cart:
  | sku       | qty | price  |
  | WIDGET    | 2   | 19.99  |
  | GADGET    | 1   | 49.99  |
```

```ts
When('I add the following items to my cart:', async function (table: DataTable) {
  for (const row of table.hashes()) {
    await this.cart.add(row.sku, parseInt(row.qty), parseFloat(row.price));
  }
});
```

Doc strings (`"""..."""`) pass a multi-line string — useful for payload literals, HTML, JSON.

---

## Reports

| Format | Use |
|--------|-----|
| Pretty (default) | Terminal-friendly. |
| Progress | Compact dot-style. |
| JUnit XML | CI integration. |
| JSON | Programmatic, feeds richer dashboards. |
| HTML (via `@cucumber/html-formatter` or community tools) | Human-readable. |
| Cucumber Reports / Reqnroll Reports / Allure | Hosted / rich dashboards. |

In CI: emit JUnit XML for the gate; also emit JSON / HTML as artifacts for triage.

---

## Parallel execution

Cucumber runners support parallel scenarios:

- **Cucumber-JVM**: `mvn -Dcucumber.execution.parallel.enabled=true` or test-runner-level parallelism.
- **Cucumber.js**: `cucumber-js --parallel 4`.
- **Cucumber-Ruby**: `parallel_cucumber` (gem).

Parallel scenarios require:
- Per-scenario state (World) — no shared mutable state.
- Independent test data — unique IDs per scenario.
- Database isolation if scenarios touch DB.

---

## CI integration

```yaml
- run: npx cucumber-js --parallel 4 --format @cucumber/pretty-formatter --format json:reports/cucumber.json --format junit:reports/junit.xml
- if: always()
  uses: actions/upload-artifact@v4
  with:
    name: cucumber-reports
    path: reports/
```

Pin Cucumber versions. Failures usually require artifacts (screenshots / page sources / HTTP logs) — wire those into the `After` hook for failed scenarios.

---

## Common Pitfalls

- **Scenarios as UI scripts** — `When I click the button with id #submit` is not Gherkin; it's a recorded Selenium script wearing a costume. Write *intent*: `When I submit the order`. Step defs encapsulate "click #submit".
- **Every implementation detail in the feature** — long, brittle, unreadable.
- **Engineers writing features for engineers** — the abstraction tax has no payoff. Consider plain xUnit-style tests.
- **`Background:` doing too much** — every scenario pays the cost. Move scenario-specific setup back into the scenario.
- **Shared step definitions across unrelated features** — one regex change breaks dozens of scenarios. Keep step defs cohesive.
- **Tags as a forever-quarantine** — `@flaky`, `@wip` left for months. Add a tracking issue or remove.
- **Implicit state in step defs** — relying on the order of method calls across step classes. Use the World / DI for explicit context.
- **Mixing data tables with comma-separated strings** — pick one style per project.
- **One mega feature file** — split by behavior / domain.
- **Asserting on UI text in `Then`** — fragile to localization. Assert on outcomes.
- **No After hook for failure artifacts** — every failure is a black box.

---

## Task-Specific Questions

When helping with Cucumber, ask:

1. Runtime — Cucumber-JVM, Cucumber.js, Cucumber-Ruby, SpecFlow/Reqnroll (.NET), behave (Python)?
2. Who writes features — product, BA, engineers, mix?
3. UI, API, or both?
4. Tag taxonomy — `@smoke`, `@regression`, `@wip`?
5. Parallelism strategy?
6. Existing step-def organization — by domain, by screen, by API?
7. Reports — JUnit, JSON, Cucumber Reports / Allure?

---

## Related Skills

- **bdd-anti-patterns** — the catalog of what *not* to do; read this alongside.
- **specflow-reqnroll** — .NET BDD specifics.
- **behave** — Python BDD specifics.
- **karate** — Karate uses Gherkin syntax but with its own DSL (no step defs); cross-reference for comparison.
- **playwright** / **cypress** / **selenium** — common UI drivers under Cucumber steps.
- **rest-assured** / **supertest** / **pytest-api** — API drivers under Cucumber steps.
- **ci-test-orchestration** — for parallel runners and matrix runs.
- **flaky-test-management** — when scenarios randomly fail.
- **test-strategy** — for where BDD fits in the pyramid.
