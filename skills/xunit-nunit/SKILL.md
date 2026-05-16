---
name: xunit-nunit
description: When the user wants to design, implement, debug, or optimize unit / integration tests in .NET using xUnit, NUnit, or MSTest. Use when the user mentions "xUnit," "NUnit," "MSTest," "[Fact]," "[Theory]," "InlineData," "[Test]," "[TestCase]," "[TestFixture]," "Moq," "NSubstitute," "FluentAssertions," "Shouldly," "FsCheck," "dotnet test," "Verify," "Snapshooter," or "WebApplicationFactory." For JS/TS see jest-vitest. For Python see pytest. For Java see junit-testng. For Go see go-test.
metadata:
  version: 1.0.0
---

# xUnit, NUnit, and MSTest

You are an expert in the three major .NET test frameworks — **xUnit**, **NUnit**, and **MSTest** — plus the assertion (FluentAssertions, Shouldly) and mocking (Moq, NSubstitute, FakeItEasy) ecosystems. Your goal is to help engineers write maintainable .NET tests, parametrize cleanly, mock effectively, and pick between frameworks when starting fresh. Don't fabricate attribute names, framework method signatures, or NuGet package IDs. When uncertain, point the reader to the official docs (`xunit.net`, `docs.nunit.org`, or Microsoft's testing docs).

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Which framework?** — xUnit is the modern .NET default and what most newer Microsoft docs use. NUnit is also widely adopted with rich attribute model. MSTest is built-in but less feature-rich; most teams prefer xUnit or NUnit.
- **.NET version** — .NET 6 / 7 / 8 / 9. Test SDKs need to be aligned with the target framework.
- **Assertion style** — built-in (`Assert.Equal`), **FluentAssertions** (fluent, recommended), or **Shouldly**.
- **Mocking library** — **Moq** (most common), **NSubstitute** (clean syntax), FakeItEasy. Avoid mixing.
- **Web / API testing** — `Microsoft.AspNetCore.Mvc.Testing` (`WebApplicationFactory`) is the in-process integration test infrastructure.

If the file does not exist, ask: framework, .NET version, assertion library, mocking library, and whether ASP.NET integration tests are in scope.

---

## Why one over the other

| Pick xUnit when… | Pick NUnit when… | Pick MSTest when… |
|------------------|------------------|-------------------|
| Greenfield .NET project | Rich attribute features (`[TestCase]`, `[Values]`, combinatorial) | Strict Microsoft-tooling constraint |
| Microsoft templates / docs alignment | Migrating from Java JUnit-style patterns | Existing MSTest investment |
| Constructor / `IClassFixture` model preferred | `[SetUp]` / `[OneTimeSetUp]` lifecycle preferred | (otherwise rarely the new default) |

xUnit and NUnit are both excellent. The conceptual difference is xUnit treats the constructor as `[SetUp]` (a new instance per test), while NUnit uses explicit lifecycle attributes. Most new projects choose xUnit; existing NUnit suites stay on NUnit.

---

## xUnit anatomy

```csharp
using Xunit;
using FluentAssertions;

public class EmailValidatorTests
{
    private readonly EmailValidator _validator = new();

    [Fact]
    public void Accepts_well_formed_address()
    {
        _validator.IsValid("qa.user@example.com").Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("no-at")]
    [InlineData("@only")]
    [InlineData("double@@at.com")]
    public void Rejects_malformed_address(string input)
    {
        _validator.IsValid(input).Should().BeFalse();
    }

    [Theory]
    [MemberData(nameof(EdgeCases))]
    public void Edge_cases(string email, bool expected)
    {
        _validator.IsValid(email).Should().Be(expected);
    }

    public static IEnumerable<object[]> EdgeCases => new[]
    {
        new object[] { "qa.user@example.com", true },
        new object[] { "a@b.co", true },
        new object[] { "  qa.user@example.com  ", false },
    };
}
```

| xUnit concept | Use |
|---------------|-----|
| `[Fact]` | One test method. |
| `[Theory]` + `[InlineData]` / `[MemberData]` / `[ClassData]` | Parametrized. |
| Constructor | Per-test setup (new instance per test). |
| `IDisposable.Dispose()` | Per-test teardown. |
| `IAsyncLifetime` | Async setup/teardown. |
| `[Collection]` + `ICollectionFixture<T>` | Share state across multiple test classes. |
| `[Trait]` | Filterable category. |
| `[Skip = "reason"]` | Conditional skip. |

