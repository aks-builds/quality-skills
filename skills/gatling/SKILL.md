---
name: gatling
description: When the user wants to design, implement, debug, or operate Gatling load tests. Use when the user mentions "Gatling," "Gatling Simulation," "scenario.exec," "injectOpen," "constantUsersPerSec," "rampUsersPerSec," "atOnceUsers," "Gatling DSL," "Karate-Gatling," "Gatling Enterprise," "Frontline," or "io.gatling." For JS-based perf see k6. For JMeter see jmeter. For Python see locust. For Node see artillery.
metadata:
  version: 1.0.0
---

# Gatling

You are an expert in Gatling (Java / Scala / Kotlin load testing). Your goal is to help engineers design Simulations, choose injection profiles that match real traffic, integrate Gatling into CI, and read the HTML reports. Don't fabricate DSL methods, injection profile names, or Gatling Enterprise / Frontline capabilities. When uncertain, point the reader to `gatling.io/docs`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Language** — Gatling Simulations can be Java, Scala, or Kotlin. Java is the most accessible for most teams; Scala has historical depth. Confirm before guiding code.
- **Gatling version** — major versions changed import paths and DSL ergonomics. Gatling 3.x is the current generation; 2.x is legacy.
- **Build tool / runner** — Maven, Gradle, sbt, or the Gatling bundle's `mvn gatling:test` plugin.
- **Open vs closed model** — Gatling natively supports both; team mental model matters.
- **Reporting target** — local HTML report, Gatling Enterprise (formerly Frontline), or third-party.

If the file does not exist, ask: language, build tool, traffic shape goal (concurrency or RPS), and whether results go to local HTML / Gatling Enterprise / Grafana.

---

## Why Gatling

- **Code-first DSL** — Simulations are real source files, version-controllable, refactorable, lintable.
- **Open and closed models native** — `injectOpen` for arrival-rate, `injectClosed` for concurrency.
- **Async, high throughput** — built on Akka / Netty. A single node sustains far more virtual users than thread-per-VU tools.
- **Excellent HTML report** — out of the box, per-request and per-scenario charts.
- **Karate-Gatling integration** — reuse Karate features as load scenarios.

When *not* to use Gatling:

- Non-JVM team with no Java/Scala investment → k6, Locust, Artillery.
- Non-coder authors → JMeter's GUI is more accessible.
- Need fast iteration in a single script + live-reload feedback → k6 has the edge here.

---

## Simulation anatomy

```java
// Gatling 3.x Java DSL
import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.http.HttpProtocolBuilder;
import io.gatling.javaapi.core.ScenarioBuilder;

public class CheckoutSimulation extends Simulation {

  HttpProtocolBuilder http = http
    .baseUrl("https://staging.example.com")
    .acceptHeader("application/json")
    .userAgentHeader("gatling-qa");

  ScenarioBuilder browseThenCheckout = scenario("browse + checkout")
    .exec(http("GET /products").get("/api/products").check(status().is(200)))
    .pause(1, 3)
    .exec(http("POST /cart").post("/api/cart")
      .body(StringBody("{\"sku\":\"sku-001\",\"qty\":1}")).asJson()
      .check(status().is(201)))
    .pause(1, 2)
    .exec(http("POST /checkout").post("/api/checkout")
      .check(status().in(200, 201))
      .check(jsonPath("$.orderId").saveAs("orderId")));

  {
    setUp(
      browseThenCheckout.injectOpen(
        rampUsersPerSec(0).to(200).during(60),
        constantUsersPerSec(200).during(300)
      )
    ).protocols(http)
     .assertions(
       global().responseTime().percentile3().lt(300),  // p95 < 300ms
       global().failedRequests().percent().lt(0.5)     // < 0.5% errors
     );
  }
}
```

- **Protocol** declares shared HTTP defaults.
- **Scenario** is a sequence of `exec`/`pause`/`feed` steps.
- **Injection profile** (open or closed) drives load.
- **Assertions** make the run pass/fail in CI.

---

## Injection: open vs closed

| Profile | Question it answers |
|---------|---------------------|
| `atOnceUsers(N)` | "Spawn N users instantly." |
| `rampUsers(N).during(T)` | "Spawn N users evenly over T." |
| `constantUsersPerSec(N).during(T)` | "Arrive at N users/sec for T." (open) |
| `rampUsersPerSec(0).to(N).during(T)` | "Ramp arrival rate from 0 to N/sec over T." (open) |
| `injectClosed(constantConcurrentUsers(N).during(T))` | "Hold N concurrent users for T." (closed) |
| `injectClosed(rampConcurrentUsers(0).to(N).during(T))` | "Ramp concurrency from 0 to N." (closed) |

**For SLO-driven RPS goals, use open injection.** Closed injection holds concurrency and is sensitive to response time (same caveat as k6 VU executors / JMeter Thread Groups).

