---
name: test-data-management
description: When the user wants to design or audit how test data is generated, managed, masked, and reset between tests. Use when the user mentions "test data," "test data management," "TDM," "fixtures," "factories," "FactoryBot," "factory_bot," "Bogus," "faker," "synthetic data," "data masking," "PII scrubbing," "production snapshot," "test database seeding," "anonymization," or "transactional rollback in tests." For environments see test-environment-management. For pact tests see pact-contract-testing. For flaky tests caused by data leakage see flaky-test-management.
metadata:
  version: 1.0.0
---

# Test Data Management

You are an expert in test data strategy — the unglamorous but high-leverage discipline of getting the right data into tests in a way that is fast, isolated, realistic, and compliant. Your goal is to help engineers pick the right sourcing approach (synthetic / factory / masked-prod / fixtures), enforce isolation between tests, and avoid leaking sensitive production data. Don't fabricate library APIs or anonymization techniques. When uncertain, point the reader to the relevant library's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Compliance scope** — HIPAA / PCI / GDPR / SOC 2 all impose constraints on what can live in non-prod environments.
- **Data shape** — relational (Postgres / MySQL), document (Mongo), event log, file storage, search index. Each has its own seeding patterns.
- **Test scope** — unit (no data layer), integration (in-memory or Testcontainers), E2E (real-ish data).
- **Existing approach** — fixtures, factories, production snapshots, hand-built seeds. Knowing what's in place avoids rewriting it.
- **Test isolation** — transactional rollback, schema-per-test, truncate-per-test, immutable shared seeds.

If the file does not exist, ask: data layer, compliance scope, test scope, current sourcing approach, isolation strategy.

---

## Sourcing approaches

### Synthetic data (recommended default)

Generate data programmatically with no production lineage. Pure synthetic data is fastest, most flexible, and has zero compliance risk.

| Library | Language |
|---------|----------|
| Faker | Python, Ruby, PHP |
| `@faker-js/faker` | JS / TS |
| Bogus | .NET |
| JavaFaker / Datafaker | JVM |
| gofakeit | Go |

```ts
import { faker } from '@faker-js/faker';

const user = {
  email: faker.internet.email(),       // qa.user@example.com flavor
  name: faker.person.fullName(),
  city: faker.location.city(),
};
```

**Always seed Faker with a constant in tests if you need reproducibility** — `faker.seed(123)`. Without a seed, test failures aren't reproducible from logs alone.

### Factories

A factory is a builder for synthetic domain objects, encoding sensible defaults and allowing per-test overrides.

| Library | Language |
|---------|----------|
| FactoryBot | Ruby |
| factory_boy | Python |
| AutoFixture | .NET |
| Test Data Builders (hand-rolled) | JVM / any |
| `@faker-js/faker` + custom builders | JS / TS |

```ruby
# FactoryBot
FactoryBot.define do
  factory :user do
    email { "qa.user-#{SecureRandom.hex(4)}@example.com" }
    name  { "QA User" }
    role  { :viewer }

    trait :admin do
      role { :admin }
    end
  end
end

# in a test
create(:user, :admin, email: 'specific@example.com')
```

Factories beat fixtures in almost every dimension: composable, refactor-safe, override-friendly, no stale JSON files.

### Production snapshots with masking

When you genuinely need production-realistic data (analytics testing, complex query plans, large data volumes for perf), take a snapshot and mask sensitive fields.

**Tools**:
- **pg_dump + bash scripts** — DIY, common for Postgres.
- **Tonic.ai**, **Delphix**, **Mockaroo** — commercial.
- **`pglogical` + on-the-fly transforms** — for live replication with masking.
- **db-anonymizer** community tools per DB.

**Masking techniques**:

| Field | Approach |
|-------|----------|
| Email | Replace local-part with a hash; preserve domain shape. |
| Name | Replace with Faker name; keep length distribution. |
| Phone | Replace with synthetic, 555-area-code style. |
| SSN / national ID | Replace with synthetic patterns matching the format. |
| Address | Replace with Faker addresses; preserve geographic distribution if needed. |
| Date of birth | Add a random offset within a window. |
| Credit card | Replace with test-card numbers (Stripe / processor test PANs). |
| Free-text fields | Replace entirely or scrub with regex (emails, phones embedded in text). |
| Referential integrity | Hash with a stable salt so FKs stay aligned. |

**Critical**: masking must be repeatable (same input → same output) so FKs continue to resolve.

**Never use real production data in non-prod environments without masking.** Even an internal team's eyes on PII is a breach in regulated environments.

### Hand-built fixtures (JSON / SQL / YAML)

Files in the repo describing seed data:

```yaml
# fixtures/users.yml
users:
  - id: 1
    email: "qa.user@example.com"
    name: "QA User"
```

Pros: simple, version-controlled, fast to read. Cons: rot quickly when the schema changes; can't be composed; shared state across tests if not loaded fresh.

Use sparingly — for genuinely static reference data (countries, currencies, role definitions). For per-test data, factories beat fixtures.

---

## Isolation strategies

The single most important property: **test A's data does not affect test B**.

### Transactional rollback (best for most relational scenarios)

```python
# pytest with SQLAlchemy
@pytest.fixture
def db_session(connection):
    transaction = connection.begin()
    session = Session(bind=connection)
    yield session
    session.close()
    transaction.rollback()
```

Each test runs inside a transaction; rollback returns the DB to its prior state. Fast, clean. Most language ecosystems have an idiomatic version (Rails fixtures, Spring `@Transactional`, etc.).

**Doesn't work for**: code paths that commit explicitly (some message-queue integrations, distributed transactions, savepoints).

### Truncate-per-test

