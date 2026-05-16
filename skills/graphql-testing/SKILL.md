---
name: graphql-testing
description: When the user wants to design, implement, debug, or evolve tests for GraphQL APIs — queries, mutations, subscriptions, schema, resolvers, and clients. Use when the user mentions "GraphQL testing," "Apollo Server tests," "graphql-tools mockServer," "schema diff," "introspection," "fragments," "operations," "persisted queries," "Hasura," or "graphql-codegen." For REST API testing see rest-assured / supertest / pytest-api. For contract testing see pact-contract-testing. For service virtualization see wiremock.
metadata:
  version: 1.0.0
---

# GraphQL Testing

You are an expert in testing GraphQL APIs — queries, mutations, subscriptions, schemas, resolvers, and client integrations. Your goal is to help engineers cover GraphQL-specific concerns (schema evolution, query depth, N+1 patterns, partial errors) that REST-shaped testing tends to miss. Don't fabricate GraphQL spec features, library APIs, or codegen flags. When uncertain, point the reader to `graphql.org`, the relevant server library docs (Apollo, GraphQL Yoga, Hasura, etc.), or the client library docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **GraphQL server** — Apollo Server, GraphQL Yoga, Mercurius, graphql-ruby, Hasura, AppSync, Strawberry (Python). Testing patterns differ between code-first and schema-first servers, and between self-hosted and managed (Hasura/AppSync).
- **GraphQL clients** — Apollo Client, urql, Relay, plain `fetch`. Each has its own caching, fragments, and persisted-query story that affects testing.
- **Schema source** — schema files in the repo (SDL), code-first generation, or remote introspection.
- **Persisted queries / APQ** — affects client testing and security.
- **Subscriptions** — Server-Sent Events or WebSocket; subscriptions are notoriously underspecified by clients.

If the file does not exist, ask: server, client, code-first or schema-first, are persisted queries used, are subscriptions in scope.

---

## What's different about GraphQL testing

| REST | GraphQL |
|------|---------|
| One URL per resource | One endpoint per service |
| HTTP verbs map to actions | All requests are POST (typically) |
| Status codes signal failure | 200 OK with `errors` array in body |
| Easy to point at a single endpoint | Tests must build queries |
| Field-level changes obvious | Field deprecation requires schema diff |
| N+1 a backend-only concern | Tests can detect via query plan / dataloader |
| Schema = OpenAPI (separate doc) | Schema = first-class artifact |

Because GraphQL returns 200 with errors in the body, a test that asserts only on status code will pass on every GraphQL request that "succeeded as a transport" — even when the resolver threw and the field is null. Always inspect `body.errors` and the actual data.

---

## Layers of testing

1. **Schema tests** — does the schema have what we expect? Are required fields non-null? Are deprecations applied where intended?
2. **Resolver unit tests** — given an arg / context, does this resolver return the right thing? (Server-side, framework-specific.)
3. **Operation tests** — given a query/mutation, does the server return the expected shape? (Like REST API tests.)
4. **Schema-diff CI gate** — has the schema changed in a breaking way?
5. **Client tests** — does the client app correctly consume the GraphQL response? (Often with mocked schema.)
6. **End-to-end** — real client against real server. Same trade-offs as E2E for REST.

A solid GraphQL test strategy hits 1, 3, 4 at minimum. Layer 2 in code, layer 5 with `MockedProvider` (Apollo) or equivalent, layer 6 sparingly.

---

## Operation tests (the bread and butter)

Whatever your stack, the pattern is the same:

```ts
// supertest-style example for an Apollo Server
import request from 'supertest';
import { app } from '../src/app';

const GET_USER = /* GraphQL */ `
  query GetUser($id: ID!) {
    user(id: $id) {
      id
      email
      roles
    }
  }
`;

it('returns the user', async () => {
  const res = await request(app)
    .post('/graphql')
    .send({ query: GET_USER, variables: { id: 'user-42' } })
    .set('Authorization', 'Bearer bearer-token-placeholder')
    .expect(200);

  expect(res.body.errors).toBeUndefined();
  expect(res.body.data.user).toMatchObject({
    id: 'user-42',
    email: expect.stringMatching(/@example\.com$/),
  });
});
```

Key habits:

- **Always assert `body.errors` is undefined for success cases.** Don't trust the 200.
- **Inspect `body.data` separately.** Both can be present (partial failure).
- **Keep queries in `.graphql` files or tagged template literals**, not inline strings, so they're greppable and lintable.

For failure cases, assert on the **shape and code** of the error, not the message text — messages drift.

---

## Schema tests

The GraphQL SDL is text. Diffing it is straightforward; asserting on it is more useful than it looks.

