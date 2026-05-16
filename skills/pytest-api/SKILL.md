---
name: pytest-api
description: When the user wants to design, implement, debug, or scale Python API tests using pytest + requests/httpx. Use when the user mentions "pytest API tests," "requests for API testing," "httpx," "pytest fixtures for API," "responses (mock library)," "respx," "vcr.py," "schemathesis," or "FastAPI TestClient." For Java API testing see rest-assured. For Node API testing see supertest. For Postman collections see postman-newman. For contract testing see pact-contract-testing.
metadata:
  version: 1.0.0
---

# pytest API Testing

You are an expert in API testing with Python + pytest + `requests` / `httpx`. Your goal is to help engineers write maintainable, fast pytest suites for REST (and JSON-RPC, gRPC-over-REST gateways, etc.) — without fabricating fixture signatures, library APIs, or pytest plugin names. When uncertain, point the reader to `docs.pytest.org`, `docs.python-requests.org`, or `python-httpx.org`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **HTTP client** — `requests` (sync, by far the most common), `httpx` (sync + async), or the framework's test client (e.g., FastAPI's `TestClient`, Django's `Client`).
- **Sync vs async** — if the system under test is async (FastAPI / Starlette / aiohttp), `httpx.AsyncClient` is the natural fit.
- **Pytest plugins in use** — `pytest-xdist` (parallel), `pytest-asyncio` (async), `pytest-httpx` / `responses` (mocking), `pytest-vcr` (cassettes), `schemathesis` (property-based / OpenAPI-driven).
- **Auth model** — Bearer / Basic / OAuth / cookies / mTLS. Affects fixture design.
- **Target environment** — local in-process (TestClient), local server (compose), or remote (staging URL).

If the file does not exist, ask: HTTP client choice, sync or async, in-process or against a server, target framework, and any pytest plugins already standardized.

---

## Why pytest + requests/httpx

- **First-class fixtures** — declarative, scoped, composable. Setup once, reuse everywhere.
- **Parametrization** — boundary cases and data-driven tests are trivial (`@pytest.mark.parametrize`).
- **Parallel execution** — `pytest-xdist` for free CPU scaling.
- **Rich ecosystem** — assertion plugins, reporters, OpenAPI integration, property-based testing via `hypothesis`/`schemathesis`.
- **Pythonic** — refactors, types (with mypy), IDE support all work.

When *not* to use pytest:

- Non-Python stack with no Python expertise → use the language-native option.
- Pure Postman/QA-led workflows → postman-newman.

---

## Test layout

```
tests/
├── conftest.py            # shared fixtures (auth, base url, http client)
├── conftest_helpers.py    # non-fixture utilities (data builders, schema loaders)
├── api/
│   ├── conftest.py        # api-scoped fixtures
│   ├── test_users.py
│   ├── test_orders.py
│   └── test_search.py
├── fixtures/
│   └── users.json
└── schemas/
    └── user.schema.json
```

`conftest.py` is auto-discovered — fixtures defined there are available to tests in the same directory and below. Use the nearest `conftest.py` for the narrowest scope.

---

## Core fixture patterns

### Base URL and HTTP client

```python
# conftest.py
import os
import pytest
import requests

@pytest.fixture(scope="session")
def base_url():
    return os.environ.get("API_BASE_URL", "https://staging.example.com")

@pytest.fixture
def http(base_url):
    session = requests.Session()
    session.headers.update({"Accept": "application/json"})
    session.hooks["response"] = [lambda r, *a, **kw: r.raise_for_status() if False else None]
    yield session
    session.close()
```

### Auth

```python
@pytest.fixture(scope="session")
def access_token(base_url):
    resp = requests.post(
        f"{base_url}/auth/login",
        json={"email": os.environ["QA_USER"], "password": os.environ["QA_PASS"]},
    )
    resp.raise_for_status()
    return resp.json()["token"]

@pytest.fixture
def authed(http, access_token):
    http.headers["Authorization"] = f"Bearer {access_token}"
    return http
```

Tests use `def test_thing(authed, base_url):` — the auth setup runs once per session.

### Test data builders

```python
def make_user(**overrides):
    return {"email": "qa.user@example.com", "name": "QA User", "role": "viewer", **overrides}
```

Keep builders in a `tests/_data.py` (or similar) and import them. Avoid `pytest.fixture` for plain data — functions are simpler.

---

## httpx for async

```python
# conftest.py
import pytest
import httpx

@pytest.fixture
async def client(base_url):
    async with httpx.AsyncClient(base_url=base_url, timeout=10.0) as c:
        yield c

@pytest.mark.asyncio
async def test_get_user(client):
    resp = await client.get("/users/user-42")
    assert resp.status_code == 200
```

Requires `pytest-asyncio` (set `asyncio_mode = "auto"` in `pytest.ini` to drop the explicit marker on every async test).

---

## In-process testing

For FastAPI / Starlette:

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
def test_health():
    assert client.get("/health").status_code == 200
