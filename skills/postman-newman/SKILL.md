---
name: postman-newman
description: When the user wants to design, organize, or run Postman collections — locally, in CI via Newman, or shared across a team. Use when the user mentions "Postman," "Postman collection," "Newman," "newman run," "pm.test," "pre-request script," "test script," "Postman environment," "collection variables," "Postman monitor," or "Postman flows." For language-native API testing (Node, Python, Java) see supertest, pytest-api, rest-assured. For service virtualization see wiremock. For contract testing see pact-contract-testing.
metadata:
  version: 1.0.0
---

# Postman + Newman

You are an expert in Postman collections and Newman (the Postman CLI runner). Your goal is to help engineers structure collections that are useful in both Postman's UI and CI, write test scripts that catch real bugs, and avoid the common Postman anti-patterns (huge unmaintained collections, untested chains, hardcoded environments). Do not fabricate `pm` API methods, CLI flags, or collection schema fields. When uncertain, point the reader to `learning.postman.com`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **What's the goal?** — Exploratory API debugging (Postman desktop is great), shared regression suite (collection + Newman in CI), or contract testing (consider pact-contract-testing instead).
- **Team familiarity** — for engineers who code daily, a language-native HTTP client (supertest, pytest-api, rest-assured) is often easier to maintain than Postman scripts. For QA teams that lean on Postman UI workflows, collections are a strong fit.
- **CI provider** — Newman runs anywhere Node runs. The reporter choice (htmlextra, junit) matters for CI consumption.
- **Compliance / data handling** — Postman Cloud syncs collections and environments by default. If your org forbids syncing, configure local-only workspaces or use the API directly.

If the file does not exist, ask: solo or team usage, whether collections will run in CI via Newman, languages the team is fluent in, and whether Postman Cloud sync is allowed.

---

## When to use Postman vs. a language-native client

| Use Postman + Newman when… | Use a language-native client when… |
|----------------------------|-----------------------------------|
| QA owns the suite and prefers a GUI | Engineers own the suite and write code daily |
| You want fast exploratory + saved collection flow | You want refactoring, types, and IDE support |
| Auth flows are complex and you want UI assistance | You need test fixtures, parametrization, parallelism |
| Test data and chains live well in collections | Test data lives well in code/fixtures/factories |
| You're sharing collections with non-engineers (PMs, support) | Tests are tightly coupled to the application code |

Don't be religious about either — many teams keep Postman for exploration and run regression via supertest/pytest/rest-assured.

---

## Collection structure

A Postman collection is a JSON file (Collection v2.1 schema is current). Recommended structure:

```
My API
├── 00 — Auth (folder)
│   ├── POST /auth/login
│   └── POST /auth/refresh
├── Users (folder)
│   ├── GET /users/:id
│   ├── POST /users
│   ├── PATCH /users/:id
│   └── DELETE /users/:id
├── Orders (folder)
│   └── ...
└── Smoke (folder, mirrors a CI subset)
```

Conventions that scale:

- One folder per resource / domain.
- Numbered prefixes for ordered flows (`00 — Auth`, `01 — Setup`).
- Use the **collection-level** Pre-request Script for env-agnostic setup (e.g., generate a unique id). Use **folder-level** for resource-specific setup.
- A separate Smoke folder that runs in CI on every PR — small, fast, must-pass.

---

## Variables and environments

| Scope | When to use |
|-------|-------------|
| **Global** | Don't. Globals leak across collections and confuse readers. |
| **Collection** | Defaults that apply to every request in the collection (e.g., `baseUrl` placeholder, content-type). |
| **Environment** | Per-target values: `baseUrl`, secrets, IDs that differ between staging and prod. |
| **Folder** | Resource-specific (e.g., a precomputed user ID for the Users folder). |
| **Local / data** | Inside a script (`pm.variables.set('foo', 'bar')`) — request-scoped. |
| **Data file** (Newman / Runner) | CSV / JSON of test rows for iteration. |

Reference syntax: `{{baseUrl}}/users/{{userId}}`. Secrets should be stored as environment variables of type `secret` and never committed.

---

## Scripts: pre-request and test

Postman exposes a sandboxed JS API. The most-used surface:

```js
// Pre-request script — runs before sending the request
pm.environment.set('correlationId', 'req-' + Date.now());

// Test script — runs after the response is received
pm.test('status is 200', () => {
  pm.response.to.have.status(200);
});

pm.test('payload schema', () => {
  const body = pm.response.json();
  pm.expect(body).to.have.property('id');
  pm.expect(body.email).to.be.a('string');
});

// Chain a value into a later request
const token = pm.response.json().token;
pm.environment.set('authToken', token);
```

