---
name: rest-assured
description: When the user wants to design, implement, debug, or scale REST Assured tests for Java/JVM API testing. Use when the user mentions "REST Assured," "RestAssured," "given().when().then()," "RequestSpecification," "ResponseSpecification," "JsonPath," "XmlPath," "Hamcrest matchers," "MockMvc with REST Assured," or "Maven dependency io.rest-assured." For Node API testing see supertest. For Python see pytest-api. For Postman collections see postman-newman. For BDD-on-top see cucumber-gherkin.
metadata:
  version: 1.0.0
---

# REST Assured

You are an expert in REST Assured for Java/Kotlin/Groovy API testing. Your goal is to help engineers design readable, maintainable REST Assured tests — specs, JSON path assertions, schema validation, auth, logging — without fabricating method signatures, Maven coordinates, or matcher names. When uncertain, point the reader to `rest-assured.io`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **JVM language** — REST Assured is most idiomatic in Java but works in Kotlin, Groovy, and Scala. Examples in this skill use Java; adapt as needed.
- **Test runner** — JUnit 4, JUnit 5, or TestNG. REST Assured is runner-agnostic but lifecycle hooks differ.
- **Build tool** — Maven or Gradle. Make sure version coords are pinned.
- **Spring context** — if the system under test is a Spring app, you have a choice: REST Assured against a running server, REST Assured against `MockMvc` (in-process), or Spring's own `WebTestClient`. Each has different speed/realism trade-offs.

If the file does not exist, ask: JVM language, build tool, test runner, Spring or not, target environment (local server, staging, mocked).

---

## Why REST Assured

- **Fluent DSL** — `given().when().then()` reads like a spec.
- **Built-in JSON / XML path** — assert on nested response data without writing a parser.
- **Schema validation** — JSON Schema and XSD validation in one line.
- **Hamcrest matcher integration** — the same matchers you use in JUnit.
- **Reusable specs** — `RequestSpecification` and `ResponseSpecification` encode common headers, auth, and assertions.

When *not* to use REST Assured:

- Non-JVM stack → use pytest-api (Python) / supertest (Node) / language-native tools.
- Pure contract testing → pact-contract-testing (you can layer Pact on top, but REST Assured isn't a contract tool).
- High-throughput load → that's a perf concern; see k6 / gatling.

---

## The DSL: given–when–then

```java
import static io.restassured.RestAssured.*;
import static org.hamcrest.Matchers.*;

@Test
void getUserReturnsExpectedShape() {
    given()
        .baseUri("https://api.example.com")
        .auth().oauth2("bearer-token-placeholder")
        .header("Accept", "application/json")
    .when()
        .get("/users/{id}", "user-42")
    .then()
        .statusCode(200)
        .contentType("application/json")
        .body("id", equalTo("user-42"))
        .body("email", endsWith("@example.com"))
        .body("roles", hasItems("user"));
}
```

`given()` sets up the request, `when()` issues it, `then()` runs assertions. Multiple `.body(jsonPath, matcher)` calls assert independently.

---

## JsonPath assertions

JsonPath in REST Assured uses **Groovy-style** dot notation (not full JSONPath like `$.foo[0]`):

```java
.body("data.users[0].id", equalTo("user-42"))
.body("data.users.size()", equalTo(3))
.body("data.users.findAll { it.active == true }.size()", greaterThanOrEqualTo(1))
.body("data.users*.email", everyItem(endsWith("@example.com")))
```

Groovy collection operators (`findAll`, `collect`, `*.`) work inside path strings. If you need pure JSONPath (`$.data.users[*].id`), use `JsonPath` from `JayWay` separately, or `body(JsonPath.from(...).get(...))`.

---

## Schema validation

```java
.then()
    .body(matchesJsonSchemaInClasspath("schemas/user.schema.json"));
```

Add the `json-schema-validator` module dependency. Keep schema files under `src/test/resources/schemas/`. For OpenAPI-derived schemas, generate per-endpoint schemas with a tool rather than hand-writing.

---

## Reusable specs

Avoid copy-pasting baseUri and auth across 200 tests. Define a `RequestSpecification` once:

```java
public class Specs {
    public static RequestSpecification authedJson(String token) {
        return new RequestSpecBuilder()
            .setBaseUri("https://api.example.com")
            .setAuth(oauth2(token))
            .setContentType(ContentType.JSON)
            .addHeader("X-Client", "qa-suite")
            .build();
    }

    public static ResponseSpecification okJson() {
        return new ResponseSpecBuilder()
            .expectStatusCode(200)
            .expectContentType(ContentType.JSON)
            .build();
    }
}
```

Tests then read clean:

```java
given().spec(Specs.authedJson(token))
.when().get("/users/{id}", id)
.then().spec(Specs.okJson()).body("id", equalTo(id));
```

---

## Request bodies

```java
given()
    .spec(Specs.authedJson(token))
    .body(Map.of("email", "qa.user@example.com", "role", "viewer"))
.when()
    .post("/users")
.then()
    .statusCode(201)
    .body("id", notNullValue());
```

`.body(Object)` serializes via Jackson (if on classpath) for POJOs and Maps. For raw strings, pass a string literal; for files, `new File("...")`.

---

## Extracting values for chaining

```java
String userId = given().spec(Specs.authedJson(token))
    .body(Map.of("email", "qa.user@example.com"))
.when().post("/users")
.then().statusCode(201)
.extract().path("id");

given().spec(Specs.authedJson(token))
.when().delete("/users/{id}", userId)
.then().statusCode(204);
```

Or extract the whole response:

```java
Response r = given().when().get("/users").then().extract().response();
List<String> ids = r.jsonPath().getList("data.users.id");
```

---

## Auth helpers

REST Assured has shortcuts for common schemes:

| Method | Use |
|--------|-----|
| `.auth().basic(user, pass)` | HTTP Basic |
| `.auth().preemptive().basic(user, pass)` | Sends auth without waiting for 401 challenge |
| `.auth().oauth2(token)` | Bearer token |
| `.auth().digest(...)` | HTTP Digest |
| `.header("Authorization", "Bearer " + token)` | Manual fallback |
| `.relaxedHTTPSValidation()` | Skip TLS verification — staging only, never prod |

For complex auth (mTLS, refresh flows), set up an `AuthenticationScheme` or do a setup call in a `@BeforeEach` and cache the token.

---

## Logging and debugging

```java
given().log().all()    // log full request
.when().get("/users/42")
.then().log().ifValidationFails();  // log response only on failure
```

`log().ifValidationFails()` is the default-in-CI pattern — minimal noise on success, full detail on failure.

For request/response logging, integrate with SLF4J via `RestAssuredConfig` or the `LogConfig`.

---

## REST Assured with Spring MockMvc

For Spring apps, `rest-assured-spring-mock-mvc` skips the network stack entirely:

```java
@Autowired MockMvc mockMvc;

@BeforeEach
void setUp() { RestAssuredMockMvc.mockMvc(mockMvc); }

@Test
void getUser() {
    given().when().get("/users/{id}", "user-42")
    .then().statusCode(200);
}
```

Much faster than running against a real port; loses the network/serialization layer realism. Pair with a few real-HTTP integration tests.

---

## Configuration (`RestAssuredConfig`)

```java
RestAssured.config = RestAssuredConfig.config()
    .objectMapperConfig(objectMapperConfig().jackson2ObjectMapperFactory((type, charset) -> sharedMapper))
    .logConfig(logConfig().enableLoggingOfRequestAndResponseIfValidationFails())
    .httpClient(httpClientConfig().setParam("http.connection.timeout", 10_000));
```

Set defaults once in a JUnit extension or `@BeforeAll`.

---

## Common Pitfalls

- **One huge test class** — split by resource. Use a base class for shared specs.
- **Hardcoded baseUri** — use a config property + `RequestSpecification`.
- **Skipping `extract()` and re-issuing the same request** — extract once and chain.
- **Confusing Groovy JsonPath with JSONPath spec** — REST Assured's `body(...)` uses Groovy. If you want JSONPath, use it explicitly.
- **Asserting on entire response equality** — fragile; assert on individual fields.
- **`relaxedHTTPSValidation()` in production** — only acceptable for self-signed staging.
- **Not using `ResponseSpecBuilder`** — leads to copy-pasted `.statusCode(200).contentType("application/json")` everywhere.
- **Logging full request/response on success** — fine locally, painful in CI. Use `ifValidationFails()`.
- **Mixing REST Assured against a real server with REST Assured MockMvc in the same module** — pick one default; clearly tag the other.

---

## Task-Specific Questions

When helping with REST Assured, ask:

1. JVM language — Java, Kotlin, Groovy, Scala?
2. Build tool — Maven or Gradle?
3. Test runner — JUnit 4, JUnit 5, TestNG?
4. Spring app — should we use REST Assured MockMvc, or full HTTP?
5. Auth model — basic, bearer, mTLS, custom?
6. Are you generating schemas from OpenAPI, or hand-writing?
7. What's the CI runner — and do you want JUnit XML, Allure, both?

---

## Related Skills

- **supertest** — Node equivalent for the same patterns.
- **pytest-api** — Python equivalent.
- **postman-newman** — when QA-led collections complement code tests.
- **karate** — when teams want a DSL-driven approach in the JVM ecosystem.
- **wiremock** — pair with REST Assured to virtualize downstream dependencies.
- **pact-contract-testing** — REST Assured can verify provider-side Pact contracts.
- **ci-test-orchestration** — for matrix runs across JDK versions or environments.
