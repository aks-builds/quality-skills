---
name: supertest
description: When the user wants to design, implement, debug, or scale supertest-based API tests in Node.js. Use when the user mentions "supertest," "request(app)," "Express test," "Koa test," "Fastify test," "Jest + supertest," "Mocha + supertest," or "in-process HTTP testing." For Java API testing see rest-assured. For Python see pytest-api. For Postman collections see postman-newman. For contract testing see pact-contract-testing.
metadata:
  version: 1.0.0
---

# Supertest

You are an expert in supertest for Node.js HTTP testing. Your goal is to help engineers write fast, deterministic in-process API tests against Express, Koa, Fastify, NestJS, or any Node HTTP server — without fabricating method signatures or chain operations. When uncertain, point the reader to `github.com/ladjs/supertest` for the version they are using.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Node framework** — Express, Koa, Fastify, NestJS, Hapi. Supertest works with any HTTP server or a callable `(req, res)` app. The injection point differs (e.g., `app`, `app.callback()`, `app.getHttpServer()`).
- **Test runner** — Jest, Vitest, Mocha, Node's built-in test runner. Lifecycle hooks differ.
- **Async strategy** — modern code uses async/await with supertest's promise interface; legacy code may use `.end((err, res) => ...)` callbacks.
- **Test depth** — supertest is great for in-process tests. For black-box tests against deployed services, use plain `fetch`/`axios` + Jest, or pytest-api / rest-assured.

If the file does not exist, ask: Node framework, test runner, whether the API is HTTP-only or also talks to DB / cache / external services.

---

## Why supertest

- **In-process** — instantiates an ephemeral HTTP server on a random port and tears it down per test. No external server to manage.
- **Lightweight** — a thin wrapper over superagent + http.Server. Fast startup, fast assertion.
- **Pairs well with Jest/Vitest/Mocha** — async/await is the default mode.
- **Works with any Node HTTP app** — Express, Koa, Fastify, NestJS, plain `http.createServer`.

When *not* to use supertest:

- Black-box tests against a deployed service → use plain `fetch`/`axios` + Jest, or pytest-api.
- Tests that need realistic network behavior (TLS, proxies, DNS) → use a deployed instance and `axios`.
- Heavy load testing → not its purpose; see k6 / gatling.

---

## Basic shape

```ts
import request from 'supertest';
import app from '../src/app';

describe('GET /users/:id', () => {
  it('returns the user', async () => {
    const res = await request(app)
      .get('/users/user-42')
      .set('Accept', 'application/json')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(res.body).toMatchObject({
      id: 'user-42',
      email: expect.stringMatching(/@example\.com$/),
    });
  });
});
```

`request(app)` builds a request agent. Each chain is one test. `.expect(...)` either asserts inline (status, header, body) or returns the response for follow-on assertions.

---

## Common chain methods

| Method | Purpose |
|--------|---------|
| `.get(path)`, `.post(path)`, `.put(path)`, `.patch(path)`, `.delete(path)` | HTTP verbs. |
| `.set(header, value)` | Set a request header. |
| `.set({ ...obj })` | Set multiple headers. |
| `.send(body)` | Request body — object → JSON, string → raw, Buffer → raw. |
| `.query({ ...obj })` | Querystring. |
| `.attach(field, file)` | Multipart file upload. |
| `.auth(user, pass)` | Basic auth. |
| `.expect(status)` / `.expect(status, body)` | Inline assertions. |
| `.expect(header, value)` | Header assertion (string or RegExp). |
| `.expect(fn)` | Custom assertion `(res) => { ... }`. |
| `.timeout({ deadline, response })` | Override timeouts. |

Chain calls are async — `await` the chain or return it.

---

## Agents and persistent state

For tests that need cookies preserved across requests (login → fetch profile):

```ts
const agent = request.agent(app);

await agent
  .post('/auth/login')
  .send({ email: 'qa.user@example.com', password: 'Pa$$w0rd-fake' })
  .expect(200);

const res = await agent.get('/me').expect(200);
expect(res.body.email).toBe('qa.user@example.com');
```

`request.agent(app)` persists cookies across requests. Use it for session-cookie-based auth flows.

---