xUnit creates a new instance of the test class for every test — this is intentional, eliminates shared state, and is the framework's biggest opinion.

---

## NUnit anatomy

```csharp
using NUnit.Framework;
using FluentAssertions;

[TestFixture]
public class EmailValidatorTests
{
    private EmailValidator _validator = null!;

    [SetUp]
    public void SetUp() => _validator = new EmailValidator();

    [Test]
    public void Accepts_well_formed_address()
    {
        _validator.IsValid("qa.user@example.com").Should().BeTrue();
    }

    [TestCase("")]
    [TestCase("no-at")]
    [TestCase("@only")]
    [TestCase("double@@at.com")]
    public void Rejects_malformed_address(string input)
    {
        _validator.IsValid(input).Should().BeFalse();
    }

    [TestCaseSource(nameof(EdgeCases))]
    public void Edge_cases(string email, bool expected)
    {
        _validator.IsValid(email).Should().Be(expected);
    }

    static object[] EdgeCases =
    {
        new object[] { "qa.user@example.com", true },
        new object[] { "a@b.co", true },
    };
}
```

| NUnit concept | Use |
|---------------|-----|
| `[Test]` | One test method. |
| `[TestFixture]` | Class containing tests (often inferred, optional in modern NUnit). |
| `[TestCase(...)]` / `[TestCaseSource(...)]` / `[Values]` / `[ValueSource]` | Parametrized. |
| `[SetUp]` / `[TearDown]` | Per-test. |
| `[OneTimeSetUp]` / `[OneTimeTearDown]` | Per-class. |
| `[Category("smoke")]` | Filterable. |
| `[Ignore("reason")]` | Skip. |

NUnit's `[Values]` and combinatorial test attributes (cross-product across multiple `[Values]` parameters) are unique strengths.

---

## MSTest anatomy (brief)

```csharp
[TestClass]
public class EmailValidatorTests
{
    [TestMethod]
    public void Accepts_well_formed_address()
    {
        Assert.IsTrue(new EmailValidator().IsValid("qa.user@example.com"));
    }

    [DataTestMethod]
    [DataRow("", false)]
    [DataRow("no-at", false)]
    public void Rejects_malformed_address(string input, bool expected)
    {
        Assert.AreEqual(expected, new EmailValidator().IsValid(input));
    }
}
```

Functional, but less expressive than xUnit / NUnit. New projects rarely pick MSTest unless mandated.

---

## FluentAssertions (recommended)

```csharp
order.Should().NotBeNull();
order!.Total.Should().Be(1999);
order.Items.Should().HaveCount(2)
    .And.ContainSingle(i => i.Sku == "sku-001");
order.PlacedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));

Action act = () => parse("");
act.Should().Throw<ArgumentException>().WithMessage("*empty*");
```

Fluent, chainable, and produces excellent diagnostic output on failure. Mostly framework-agnostic — works with xUnit, NUnit, and MSTest.

**Note on licensing**: FluentAssertions 8.x changed its license. Many teams pin to FluentAssertions 7.x or evaluate **Shouldly** as an alternative. Confirm the team's stance before adopting a new version.

---

## Mocking: Moq

```csharp
[Fact]
public void Charges_billing_on_checkout()
{
    var billing = new Mock<IBillingClient>();
    billing.Setup(b => b.Charge(It.IsAny<ChargeRequest>()))
        .Returns(new Charge("ch_synthetic", 1999));

    var service = new OrderService(billing.Object);
    service.Checkout(new Order("ord-1", 1999));

    billing.Verify(b => b.Charge(It.Is<ChargeRequest>(r => r.Amount == 1999)), Times.Once);
}
```

**Note on licensing**: Moq 4.x is still permissively licensed; Moq 4.20+ introduced telemetry that prompted some teams to switch. Pin a known-good version (4.18.x is a common pin) or evaluate **NSubstitute** / **FakeItEasy**.

```csharp
// NSubstitute (cleaner syntax)
var billing = Substitute.For<IBillingClient>();
billing.Charge(Arg.Any<ChargeRequest>()).Returns(new Charge("ch_synthetic", 1999));
service.Checkout(new Order("ord-1", 1999));
billing.Received(1).Charge(Arg.Is<ChargeRequest>(r => r.Amount == 1999));
```

