---
name: karate
description: When the user wants to design, implement, debug, or scale Karate tests for API testing (and optionally UI/mocking/perf). Use when the user mentions "Karate," "Karate DSL," ".feature file in Karate," "karate.callonce," "karate-config.js," "Karate UI," "Karate mocks," "Karate gatling," or "io.karatelabs / com.intuit.karate." For pure Gherkin BDD see cucumber-gherkin. For Java fluent API testing see rest-assured. For Postman see postman-newman.
metadata:
  version: 1.0.0
---

# Karate

You are an expert in Karate — a domain-specific testing DSL built on top of Gherkin/Cucumber but designed specifically for API testing (with optional UI, mocking, and performance integration). Your goal is to help engineers write maintainable Karate `.feature` files, organize suites, and integrate Karate into CI. Don't fabricate Karate keywords, config keys, or Maven coordinates. When uncertain, point the reader to the official Karate docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Why Karate?** — Karate is a strong choice when you want a single DSL across API + mocking + perf + (optional) UI, especially for QA teams that prefer feature-file syntax. For pure Java code-first teams, rest-assured is usually more idiomatic.
- **Karate version** — major versions (0.9, 1.x, 1.4+) introduced changes. Confirm before guiding code.
- **Build tool** — Maven or Gradle. Coordinates are `io.karatelabs:karate-junit5` (or the older `com.intuit.karate:karate-junit5`). Verify the current group ID against your `pom.xml` / `build.gradle`.
- **What's Karate replacing?** — if it's replacing Postman, expect a translation pass. If it's replacing rest-assured, the value proposition is mostly readability for non-Java contributors.

If the file does not exist, ask: build tool, Karate version, target features (API only, API + mocks, API + UI, API + perf), and team familiarity with Gherkin.

---

## Why Karate

- **Single DSL across layers** — API, mocking (Karate Netty mocks), UI (Karate UI), and perf (Karate-Gatling) share one feature-file language.
- **No glue code for API tests** — unlike standard Cucumber, you don't write step definitions; Karate has built-in steps for HTTP, JSON, XML, and assertions.
- **JSON-native assertions** — `match response == { id: '#string', email: '#regex .*@example\\.com' }` reads naturally.
- **Parallel execution built-in** — `Runner.path(...).parallel(N)`.
- **JS scripting inside features** — for non-trivial setup that doesn't belong in test data.

When *not* to use Karate:

- Pure code-first JVM team comfortable with rest-assured.
- BDD-as-living-documentation use case where step definitions are valuable for clarity → cucumber-gherkin.
- Non-JVM ecosystem.

---

## Feature-file basics

```gherkin
Feature: Users API

Background:
  * url 'https://staging.example.com'
  * header Accept = 'application/json'
  * configure headers = { Authorization: 'Bearer bearer-token-placeholder' }

Scenario: get an existing user
  Given path 'users', 'user-42'
  When method get
  Then status 200
  And match response == { id: 'user-42', email: '#regex .*@example\\.com', roles: '#array' }

Scenario: create then delete a user
  Given path 'users'
  And request { email: 'qa.user@example.com', role: 'viewer' }
  When method post
  Then status 201
  * def userId = response.id

  Given path 'users', userId
  When method delete
  Then status 204
```

Note: Karate uses `*` for steps that aren't naturally Given/When/Then, and chains them implicitly.

---

## Matchers

`match` is Karate's signature operator. It supports deep equality with fuzzy markers:

| Marker | Meaning |
|--------|---------|
| `#string` | Any string. |
| `#number` | Any number. |
| `#boolean` | Any boolean. |
| `#null` / `#notnull` | Null check. |
| `#array` / `#object` | Type check. |
| `#regex pattern` | String matching a regex. |
| `#? expr` | Custom predicate (JS expression). |
| `#(value)` | Embed a variable. |

```gherkin
And match response ==
  """
  {
    id: '#string',
    email: '#regex .*@example\\.com$',
    age: '#? _ > 0',
    roles: '#array'
  }
  """
```

