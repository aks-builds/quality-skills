---
name: pact-contract-testing
description: When the user wants to design, implement, or operate consumer-driven contract testing with Pact. Use when the user mentions "Pact," "contract testing," "consumer-driven contracts," "Pact Broker," "Pactflow," "pact_broker," "publish pacts," "verify pacts," "Pact matcher," "can-i-deploy," or "WIP pacts." For service virtualization see wiremock. For Postman-style API tests see postman-newman. For REST Assured / supertest / pytest-api see those skills. For schema-validation-only see graphql-testing / pytest-api schemathesis.
metadata:
  version: 1.0.0
---

# Pact Contract Testing

You are an expert in consumer-driven contract testing with Pact. Your goal is to help engineers design, implement, and operate contract tests across consumer and provider sides, plus the Pact Broker / Pactflow workflow that makes contract testing scalable. Don't fabricate Pact method names, broker API endpoints, or matcher syntax — point to `docs.pact.io` when uncertain.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Architecture** — Pact is most useful in microservice / multi-service architectures where consumers and providers are owned by different teams and deploy independently. For a monolith, contract testing is usually overkill.
- **Languages** — Pact has official implementations in JavaScript/Node, Java/JVM, Python, Ruby, Go, .NET, Rust, PHP, Swift. The consumer and provider can be in different languages.
- **Broker** — Pact Broker (self-hosted) or Pactflow (managed). Without a broker, contract testing is much less valuable because you lose the deployment-coordination workflow.
- **CI maturity** — Pact's value compounds when wired into CI with `can-i-deploy` gates. Manual workflows are fragile.

If the file does not exist, ask: architecture (number of services, ownership boundaries), consumer/provider languages, broker (Pact Broker / Pactflow / none yet), and CI provider.

---

## What contract testing is — and isn't

**Is**: an agreement between a consumer (e.g., a mobile app) and a provider (e.g., a payments API) about the *shape* of HTTP requests/responses they exchange. The consumer writes a Pact test that says "when I send this request, I expect this response shape." The provider then runs a verification that says "if I receive that request, I produce that response shape." The agreement (the pact file) is the contract.

**Isn't**:
- Not load testing.
- Not functional testing — pacts test *shape*, not business logic.
- Not a replacement for E2E — there are integration concerns pacts can't catch.
- Not auto-generated documentation, although it doubles as one.
- Not useful for system boundaries where you don't control both sides (e.g., a third-party API you can't ask to verify).

---

## The consumer side

The consumer writes a unit-test-style file using its language's Pact library. Each test defines:

1. The provider state (a precondition the provider must satisfy).
2. The expected request (method, path, headers, body).
3. The mock response (status, headers, body shape).

```js
// JavaScript / Node example using @pact-foundation/pact
import { PactV3, MatchersV3 } from '@pact-foundation/pact';
const { like, eachLike, regex } = MatchersV3;

const provider = new PactV3({
  consumer: 'web-app',
  provider: 'orders-service',
});

describe('orders-service consumer', () => {
  it('fetches orders for an authenticated user', async () => {
    provider
      .given('a user user-42 with 2 orders')
      .uponReceiving('a request for that user’s orders')
      .withRequest({
        method: 'GET',
        path: '/users/user-42/orders',
        headers: { Authorization: regex('^Bearer .+', 'Bearer bearer-token-placeholder') },
      })
      .willRespondWith({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: {
          orders: eachLike({
            id: like('ord-1001'),
            total: like(99.0),
          }, { min: 1 }),
        },
      });

    await provider.executeTest(async (mock) => {
      // call your code under test, pointing at mock.url
    });
  });
});
```

Running this test produces a **pact file** — a JSON document describing the interactions. That file gets published to the broker.

---

## Matchers — the heart of usable pacts

You almost never want exact equality. Use matchers so pacts don't break on every minor real value change.

| Matcher | Use |
|---------|-----|
| `like(value)` | Same type as value, any actual content. |
| `eachLike(shape, { min })` | Array where each element matches shape. |
| `regex(pattern, example)` | String matching the regex. |
| `term({ matcher, generate })` | Same as regex but more flexible. |
| `iso8601DateTime()` / `uuid()` | Common formats. |

A pact full of literal strings is brittle. A pact full of `like(...)` matchers is the right amount of strictness.

---

## The provider side

The provider checks out each pact file (usually from the broker) and runs a verification: replay every recorded interaction against the real service, assert the response matches.

