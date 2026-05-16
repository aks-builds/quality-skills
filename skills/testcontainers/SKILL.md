---
name: testcontainers
description: When the user wants to use Docker-backed real infrastructure (Postgres, Kafka, Redis, Mongo, S3, etc.) inside tests via the Testcontainers libraries. Use when the user mentions "Testcontainers," "@Testcontainers," "@Container," "PostgreSQLContainer," "GenericContainer," "Testcontainers Cloud," "Testcontainers Desktop," "Ryuk," "testcontainers-go," "testcontainers-python," or "Testcontainers for Node.js." For broader CI infra see ci-test-orchestration. For environment strategy see test-environment-management.
metadata:
  version: 1.0.0
---

# Testcontainers

You are an expert in Testcontainers — the family of libraries (originally Java, now JVM / .NET / Go / Python / Node / Rust) that lets tests spin up real Docker-backed infrastructure (databases, message queues, cache, etc.) per test class or per test method. Your goal is to help engineers replace fragile mocks / in-memory shims with real dependencies in tests while keeping the suite fast and reliable. Don't fabricate library APIs, container module names, or feature flags. When uncertain, point the reader to `testcontainers.com/` or the language-specific docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Languages** — Testcontainers libraries exist for JVM, .NET, Go, Python, Node, Rust, Ruby. Quality and feature parity vary.
- **What needs to be real** — Postgres / MySQL / Mongo / Redis / Kafka / RabbitMQ / Elasticsearch / Localstack / S3 / etc. Pre-built modules exist for popular dependencies.
- **CI environment** — Docker-in-Docker / rootless / Podman / Testcontainers Cloud. The runtime matters.
- **Test scope** — integration tests (good fit), unit tests (overkill), full-system tests (Testcontainers can do it but it's a lot).
- **Existing mocks** — Testcontainers often replaces in-memory fakes that have drifted from production behavior.

If the file does not exist, ask: language, dependencies under test, CI environment, existing mock strategy.

---

## Why Testcontainers

- **Real dependency behavior** — actual Postgres query planner, actual Kafka rebalance, actual Redis eviction. Catches what in-memory fakes miss.
- **Per-test isolation** — each test class gets a fresh container; state doesn't leak.
- **Cross-language** — same conceptual model in Java, Go, Python, Node, etc.
- **Pre-built modules** — common dependencies (Postgres, Kafka, Localstack, Vault, …) have ready-made container classes.
- **Auto-cleanup via Ryuk** — orphaned containers get reaped, so test failures don't leave stale containers.

When *not* to use Testcontainers:

- Pure unit tests with no I/O — overkill.
- Production-style data volume — Testcontainers spins fresh; not for big-data perf testing.
- Slow CI runner without Docker — won't run.

---

## A minimal example (JVM)

```java
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class OrderRepositoryIT {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16.4")
        .withDatabaseName("orders_test")
        .withUsername("qa")
        .withPassword("Pa$$w0rd-fake");

    @Test
    void inserts_and_reads() {
        String url = postgres.getJdbcUrl();
        // ... use url in a DataSource or Spring's @DynamicPropertySource
    }
}
```

The container starts before the class's tests, stops after. Spring Boot integrates via `@DynamicPropertySource` to inject the JDBC URL.

---

## Common modules

| Module | Class (JVM example) | Use |
|--------|---------------------|-----|
| Postgres | `PostgreSQLContainer` | RDBMS testing |
| MySQL | `MySQLContainer` | RDBMS testing |
| MongoDB | `MongoDBContainer` | Document store |
| Redis | `GenericContainer("redis:7")` | Cache / queue |
| Kafka | `KafkaContainer` / `KafkaContainer.Confluent` | Event streaming |
| RabbitMQ | `RabbitMQContainer` | Messaging |
| Elasticsearch | `ElasticsearchContainer` | Search |
| Localstack | `LocalStackContainer` | AWS services emulator (S3, SQS, SNS, DDB) |
| MinIO | `GenericContainer` with MinIO image | S3-compatible storage |
| Vault | `VaultContainer` | Secrets |

Verify exact class names against the language-specific Testcontainers docs.

---

## Per-language patterns

### Java (JUnit 5)

```java
@Testcontainers
class ServiceIT {
    @Container
    static PostgreSQLContainer<?> db = new PostgreSQLContainer<>("postgres:16.4");

    @DynamicPropertySource
    static void registerProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", db::getJdbcUrl);
        registry.add("spring.datasource.username", db::getUsername);
        registry.add("spring.datasource.password", db::getPassword);
    }
}
```

`@Container static` = one container per class (shared across tests). `@Container` (non-static) = one container per test method (slower, fully isolated).

### Python (pytest)

```python
import pytest
from testcontainers.postgres import PostgresContainer

@pytest.fixture(scope="session")
def postgres():
    with PostgresContainer("postgres:16.4") as pg:
        yield pg

def test_query(postgres):
    conn = psycopg.connect(postgres.get_connection_url())
    # ...
```

### Node / TS

```ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: StartedPostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16.4').start();
});

afterAll(async () => {
  await container.stop();
});

test('query', async () => {
  const url = container.getConnectionUri();
  // ...
});
```

### Go

```go
import (
    "testing"
    "github.com/testcontainers/testcontainers-go/modules/postgres"
)

func TestThing(t *testing.T) {
    ctx := context.Background()
    pg, err := postgres.Run(ctx, "postgres:16.4",
        postgres.WithDatabase("orders_test"),
        postgres.WithUsername("qa"),
        postgres.WithPassword("Pa$$w0rd-fake"),
    )
    if err != nil { t.Fatal(err) }
    t.Cleanup(func() { pg.Terminate(ctx) })
    // ...
}
```

---

## Performance considerations

Fresh containers add 1-10 seconds per startup. Strategies:

- **`@Container static`** (or `scope='session'` in pytest) — one container, many tests. Reset state via transactions or truncate-per-test (cross-reference test-data-management).
- **Reusable containers** (`.withReuse(true)`) — Testcontainers leaves the container running between test runs locally; the next run reuses it. **Local development only**, not CI.
- **Image pre-pulling** — pull images in a CI cache step, not in the test.
- **Light images** — `postgres:16.4-alpine` is smaller than `postgres:16.4`.
- **Parallel test isolation via DB-per-worker** — start one Postgres container shared across all tests, use `CREATE DATABASE test_<worker>` for per-worker isolation.

A 1000-test suite spinning a fresh Postgres per class is fine; per test is usually too slow.

---

## Ryuk (the cleanup daemon)

Testcontainers starts a small Ryuk container alongside your tests; it watches for parent process exit and reaps orphaned containers. This is why crashed tests don't leave stale containers.

Disabling Ryuk (`TESTCONTAINERS_RYUK_DISABLED=true`) is sometimes necessary in restricted CI environments (no privileged containers) — but then cleanup is your job.

---

## CI patterns

### Docker available

Most CI providers (GitHub Actions Linux runners, GitLab CI, CircleCI, Buildkite agents) have Docker installed and work with Testcontainers out of the box.

### Docker-in-Docker (DinD)

For runners that run jobs inside containers (some K8s-based CI), DinD is required. Set `DOCKER_HOST` so Testcontainers finds the daemon.

### Testcontainers Cloud

A managed Docker host for tests. Useful when:

- Local Docker Desktop is licensed (cost / restrictions).
- CI runners can't run Docker (sandboxed, security policy).
- You want to share container pre-pulls across the org.

Test code is unchanged; environment vars point to Testcontainers Cloud.

### Podman / rootless

Testcontainers supports Podman; some configuration required. Verify against current docs for your language binding.

---

## Wait strategies

Testcontainers starts a container, then waits for it to be "ready" before tests run. The default wait strategy depends on the module; you can override:

```java
new GenericContainer("kafka:7.5.0")
    .waitingFor(Wait.forLogMessage(".*started.*", 1))
    .withStartupTimeout(Duration.ofMinutes(2));
```

Common strategies:

- `Wait.forListeningPort()` — port open.
- `Wait.forLogMessage(regex, occurrences)` — log indicates ready.
- `Wait.forHttp(path).forStatusCode(200)` — HTTP endpoint healthy.
- `Wait.forHealthcheck()` — Docker healthcheck passes.

Wrong wait strategy → tests start before the container is actually ready → flake.

---

## Network and exposed ports

Testcontainers binds container ports to random host ports. Access via:

```java
String url = "jdbc:postgresql://" + container.getHost() + ":" + container.getMappedPort(5432) + "/db";
```

The container's `localhost` is NOT the host's localhost — your app under test running on the host can't talk to the container via `localhost:5432`. Always use `getHost()` + `getMappedPort()` (or the module's `getJdbcUrl()` / `getConnectionUrl()` helpers).

