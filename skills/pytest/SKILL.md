---
name: pytest
description: When the user wants to design, implement, debug, or optimize pytest tests in Python. Use when the user mentions "pytest," "pytest fixtures," "conftest.py," "pytest.ini," "pyproject.toml pytest section," "@pytest.fixture," "@pytest.mark.parametrize," "pytest-xdist," "pytest-asyncio," "pytest-cov," "monkeypatch," "tmp_path," "capsys," or "pytest plugins." For pytest-based API testing see pytest-api. For JS/TS unit testing see jest-vitest. For Java see junit-testng. For .NET see xunit-nunit.
metadata:
  version: 1.0.0
---

# pytest

You are an expert in pytest — Python's de facto unit and integration test runner. Your goal is to help engineers design clean fixtures, parametrize effectively, manage async tests, and pick the right plugins without overgrowing the dependency surface. Don't fabricate pytest APIs, fixture names, or plugin names. When uncertain, point the reader to `docs.pytest.org`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Python version** — pytest features are version-stable, but some plugins lag Python releases.
- **Project layout** — `src/` layout vs flat. Affects pytest's discovery.
- **Async strategy** — `pytest-asyncio` (most common) vs `anyio` plugin for `asyncio` + `trio` cross-compat.
- **Plugins already in use** — `pytest-xdist` (parallel), `pytest-cov` (coverage), `pytest-mock` (mocker fixture), `pytest-httpx` / `responses` (HTTP mocking), `pytest-django` / `pytest-flask` (framework-specific), `hypothesis` (property-based).
- **Framework under test** — Django / FastAPI / Flask / Starlette / pure library. Test patterns differ.

If the file does not exist, ask: Python version, framework, plugins standardized, async style, CI provider.

---

## Why pytest

- **Declarative, scoped fixtures** — composable, reusable, scoped per function / class / module / session.
- **Parametrization** — boundary cases and data-driven tests are trivial.
- **Plugin ecosystem** — hundreds of plugins, generally maintained.
- **Plain functions** — no inheritance, no special syntax. Tests are functions.
- **Detailed assertion introspection** — `assert x == y` shows exactly what differed, no special matcher API needed.

When *not* to use pytest:

- Non-Python — see jest-vitest / junit-testng / xunit-nunit.
- Pure black-box API testing without Python ecosystem benefits — Postman / Newman might be a better fit for QA-only teams (cross-reference postman-newman).

---

## Test layout

```
src/
├── myproject/
│   ├── __init__.py
│   └── ...
tests/
├── conftest.py           # shared fixtures, hooks
├── unit/
│   ├── test_math.py
│   └── test_parsers.py
├── integration/
│   ├── conftest.py       # integration-only fixtures
│   └── test_api.py
└── fixtures/
    └── sample.json
```

`conftest.py` is auto-discovered. Fixtures defined in `tests/conftest.py` are available to every test under `tests/`; fixtures in `tests/integration/conftest.py` are scoped to that subdirectory.

---

## A test

```python
# test_math.py
def test_add():
    assert add(1, 2) == 3

def test_divides_to_zero_raises():
    with pytest.raises(ZeroDivisionError):
        divide(1, 0)
```

No imports of `unittest.TestCase`, no `self.assertEqual`. Plain `assert` works because pytest rewrites it to show useful diff on failure.

---

## Fixtures

```python
import pytest

@pytest.fixture
def temp_user():
    user = create_user(email='qa.user@example.com', name='QA User')
    yield user
    delete_user(user.id)

def test_user_has_email(temp_user):
    assert temp_user.email.endswith('@example.com')
```

Fixtures are dependency-injected by name. The `yield` style provides setup and teardown.

### Scopes

| Scope | Lifetime |
|-------|----------|
| `function` (default) | One per test. |
| `class` | One per class. |
| `module` | One per module. |
| `package` | One per package. |
| `session` | One per pytest run. |

```python
@pytest.fixture(scope='session')
def database_url():
    return os.environ.get('DATABASE_URL', 'postgresql://qa.user:Pa$$w0rd-fake@localhost/test')
```

Pick the narrowest scope that's still cheap. A `session`-scoped fixture that mutates is a flake factory.

### Autouse

```python
@pytest.fixture(autouse=True)
def reset_singletons():
    Singleton.reset()
```

Runs for every test without needing to be requested. Use sparingly — autouse fixtures are easy to forget about and surprise future readers.

### Parameterizing fixtures

```python
@pytest.fixture(params=['sqlite', 'postgres'])
def db(request):
    return make_db(request.param)
```

Every test using `db` runs twice — once per backend.

---

## Parametrize

```python
@pytest.mark.parametrize('email,expected', [
    ('qa.user@example.com', True),
    ('not-an-email', False),
    ('', False),
    pytest.param('Α@β.com', True, id='unicode-local-part'),
])
def test_is_valid_email(email, expected):
    assert is_valid_email(email) == expected
```

`pytest.param(..., id=...)` gives readable test names in output and reports.

For large datasets, load from JSON / CSV and pass via `parametrize`:

```python
import json, pathlib
CASES = json.loads(pathlib.Path('tests/fixtures/email_cases.json').read_text())

@pytest.mark.parametrize('email,expected', CASES)
def test_is_valid_email(email, expected):
    assert is_valid_email(email) == expected
```

---

## Built-in fixtures

| Fixture | Use |
|---------|-----|
| `tmp_path` | Per-test temporary directory (`pathlib.Path`). |
| `tmp_path_factory` | Session-scoped temporary directories. |
| `monkeypatch` | Mutate env vars / attributes / dict items; auto-reverts. |
| `capsys` / `capfd` | Capture stdout/stderr. |
| `caplog` | Capture logging records. |
| `request` | Introspect the current test / fixture context. |

