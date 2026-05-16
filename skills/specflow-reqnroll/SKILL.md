---
name: specflow-reqnroll
description: When the user wants to design, implement, debug, or migrate BDD tests on .NET using SpecFlow or its open-source successor Reqnroll. Use when the user mentions "SpecFlow," "Reqnroll," "[Binding]," "[Given]," "[When]," "[Then]," ".feature file in .NET," "SpecFlow+ LivingDoc," "SpecFlow.Tools.MsBuild.Generation," "Reqnroll migration," or ".NET BDD." For language-agnostic Gherkin patterns see cucumber-gherkin. For Java BDD see cucumber-gherkin (Cucumber-JVM). For Python BDD see behave. For BDD failure modes see bdd-anti-patterns.
metadata:
  version: 1.0.0
---

# SpecFlow & Reqnroll (.NET BDD)

You are an expert in BDD on .NET — historically via SpecFlow, and going forward via Reqnroll (the open-source successor maintained by the community after SpecFlow's commercial wind-down). Your goal is to help engineers run, maintain, and migrate .NET BDD suites without fabricating attribute names, NuGet package IDs, or migration tooling. When uncertain, point the reader to `reqnroll.net` or the archived SpecFlow docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **SpecFlow status** — Tricentis announced SpecFlow's end-of-life. **Reqnroll** is the actively-maintained, open-source, near-drop-in fork. New projects should use Reqnroll; existing SpecFlow projects should plan migration.
- **.NET version** — Reqnroll targets modern .NET (6/7/8/9). Older SpecFlow installations may be pinned to .NET Framework.
- **Test runner** — xUnit, NUnit, or MSTest. Both SpecFlow and Reqnroll integrate with all three.
- **Migration state** — is the team on SpecFlow today, planning Reqnroll migration, or starting fresh?
- **Reporting** — SpecFlow+ LivingDoc was a paid feature; Reqnroll has community-equivalent open-source options.

If the file does not exist, ask: SpecFlow or Reqnroll, .NET version, test runner, current/planned reporting tool.

---

## The SpecFlow → Reqnroll situation

In 2024, Tricentis announced SpecFlow would be deprecated. Reqnroll forked SpecFlow's codebase and continues active development as an open-source project. For most teams:

- **New project**: use Reqnroll.
- **Existing SpecFlow project**: plan a Reqnroll migration. The migration is typically straightforward (rename NuGet packages, rename namespaces — the surface API is highly compatible).
- **Don't pretend SpecFlow has a long future**: even if your current build still works, the package will not get fixes for new .NET versions indefinitely.

Reqnroll keeps the same Gherkin features and the same `[Binding]` / `[Given]` / `[When]` / `[Then]` attribute model as SpecFlow — most existing code compiles after a namespace swap.

---

## Project setup (Reqnroll)

NuGet packages (verify current versions):

```xml
<PackageReference Include="Reqnroll" Version="<pinned-version>" />
<PackageReference Include="Reqnroll.xUnit" Version="<pinned-version>" />          <!-- or .NUnit / .MsTest -->
<PackageReference Include="Reqnroll.Tools.MsBuild.Generation" Version="<pinned-version>" />
<PackageReference Include="Microsoft.NET.Test.Sdk" Version="<pinned-version>" />
<PackageReference Include="xunit" Version="<pinned-version>" />
<PackageReference Include="xunit.runner.visualstudio" Version="<pinned-version>" />
```

`.feature` files live in the test project. Reqnroll's MSBuild generator produces code-behind files at build time.

For SpecFlow, replace `Reqnroll` → `SpecFlow` in the package names; the rest is structurally identical.

---

## A feature

```gherkin
# Checkout.feature
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

```csharp
using Reqnroll;            // or TechTalk.SpecFlow for SpecFlow
using FluentAssertions;

[Binding]
public class CheckoutSteps
{
    private readonly ScenarioContext _scenarioContext;
    private readonly Cart _cart;
    private readonly Checkout _checkout;

    public CheckoutSteps(ScenarioContext scenarioContext, Cart cart, Checkout checkout)
    {
        _scenarioContext = scenarioContext;
        _cart = cart;
        _checkout = checkout;
    }

    [Given(@"I am signed in as a regular customer")]
    public void SignedInAsCustomer() => _checkout.SignIn("qa.user@example.com");

    [Given(@"my cart has one Widget priced at ([\d.]+) USD")]
    public void CartHasWidgetAt(decimal price) => _cart.Add(new Widget(), price);

    [When(@"I submit checkout with a valid card")]
    public void SubmitWithValidCard() => _checkout.Submit(TestCards.Valid);

    [Then(@"the order is placed")]
    public void OrderIsPlaced() => _checkout.LatestOrder.Should().NotBeNull();
}
```

Step definitions are decorated `[Binding]` classes. Reqnroll injects constructor dependencies — use them for shared state across step classes within a scenario.

---

## Scenario context and dependency injection

| Mechanism | Use |
|-----------|-----|
| `ScenarioContext` | Per-scenario dictionary-like storage. |
| `FeatureContext` | Per-feature storage. Avoid mutating from steps. |
| Constructor DI | Recommended pattern — Reqnroll/SpecFlow inject types you register. |
| `[BeforeScenario]` / `[AfterScenario]` | Hooks. |
| `[BeforeTestRun]` / `[AfterTestRun]` | Once-per-run hooks (static). |

Use constructor DI for typed state — `Cart`, `Checkout`, etc. — and `ScenarioContext` for ad-hoc key/value carrying within a scenario.

```csharp
[Binding]
public class Hooks
{
    [BeforeScenario("@auth")]
    public void EnsureSignedIn(ScenarioContext context) { /* ... */ }

    [AfterScenario]
    public void CaptureFailure(ScenarioContext context)
    {
        if (context.TestError != null) { /* save artifact */ }
    }
}
```

---

## Parameter binding

```csharp
[Given(@"my cart total is (\d+\.\d+) (USD|EUR|CAD)")]
public void CartTotalIs(decimal total, string currency) { /* ... */ }
```

For typed enums / domain objects, register a `[StepArgumentTransformation]`:

```csharp
[StepArgumentTransformation]
public Money ConvertMoney(string raw) => Money.Parse(raw);

[Given(@"my cart total is (.+)")]
public void CartTotalIs(Money total) { /* ... */ }
```

Cleaner step text and reusable conversion.

---

## Tag-based selection

```bash
# xUnit
dotnet test --filter "TestCategory=smoke"

# NUnit
dotnet test --filter "Category=smoke"
```

Tags from `@smoke` become test categories in the generated test methods. The exact filter syntax varies by runner — verify against your runner's docs.

---

## Reports

- **SpecFlow+ LivingDoc** (commercial, archived) — was the gold standard. New projects should use community alternatives.
- **Reqnroll LivingDoc / community equivalents** — actively evolving open-source options.
- **Allure** integrates with all three runners.
- **JUnit XML** via `xunit.runner.visualstudio` / `nunit` `--logger junit;...`.

For CI dashboards, JUnit XML is the lowest common denominator.

---

## Running

```bash
dotnet test                                          # all tests including BDD
dotnet test --filter "Category=smoke"                # tag filter
dotnet test --filter "FullyQualifiedName~Checkout"   # by class name
dotnet test --logger "junit;LogFilePath=results.xml" # CI integration
```

Verify with `dotnet test --help` against your installed SDK.

---

## Migrating SpecFlow → Reqnroll

Typical steps (verify against current Reqnroll migration docs):

1. Replace NuGet packages: `SpecFlow.*` → `Reqnroll.*`.
2. Update namespaces in step definition files: `TechTalk.SpecFlow` → `Reqnroll`.
3. Update `specflow.json` → `reqnroll.json` (settings file rename).
4. Rebuild — the code-behind generator runs and produces Reqnroll-compatible output.
5. Run the suite; investigate any test changes (most pass through unmodified).

For mixed migration, both packages can't coexist in the same project — migrate one project at a time.

---

## Common Pitfalls

- **Staying on SpecFlow indefinitely** — future .NET versions won't be supported. Plan migration.
- **Static state in step classes** — leaks across scenarios in parallel runs. Use DI.
- **`FeatureContext` mutation from steps** — meant for feature-level read-only data, not scenario state.
- **One mega step class with 50 bindings** — split by domain.
- **Regex bindings without parameter types** — error-prone. Use parameter types when possible.
- **`[BeforeTestRun]` doing expensive setup that should be per-scenario** — slow startup, leaky state.
- **Same step text bound in multiple classes** — runtime ambiguity error. Cucumber/SpecFlow/Reqnroll all fail when bindings collide.
- **Asserting on UI text in `Then`** — localization break.
- **Migrating SpecFlow→Reqnroll without pinning Reqnroll version** — pin, test, then unpin only when comfortable.

---

## Task-Specific Questions

When helping with SpecFlow / Reqnroll, ask:

1. SpecFlow (current version) or Reqnroll? Migration planned?
2. .NET version?
3. Test runner — xUnit, NUnit, MSTest?
4. DI framework — Reqnroll's built-in, custom (Autofac, Microsoft.Extensions.DependencyInjection)?
5. Reporting target — JUnit XML for CI, LivingDoc, Allure?
6. Parallelism strategy — assembly / class / collection level?
7. UI / API driver under steps?

---

## Related Skills

- **cucumber-gherkin** — the cross-language Gherkin canon; principles transfer.
- **bdd-anti-patterns** — read alongside; same failures recur in .NET BDD.
- **xunit-nunit** — for the underlying test-runner specifics.
- **behave** — Python BDD equivalent.
- **selenium** / **playwright** — common UI drivers under steps.
- **rest-assured** equivalent: REST testing in .NET typically uses `RestSharp` or `HttpClient` directly inside step defs.
- **ci-test-orchestration** — for parallel runs and matrix sharding.
- **test-strategy** — for placing BDD in the pyramid.
