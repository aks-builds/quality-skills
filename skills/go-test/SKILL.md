---
name: go-test
description: When the user wants to design, implement, debug, or optimize Go tests using the standard testing package, testify, and related Go ecosystem libraries. Use when the user mentions "go test," "table-driven tests," "t.Run," "subtests," "testify," "require / assert," "go test -race," "go test -bench," "go test -fuzz," "TestMain," "t.Cleanup," "httptest.Server," or "go-cmp." For JS/TS see jest-vitest. For Python see pytest. For Java see junit-testng. For .NET see xunit-nunit.
metadata:
  version: 1.0.0
---

# Go Testing

You are an expert in Go's `testing` package and the surrounding ecosystem (testify, go-cmp, httptest, fuzz tests, benchmarks). Your goal is to help engineers write idiomatic Go tests — table-driven, parallel-safe, deterministic — without fabricating package APIs or `go test` flags. When uncertain, point the reader to `pkg.go.dev/testing` and the relevant package docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Go version** — fuzz testing is generally available since 1.18; some recent additions (e.g., `testing/synctest`) are in newer versions.
- **Assertion style** — built-in `t.Errorf` / `t.Fatalf` is idiomatic; **testify** (`require` / `assert`) is widely used for cleaner assertions; **go-cmp** for deep-diff comparisons.
- **Module structure** — standard `pkg/`, `cmd/`, `internal/` Go layout.
- **HTTP testing** — `net/http/httptest` for in-process servers, `gock` / community libs for client-side mocking.
- **Concurrency** — `go test -race` is the single biggest leverage point; ensure it runs in CI.

If the file does not exist, ask: Go version, assertion style preference, packages under test (mostly libraries vs HTTP services), and CI race-detector status.

---

## Why Go's testing

- **Stdlib, zero-deps** — Go ships with everything needed for basic testing.
- **Fast** — Go's compile + test cycle is among the fastest in any language.
- **`-race` flag** — built-in data race detector, almost free, catches real bugs.
- **Subtests / table-driven** — idiomatic pattern for boundary coverage.
- **Fuzzing built in** — `go test -fuzz` for property-based coverage of byte / string inputs.
- **Benchmarks** — `testing.B` for micro-perf with go test integration.

When *not* to rely on stdlib alone:

- Need cleaner assertions / deep equality with diff → testify or go-cmp.
- Need HTTP mocking with rich matchers → community packages.
- Need behavior-driven syntax → Ginkgo (less common but real ecosystem).

---

## A test file

```go
// math_test.go
package mathx

import (
    "testing"
)

func TestAdd(t *testing.T) {
    got := Add(1, 2)
    want := 3
    if got != want {
        t.Errorf("Add(1, 2) = %d; want %d", got, want)
    }
}
```

Files named `*_test.go`, in the same package (white-box) or `package mathx_test` (black-box). Run with `go test ./...`.

`t.Errorf` records failure and continues; `t.Fatalf` records failure and aborts the test.

---

## Table-driven tests

The single most idiomatic Go testing pattern:

```go
func TestIsValidEmail(t *testing.T) {
    cases := []struct {
        name  string
        input string
        want  bool
    }{
        {"standard", "qa.user@example.com", true},
        {"missing at", "no-at", false},
        {"empty", "", false},
        {"double at", "double@@at.com", false},
    }

    for _, tc := range cases {
        tc := tc  // capture for parallel safety (Go 1.21 and earlier)
        t.Run(tc.name, func(t *testing.T) {
            t.Parallel()
            if got := IsValidEmail(tc.input); got != tc.want {
                t.Errorf("IsValidEmail(%q) = %v; want %v", tc.input, got, tc.want)
            }
        })
    }
}
```

`t.Run` creates a subtest with its own name visible in `go test -v` output. `t.Parallel()` makes the subtest run in parallel with siblings.

Note: **Go 1.22+** fixed the loop-variable scoping issue, so the `tc := tc` capture line is no longer needed. Keep the line for older Go versions; remove for 1.22+.

---

## Testify

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestUser(t *testing.T) {
    u, err := LoadUser("user-42")
    require.NoError(t, err)         // fails fast on err
    require.NotNil(t, u)
    assert.Equal(t, "user-42", u.ID)
    assert.Contains(t, u.Email, "@example.com")
}
```

`require.X` aborts on failure (like `t.Fatalf`); `assert.X` continues (like `t.Errorf`). Use `require` for preconditions where continuing makes no sense, `assert` for independent checks.

Testify's `mock` package and `suite` package exist; use them sparingly. Hand-rolled fakes are often clearer than testify mocks for simple cases.

---

## go-cmp for deep equality

`reflect.DeepEqual` works but gives no diff. Use `github.com/google/go-cmp/cmp`:

```go
import "github.com/google/go-cmp/cmp"

if diff := cmp.Diff(want, got); diff != "" {
    t.Errorf("Order mismatch (-want +got):\n%s", diff)
}
```

go-cmp supports custom comparers (`cmp.Comparer(...)`), ignore options (`cmpopts.IgnoreFields(...)`), and produces excellent diffs.

---

## HTTP testing

### Server side

```go
import "net/http/httptest"