```python
def test_reads_config(monkeypatch, tmp_path):
    cfg = tmp_path / 'app.toml'
    cfg.write_text('debug = true')
    monkeypatch.setenv('APP_CONFIG_PATH', str(cfg))
    assert load_config().debug is True
```

---

## Marks

```python
@pytest.mark.slow
def test_long_running():
    ...

@pytest.mark.skip(reason='needs Redis')
def test_with_redis():
    ...

@pytest.mark.skipif(sys.platform == 'win32', reason='posix only')
def test_unix_only():
    ...

@pytest.mark.xfail(reason='known broken in v2.0')
def test_known_issue():
    ...
```

Register custom marks in `pyproject.toml` / `pytest.ini` to avoid warnings:

```ini
[tool.pytest.ini_options]
markers = [
    "slow: marks tests as slow",
    "integration: marks tests as integration",
]
```

Run subsets: `pytest -m "not slow"`, `pytest -m "integration and not flaky"`.

---

## Async with pytest-asyncio

```python
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"   # async def tests auto-detected

# test file
async def test_fetch_user():
    user = await fetch_user('user-42')
    assert user.id == 'user-42'
```

With `asyncio_mode = "auto"`, every `async def test_*` runs as an async test. Without it, decorate explicitly: `@pytest.mark.asyncio`.

For trio / multi-backend, use `anyio` plugin.

---

## Mocking

Two main approaches:

### `monkeypatch` for simple replacements

```python
def test_uses_clock(monkeypatch):
    monkeypatch.setattr('myproject.clock.now', lambda: datetime(2026, 1, 1))
    assert message() == 'Happy 2026'
```

### `unittest.mock` (often via `pytest-mock`'s `mocker` fixture)

```python
def test_calls_billing(mocker):
    billing_mock = mocker.patch('myproject.billing.charge')
    billing_mock.return_value = {'id': 'ch_synthetic'}
    process_order(order_id='ord-1')
    billing_mock.assert_called_once()
```

`pytest-mock` is a thin wrapper around `unittest.mock` that gives you the `mocker` fixture with auto-teardown.

For HTTP mocking specifically, see pytest-api skill for `responses` / `respx` / `pytest-httpx`.

---

## Running

| Command | Purpose |
|---------|---------|
| `pytest` | Run everything discovered. |
| `pytest tests/unit` | One directory. |
| `pytest tests/unit/test_math.py::test_add` | One test. |
| `pytest -k "email and not unicode"` | Filter by name expression. |
| `pytest -m "not slow"` | Filter by mark. |
| `pytest -n auto` | Parallel via pytest-xdist. |
| `pytest -x` | Stop on first failure. |
| `pytest --lf` / `--ff` | Last failed / failed first. |
| `pytest --pdb` | Drop into debugger on failure. |
| `pytest -v` | Verbose. |
| `pytest --tb=short` | Compact tracebacks. |
| `pytest --junitxml=report.xml` | JUnit XML. |
| `pytest --cov=myproject` | Coverage via pytest-cov. |

Verify against `pytest --help` for your installed version.

---

## CI

```yaml
- run: pip install -r requirements-dev.txt
- run: pytest -n auto --junitxml=report.xml --cov=myproject --cov-report=xml
- if: always()
  uses: actions/upload-artifact@v4
  with: { name: pytest-report, path: report.xml }
```

Pin pytest and plugin versions in `requirements-dev.txt`. Use `pytest-xdist` for parallelism, `--maxfail=N` to stop early on collapse, and ensure tests are parallel-safe (cross-reference pytest-api eval on parallel safety).

---

## Common Pitfalls

- **Putting expensive work in `conftest.py` module level** — runs on collection, slows everything. Use session-scoped fixtures.
- **Session-scoped fixtures that mutate** — order dependence.
- **`assert x or "useful message"` instead of `assert x, "useful message"`** — wrong syntax silently always-true.
- **One mega-fixture that does five things** — split. Fixtures should compose.
- **Module-level imports that hit the network / DB** — discovery alone now requires connectivity.
- **`@pytest.mark.parametrize` with mutable defaults** — same default object shared across params. Use a factory.
- **Mocking your own code instead of dependencies** — test the real behavior; mock at the boundary.
- **Snapshot-style assertions on huge JSON blobs** — fragile. Use `toMatchObject`-style partial assertions or `jsonschema`.
- **Not using `tmp_path` for files** — leaks junk into the project directory.
- **`pytest --random-order` revealing failures** — those tests were order-dependent. Fix the underlying issue.

---

## Task-Specific Questions

When helping with pytest, ask:

1. Python version?
2. Project layout (src-layout or flat)?
3. Framework — Django / FastAPI / Flask / pure library?
4. Async — yes / no / mixed?
5. Plugins standardized — xdist, asyncio, cov, mock, hypothesis, framework-specific?
6. Test scope mix — units / integration / E2E?
7. CI parallelism budget?

---

## Related Skills

- **pytest-api** — pytest-flavored HTTP API testing.
- **jest-vitest** — JS/TS equivalent.
- **junit-testng** — JVM equivalent.
- **xunit-nunit** — .NET equivalent.
- **test-data-management** — factories, fixtures, synthetic data strategy.
- **flaky-test-management** — when fixtures leak state.
- **code-coverage** — pytest-cov patterns and what to do with the numbers.
- **mutation-testing** — `mutmut` is the Python tool.
- **ci-test-orchestration** — sharding via xdist and across machines.
