---
name: junit-testng
description: When the user wants to design, implement, debug, or optimize JUnit 5 (Jupiter) or TestNG tests on the JVM. Use when the user mentions "JUnit 5," "JUnit Jupiter," "@Test," "@ParameterizedTest," "@MethodSource," "@TestFactory," "TestNG," "@DataProvider," "@BeforeEach," "@BeforeMethod," "AssertJ," "Hamcrest," "Mockito," "MockK," "ArchUnit," or "Maven surefire / Gradle test." For JS/TS see jest-vitest. For Python see pytest. For .NET see xunit-nunit. For Java API testing see rest-assured.
metadata:
  version: 1.0.0
---

# JUnit & TestNG

You are an expert in JUnit 5 (Jupiter) and TestNG — the two dominant JVM unit and integration test frameworks. Your goal is to help engineers structure tests, parametrize cleanly, integrate with build tools and mocking libraries, and pick between the two when relevant. Don't fabricate JUnit/TestNG annotations, AssertJ / Mockito APIs, or Maven/Gradle plugin coordinates. When uncertain, point the reader to `junit.org/junit5` or `testng.org`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **JUnit or TestNG?** — JUnit 5 is the modern default for most JVM projects. TestNG is still common in legacy / Selenium-heavy suites (broad `@DataProvider`, group / dependency features).
- **JVM language** — Java, Kotlin, Groovy, Scala. Patterns transfer; Kotlin tests benefit from Kotest as an alternative if the team prefers a Kotlin-idiomatic API.
- **Build tool** — Maven (Surefire/Failsafe) or Gradle. Plugin configuration differs.
- **Assertion library** — built-in (`Assertions`), AssertJ (fluent, recommended), Hamcrest, Truth. Pick one per project.
- **Mocking library** — Mockito (most common), MockK (Kotlin-friendly), PowerMock (legacy, avoid for new code).
- **Spring / framework** — Spring Boot Test, Quarkus Test, Micronaut Test integrate at the framework level on top of JUnit/TestNG.

If the file does not exist, ask: framework, language, build tool, assertion library, mocking library, Spring or not.

---

## Why one over the other

| Pick JUnit 5 when… | Pick TestNG when… |
|--------------------|-------------------|
| Greenfield project | Existing TestNG suite |
| Selenium / Appium (both work, JUnit is fine) | Heavy `@DataProvider` + group / suite XML usage |
| Spring Boot (JUnit 5 is the integrated default) | Test dependency graphs (`dependsOnMethods`) |
| Modern IDE integration | Legacy patterns the team is fluent in |
| Most plugin / library docs target it | Suite XML-driven Selenium grids |

For new JVM projects, JUnit 5 is the default. TestNG remains valid for established suites and use cases that lean on its features.

---

## JUnit 5 anatomy

```java
import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.*;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.*;

@DisplayName("EmailValidator")
class EmailValidatorTest {

    EmailValidator validator;

    @BeforeEach
    void setUp() { validator = new EmailValidator(); }

    @Test
    void accepts_well_formed_address() {
        assertThat(validator.isValid("qa.user@example.com")).isTrue();
    }

    @ParameterizedTest(name = "[{index}] {0} is invalid")
    @ValueSource(strings = { "", "no-at", "@only", "double@@at.com" })
    void rejects_malformed_address(String input) {
        assertThat(validator.isValid(input)).isFalse();
    }

    @Nested
    @DisplayName("when input has trailing whitespace")
    class WithWhitespace {
        @Test
        void still_rejects() {
            assertThat(validator.isValid("qa.user@example.com  ")).isFalse();
        }
    }
}
```

Key annotations:

| Annotation | Purpose |
|------------|---------|
| `@Test` | One test method. |
| `@BeforeEach` / `@AfterEach` | Per-test setup/teardown. |
| `@BeforeAll` / `@AfterAll` | Per-class (must be static unless `@TestInstance(PER_CLASS)`). |
| `@ParameterizedTest` | Parametrized. |
| `@DisplayName` | Human-readable name in reports. |
| `@Nested` | Inner class grouping. |
| `@Tag("slow")` | Filterable. |
| `@Disabled` | Skip with reason. |
| `@RepeatedTest(N)` | Run N times. |