Keep scripts short. If a script grows beyond ~30 lines, either move logic into a helper request that runs earlier in the folder, or accept that this flow probably belongs in code rather than a collection.

---

## Running with Newman

Newman is the Node-based CLI for collections.

```bash
npx newman run collection.json \
  -e staging.env.json \
  --iteration-data users.csv \
  --reporters cli,junit,htmlextra \
  --reporter-junit-export results.xml \
  --reporter-htmlextra-export results.html
```

Common flags (verify against your installed version with `newman run --help`):

| Flag | Purpose |
|------|---------|
| `-e <file>` / `--environment` | Environment file. |
| `-d <file>` / `--iteration-data` | Data file for data-driven runs. |
| `-n <count>` / `--iteration-count` | Number of iterations. |
| `--folder <name>` | Run only one folder. |
| `--reporters cli,junit` | Multiple reporters. |
| `--bail` | Stop on first failure. |
| `--timeout-request <ms>` | Per-request timeout. |
| `--insecure` | Skip TLS verification — use sparingly. |

The `newman-reporter-htmlextra` reporter produces a much richer HTML report than the built-in HTML reporter.

---

## CI integration

```yaml
# GitHub Actions example
- run: npm install -g newman newman-reporter-htmlextra
- run: |
    newman run collection.json \
      -e ${{ github.workspace }}/postman/staging.env.json \
      --reporters cli,junit,htmlextra \
      --reporter-junit-export newman-results.xml \
      --reporter-htmlextra-export newman-report.html
- if: always()
  uses: actions/upload-artifact@v4
  with:
    name: newman-report
    path: |
      newman-results.xml
      newman-report.html
```

Secrets go in CI secret stores, not in committed env files. Use `--env-var "key=value"` overrides at runtime for sensitive values.

---

## Versioning and review

Collections are JSON. **Diff them in Git like any other file.** This means:

- Export the collection (`File → Export → Collection v2.1`) and commit it.
- Avoid editing the JSON by hand — make changes in Postman, re-export.
- Use Postman's built-in version control sparingly; Git is the source of truth.
- Code review collection changes — script changes are real code.

For teams that struggle to keep collections in sync, the `postman-collection-transformer` and CLI export workflows help.

---

## Common Pitfalls

- **One giant collection** — 200 requests in a flat list is unreadable. Split into folders and per-domain collections.
- **Globals everywhere** — globals leak across collections. Use environments and collection-level variables instead.
- **No tests** — a collection without `pm.test(...)` blocks isn't a test suite; it's a saved request log.
- **Hardcoded URLs and IDs** — every URL should be `{{baseUrl}}/...`; every ID should come from a variable or a previous request.
- **Committing secrets in env JSON files** — environments often contain tokens. Strip secrets before commit, or use `--env-var` at runtime.
- **Skipping data-driven testing** — for boundary cases, an iteration data file is far cleaner than 12 copy-pasted requests.
- **Treating collection failures as advisory** — if Newman runs in CI, its exit code must gate merges. Set it as a required check.
- **Letting collections drift from the actual API** — without an OpenAPI link or auto-generation, collections rot fast. Schedule a quarterly sync.
- **Using Postman as a contract test** — Postman tests verify *this client's expectations against the current server*. They aren't contract tests. For consumer-driven contracts, use pact-contract-testing.

---

## Task-Specific Questions

When helping with Postman, ask:

1. Is this a solo exploration collection or a team-shared regression suite?
2. Will it run in CI via Newman, or only in Postman desktop?
3. What's your CI provider and how do you want results reported (JUnit XML, HTML, both)?
4. How are environments and secrets managed (CI secrets, vault, env files)?
5. Are tests organized by resource (Users, Orders) or by flow (Onboarding, Checkout)?
6. Is there an OpenAPI spec for the API — can collections be generated/validated against it?
7. Any compliance constraint on Postman Cloud sync?

---

## Related Skills

- **supertest** / **pytest-api** / **rest-assured** — language-native alternatives when the team is comfortable writing code.
- **pact-contract-testing** — for true consumer-driven contract testing rather than client-side regression.
- **wiremock** — when you need to virtualize dependencies the API talks to.
- **graphql-testing** / **grpc-testing** — Postman supports both; specific patterns in those skills.
- **ci-test-orchestration** — for parallelizing Newman runs across iteration files.
- **test-data-management** — iteration data files are test data; manage them like other fixtures.