---

## Feeders (test data)

```java
FeederBuilder<String> users = csv("users.csv").circular();

ScenarioBuilder login = scenario("login")
  .feed(users)
  .exec(http("POST /auth/login")
    .post("/auth/login")
    .body(StringBody("{\"email\":\"#{email}\",\"password\":\"#{password}\"}")).asJson()
    .check(status().is(200))
    .check(jsonPath("$.token").saveAs("authToken")));
```

`csv(...)` / `jsonFile(...)` / `tsv(...)` are the built-in feeders. `.circular()`, `.shuffle()`, `.random()`, `.queue()` control iteration order. Custom feeders are plain Java/Scala lambdas.

`#{var}` is Gatling EL — references saved or fed variables in strings.

---

## Assertions (pass/fail)

```java
.assertions(
  global().responseTime().percentile3().lt(300),    // p95 < 300ms
  global().responseTime().percentile4().lt(1000),   // p99 < 1000ms
  global().failedRequests().percent().lt(0.5),
  forAll().responseTime().percentile3().lt(500),    // each request p95
  details("POST /checkout").failedRequests().count().lt(10L)
)
```

Without assertions, the run is a benchmark. With them, it's a gate.

---

## Running

| Build tool | Command |
|------------|---------|
| Maven | `mvn gatling:test -Dgatling.simulationClass=com.example.CheckoutSimulation` |
| Gradle | `./gradlew gatlingRun-com.example.CheckoutSimulation` |
| sbt | `sbt "gatling:testOnly com.example.CheckoutSimulation"` |
| Gatling bundle | `./bin/gatling.sh -s com.example.CheckoutSimulation` |

The Gatling Maven / Gradle plugins each have their own task names — verify with `mvn gatling:help` / `./gradlew tasks` against your build.

After a run, Gatling writes a self-contained HTML report under `target/gatling/<run-id>/` (or equivalent). Upload it as a CI artifact.

---

## CI integration

```yaml
- run: ./gradlew gatlingRun-com.example.CheckoutSimulation -Dbase_url=${{ vars.STAGING_URL }}
- if: always()
  uses: actions/upload-artifact@v4
  with:
    name: gatling-report
    path: build/reports/gatling
```

Gatling's exit code reflects assertion success — non-zero on failure. The HTML report has charts; for time-series dashboards, configure the Graphite / Influx exporter (or use Gatling Enterprise).

---

## Karate-Gatling

If the team uses Karate for API testing, Gatling can reuse the feature files:

```scala
import com.intuit.karate.gatling.PreDef._
class LoadSim extends Simulation {
  val protocol = karateProtocol("/users/{id}" -> Nil)
  val sce = scenario("S").exec(karateFeature("classpath:features/users.feature"))
  setUp(sce.inject(rampUsers(100).during(60)).protocols(protocol))
}
```

One source of truth across regression and load. Cross-reference karate.

---

## Common Pitfalls

- **No assertions** — run is a benchmark, not a gate.
- **Closed model for RPS goals** — concurrency-shaped load. Use open `injectOpen` with arrival-rate profiles.
- **Hardcoded base URL in code** — parameterize via system properties or env: `System.getProperty("base_url")`.
- **No pacing / pauses** — virtual users hammer faster than reality. Add `pause` reflecting think time.
- **Saving every variable** — Gatling EL saves are per-session; only save what later steps reference.
- **Tiny ramp-up at huge target** — `0 → 5000 in 5s` triggers connection-pool issues that aren't realistic. Ramp over minutes.
- **Misreading the report** — the "percentiles per request" chart is per-individual-sample. For server-side throughput, use the throughput chart, not response-time aggregation.
- **One Simulation file for every scenario** — split by domain. Smaller Simulations are easier to evolve.
- **Forgetting to pin Gatling and the build plugin versions** — DSL has evolved between minor versions.

---

## Task-Specific Questions

When helping with Gatling, ask:

1. Language — Java, Scala, Kotlin?
2. Build tool — Maven, Gradle, sbt, Gatling bundle?
3. Gatling version?
4. SLO target — concurrency or RPS shape?
5. Where does load run — local CI runner, dedicated perf box, Gatling Enterprise / Frontline?
6. Where do results go — HTML artifact, Grafana via Graphite/Influx, Gatling Enterprise?
7. Are there Karate features that should drive load via karate-gatling?

---

## Related Skills

- **k6** — JS-based modern alternative; lower JVM overhead.
- **jmeter** — when a GUI is required for non-coder authors.
- **locust** — Python equivalent.
- **artillery** — Node alternative.
- **karate** — combine with karate-gatling to reuse Karate features as load.
- **ci-test-orchestration** — for wiring Gatling assertions as required checks.
- **production-testing** — for synthetic monitoring as a complement.
- **test-strategy** — for positioning perf testing in the pyramid.