func TestHandler(t *testing.T) {
    srv := httptest.NewServer(http.HandlerFunc(MyHandler))
    defer srv.Close()

    resp, err := http.Get(srv.URL + "/health")
    require.NoError(t, err)
    defer resp.Body.Close()
    require.Equal(t, 200, resp.StatusCode)
}
```

`httptest.NewServer` starts a real server on a random port; `httptest.NewRecorder` records responses for handler unit tests without a network. Pick based on whether you want to exercise the full HTTP stack.

### Client side

For testing code that *makes* HTTP calls, point it at an `httptest.NewServer` that returns canned responses. Avoid heavy client-mocking libraries unless you really need them.

---

## Test setup and cleanup

```go
func TestThing(t *testing.T) {
    t.TempDir()  // auto-cleaned at end of test
    f := setupFixture(t)
    t.Cleanup(func() { f.Close() })
    // ... use f
}
```

`t.Cleanup(...)` runs at test end, even on panic. Prefer over `defer` for setup helpers because it composes cleanly across helper functions.

For package-level setup, `TestMain(m *testing.M)`:

```go
func TestMain(m *testing.M) {
    setup()
    code := m.Run()
    teardown()
    os.Exit(code)
}
```

Use sparingly; package-level state often leaks between tests.

---

## Race detector

```bash
go test -race ./...
```

Runs every test with Go's race detector. Catches data races in concurrent code. **Run with `-race` in CI on every PR**. The runtime overhead (~2-10x slower) is worth it for the bugs it surfaces.

If the suite passes `-race` locally but fails in CI, suspect timing-dependent assertions (sleeps, channel timing, goroutine leaks). Use `goleak` to detect goroutine leaks.

---

## Benchmarks

```go
func BenchmarkAdd(b *testing.B) {
    for i := 0; i < b.N; i++ {
        _ = Add(1, 2)
    }
}
```

Run with `go test -bench=. -benchmem ./...`. Benchmarks are great for micro-perf comparisons; **don't treat them as production load tests** (that's the perf-tier skills' job).

For comparing two implementations, use `benchstat` to detect statistically significant differences.

---

## Fuzz tests

```go
func FuzzIsValidEmail(f *testing.F) {
    f.Add("qa.user@example.com")
    f.Fuzz(func(t *testing.T, input string) {
        _ = IsValidEmail(input)  // must not panic
    })
}
```

`go test -fuzz=FuzzIsValidEmail ./...` runs the fuzzer until a failure is found (or until `-fuzztime` elapses). Fuzz tests aim to find inputs that crash or panic — they're cheap to add for code that parses bytes/strings.

---

## Test data

```go
//go:embed testdata/users.json
var usersData []byte

func TestParse(t *testing.T) {
    got, err := Parse(usersData)
    require.NoError(t, err)
    // ... assert
}
```

`testdata/` is Go's convention for fixture files (excluded from `go build`). Use `embed` for compile-time inclusion or `os.ReadFile` for runtime. Keep fixtures small and synthetic.

---

## Running

| Command | Purpose |
|---------|---------|
| `go test ./...` | All tests, all packages. |
| `go test ./pkg/x -run TestAdd` | One test. |
| `go test -v ./...` | Verbose. |
| `go test -race ./...` | With race detector. |
| `go test -count=1 ./...` | Disable cache (forces re-run). |
| `go test -p 8 ./...` | Set per-package parallelism. |
| `go test -timeout 30s ./...` | Per-test timeout. |
| `go test -coverprofile=cover.out ./...` | Coverage. |
| `go tool cover -html=cover.out` | HTML coverage report. |
| `go test -bench=. -benchmem` | Run benchmarks. |
| `go test -fuzz=FuzzX -fuzztime=30s` | Run fuzz target for 30s. |
| `go test -json` | JSON output (great for CI integrations). |

---

## CI integration

```yaml
- run: go test -race -coverprofile=cover.out ./...
- run: go tool cover -func=cover.out
- if: always()
  uses: actions/upload-artifact@v4
  with: { name: coverage, path: cover.out }
```

Always run `-race` in CI. For richer reports, pipe `go test -json` to `gotestsum` or similar for prettier output and JUnit XML conversion.

---

## Common Pitfalls

- **Not running `-race` in CI** — data races slip into production.
- **`for _, tc := range cases { t.Run(... )` without `tc := tc` on Go 1.21 or earlier** — same loop variable shared across parallel subtests; all see the last value.
- **`sleep` for synchronization** — flake forever. Use channels, `sync.WaitGroup`, or polling with timeout.
- **Tests that share package-level state** — `var globalMap = map[...]X{}` mutated by tests = order dependence.
- **Asserting on entire struct equality via `==`** — fragile on additions. Use `cmp.Diff`.
- **`reflect.DeepEqual` without diff output** — frustrating failures. Use `cmp.Diff`.
- **Skipping `t.Cleanup` for resources** — leaks across tests, hard to debug.
- **Benchmarks that don't use `b.N`** — measuring nothing.
- **Goroutine leaks** — tests pass but leak workers. Use `goleak` to catch.
- **`go test` without `-count=1` after suspecting cache issues** — cache hides the re-run.

---

## Task-Specific Questions

When helping with Go testing, ask:

1. Go version?
2. Assertion preference — stdlib, testify, go-cmp?
3. Is `-race` in CI today?
4. What's the package structure — internal-heavy, lots of HTTP handlers, libraries?
5. Are fuzz / benchmark tests in use?
6. Test data strategy — `testdata/` files, in-test literals, generated?
7. CI output format — `gotestsum`, JUnit XML, JSON?

---

## Related Skills

- **jest-vitest** — JS/TS equivalent.
- **pytest** — Python equivalent.
- **junit-testng** — JVM equivalent.
- **xunit-nunit** — .NET equivalent.
- **grpc-testing** — Go is heavy in gRPC; pair with bufconn-based tests.
- **testcontainers** — `Testcontainers for Go` is the canonical infra-backed test setup.
- **mutation-testing** — `go-mutesting` exists but the ecosystem is smaller; consider PIT-equivalent maturity.
- **code-coverage** — `go test -coverprofile` + `go tool cover`.
- **flaky-test-management** — when goroutine timing causes intermittent failures.
- **ci-test-orchestration** — for sharding via `go test -p` plus matrix runs.