Delete from all tables before each test. Slower than transactions, but works when transactions don't.

```python
@pytest.fixture(autouse=True)
def reset_db(engine):
    yield
    for table in reversed(metadata.sorted_tables):
        engine.execute(table.delete())
```

### Schema / database per test (or per worker)

For parallel runs that hit the same DB, give each worker its own schema or database. Most pytest-xdist setups support this via `worker_id`.

```python
@pytest.fixture(scope='session')
def db_url(worker_id):
    return f'postgresql://qa.user:Pa$$w0rd-fake@localhost/test_{worker_id}'
```

### Testcontainers (recommended for integration)

Spin up a fresh Postgres / Redis / Kafka container per test class. Slower than transactions but bullet-proof isolation. Cross-reference testcontainers.

### Immutable shared seed

Read-only data shared across the suite. Tests can read but never write. Good for reference data (country list, currency codes).

---

## Identity / uniqueness in parallel tests

Tests running in parallel can collide on unique constraints (`users_email_unique`). Patterns:

- **Per-test UUIDs**: `email: "qa.user-#{SecureRandom.uuid}@example.com"`.
- **Worker-namespaced**: `email: "qa.user-#{worker_id}-#{counter}@example.com"`.
- **Factories with sequences** (FactoryBot, factory_boy): auto-incrementing per-process.

The goal is: any two tests, run in any order, on any worker, must not collide.

---

## File / object storage data

For S3 / blob storage tests:

- **Test buckets**: separate buckets per test, named with random suffix, cleaned up after.
- **MinIO** in Testcontainers — local S3-compatible server.
- **Mock libraries**: `moto` (Python), `aws-sdk-mock` (JS) — fast but less realistic.

---

## Time-sensitive data

Tests that depend on "today" or "now" are flaky as the day changes.

| Approach | Use |
|----------|-----|
| Freeze time with `freezegun` / `Timecop` / `Clock.fixed()` | Most reliable for "logic at this exact time" tests. |
| Inject a `Clock` interface into the production code | Cleanest long-term — the test substitutes a fake clock. |
| Generate timestamps relative to "now" in factories | Avoids hardcoded dates that break the moment the year changes. |

Don't hardcode `'2024-06-15'` in a factory unless the test specifically asserts on that date.

---

## Sensitive data in test code

**Never commit real credentials, real tokens, real PII, or real customer data** to a test repository — even if "the repo is private." Treat tests with the same hygiene as production code.

- Use synthetic credentials (`qa.user@example.com`, `Pa$$w0rd-fake`, `bearer-token-placeholder`).
- For tests that need real test-account credentials, inject from CI secrets — never from a committed file.
- Audit `git log -p -- tests/` periodically for accidental commits of real data.

---

## Data for performance testing

Perf tests need **realistic-scale** data — production volumes, distributions, key cardinality. Synthetic data must reflect:

- Row counts (100M rows vs 100 rows changes query plans).
- Distribution (Zipf-like for things like product popularity, not uniform).
- Cardinality of indexed columns.
- Foreign key locality / clustering.

A perf run against 100 rows is a fiction. Cross-reference k6 / jmeter / gatling for tools, but the data-side is on you.

---

## Common Pitfalls

- **Real PII in test data** — biggest compliance risk, easiest to avoid.
- **Hardcoded IDs across tests** — `user.id == 1` works on a fresh DB, breaks under parallel.
- **Fixtures that drift from schema** — every migration leaves them stale.
- **Heavy `before_all` seeding mutated by tests** — order dependence.
- **Snapshot-from-prod without masking** — even a 1-row preview is a leak.
- **Factories with too many associations** — every `create(:user)` cascades into 10 inserts. Use `build_stubbed` / `build` where possible.
- **Faker without a seed when reproducibility matters** — a failing test can't be reproduced from logs alone.
- **Per-test schema creation on every test** — sub-second tests become 30-second tests. Use transactions instead.
- **Mocking the database with fakes that pretend to be the real DB** — type mismatches, behavior drift. Use Testcontainers or transactional fixtures.
- **No data lifecycle policy** — test data piles up in shared environments forever.

---

## Building a test data strategy

1. **Compliance first** — what data is allowed in non-prod?
2. **Default to synthetic** — faker + factories — unless there's a concrete reason not to.
3. **Isolation strategy** — transactions if relational + supports it; otherwise truncate or container-per-test.
4. **Parallel safety** — every test uses unique identifiers.
5. **For perf** — separate realistic-scale synthetic dataset, regenerated periodically.
6. **Audit periodically** — `git log` for committed secrets; non-prod environments for leaked PII.

---

## Task-Specific Questions

When helping with test data, ask:

1. What's the data layer — Postgres / MySQL / Mongo / DynamoDB / event store / files?
2. Compliance constraints — HIPAA / PCI / GDPR / SOC 2 / internal?
3. Test scope — unit, integration, E2E, perf?
4. Current sourcing — fixtures, factories, prod snapshots, mix?
5. Isolation strategy — transactional, truncate, schema-per-worker?
6. Parallel test runs — how identities are namespaced?
7. Are there existing committed credentials or PII to clean up?

---

## Related Skills

- **qa-context** — compliance + stack drive the data strategy.
- **test-environment-management** — where the data lives.
- **flaky-test-management** — leaked test data is a top cause of flake.
- **testcontainers** — for container-per-test infra.
- **pact-contract-testing** — pact tests have their own data conventions.
- **k6** / **jmeter** / **gatling** / **locust** — perf needs scale data.
- All language unit-test skills handle factories and fixtures idiomatically — cross-reference the relevant one.
- **bdd-anti-patterns** — `Background:` setup is a form of test data; same hygiene rules apply.
