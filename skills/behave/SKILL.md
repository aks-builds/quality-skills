---
name: behave
description: When the user wants to design, implement, debug, or operate BDD tests on Python using behave. Use when the user mentions "behave," "behave.ini," "@given/@when/@then," "context.x," "environment.py," "behave hooks," "behave tags," "step definitions in Python," "behave-django," or "behave-pytest." For language-agnostic Gherkin patterns see cucumber-gherkin. For .NET BDD see specflow-reqnroll. For BDD failure modes see bdd-anti-patterns. For non-BDD Python testing see pytest.
metadata:
  version: 1.0.0
---

# behave (Python BDD)

You are an expert in `behave` — Python's most established BDD framework — and the surrounding ecosystem (`environment.py` hooks, `behave-django`, `behave-pytest` integration). Your goal is to help engineers write Gherkin features with Python step definitions, manage scenario-scoped context, and integrate behave into CI. Don't fabricate behave decorators, context attributes, or runner flags. When uncertain, point the reader to `behave.readthedocs.io`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Is BDD the right call?** — same caveat as cucumber-gherkin: BDD's value comes from non-engineer collaboration. If only engineers write and read features, pytest is usually a better fit.
- **Python version** — behave is largely version-stable but tooling around it (linters, type checkers) targets modern Python.
- **Framework under test** — Django (`behave-django` runner), Flask, FastAPI, or pure library.
- **Driver beneath steps** — UI (Selenium, Playwright via the Python bindings), API (requests / httpx).
- **Existing pytest investment** — `pytest-bdd` is an alternative that runs Gherkin features inside pytest, getting fixtures and plugins. behave is a separate runner with its own ecosystem.

If the file does not exist, ask: framework, driver under steps, runner (behave vs pytest-bdd), and who authors features.

---

## Why behave

- **First-class Python BDD** — pure Python step definitions, no cross-language plumbing.
- **Familiar Gherkin** — `.feature` files identical to Cucumber's.
- **Clean hook model** — `environment.py` for `before_all` / `before_feature` / `before_scenario` / `before_step`.
- **Active community** — long-running project with stable patterns.

When *not* to use behave:

- Want full pytest fixture / plugin ecosystem → `pytest-bdd`.
- Team only writes / reads features as engineers — drop BDD entirely.
- Non-Python codebase — use the host language's BDD tool.

---

## Project layout

```
features/
├── checkout.feature
├── search.feature
├── steps/
│   ├── checkout_steps.py
│   ├── search_steps.py
│   └── common_steps.py
└── environment.py
```

`features/` is the conventional root. Step modules under `features/steps/` are auto-discovered. `environment.py` defines hooks.

---

## A feature

```gherkin
# features/checkout.feature
Feature: Checkout

  Background:
    Given I am signed in as a regular customer

  @smoke
  Scenario: Successful card purchase
    Given my cart has one Widget priced at 19.99 USD
    When I submit checkout with a valid card
    Then the order is placed

  Scenario Outline: Tax by region
    Given my cart total is 100.00 USD
    When I check out from <region>
    Then the displayed tax is <tax>

    Examples:
      | region   | tax       |
      | Oregon   | 0.00 USD  |
      | New York | 8.875 USD |
```

---

## Step definitions

```python
# features/steps/checkout_steps.py
from behave import given, when, then
from hamcrest import assert_that, equal_to, not_none

@given('I am signed in as a regular customer')
def step_signed_in(context):
    context.user = context.app.sign_in('qa.user@example.com', 'Pa$$w0rd-fake')

@given('my cart has one {item} priced at {price:f} USD')
def step_cart_has_item(context, item, price):
    context.cart.add(item, price)

@when('I submit checkout with a valid card')
def step_submit_valid(context):
    context.response = context.checkout.submit(card=context.app.test_cards.valid)

@then('the order is placed')
def step_order_placed(context):
    assert_that(context.response.status_code, equal_to(201))
    assert_that(context.app.orders.latest(), not_none())
```

`context` is behave's per-scenario state object. Attach anything to it; it's cleared between scenarios.

Step matching is via simple string template by default (`{price:f}` for a float). For regex matching, set `step_matcher('re')` at module top.

---

## Hooks (`environment.py`)

```python
# features/environment.py
def before_all(context):
    context.app = boot_app_under_test()
    context.config.setup_logging()

def before_feature(context, feature):
    if 'requires_db' in feature.tags:
        context.db.snapshot()

def before_scenario(context, scenario):
    context.cart = context.app.new_cart()
    context.checkout = context.app.new_checkout()

def after_scenario(context, scenario):
    if scenario.status == 'failed':
        screenshot_path = f'artifacts/{scenario.name}.png'
        context.app.screenshot(screenshot_path)

def after_all(context):
    context.app.shutdown()
```

Hooks see `context` plus a `feature` / `scenario` / `step` object as appropriate. Use them sparingly — too much state in hooks leaks across scenarios.

---

## Context attributes (and gotchas)

`context` has three scopes:

| Scope | Set during | Cleared after |
|-------|------------|---------------|
| `feature` | `before_feature` / `before_all` | `after_feature` |
| `scenario` | `before_scenario` | `after_scenario` |
| `step` | `before_step` | `after_step` |