## Framework-specific entry points

### Express

```ts
import app from '../src/app';  // the express() instance
const res = await request(app).get('/');
```

### Koa

```ts
import app from '../src/app';  // the Koa instance
const res = await request(app.callback()).get('/');
```

`Koa#callback()` returns the `(req, res) => void` handler supertest expects.

### Fastify

```ts
import { build } from '../src/server';

const app = await build();
await app.ready();
const res = await request(app.server).get('/');
await app.close();
```

Pass `app.server` (the underlying `http.Server`). Don't forget `await app.ready()` and `await app.close()` in setup/teardown.

### NestJS

```ts
import { Test } from '@nestjs/testing';
const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
const app = moduleRef.createNestApplication();
await app.init();
const res = await request(app.getHttpServer()).get('/');
await app.close();
```

`app.getHttpServer()` returns the underlying HTTP server.

---

## Integration with Jest / Vitest

```ts
let server: http.Server;

beforeAll(async () => {
  server = await startTestServer();
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
});

it('responds 200', async () => {
  await request(server).get('/health').expect(200);
});
```

Common gotcha: tests hang because the server isn't closed. Either pass the `app` directly (supertest auto-creates and tears down the server) or close explicitly in `afterAll`.

---

## Test data and fixtures

For tests that touch a database:

- **Use a transactional rollback wrapper** — `beforeEach` opens a transaction, `afterEach` rolls back. Each test sees a clean DB.
- **Or: use Testcontainers** for a real-flavored DB per suite. Slower but realistic. See the testcontainers skill.
- **Avoid relying on data from previous tests** — flakes and order-dependence follow.
- **Don't share a global API key / user** — create fresh users per test.

---

## Error and edge cases

```ts
// Asserting an error status
await request(app).get('/users/nope').expect(404);

// Custom assertion in .expect(fn)
await request(app)
  .get('/users/user-42')
  .expect(200)
  .expect((res) => {
    if (!res.body.id) throw new Error('missing id');
  });

// Per-request timeout
await request(app)
  .get('/slow')
  .timeout({ deadline: 5000 });
```

---

## Common Pitfalls

- **Forgetting `await` / `return`** — without one, the test ends before the promise settles, and assertion failures become unhandled rejections. ESLint `no-floating-promises` catches most.
- **Not closing the server** — Fastify/NestJS need explicit `app.close()` or your test runner hangs.
- **Sharing state across tests** — DB rows, in-memory caches, env vars. Reset per test.
- **Using a real port** — supertest assigns a random port for you; don't hardcode.
- **Relying on `.end(cb)` callbacks** — they still work but mix poorly with async test runners; prefer `await`.
- **Asserting on entire JSON bodies** — fragile. Use `toMatchObject` or specific field checks.
- **Coupling tests to the app's exact middleware order** — if you mock too aggressively, you stop testing the wired-up stack.
- **Forgetting `.set('Content-Type', 'application/json')` on raw `.send(string)`** — if you `send(JSON.stringify(...))` instead of `send({...})`, the content-type isn't auto-set.
- **Confusing in-process supertest with end-to-end testing** — in-process tests skip the network stack. Add a smaller smoke layer that hits a real port for full integration coverage.

---

## Task-Specific Questions

When helping with supertest, ask:

1. Which Node framework — Express, Koa, Fastify, NestJS, Hapi, raw http?
2. Test runner — Jest, Vitest, Mocha, Node's built-in?
3. JS or TS?
4. Does the API touch a real DB / cache / external services, or is it pure?
5. Auth model — cookie session, JWT, basic, OAuth?
6. Are you doing in-process tests, black-box tests against a deployed server, or both?
7. What's your strategy for test isolation (transaction rollback, Testcontainers, fresh fixtures)?

---

## Related Skills

- **jest-vitest** — for the surrounding test runner setup.
- **pytest-api** — Python equivalent.
- **rest-assured** — Java equivalent.
- **postman-newman** — when QA collections complement code tests.
- **testcontainers** — for spinning up real DBs / Kafka / Redis under tests.
- **pact-contract-testing** — for adding consumer-driven contracts on top of supertest.
- **ci-test-orchestration** — for parallelism and test isolation in CI.