---

## Parameterized tests (JUnit 5)

| Source | Use |
|--------|-----|
| `@ValueSource(strings/ints/...)` | Inline literals. |
| `@CsvSource({"qa.user@example.com,true", "invalid,false"})` | CSV inline. |
| `@CsvFileSource(resources = "/cases.csv")` | External CSV file. |
| `@MethodSource("data")` | Method returning a `Stream`/`Iterable` of arguments. |
| `@EnumSource(MyEnum.class)` | Every enum value. |
| `@ArgumentsSource(MyProvider.class)` | Custom provider. |

```java
static Stream<Arguments> data() {
    return Stream.of(
        Arguments.of("qa.user@example.com", true),
        Arguments.of("not-an-email", false)
    );
}

@ParameterizedTest
@MethodSource("data")
void validates(String input, boolean expected) {
    assertThat(validator.isValid(input)).isEqualTo(expected);
}
```

---

## TestNG anatomy

```java
import static org.assertj.core.api.Assertions.assertThat;
import org.testng.annotations.*;

public class EmailValidatorTest {
    EmailValidator validator;

    @BeforeMethod
    public void setUp() { validator = new EmailValidator(); }

    @Test
    public void accepts_well_formed_address() {
        assertThat(validator.isValid("qa.user@example.com")).isTrue();
    }

    @Test(dataProvider = "malformed")
    public void rejects_malformed(String input) {
        assertThat(validator.isValid(input)).isFalse();
    }

    @DataProvider
    public Object[][] malformed() {
        return new Object[][] {
            { "" }, { "no-at" }, { "@only" }, { "double@@at.com" }
        };
    }
}
```

TestNG-specific concepts:

| Feature | JUnit equivalent |
|---------|------------------|
| `@Test(groups = {"smoke"})` + suite XML | `@Tag("smoke")` + maven/gradle filter |
| `@Test(dependsOnMethods = {"x"})` | No direct equivalent (intentionally, JUnit considers test order an anti-pattern) |
| `@DataProvider` | `@MethodSource` |
| `@BeforeMethod` / `@BeforeClass` / `@BeforeSuite` | `@BeforeEach` / `@BeforeAll` |
| Suite XML (`testng.xml`) | Build tool config + tags |

---

## Assertions: AssertJ vs Hamcrest vs built-in

| Library | Style |
|---------|-------|
| Built-in JUnit (`Assertions.assertEquals(...)`) | Procedural, terse, less expressive. |
| AssertJ (`assertThat(x).isEqualTo(y).hasSize(3).containsExactly(...)`) | Fluent, chainable, **strongly recommended**. |
| Hamcrest (`assertThat(x, is(equalTo(y)))`) | Matcher composition; older style. |
| Truth (Google) | Similar to AssertJ. |

Pick one per project — mixing styles makes maintenance painful. **AssertJ is the default recommendation** for new Java projects (rich diffs, autocomplete-driven discovery, plays well with Kotlin too).

---

## Mocking with Mockito

```java
@ExtendWith(MockitoExtension.class)
class OrderServiceTest {

    @Mock BillingClient billing;
    @InjectMocks OrderService service;

    @Test
    void charges_billing_on_checkout() {
        when(billing.charge(any())).thenReturn(new Charge("ch_synthetic", 1999));

        service.checkout(new Order("ord-1", 1999));

        ArgumentCaptor<ChargeRequest> captor = ArgumentCaptor.forClass(ChargeRequest.class);
        verify(billing).charge(captor.capture());
        assertThat(captor.getValue().amount()).isEqualTo(1999);
    }
}
```

Mockito 5+ runs on modern Java versions out of the box. Avoid `PowerMock` for new code — it mocks `static`/`final`/constructors but at significant complexity cost; modern Mockito's `mockito-inline` covers most of those cases.

For Kotlin, **MockK** is the idiomatic alternative (`every { x.foo() } returns ...` etc.).

---

## Spring Boot Test integration

