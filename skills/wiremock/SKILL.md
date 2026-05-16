---
name: wiremock
description: When the user wants to virtualize HTTP services for testing — mocking downstream dependencies, simulating slow/error responses, recording-and-replay, or building a stub server for development. Use when the user mentions "WireMock," "stubFor," "mappings," "WireMockServer," "WireMock standalone," "request matching," "scenarios in WireMock," "fault injection," "WireMock Cloud," or "wiremock studio." For consumer-driven contracts see pact-contract-testing. For Karate's Netty mocks see karate. For language-native HTTP mocking see pytest-api / supertest.
metadata:
  version: 1.0.0
---

# WireMock

You are an expert in WireMock — a JVM-based HTTP service virtualization tool that can run embedded in tests or standalone. Your goal is to help engineers stand up reliable, deterministic stubs of HTTP dependencies so that tests for the system-under-test aren't blocked by flaky or unavailable downstream services. Don't fabricate WireMock matcher names, response transformers, or Java APIs. When uncertain, point the reader to `wiremock.org` or the GitHub docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Why WireMock?** — common reasons: simulating third-party APIs in tests, simulating slow/error responses, providing a shared stub server for dev/QA environments, recording-and-replay against a real upstream. Picking the right deployment mode (embedded vs standalone vs cloud) depends on the reason.
- **JVM or non-JVM project** — WireMock is JVM-native. Standalone mode is language-agnostic (it's just an HTTP server). For pure Node/Python teams, language-native mocking libraries are often more ergonomic for in-test mocking.
- **Stateful vs stateless stubs** — for stateless ("always return X"), basic stubs work. For state machines (login → token → resource), scenarios are needed.
- **Where stubs live** — in code (Java), in JSON mappings (portable), or recorded from a real service. Each has trade-offs.

If the file does not exist, ask: deployment mode (embedded / standalone / cloud), language of the system-under-test, stateful or stateless stubs, and how stubs will be versioned (in code vs JSON mapping files).

---

## Why WireMock

- **Flexible matching** — match on URL, method, headers, body (JSON Path, XPath, regex), query, cookies.
- **Response building** — static bodies, templated bodies, transformed bodies, delays, faults.
- **Scenarios** — stateful sequences (after this request, the next response changes).
- **Record-and-replay** — point WireMock at a real upstream, capture interactions, replay later.
- **Standalone or embedded** — Java tests can embed it; non-JVM teams can run the standalone jar/docker image.

When *not* to use WireMock:

- For *contract testing*, use Pact (see pact-contract-testing). WireMock stubs don't bind the provider; pacts do.
- For language-native in-process tests where a library like `responses` (Python) or `nock` (Node) is simpler.
- For full simulator/proxy tooling — WireMock is HTTP-focused; for gRPC/Kafka virtualization see other tools.

---

## Deployment modes

| Mode | When |
|------|------|
| **Embedded in JVM test** | Java/Kotlin/Groovy unit/integration tests. JUnit extension starts/stops it per class or method. |
| **Standalone server** | Polyglot teams — Docker container or jar. Configure via JSON mappings on disk. |
| **WireMock Cloud** | Hosted SaaS. Shared environment for cross-team integration. |

### Embedded (JUnit 5)

```java
@WireMockTest(httpPort = 0)  // 0 = random port
class BillingClientTest {

    @Test
    void chargesCard(WireMockRuntimeInfo wm) {
        stubFor(post("/charge")
            .withRequestBody(matchingJsonPath("$.amount", equalTo("1999")))
            .willReturn(jsonResponse("{\"id\":\"ch_synthetic_123\",\"status\":\"succeeded\"}", 201)));

        // ... invoke code that calls wm.getHttpBaseUrl() + "/charge"
        verify(postRequestedFor(urlEqualTo("/charge")));
    }
}
```

### Standalone

```bash
docker run --rm -p 8080:8080 \
  -v $(pwd)/mappings:/home/wiremock/mappings \
  wiremock/wiremock:<pinned-version>
```

Mappings folder contains JSON files like:

```json
{
  "request": {
    "method": "GET",
    "urlPath": "/users/user-42"
  },
  "response": {
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "jsonBody": { "id": "user-42", "email": "qa.user@example.com" }
  }
}
```

Re-load mappings without restart via the `/__admin/mappings/reset` admin endpoint.

---

## Matching

| Match on | Operators |
|----------|-----------|
| URL path | `urlEqualTo`, `urlPathEqualTo`, `urlMatching` (regex), `urlPathMatching`. |
| Query string | `withQueryParam("k", equalTo("v"))`. |
| Headers | `withHeader("Authorization", matching("Bearer .*"))`. |
| Body | `withRequestBody(equalToJson(...))`, `matchingJsonPath(...)`, `equalToXml(...)`, `matchingXPath(...)`, `containing(...)`. |
| Multiple criteria | All criteria must match — they AND together. |

Specificity beats priority: most specific stub wins for a given request. Explicit `.atPriority(N)` lets you order overlapping stubs.

---

## Responses

```java
.willReturn(aResponse()
    .withStatus(200)
    .withHeader("Content-Type", "application/json")
    .withBody("{\"id\":\"user-42\"}")
    .withFixedDelay(500)  // simulate 500ms latency
);
```

**Templating** (response built from request values) requires the response-template extension:

```json
{
  "response": {
    "transformers": ["response-template"],
    "body": "{\"echo\": \"{{request.body}}\"}"
  }
}
```

**Faults** (corrupted responses, dropped connections):

```java
.willReturn(aResponse().withFault(Fault.CONNECTION_RESET_BY_PEER))
```

Use faults sparingly — they verify retry/error paths that unit tests can't easily.

---

## Scenarios — stateful stubs

For sequences (login first → then return token-protected resource):

```java
stubFor(post("/auth/login")
    .inScenario("happy login")
    .whenScenarioStateIs(Scenario.STARTED)
    .willReturn(jsonResponse("{\"token\":\"t_synthetic\"}", 200))
    .willSetStateTo("logged_in"));

stubFor(get("/me")
    .inScenario("happy login")
    .whenScenarioStateIs("logged_in")
    .withHeader("Authorization", equalTo("Bearer t_synthetic"))
    .willReturn(jsonResponse("{\"id\":\"user-42\"}", 200)));
```

Reset scenarios between tests via `WireMock.resetScenarios()` (embedded) or the `/__admin/scenarios/reset` admin endpoint.

---

## Verifying calls

```java
verify(postRequestedFor(urlEqualTo("/charge"))
    .withRequestBody(matchingJsonPath("$.amount", equalTo("1999"))));

// Count assertions
verify(exactly(1), postRequestedFor(urlEqualTo("/charge")));
verify(moreThan(0), getRequestedFor(urlPathMatching("/users/.*")));
```

Use verification to assert that the code under test actually called the dependency in the expected way — that's the "interaction" part of integration testing.

---

## Recording and replay

WireMock can proxy requests to a real upstream and record the interactions:

```bash
curl -X POST http://localhost:8080/__admin/recordings/start \
  -d '{"targetBaseUrl": "https://real-upstream.example.com"}'

# ... drive the system under test against localhost:8080

curl -X POST http://localhost:8080/__admin/recordings/stop
# Resulting mappings end up in mappings/ on disk
```

Useful for bootstrapping stubs against an unstable upstream — but **always review the recordings**. They capture every header (including secrets) and every dynamic field. Recorded mappings tend to be too strict; loosen them deliberately.

---

## Admin API

WireMock exposes admin endpoints under `/__admin/`:

| Endpoint | Use |
|----------|-----|
| `GET /__admin/mappings` | List all stubs. |
| `POST /__admin/mappings/reset` | Reload from disk (standalone). |
| `POST /__admin/requests/reset` | Clear request history. |
| `GET /__admin/requests` | Get observed requests. |
| `POST /__admin/scenarios/reset` | Reset scenarios. |

Use these in non-JVM tests that need to interact with a standalone instance.

---

## Common Pitfalls

- **Treating WireMock stubs as contracts** — stubs don't bind the real provider. If the real provider changes, your stubs lie quietly. Use pact-contract-testing if you need real binding.
- **Recording without review** — recorded mappings include secrets, timestamps, request IDs. Triage every recording before committing.
- **Pinning `:latest` Docker image** — pin a version. WireMock changes API surface across versions.
- **Not resetting state between tests** — request history and scenarios bleed across tests. Reset in `@BeforeEach`.
- **One giant mappings folder** — split by service or feature. Use subdirectories.
- **`equalToJson` strict mode for partial matches** — by default `equalToJson` ignores extra fields if you pass the right flags; understand strict vs lenient.
- **Mixing record-replay with hand-written stubs in the same folder** — confusing. Keep them separate.
- **Stubbing your own application's HTTP API** — that's not what WireMock is for. Stub *downstream* dependencies.
- **Forgetting that delays slow CI** — `withFixedDelay(5000)` is great for testing timeouts; deadly when sprinkled liberally across a suite.

---

## Task-Specific Questions

When helping with WireMock, ask:

1. JVM-embedded test mode or standalone server mode?
2. Are stubs hand-written, recorded, or both?
3. How are stubs versioned — Java code, JSON mappings in Git, or a separate config repo?
4. Stateful sequences needed (scenarios), or stateless?
5. How are tests resetting state between runs?
6. Latency / fault injection requirements?
7. Is the goal interaction testing (verify calls happened) or just response stubbing?

---

## Related Skills

- **pact-contract-testing** — when you need real binding between consumer and provider.
- **karate** — Karate's Netty mocks are an alternative if you're already using Karate.
- **rest-assured** — common pairing inside JVM tests.
- **pytest-api** / **supertest** — for non-JVM stacks, often `responses` (Python) or `nock` (Node) is simpler than running WireMock standalone, but standalone WireMock is still valid for shared environments.
- **chaos-engineering** — WireMock faults are a primitive form of failure injection.
- **test-data-management** — recorded mappings often include data; treat them as test data subject to the same hygiene rules.
- **ci-test-orchestration** — running WireMock standalone in CI alongside the system under test.