```java
// JVM example (pact-jvm)
@Provider("orders-service")
@PactBroker(host = "broker.example.com")
public class OrdersServiceContractTest {
    @TestTemplate
    @ExtendWith(PactVerificationInvocationContextProvider.class)
    void verifyPact(PactVerificationContext context) {
        context.verifyInteraction();
    }

    @State("a user user-42 with 2 orders")
    public void user42HasOrders() {
        // seed the test database / fixtures for this state
    }
}
```

`@State` handlers are how providers satisfy the consumer's preconditions. They run before each interaction.

---

## The Pact Broker / Pactflow workflow

The broker stores pacts and verification results. Without it, you have JSON files floating around — with it, you get the coordination workflow that makes contract testing worth the cost.

### Lifecycle

1. Consumer CI runs consumer tests → publishes new pact (with consumer version) to broker.
2. Broker notifies provider that a new pact was published (webhook).
3. Provider CI verifies the new pact against the relevant provider branch/version → publishes verification result.
4. Both sides query the broker via `can-i-deploy` before deploying.

### `can-i-deploy`

```bash
pact-broker can-i-deploy \
  --pacticipant web-app --version $GIT_SHA \
  --to-environment production
```

The broker answers: yes (every required compatibility is verified), or no (with a list of unverified or failing pacts). Wire this into the deploy job as a required gate.

---

## WIP pacts and pending pacts

Both prevent "we added a new pact and now the provider is red because it doesn't know about it":

- **Pending pacts**: a verification failure on a pact the provider doesn't yet know is *non-blocking*. Provider builds stay green until the provider explicitly accepts the new pact.
- **WIP pacts**: a more recent feature — pacts published by the consumer after the provider's last build can be opted-in for verification without blocking.

Without these, contract testing creates a coupling between consumer and provider release cadence that defeats the point.

---

## When to write a pact vs. an integration test

| Use a pact | Use an integration test |
|------------|-------------------------|
| Different team owns the provider | Same team / same repo |
| Provider deploys independently | Provider deploys with consumer |
| You want to gate deployments on compatibility | You want to test wiring & business logic |
| Test shapes, not logic | Test logic end-to-end |
| The broker is set up | No broker available |

Don't write pacts between a controller and a service in the same JVM. That's an integration test.

---

## Common Pitfalls

- **No broker** — pacts in Git work for the first 5 minutes. They don't scale. Get a Pact Broker or Pactflow before adopting contract testing org-wide.
- **Exact-match matchers everywhere** — the pact breaks on every real-data change. Use `like` / `eachLike` / `regex` aggressively.
- **Treating pacts as functional tests** — they're not. Don't write pacts that try to assert business rules.
- **Not setting up provider states** — a `@State("user with 2 orders")` that does nothing means the verification runs against whatever data happens to be there. Tests become flaky and meaningless.
- **No `can-i-deploy` gate** — the workflow only pays off when deploys check compatibility. Without that, contract testing is just extra tests.
- **Skipping pending/WIP pact configuration** — new pacts immediately break provider builds; teams disable contract testing in frustration.
- **Pacts across systems you don't own** — if the third party can't run pact verification, your pacts are wishful thinking.
- **Generating pacts from a recorded session** — the pact then encodes incidental fields and breaks constantly. Write pact tests deliberately, like unit tests.
- **One giant consumer pact file** — split by provider, by feature area. Easier to review, easier to evolve.

---

## Task-Specific Questions

When helping with Pact, ask:

1. How many services, and who owns each?
2. Languages on each side?
3. Pact Broker (self-hosted) or Pactflow (managed) — or none yet?
4. CI provider and how deploys are gated today?
5. Are consumer and provider in the same repo or different repos?
6. Which interactions need pacts (high-traffic critical paths first), and which are better left to integration tests?
7. Provider state setup — are you ready to maintain fixture / seed code for each state?

---

## Related Skills

- **rest-assured** / **supertest** / **pytest-api** — language-native API testing that complements pacts (pacts for compatibility, code tests for business logic).
- **postman-newman** — Postman tests are *not* contract tests; clarify the difference when migrating.
- **wiremock** — service virtualization is sometimes confused with contract testing; they solve different problems.
- **karate** — Karate doesn't replace Pact; can be used together.
- **ci-test-orchestration** — for wiring `can-i-deploy` into deploy gates.
- **test-strategy** — for placing contract testing in the broader pyramid.
- **graphql-testing** / **grpc-testing** — Pact has GraphQL and protobuf-aware patterns; the principles transfer.