Variants: `match response contains { ... }` (partial), `match each response.users == { ... }` (every element), `match response.users[*].id == '#notnull'` (every element's `id` is not null).

---

## Reusable features (`call` / `callonce`)

Karate's primary reuse pattern is calling one feature from another.

```gherkin
# auth.feature
Feature: get a token

Scenario:
  Given url 'https://staging.example.com'
  And path 'auth', 'login'
  And request { email: 'qa.user@example.com', password: 'Pa$$w0rd-fake' }
  When method post
  Then status 200
  * def authToken = response.token
```

```gherkin
# Background of another feature
Background:
  * def auth = callonce read('classpath:helpers/auth.feature')
  * configure headers = { Authorization: '#("Bearer " + auth.authToken)' }
```

`call` runs every time; `callonce` caches per scenario/feature scope.

---

## Configuration (`karate-config.js`)

```js
function fn() {
  var env = karate.env || 'staging';
  var config = {
    baseUrl: 'https://staging.example.com',
    env: env,
  };
  if (env === 'prod') {
    config.baseUrl = 'https://api.example.com';
  }
  // shared helpers
  karate.configure('connectTimeout', 5000);
  karate.configure('readTimeout', 30000);
  return config;
}
```

This file is read at startup; everything it returns becomes available as `karate.<key>` and direct variables in features.

---

## JUnit 5 runner

```java
import com.intuit.karate.junit5.Karate;

class UsersRunnerTest {
    @Karate.Test
    Karate users() {
        return Karate.run("classpath:features/users.feature");
    }

    @Karate.Test
    Karate all() {
        return Karate.run("classpath:features").relativeTo(getClass());
    }
}
```

For parallel runs in CI, use a top-level runner:

```java
public class RunAllParallelTest {
    @Test
    void run() {
        Results results = Runner.path("classpath:features")
            .outputCucumberJson(true)
            .parallel(5);
        assertEquals(0, results.getFailCount(), results.getErrorMessages());
    }
}
```

---

## Mocking with Karate Netty

Karate can stand up a mock HTTP server defined by a feature file:

```gherkin
# mock-billing.feature
Feature: billing service mock

Background:
  * configure cors = true

Scenario: pathMatches('/charge') && methodIs('post')
  * def response = { id: 'ch_synthetic_123', status: 'succeeded' }
  * def responseStatus = 201
```

Start with `MockServer.feature("classpath:mock-billing.feature").http(8765).build();` and point the system under test at `localhost:8765` for tests that depend on the billing service.

---

## Perf via Karate-Gatling

Karate feature files can be reused as Gatling scenarios via `karate-gatling`:

```scala
import com.intuit.karate.gatling.PreDef._

class LoadSim extends Simulation {
  val protocol = karateProtocol(
    "/users/{id}" -> Nil
  )
  val createAndFetch = scenario("Create + Fetch").exec(karateFeature("classpath:features/users.feature"))
  setUp(createAndFetch.inject(rampUsers(50).during(60)).protocols(protocol))
}
```

Same feature, two purposes: regression and load. Cross-reference the gatling skill for Gatling-specific patterns.

---

## Common Pitfalls

- **Treating Karate like full Gherkin/Cucumber** — it isn't. Karate has its own DSL and doesn't use step definitions. Gherkin BDD anti-patterns still apply (long technical steps), but the language is different.
- **Putting credentials in `karate-config.js` and committing it** — config can read env vars (`karate.env`, `karate.properties`). Never commit secrets.
- **Huge feature files** — a `.feature` over a few hundred lines is hard to navigate. Split by resource or concern.
- **Calling features inside loops with `call` instead of `callonce`** — `call` re-runs every iteration; `callonce` caches.
- **Asserting full response equality with `match ==`** when fields are dynamic — use `#string`/`#regex`/`#notnull` markers, or `match contains` for partial matches.
- **Ignoring parallel execution** — Karate parallelizes well; running serial is usually a config issue, not a fundamental limit.
- **Mixing Karate with cucumber-java** — they share Gherkin syntax but are incompatible runtimes. Pick one.

---

## Task-Specific Questions

When helping with Karate, ask:

1. Karate version — what's in `pom.xml` / `build.gradle`?
2. Build tool — Maven or Gradle?
3. Just API, or also mocks / perf / UI?
4. Existing Postman, REST Assured, or Cucumber suite being migrated, or greenfield?
5. CI parallelism — `parallel(N)` per runner, plus matrix shards?
6. Authentication — captured once and reused via `callonce`, or fresh per scenario?
7. Reporting — Cucumber JSON, JUnit XML, Karate's built-in HTML, or Allure?

---

## Related Skills

- **cucumber-gherkin** — for the BDD-with-step-definitions model when business readability matters.
- **rest-assured** — JVM alternative when team prefers Java code.
- **postman-newman** — when migrating from Postman, or for QA-led complementary collections.
- **wiremock** — alternative service virtualization tool.
- **gatling** — for Gatling perf patterns when reusing Karate features.
- **ci-test-orchestration** — for tuning `parallel(N)` and matrix sharding.
- **pact-contract-testing** — Karate alone is not contract testing; layer Pact for consumer-driven contracts.
