---
name: locust
description: When the user wants to design, implement, debug, or operate Locust load tests in Python. Use when the user mentions "Locust," "HttpUser," "@task," "TaskSet," "locustfile.py," "master/worker," "Locust web UI," "FastHttpUser," "constant_pacing," "wait_time," or "locust -f -u -r --headless." For k6 see k6. For JMeter see jmeter. For Gatling see gatling. For Node-based perf see artillery.
metadata:
  version: 1.0.0
---

# Locust

You are an expert in Locust — a Python-based, code-first load testing tool. Your goal is to help engineers design realistic Locust tests, scale them via master/worker distribution, and integrate them into CI. Don't fabricate Locust class methods, decorators, or CLI flags. When uncertain, point the reader to `docs.locust.io`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Python ecosystem fit** — Locust shines when the team is already Python-strong (Django/FastAPI/Flask backends, pytest test suite). For JS-only teams, k6 is usually a better fit.
- **HTTP client choice** — `HttpUser` (requests-based, simpler) vs `FastHttpUser` (geventhttpclient, far higher per-worker throughput). For high-RPS targets, prefer FastHttpUser.
- **Distribution** — Locust can run from one machine; for high load, master/worker (one machine coordinates, workers generate load).
- **Web UI vs headless** — UI is great for design and exploration. CI runs `--headless`.
- **Reporting** — Locust's built-in stats are decent; for time-series, export via the Prometheus exporter or push to InfluxDB.

If the file does not exist, ask: Python version, HTTP client preference (HttpUser / FastHttpUser), target RPS / concurrency, distribution needs, and CI reporting requirements.

---

## Why Locust

- **Pure Python** — write tests in the language your team already knows.
- **Code-first** — no XML, no GUI dependency; tests live in version control.
- **Web UI for design** — start/stop/adjust load live during exploration.
- **Master/worker distribution** — scale horizontally.
- **Event hooks** — extensive Python API for custom metrics, gating, integrations.

When *not* to use Locust:

- Non-Python team → k6 / Gatling / Artillery / JMeter.
- Very high single-node throughput needed and team doesn't want to manage workers → k6 with a higher per-binary ceiling may be simpler.
- Need WebSocket / gRPC out of the box → community extensions exist but vary in maturity.

---

## Basic shape

```python
from locust import HttpUser, task, between

class CheckoutUser(HttpUser):
    wait_time = between(1, 3)  # think time per task

    def on_start(self):
        resp = self.client.post(
            "/auth/login",
            json={"email": "qa.user@example.com", "password": "Pa$$w0rd-fake"},
            name="POST /auth/login",
        )
        self.token = resp.json()["token"]
        self.client.headers.update({"Authorization": f"Bearer {self.token}"})

    @task(3)
    def browse_products(self):
        self.client.get("/api/products", name="GET /api/products")

    @task(1)
    def checkout(self):
        self.client.post(
            "/api/checkout",
            json={"sku": "sku-001", "qty": 1},
            name="POST /api/checkout",
        )
```

- `HttpUser` subclasses describe one virtual user.
- `@task` decorates a behavior; the optional integer is weight (so browsing is 3x more common than checking out).
- `wait_time = between(min, max)` provides think time per task.
- `on_start` runs once per VU at spawn (use for login, setup).

---

## HttpUser vs FastHttpUser

| Class | Backend | When |
|-------|---------|------|
| `HttpUser` | `requests` | Default, simple, ergonomic, lower per-worker throughput. |
| `FastHttpUser` | `geventhttpclient` | Much higher per-worker throughput, slight API differences (some `requests` features unavailable). |

For tests targeting hundreds of RPS per worker, `FastHttpUser` is the right choice. For most teams writing first Locust tests, `HttpUser` is fine.

---

## `wait_time` strategies

- `between(min, max)` — random uniform.
- `constant(N)` — fixed N seconds.
- `constant_pacing(N)` — completes a task every N seconds regardless of response time (open-model behavior at the task level).

`constant_pacing` is what you want when you have an RPS-shaped goal. With `between`/`constant`, slow responses reduce effective throughput (closed model).

---

## Naming requests with `name=`

By default Locust groups requests by URL — `client.get('/users/abc')` and `/users/xyz` are aggregated separately, polluting stats. Always pass `name=` to group by logical endpoint:

```python
self.client.get(f"/users/{user_id}", name="GET /users/:id")
```

Stats become readable. Without this, your report is unusable for any URL that contains an ID.

---

## Configuration

```python
from locust import HttpUser, task, between, events

class MyUser(HttpUser):
    host = "https://staging.example.com"  # default host, can be overridden via --host
    wait_time = between(1, 3)
```

For multi-environment runs, pass `--host` on the CLI; the `host` class attribute is just the default.