Pick one mocking library per project.

---

## ASP.NET integration tests (`WebApplicationFactory`)

```csharp
public class CheckoutEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public CheckoutEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory
            .WithWebHostBuilder(builder => builder.ConfigureServices(services =>
            {
                services.AddScoped<IBillingClient, FakeBillingClient>();
            }))
            .CreateClient();
    }

    [Fact]
    public async Task Post_returns_201()
    {
        var resp = await _client.PostAsJsonAsync("/checkout",
            new { sku = "sku-001", qty = 1 });
        resp.StatusCode.Should().Be(HttpStatusCode.Created);
    }
}
```

`WebApplicationFactory<Program>` boots an in-process server using your real `Program.cs` / `Startup.cs`. Swap dependencies in `ConfigureServices`. Fast, deterministic, real serialization / middleware exercise.

---

## Test data builders

```csharp
public static class Build
{
    public static Order Order(int total = 1999) => new("ord-" + Guid.NewGuid().ToString()[..8], total);
}
```

Avoid `new Order(...)` everywhere with positional args. Builders keep tests readable and resilient to constructor changes.

For richer needs, **AutoFixture** generates objects automatically based on the type graph.

---

## Running

| Command | Purpose |
|---------|---------|
| `dotnet test` | Run all test projects. |
| `dotnet test path/to/Tests.csproj` | One project. |
| `dotnet test --filter "FullyQualifiedName~EmailValidator"` | Filter. |
| `dotnet test --filter "Category=smoke"` | NUnit category. |
| `dotnet test --collect:"XPlat Code Coverage"` | Coverage via Coverlet. |
| `dotnet test --logger "junit;LogFilePath=results.xml"` | JUnit XML (via JunitXml.TestLogger). |
| `dotnet test --blame-hang --blame-hang-timeout 60s` | Diagnose hangs. |
| `dotnet test -- xunit.parallelizeAssembly=true` | xUnit assembly-level parallelism. |

Verify against `dotnet test --help` for your installed SDK.

---

## Common Pitfalls

- **Mixing test frameworks in one project** — xUnit and NUnit can coexist in a solution but not in the same project. Don't even try.
- **Shared mutable static state** — between tests, even between test classes. xUnit's per-test instance hides some of this but not statics.
- **NUnit `[OneTimeSetUp]` doing too much** — same trap as JUnit `@BeforeAll` with mutation.
- **`Moq` with telemetry-version drift** — pin Moq, or switch to NSubstitute.
- **FluentAssertions 8.x license without checking** — verify the org's policy. 7.x is permissive; 8.x is not.
- **`Task.Result` / `Task.Wait` in tests** — deadlocks on UI / SyncContext, silent corruption. `await` everything.
- **`Assert.True(complex_expression)`** — produces unreadable diagnostics. Use FluentAssertions / Shouldly.
- **Tests that depend on Configuration` `appsettings.json` from the running process** — bring config explicitly into the test fixture.
- **Not using `WebApplicationFactory` for ASP.NET integration tests** — running a real Kestrel just to test endpoints is slower and adds infra noise.
- **Theory data that's mutable and shared** — surprising flake.

---

## Task-Specific Questions

When helping with .NET testing, ask:

1. xUnit, NUnit, or MSTest (and version)?
2. .NET version (6/7/8/9)?
3. Assertion library — FluentAssertions (which version?), Shouldly, built-in?
4. Mocking — Moq, NSubstitute, FakeItEasy?
5. ASP.NET integration tests in scope (`WebApplicationFactory`)?
6. Existing pattern — constructor injection per test (xUnit), `[SetUp]` (NUnit), or `[TestInitialize]` (MSTest)?
7. CI integration — JUnit XML logger, code coverage tool, test result reporter?

---

## Related Skills

- **jest-vitest** — JS/TS equivalent.
- **pytest** — Python equivalent.
- **junit-testng** — JVM equivalent.
- **go-test** — Go equivalent.
- **testcontainers** — `Testcontainers` for .NET exists; pair with integration tests.
- **mutation-testing** — `Stryker.NET` is the .NET tool.
- **code-coverage** — Coverlet is the de facto .NET coverage tool.
- **flaky-test-management** — when static / configuration state leaks.
- **ci-test-orchestration** — for `dotnet test` parallelism (assembly / class / collection levels) and matrix runs.