Attributes set at `before_scenario` are automatically rolled back when the scenario ends, **provided you set them via `context.attr = ...`** (not `setattr(context, 'attr', ...)`).

**Common bug**: setting attributes in `before_all` that scenarios mutate. The mutation persists across all scenarios. Either keep `before_all` state immutable or reset in `before_scenario`.

---

## Data tables and doc strings

```gherkin
When I add the following items to my cart:
  | sku    | qty | price  |
  | WIDGET | 2   | 19.99  |
  | GADGET | 1   | 49.99  |
```

```python
@when('I add the following items to my cart')
def step_add_items(context):
    for row in context.table:
        context.cart.add(row['sku'], int(row['qty']), float(row['price']))
```

For doc strings:

```gherkin
When I POST the following JSON:
  """
  { "sku": "WIDGET", "qty": 2 }
  """
```

```python
@when('I POST the following JSON')
def step_post_json(context):
    context.response = context.client.post('/api/cart', data=context.text)
```

`context.table` and `context.text` are the standard arguments.

---

## Tags

```bash
behave --tags=@smoke
behave --tags='@smoke and not @wip'
behave --tags='@checkout or @cart'
```

Use tags to filter what runs. Same hygiene as cucumber-gherkin — don't let `@wip` / `@flaky` become permanent.

---

## behave-django

For Django apps, `behave-django` integrates Django's test runner (DB setup, transactional rollback, fixtures, `LiveServerTestCase`):

```bash
python manage.py behave --tags=@smoke
```

Each scenario can run in a Django test transaction (rolled back at end), giving DB isolation.

For Flask / FastAPI, use plain behave with a test fixture that boots the app — typically via `httpx.AsyncClient(transport=ASGITransport(app=app))` for FastAPI, or `app.test_client()` for Flask.

---

## pytest-bdd vs behave

`pytest-bdd` is an alternative library that runs Gherkin features inside pytest. Differences:

| Aspect | behave | pytest-bdd |
|--------|--------|------------|
| Runner | Own runner (`behave`) | pytest |
| Fixtures | `context` object | pytest fixtures (full ecosystem) |
| Plugins | behave's own | All pytest plugins |
| Maturity | Older, very stable | Active, growing |
| Friction | Self-contained | Mixes Gherkin into pytest's test discovery |

For Python teams already deep into pytest, pytest-bdd can be a smoother fit — you keep fixtures, parametrize, plugins. For teams that want a clear BDD-shaped runner, behave's separation is a feature.

---

## Running

| Command | Purpose |
|---------|---------|
| `behave` | Run all features. |
| `behave features/checkout.feature` | One file. |
| `behave features/checkout.feature:42` | Scenario at line 42. |
| `behave --tags=@smoke` | Tag filter. |
| `behave -k something` | Filter by name. |
| `behave -v` | Verbose. |
| `behave --no-capture --no-capture-stderr` | Show prints / logs in real time. |
| `behave -f json -o reports/behave.json` | JSON formatter for CI. |
| `behave -f junit --junit-directory reports/junit` | JUnit XML. |
| `behave --stop` | Stop on first failure. |

Verify flags with `behave --help` against your installed version.

---

## CI integration

```yaml
- run: pip install -r requirements-test.txt
- run: behave -f junit --junit-directory reports/junit -f pretty
- if: always()
  uses: actions/upload-artifact@v4
  with: { name: behave-reports, path: reports/ }
```

Pin behave version. For parallelism, behave doesn't have built-in parallel runners — use `parallel` (GNU) or split features across CI shards.

---

## Common Pitfalls

- **State leakage via `before_all`-set mutable attrs** — reset in `before_scenario`.
- **Step definitions doing UI clicks directly** — same anti-pattern as in any BDD tool. Wrap in domain language (`context.app.add_to_cart(...)`).
- **One mega `common_steps.py` shared across unrelated features** — split.
- **Asserting on UI text in `then`** — fragile to localization.
- **Mixing pytest and behave in the same project** — pick one runner per repo (or use pytest-bdd if you want pytest's ecosystem).
- **No artifact capture on failure** — every failed scenario should produce screenshot / DOM / logs via `after_scenario`.
- **`Then` steps that don't actually assert** — easy to write `then I see something` whose definition just `pass`es. Audit periodically.
- **Long Backgrounds** — every scenario in the feature pays the cost.
- **`@wip` tag permanently** — pair with a tracking issue or remove.

---

## Task-Specific Questions

When helping with behave, ask:

1. behave or pytest-bdd?
2. Python version?
3. Framework — Django, Flask, FastAPI, pure library?
4. UI driver — Selenium, Playwright, none (API-only)?
5. Reporting target — JUnit XML, behave JSON, Allure?
6. Tag taxonomy?
7. Who authors features — engineers only, or product/BA too?

---

## Related Skills

- **cucumber-gherkin** — the cross-language Gherkin canon.
- **bdd-anti-patterns** — read alongside.
- **specflow-reqnroll** — .NET equivalent.
- **pytest** — for non-BDD Python testing, or pytest-bdd alternative.
- **pytest-api** — common API driver under behave steps.
- **playwright** / **selenium** — common UI drivers (with Python bindings).
- **ci-test-orchestration** — for sharding behave (no built-in parallel).
- **flaky-test-management** — when scenarios randomly fail.
- **test-strategy** — for where BDD fits in the broader pyramid.