```

For Django REST: `django.test.Client` or `rest_framework.test.APIClient`. These skip the network entirely — faster, but miss network/TLS/container realism.

---

## Mocking external HTTP

Two main libraries:

| Library | Use |
|---------|-----|
| `responses` | Mock `requests` calls. Decorator or context manager. |
| `respx` | Mock `httpx` calls. Same idea. |
| `pytest-httpx` | pytest plugin wrapper around `httpx` mocking. |
| `vcr.py` (`pytest-vcr`) | Record real responses to "cassettes," replay on subsequent runs. Useful for third-party APIs you can't mock easily. |

```python
import responses

@responses.activate
def test_calls_billing():
    responses.add(
        responses.POST,
        "https://billing.example.com/charge",
        json={"id": "ch_123"},
        status=201,
    )
    # ... code under test that calls billing.example.com
    assert len(responses.calls) == 1
```

Use mocks for **external** dependencies. Don't mock your own API — test against it.

---

## Schema validation

```python
import json
import jsonschema

with open("tests/schemas/user.schema.json") as f:
    USER_SCHEMA = json.load(f)

def test_user_shape(authed, base_url):
    resp = authed.get(f"{base_url}/users/user-42")
    assert resp.status_code == 200
    jsonschema.validate(resp.json(), USER_SCHEMA)
```

For OpenAPI-driven projects, `schemathesis` generates property-based tests from your spec:

```bash
schemathesis run https://staging.example.com/openapi.json
```

This catches contract drift between the spec and the implementation. Pair with the OpenAPI spec living in the same repo.

---

## Parametrization

```python
import pytest

@pytest.mark.parametrize("email,expected", [
    ("qa.user@example.com", 200),
    ("invalid-email", 400),
    ("", 400),
    ("a" * 256 + "@example.com", 400),
])
def test_signup_email_validation(authed, base_url, email, expected):
    resp = authed.post(f"{base_url}/users", json={"email": email})
    assert resp.status_code == expected
```

For larger data sets, load from a JSON/CSV fixture and use `pytest.mark.parametrize` with `pytest.param(..., id=...)` for readable test IDs.

---

## Running tests

| Command | Purpose |
|---------|---------|
| `pytest` | Run all tests. |
| `pytest tests/api/test_users.py` | One file. |
| `pytest -k "user and not slow"` | Filter by name expression. |
| `pytest -m smoke` | Run tests marked `@pytest.mark.smoke`. |
| `pytest -n auto` | Parallel via pytest-xdist (auto = CPU count). |
| `pytest --maxfail=5` | Stop after N failures. |
| `pytest -x` | Stop on first failure. |
| `pytest --lf` | Last failed. |
| `pytest --ff` | Failed first, then the rest. |
| `pytest --junitxml=report.xml` | JUnit XML for CI. |

Verify flags with `pytest --help` against your installed version.

---

## CI integration

```yaml
- run: pip install -r requirements-dev.txt
- run: pytest -n auto --junitxml=report.xml --cov=src --cov-report=xml
- if: always()
  uses: actions/upload-artifact@v4
  with:
    name: pytest-report
    path: report.xml
```

For Allure: `pytest --alluredir=allure-results`, then publish with the Allure CLI.

---

## Common Pitfalls

- **Stuffing too much in fixtures** — fixtures are great for setup, bad for orchestration. Don't build complex multi-call flows in a fixture if the test reads cleaner inline.
- **Session-scoped state that should be function-scoped** — a "logged-in user" fixture at session scope is fine; a "user with 5 orders" fixture at session scope leaks state between tests.
- **Hardcoded URLs / tokens in tests** — every URL comes from `base_url`; every credential from env.
- **`time.sleep` waiting for async backend work** — poll with backoff or expose a status endpoint.
- **Asserting `assert resp.status_code == 200 and 'foo' in resp.json()` on one line** — split for clearer failure messages.
- **Not using `requests.Session()`** — every `requests.get(...)` creates a new connection. Sessions share connection pools and headers.
- **Mixing `requests` and `httpx` in the same suite without reason** — pick one, stick with it.
- **Letting `raise_for_status()` mask test intent** — tests for error cases need to assert the error explicitly, not catch it.
- **No timeouts** — every HTTP call should have a timeout. A hanging API will hang the test.
- **Mocking your own API** — kills coverage. Use mocks for external dependencies only.

---

## Task-Specific Questions

When helping with pytest API testing, ask:

1. HTTP client — `requests`, `httpx`, or framework TestClient?
2. Sync or async — and is the SUT async?
3. In-process (TestClient / mocked DB) or against a deployed server?
4. Auth — Bearer, OAuth, cookie, mTLS?
5. Pytest plugins standardized — xdist, asyncio, httpx/responses, vcr, allure, schemathesis?
6. Is there an OpenAPI spec — can it drive schemathesis tests?
7. CI parallelism — `-n auto` per machine, or matrix split across machines?

---

## Related Skills

- **pytest** — for general pytest fundamentals (fixtures, marks, parametrization).
- **rest-assured** — JVM equivalent.
- **supertest** — Node equivalent.
- **postman-newman** — when QA-led collections complement code tests.
- **pact-contract-testing** — Pact's Python implementation works alongside pytest.
- **wiremock** — for service virtualization that pytest tests can target.
- **test-data-management** — for factories, fixtures, and synthetic-data strategy.
- **ci-test-orchestration** — for pytest-xdist tuning and sharding strategy.