```ts
import { buildSchema, GraphQLObjectType } from 'graphql';
import { readFileSync } from 'fs';

const schema = buildSchema(readFileSync('schema.graphql', 'utf8'));

it('User.email is non-null String', () => {
  const userType = schema.getType('User') as GraphQLObjectType;
  const emailField = userType.getFields().email;
  expect(emailField.type.toString()).toBe('String!');
});

it('Query.user accepts ID! id', () => {
  const queryType = schema.getQueryType()!;
  const userField = queryType.getFields().user;
  const arg = userField.args.find(a => a.name === 'id')!;
  expect(arg.type.toString()).toBe('ID!');
});
```

These tests catch unintended schema changes that survive a code review.

---

## Schema-diff CI gate

The single highest-leverage CI check for a GraphQL API:

```bash
# Using graphql-inspector or similar
npx graphql-inspector diff schema.graphql https://staging.example.com/graphql
```

The tool reports each change as Safe / Dangerous / Breaking. Configure CI to fail on Breaking. Allow Dangerous with explicit approval (deprecation, default change). Allow Safe automatically.

The same approach works with `apollo` CLI's schema checks against Apollo Studio, or any equivalent tool — pick one and wire it into the PR pipeline.

---

## N+1 detection

A common GraphQL bug class: a query that looks fast but triggers one DB query per item.

For Apollo Server (and many others), instrument tests with the DataLoader / query-plan inspector your framework provides. Assertions like "this query produces at most 1 SQL statement per type" catch regressions early.

For black-box testing, sniff DB query count via a test-hook on the DB driver (most ORMs have one) and assert.

---

## Mocking schemas for client tests

For testing UI components or client code without a real backend, use `@graphql-tools/mock`:

```ts
import { addMocksToSchema, makeExecutableSchema } from '@graphql-tools/mock';
const schemaWithMocks = addMocksToSchema({
  schema: makeExecutableSchema({ typeDefs }),
  mocks: {
    User: () => ({ email: 'qa.user@example.com', roles: ['viewer'] }),
  },
});
```

For Apollo Client tests specifically, `MockedProvider` from `@apollo/client/testing` lets you specify the response for each operation in a component test.

---

## Subscriptions

WebSocket-based subscription testing is the wild west — every client/server pair has quirks.

- For server-side: drive subscriptions with the test client `graphql-ws` against a real WebSocket transport, assert each event.
- For Apollo Server v3+ subscriptions, the `graphql-ws` protocol is the current standard (the legacy `subscriptions-transport-ws` is deprecated).
- Test the unhappy paths: dropped connection, server restart, auth expiration.

Subscriptions are also the most likely area to skip and instead test via end-to-end UI flows. Be deliberate.

---

## Persisted queries

If your stack uses persisted queries (also called APQ — Automatic Persisted Queries), tests must either:

1. Test before APQ kicks in (raw queries), or
2. Pre-register the test queries with the persisted-query store.

If your production traffic is APQ-only, your tests should be APQ-aware too. Otherwise you're testing a different code path than what runs in prod.

---

## Common Pitfalls

- **Asserting only on HTTP 200** — GraphQL returns 200 for both success and resolver failure. Always check `body.errors`.
- **Inline query strings everywhere** — un-greppable, un-lintable. Use `.graphql` files plus `graphql-codegen` if possible.
- **Snapshot testing raw JSON responses** — every dynamic field breaks the snapshot. Snapshot the *shape*, not the *values*.
- **No schema-diff gate** — schema regresses silently. Add it to CI even if no other GraphQL tests exist.
- **Mocking the whole schema and testing the mock** — the test passes because the mock matches itself. Always include some real-server coverage.
- **Treating Hasura or AppSync as "no testing needed"** — they generate resolvers, but permission rules and computed fields are still business logic that needs tests.
- **Querying with `__typename` everywhere in tests, but not in production** — caches behave differently. Match how the client actually queries.
- **Forgetting to authenticate** — many endpoints quietly return null for restricted fields when unauth'd. Test as the role the test expects.

---

## Task-Specific Questions

When helping with GraphQL testing, ask:

1. Server — Apollo, Yoga, Mercurius, graphql-ruby, Hasura, AppSync, Strawberry?
2. Client — Apollo Client, urql, Relay, plain fetch, none?
3. Schema-first (SDL files) or code-first (schema generated from code)?
4. Are persisted queries / APQ used in production?
5. Subscriptions in scope, and on what transport (WebSocket, SSE)?
6. Test layers in place — schema, resolver unit, operation, schema-diff, client mock, E2E? Which are missing?
7. Permission / auth model — RBAC, field-level, row-level (e.g., Hasura)?

---

## Related Skills

- **rest-assured** / **supertest** / **pytest-api** — same patterns work for GraphQL when the endpoint is HTTP. Combine with this skill for GraphQL-specific concerns.
- **pact-contract-testing** — Pact has GraphQL plugins; useful for cross-team binding.
- **wiremock** — for stubbing a remote GraphQL dependency.
- **postman-newman** — works fine for GraphQL collections.
- **jest-vitest** — common runner for client-side GraphQL component tests.
- **ci-test-orchestration** — for wiring the schema-diff gate.
- **production-testing** — synthetic GraphQL probes for production monitoring.
