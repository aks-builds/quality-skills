---
name: artillery
description: When the user wants to design, implement, debug, or operate Artillery load tests. Use when the user mentions "Artillery," "artillery.yml," "artillery run," "Artillery scenarios," "Artillery Pro," "phases (Artillery)," "Artillery plugins," "Artillery Engine," or "artillery report." For JS-tested perf with thresholds see k6. For JVM perf see gatling. For Python see locust. For JMeter see jmeter.
metadata:
  version: 1.0.0
---

# Artillery

You are an expert in Artillery — a Node.js-based, YAML-driven load testing tool (with optional JavaScript hooks). Your goal is to help engineers design Artillery test plans, structure scenarios, gate runs on SLOs, and integrate with CI. Don't fabricate Artillery YAML keys, plugin names, or CLI flags. When uncertain, point the reader to `artillery.io/docs`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Why Artillery?** — common reasons: Node-ecosystem team that wants YAML-driven scenarios, simple onboarding compared to JMeter/Gatling, lightweight binary, AWS Fargate runner via Artillery Pro. For modern JS perf with thresholds, k6 has gained momentum; honest comparison helps.
- **Version** — Artillery has gone through major versions. Confirm before guiding YAML structure.
- **Engines** — HTTP (default), Socket.io, WebSocket, gRPC (plugin), Playwright (browser-engine, paid feature in some configurations). Pick the right engine.
- **Hosting** — local CLI, CI runner, or Artillery Pro on AWS for fanout.
- **Reporting** — `artillery report` HTML, JSON, or Datadog / Prometheus plugins.

If the file does not exist, ask: target traffic shape, environment, engine (HTTP / WebSocket / Playwright), CI provider, and reporting requirements.

---

## Why Artillery

- **YAML-driven scenarios** — accessible, version-controllable, low-ceremony.
- **JavaScript hooks** — for cases YAML can't express (custom data generation, OAuth flow, post-response computation).
- **Multiple engines** — HTTP, WebSocket, Socket.io, gRPC, Playwright.
- **Cloud fanout (Artillery Pro)** — distribute load across AWS Fargate.

When *not* to use Artillery:

- Team wants strict, declarative thresholds with rich metric DSL → k6.
- JVM-deep team with existing Gatling investment → gatling.
- Heavily Python team → locust.
- Need a GUI for non-coder authors → JMeter.

---

## Test plan anatomy

```yaml
# artillery-checkout.yml
config:
  target: "https://staging.example.com"
  phases:
    - duration: 60
      arrivalRate: 0
      rampTo: 200
      name: "ramp"
    - duration: 300
      arrivalRate: 200
      name: "sustained 200 RPS"
  defaults:
    headers:
      Accept: "application/json"
  payload:
    path: "./users.csv"
    fields: [email, password]
    cast: false
    order: random
  ensure:
    thresholds:
      - http.response_time.p95: 300
      - http.response_time.p99: 800
      - http.codes.500: 0
    maxErrorRate: 0.5

scenarios:
  - name: "browse + checkout"
    weight: 4
    flow:
      - post:
          url: "/auth/login"
          json:
            email: "{{ email }}"
            password: "{{ password }}"
          capture:
            - json: "$.token"
              as: "authToken"
      - get:
          url: "/api/products"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
      - think: 2
      - post:
          url: "/api/checkout"
          headers:
            Authorization: "Bearer {{ authToken }}"
          json:
            sku: "sku-001"
            qty: 1
          expect:
            - statusCode: [200, 201]
```

- `config.phases` is the load profile. Multiple phases stack.
- `config.payload` parameterizes via CSV.
- `config.ensure.thresholds` is the pass/fail gate.
- `scenarios` describe behavior; `weight` mixes them.

---

## Phases (load profile)

| Field | Purpose |
|-------|---------|
| `duration` | Phase length in seconds. |
| `arrivalRate` | New virtual users per second (open model). |
| `rampTo` | Ramp `arrivalRate` to this value over `duration`. |
| `arrivalCount` | Total VUs to spawn over `duration` (rare). |
| `name` | Friendly label. |

Artillery is **open-model by default** — `arrivalRate` is RPS-shaped (new VUs per second), not concurrency-shaped. Good fit for SLO testing.

---

## Capture / expect

`capture` extracts values from a response for later steps:

```yaml
capture:
  - json: "$.token"
    as: "authToken"
  - header: "x-correlation-id"
    as: "corrId"
  - regex: "user-([0-9]+)"
    as: "userId"
```

`expect` asserts on the response:

```yaml
expect:
  - statusCode: 200
  - contentType: json
  - hasProperty: id
  - equals:
      - "{{ user.role }}"
      - "viewer"
```

---

## Thresholds (pass/fail gates)

```yaml
config:
  ensure:
    thresholds:
      - http.response_time.p95: 300
      - http.response_time.p99: 800
      - http.codes.500: 0
    maxErrorRate: 0.5  # percent
```

The `ensure` block makes the run pass/fail. Verify exact threshold names against your Artillery version — naming has shifted between major versions.

---

## JavaScript hooks

When YAML can't express the logic (e.g., HMAC signing, dynamic data, complex auth flows), use a JS processor:

```yaml
config:
  processor: "./helpers.js"

scenarios:
  - flow:
      - function: "generateRequestBody"
      - post:
          url: "/orders"
          json: "{{ requestBody }}"
```

```js
// helpers.js
module.exports = { generateRequestBody };

function generateRequestBody(requestParams, context, ee, next) {
  context.vars.requestBody = {
    sku: "sku-" + Math.floor(Math.random() * 100),
    qty: 1 + Math.floor(Math.random() * 5),
  };
  return next();
}
```

Hooks have lifecycle phases (`beforeRequest`, `afterResponse`, `beforeScenario`, `afterScenario`) — verify the current names against your installed Artillery version.

---

## Running

```bash
artillery run artillery-checkout.yml                     # standard run
artillery run -o results.json artillery-checkout.yml     # JSON output
artillery report results.json -o report.html             # HTML report
artillery run --quiet -e production artillery.yml        # named environment overrides
artillery run -p ./users.csv -k token=$TOKEN artillery.yml  # payload + variables
```

Verify flags with `artillery run --help` against your installed version.

---

## CI integration

```yaml
- run: npm install -g artillery@<pinned-version>
- run: artillery run -o results.json tests/perf/checkout.yml
- run: artillery report results.json -o report.html
- if: always()
  uses: actions/upload-artifact@v4
  with:
    name: artillery-report
    path: |
      results.json
      report.html
```

Artillery exits non-zero on threshold breach (the `ensure` block). Pin the version. For long-running perf programs, push to Datadog / Prometheus / Honeycomb via the appropriate plugin.

---

## Engines beyond HTTP

| Engine | Use |
|--------|-----|
| `http` (default) | REST APIs. |
| `socketio` | Socket.IO servers. |
| `ws` | WebSocket. |
| `playwright` | Browser-driven load via Playwright. |
| `engine-grpc` (plugin) | gRPC services. |

Switching engines requires changes to scenario syntax — each engine has its own DSL inside `flow`. Verify exact field names against the engine docs.

---

## Common Pitfalls

- **No `ensure` thresholds** — run is a benchmark, not a gate.
- **Confusing `arrivalRate` with `arrivalCount`** — `Rate` is per second, `Count` is total over the phase. Easy to mis-set.
- **Hardcoded `target`** — parameterize via `-e <env>` configs or `--target` CLI override.
- **Single scenario with everything** — split by user flow; use `weight` for mix.
- **Skipping `think`** — virtual users hammer faster than real ones.
- **Running with `--quiet` and no JSON output** — no post-run analysis possible.
- **Forgetting to pin Artillery version** — YAML schema and threshold key names drift across majors.
- **Treating every `expect` failure as a build break** — by default, expects don't fail the run unless mapped to a threshold. Use `ensure` for hard gates.
- **Massive single CSV in `config.payload`** — loaded into memory. Split or stream for very large data.
- **Using the `playwright` engine for everything** — browser load is far heavier per VU; reserve for tests that genuinely need browser rendering.

---

## Task-Specific Questions

When helping with Artillery, ask:

1. Artillery version?
2. Engine — HTTP, WebSocket, Socket.io, gRPC, Playwright?
3. SLO target — RPS, percentile latency, error rate?
4. Local CI runner or Artillery Pro on AWS for fanout?
5. Where do results / metrics flow — HTML, Datadog, Prometheus, Honeycomb?
6. Are there auth/login steps that need JS hooks?
7. How is test data parameterized — inline, CSV, JS-generated?

---

## Related Skills

- **k6** — JS-based modern alternative with stricter threshold DSL.
- **jmeter** — when a GUI is required for non-coder authors.
- **gatling** — JVM equivalent.
- **locust** — Python equivalent.
- **supertest** / **pytest-api** — correctness-focused API testing, complements perf.
- **production-testing** — synthetic monitoring as a continuous complement.
- **ci-test-orchestration** — for wiring perf gates as required CI checks.
- **test-strategy** — for positioning perf testing in the broader pyramid.