---

## Custom events and metrics

```python
from locust import events

@events.request.add_listener
def on_request(request_type, name, response_time, response_length, exception, **kwargs):
    if exception is not None:
        # custom logging / alerting
        pass

@events.test_start.add_listener
def on_test_start(environment, **kwargs):
    # setup hook
    pass
```

For custom metrics, fire `events.request.fire(...)` from inside tasks to record events Locust didn't natively capture (e.g., business outcome flags).

---

## Running

```bash
# Web UI (for design / exploration)
locust -f locustfile.py --host https://staging.example.com

# Headless (for CI)
locust -f locustfile.py --host https://staging.example.com \
    --headless -u 200 -r 20 -t 5m \
    --csv=results --html=report.html

# Distributed: master
locust -f locustfile.py --master --master-host 0.0.0.0

# Distributed: worker
locust -f locustfile.py --worker --master-host master.internal
```

| Flag | Purpose |
|------|---------|
| `-f <file>` | Locustfile path. |
| `--host <url>` | Override `host` class attribute. |
| `--headless` | No web UI. |
| `-u <N>` | Number of users (target concurrency). |
| `-r <N>` | Spawn rate (users per second). |
| `-t <duration>` | Run duration (e.g., `5m`, `2h`). |
| `--csv=<prefix>` | Write stats CSV files. |
| `--html=<file>` | Write HTML report. |
| `--exit-code-on-error <code>` | Exit with non-zero on errors (CI gating). |
| `--stop-timeout <s>` | Allow N seconds for in-flight requests to finish. |

Verify flags with `locust --help` against your installed version.

---

## Pass/fail gating in CI

Locust doesn't have built-in declarative thresholds the way k6 does. Two patterns:

1. **`--exit-code-on-error`** — non-zero exit if any request errored. Coarse but easy.
2. **Custom event listener that calls `environment.process_exit_code = 1`** if SLO breached. Example:

```python
@events.quitting.add_listener
def assert_slo(environment, **kwargs):
    stats = environment.stats.total
    if stats.get_response_time_percentile(0.95) > 300:
        environment.process_exit_code = 1
    if stats.fail_ratio > 0.005:
        environment.process_exit_code = 1
```

Wire this in your locustfile and CI gets a real gate.

---

## CI integration

```yaml
- run: pip install locust
- run: |
    locust -f tests/perf/checkout.py \
      --host ${{ vars.STAGING_URL }} \
      --headless -u 200 -r 20 -t 5m \
      --csv=results --html=report.html \
      --exit-code-on-error 1
- if: always()
  uses: actions/upload-artifact@v4
  with:
    name: locust-report
    path: |
      results_*.csv
      report.html
```

Pin Locust version in `requirements-perf.txt`. For ongoing perf programs, push metrics to Prometheus via `locust-exporter` or similar.

---

## Common Pitfalls

- **No `name=` on parameterized URLs** — stats are unreadable. Always group.
- **`HttpUser` when you need raw throughput** — switch to `FastHttpUser`.
- **`wait_time = between(...)` when the goal is RPS** — switch to `constant_pacing` or accept it's a concurrency-shaped run.
- **Single worker for high-RPS goals** — Python GIL + requests is throughput-limited. Distribute.
- **Forgetting `--headless` in CI** — the web UI starts and the run never executes load.
- **`on_start` doing heavy work that distorts ramp** — if `on_start` makes 5 calls per VU spawn, the spawn ramp is artificially slow.
- **Hardcoded host in code** — pass `--host` from CI.
- **No SLO gate** — `--exit-code-on-error` is the easy bar; add an event-listener SLO check for real gating.
- **Skipping `--stop-timeout`** — abrupt shutdown can show in-flight requests as failed, inflating error rate.

---

## Task-Specific Questions

When helping with Locust, ask:

1. Python version, and how is Locust installed (pip, container image)?
2. `HttpUser` or `FastHttpUser`?
3. SLO target — concurrency or RPS?
4. Single machine, or master/worker distributed?
5. Web UI for exploration, headless for CI, or both?
6. How are SLO breaches gated — `--exit-code-on-error`, custom listener, or external dashboard?
7. Where do results go — CSV/HTML artifact, Prometheus, BlazeMeter, etc.?

---

## Related Skills

- **k6** — JS-based modern alternative; often simpler for the same job.
- **jmeter** — when GUI is required for non-coder authors.
- **gatling** — JVM equivalent.
- **artillery** — Node alternative.
- **pytest-api** — pytest is for correctness, Locust is for load — same Python ecosystem, different jobs.
- **ci-test-orchestration** — for wiring perf gates in CI.
- **production-testing** — for synthetic monitoring as a complement.
- **test-strategy** — for placing perf testing in the overall pyramid.