For container-to-container in tests (e.g., app container talks to Postgres container), use Testcontainers' network feature:

```java
Network network = Network.newNetwork();
PostgreSQLContainer<?> pg = new PostgreSQLContainer<>("postgres:16.4")
    .withNetwork(network)
    .withNetworkAliases("postgres");

GenericContainer<?> app = new GenericContainer<>("myapp:latest")
    .withNetwork(network)
    .withEnv("DATABASE_URL", "postgresql://qa:Pa$$w0rd-fake@postgres:5432/db");
```

---

## Custom images

`GenericContainer` works with any Docker image. For your own services:

```java
GenericContainer<?> app = new GenericContainer<>(DockerImageName.parse("myorg/myapp:abc123"))
    .withExposedPorts(8080)
    .withEnv("CONFIG", "...")
    .waitingFor(Wait.forHttp("/health"));
```

For images built per-test-run, use `ImageFromDockerfile`:

```java
GenericContainer<?> app = new GenericContainer<>(new ImageFromDockerfile()
    .withFileFromPath(".", Path.of("./src/main/docker")));
```

---

## Common Pitfalls

- **`:latest` image tags** — silent version drift. Always pin.
- **Per-test container when per-class would do** — multiplies test time.
- **Forgetting wait strategy** — race between container start and test connection.
- **Sharing a container across parallel test runs without partitioning** — collisions.
- **Using `localhost` in connection strings** — won't work for container-to-container; use `getHost()`.
- **Not enabling Ryuk in CI** — orphaned containers pile up.
- **Trying to test things Testcontainers doesn't suit** — production-scale data, multi-day soak.
- **Resource exhaustion in CI** — 10 containers per test × 100 tests in parallel = your CI box is dead. Bound concurrency.
- **Mixing in-memory fakes and real containers** — pick one; mixing creates surprising bug surface.
- **Trusting startup logs as ready-state** — use proper wait strategies, not arbitrary sleeps.

---

## Task-Specific Questions

When helping with Testcontainers, ask:

1. Language and Testcontainers library version?
2. Which dependencies need to be real (Postgres / Kafka / Redis / S3 / custom service)?
3. Test scope — class-scoped, method-scoped, session-scoped?
4. CI runtime — Docker / DinD / Podman / Testcontainers Cloud?
5. Existing fake / mock approach being replaced?
6. Performance budget for the test suite?
7. Image registry — public Docker Hub, internal mirror?

---

## Related Skills

- **test-data-management** — Testcontainers + transactional rollback is the canonical fast-and-clean integration test setup.
- **test-environment-management** — Testcontainers sits at the local + CI layer of the environment ladder.
- **ci-test-orchestration** — for parallelism + container resource management.
- **All language unit-test skills** (**jest-vitest** / **pytest** / **junit-testng** / **xunit-nunit** / **go-test** / **rspec**) — for the runners that drive Testcontainers.
- **supertest** / **pytest-api** / **rest-assured** — Testcontainers + these is the canonical full integration test setup.
- **flaky-test-management** — wait strategies are a common flake source.
- **wiremock** — for mocking external HTTP services Testcontainers can't easily virtualize.