```java
@SpringBootTest
@AutoConfigureMockMvc
class CheckoutControllerTest {

    @Autowired MockMvc mvc;
    @MockBean BillingClient billing;  // replaces the real bean

    @Test
    void post_returns_201() throws Exception {
        when(billing.charge(any())).thenReturn(new Charge("ch_synthetic", 1999));
        mvc.perform(post("/checkout").contentType("application/json").content("{...}"))
           .andExpect(status().isCreated());
    }
}
```

Spring's test slicing (`@WebMvcTest`, `@DataJpaTest`, `@WebFluxTest`) loads only part of the context — faster than `@SpringBootTest`.

---

## Build tool configuration

### Maven (Surefire / Failsafe)

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-surefire-plugin</artifactId>
  <configuration>
    <includes><include>**/*Test.java</include></includes>
    <parallel>classes</parallel>
    <threadCount>4</threadCount>
  </configuration>
</plugin>
```

Use Surefire for unit tests; Failsafe for integration tests (separate phases of the Maven lifecycle).

### Gradle

```kotlin
tasks.test {
    useJUnitPlatform()           // JUnit 5
    // or useTestNG()
    maxParallelForks = 4
    forkEvery = 100
    testLogging { events("passed", "failed", "skipped") }
}
```

For TestNG XML suites: `tasks.test { useTestNG { suites("src/test/resources/testng.xml") } }`.

---

## Running

| Command | Purpose |
|---------|---------|
| `mvn test` | Run unit tests (Surefire). |
| `mvn verify` | Unit + integration (Failsafe). |
| `mvn -Dtest=ClassName#methodName test` | One test. |
| `./gradlew test` | Gradle equivalent. |
| `./gradlew :module:test --tests "ClassName.methodName"` | One test in a module. |
| `mvn test -Dgroups="smoke"` | TestNG groups. |
| `./gradlew test --tests "ClassName" -i` | Info logging. |

---

## Common Pitfalls

- **Mixing JUnit 4 and JUnit 5 in the same module** — both can coexist via the vintage engine, but it's confusing. Migrate fully.
- **`@BeforeAll` not static in JUnit 5** — fails unless `@TestInstance(Lifecycle.PER_CLASS)` is set.
- **Shared mutable state at class level** — order dependence. Use `@BeforeEach` for fresh state.
- **Asserting on internal Mockito mocks instead of behavior** — over-mocking makes tests rigid. Mock at boundaries.
- **`PowerMock` in new code** — sign of testability gaps; refactor instead.
- **JUnit 5 with Maven Surefire older than 2.22** — older Surefire doesn't run Jupiter. Pin Surefire 3.x.
- **TestNG `dependsOnMethods` for "ordering"** — JUnit philosophy and modern testing wisdom say tests should be independent; if you find yourself needing ordering, the tests are coupled.
- **Mega `@BeforeEach` doing 5 things** — split into helper methods or fixtures (smaller `@BeforeEach`s in `@Nested` classes).
- **Hardcoded data in `@CsvSource`** — for large data, use `@CsvFileSource` or `@MethodSource`.
- **Disabled flaky tests left disabled forever** — at minimum, link to a tracking issue. Otherwise they're dead weight.

---

## Task-Specific Questions

When helping with JUnit / TestNG, ask:

1. JUnit 5 or TestNG?
2. JVM language — Java, Kotlin, Groovy, Scala?
3. Build tool — Maven or Gradle?
4. Assertion library — AssertJ, Hamcrest, built-in?
5. Mocking — Mockito, MockK, PowerMock (try to leave PowerMock)?
6. Spring / framework integration?
7. Test scope mix — pure units, slice tests, integration with Testcontainers?

---

## Related Skills

- **jest-vitest** — JS/TS equivalent.
- **pytest** — Python equivalent.
- **xunit-nunit** — .NET equivalent.
- **rest-assured** — paired for API tests on JVM.
- **karate** — alternative for API + UI on JVM.
- **testcontainers** — Java's `org.testcontainers:testcontainers` is the canonical pairing for integration tests needing real infra.
- **mutation-testing** — `PIT` is the JVM tool.
- **code-coverage** — JaCoCo on JVM.
- **ci-test-orchestration** — for Gradle test parallelism / Maven Surefire forks across CI workers.
- **flaky-test-management** — when class-level state leaks.
