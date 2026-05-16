---
name: jest-vitest
description: When the user wants to design, implement, debug, or optimize Jest or Vitest unit / integration tests in JavaScript or TypeScript. Use when the user mentions "Jest," "Vitest," "describe/it/test," "expect," "jest.mock," "vi.mock," "vi.fn," "snapshot," "spyOn," "fake timers," "module mocks," "jest.config," "vitest.config," "test coverage," or "@swc/jest." For Node API integration testing see supertest. For Cypress component tests see cypress. For pytest see pytest. For Java unit testing see junit-testng.
metadata:
  version: 1.0.0
---

# Jest & Vitest

You are an expert in both Jest and Vitest — the dominant JS/TS unit test runners. Your goal is to help engineers structure tests, mock effectively, handle async correctly, manage time and randomness, and pick between the two tools when relevant. Don't fabricate matcher names, mock APIs, or config keys. When uncertain, point the reader to `jestjs.io` or `vitest.dev`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Which runner?** — Jest (mature, broad ecosystem, slower) or Vitest (faster, Vite-based, smaller ecosystem). Vitest is largely API-compatible with Jest, so most patterns transfer.
- **Module system** — ESM vs CJS. Jest historically struggled with ESM; Vitest is ESM-native. Knowing the module setup avoids hours of debugging.
- **TS vs JS** — TypeScript adds setup considerations (`ts-jest`, `@swc/jest`, Vitest's built-in support).
- **Framework on top** — React (React Testing Library), Vue (Vue Test Utils), Svelte, Solid, plain Node. Test patterns are similar; rendering helpers differ.
- **Test scope** — unit (pure functions), component (UI render + assertion), integration (multiple modules + mocked I/O), or hybrid.

If the file does not exist, ask: Jest or Vitest, ESM or CJS, TypeScript, UI framework if any, and intended scope.

---

## Why one over the other

| Pick Jest when… | Pick Vitest when… |
|-----------------|-------------------|
| Existing Jest investment | Greenfield project on Vite |
| React Native (Jest is the default) | ESM-native code |
| Need every Jest plugin under the sun | Care about test runtime / DX |
| CI infrastructure already wired for Jest | Vue / Svelte / Solid project using Vite |
| Module-mocking patterns very deeply set | Want browser-mode tests via Vitest |

If you're starting fresh and not React-Native-bound, Vitest is the modern default for most Node/web projects. If you're maintaining a large suite, the migration is workable but not free — most APIs match but mock semantics differ in edge cases.

---

## Test anatomy

```ts
// math.test.ts — works in both Jest and Vitest (with the right import for Vitest)
// Jest: globals are auto-provided; Vitest: `import { describe, it, expect, vi } from 'vitest'` (or set globals: true)

describe('add', () => {
  it('adds two numbers', () => {
    expect(add(1, 2)).toBe(3);
  });

  it.each([
    [1, 1, 2],
    [0, 0, 0],
    [-1, 1, 0],
  ])('add(%i, %i) = %i', (a, b, expected) => {
    expect(add(a, b)).toBe(expected);
  });
});
```

| Block | Use |
|-------|-----|
| `describe` | Group related tests. |
| `it` / `test` | One test. (`it` and `test` are identical.) |
| `it.each` | Parametrized. |
| `beforeAll` / `afterAll` | Once per suite. |
| `beforeEach` / `afterEach` | Per test. |
| `it.skip` / `it.only` / `describe.skip` / `describe.only` | Skip / focus. |

---

## Matchers

Most-used `expect` matchers:

| Matcher | Use |
|---------|-----|
| `toBe(x)` | Strict equality (`===`). |
| `toEqual(x)` | Deep equality. |
| `toMatchObject(x)` | Partial deep equality (subset). |
| `toStrictEqual(x)` | Like `toEqual` but checks undefined props and types. |
| `toBeNull()` / `toBeUndefined()` / `toBeDefined()` | Specific values. |
| `toBeTruthy()` / `toBeFalsy()` | Coerced. |
| `toBeGreaterThan(n)` / `toBeLessThanOrEqual(n)` | Numeric. |
| `toContain(x)` / `toContainEqual(x)` | Array / string membership. |
| `toHaveLength(n)` | Array length. |
| `toHaveProperty(path, value?)` | Object property by path. |
| `toThrow(/regex/)` / `toThrowError(...)` | Function throws. |
| `toMatch(/regex/)` | String regex. |
| `toMatchSnapshot()` | Inline / external snapshot. |

`expect.any(Type)`, `expect.objectContaining({...})`, `expect.stringMatching(/x/)` produce asymmetric matchers usable inside `toEqual` / `toMatchObject`.

---

## Async tests

Three valid forms; pick one per test:

```ts
// async/await — recommended
it('resolves', async () => {
  await expect(fetchUser('user-42')).resolves.toMatchObject({ id: 'user-42' });
});

it('rejects', async () => {
  await expect(fetchUser('nope')).rejects.toThrow(/not found/);
});

// done callback — legacy, error-prone, avoid
```

Don't mix `done` callbacks with `async`. If a test calls `await` and never returns the awaited promise, the test "passes" silently when the assertion fails — always `return`/`await` promise-returning expressions.

---

## Mocking

### Function mocks

```ts
const greet = vi.fn(() => 'hi');   // Vitest
const greet = jest.fn(() => 'hi'); // Jest

greet('alice');
expect(greet).toHaveBeenCalledWith('alice');
expect(greet).toHaveBeenCalledTimes(1);

greet.mockReturnValueOnce('once');
greet.mockResolvedValueOnce({ id: 'user-42' });
greet.mockImplementation((name) => `hi ${name}`);
greet.mockRestore();  // for spies created via spyOn
```

### Module mocks

```ts
// Vitest
vi.mock('./api', () => ({
  fetchUser: vi.fn().mockResolvedValue({ id: 'user-42' }),
}));

// Jest
jest.mock('./api', () => ({
  fetchUser: jest.fn().mockResolvedValue({ id: 'user-42' }),
}));
```

Module mocks are **hoisted** to the top of the file before imports — calling them inline mid-test does not work. For partial mocks:

```ts
vi.mock('./api', async () => {
  const actual = await vi.importActual<typeof import('./api')>('./api');
  return { ...actual, fetchUser: vi.fn() };
});
```

### Spies

```ts
const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
// call code under test
expect(spy).toHaveBeenCalledWith('expected message');
spy.mockRestore();
```

Spies wrap an existing implementation, keep call records, and restore on `mockRestore()`. Prefer spies over `vi.fn()` when you want default behavior preserved.

---

## Fake timers

```ts
beforeEach(() => { vi.useFakeTimers(); });        // Jest: jest.useFakeTimers()
afterEach(() => { vi.useRealTimers(); });

it('debounces', () => {
  const cb = vi.fn();
  const debounced = debounce(cb, 200);
  debounced();
  vi.advanceTimersByTime(199);
  expect(cb).not.toHaveBeenCalled();
  vi.advanceTimersByTime(1);
  expect(cb).toHaveBeenCalledTimes(1);
});
```

Don't `setTimeout(() => done(), 200)` to test debouncing. Fake timers make these tests deterministic and fast.

---

## Snapshot tests

```ts
expect(renderToString(<Profile name="Jane" />)).toMatchSnapshot();
expect(parse('a + b')).toMatchInlineSnapshot(`Object {...}`);
```

Snapshots are great for stable serialized output (parser ASTs, generated code) and bad for anything that changes on every commit (timestamps, random IDs). Review snapshot diffs in code review like regular code — a passing-because-updated snapshot defeats the point.

Use sparingly. A snapshot that's longer than 30 lines or full of dynamic content is usually the wrong tool.

---

## Coverage

```bash
# Vitest
vitest run --coverage

# Jest
jest --coverage
```

Coverage tools (V8 for Vitest by default, Istanbul for Jest) report line / branch / function / statement coverage. **Don't gate on coverage percentage** as if it's quality — high coverage with weak assertions is worse than low coverage with strong ones. Use coverage for *gap-finding*, not pass/fail.

Cross-reference the code-coverage skill for deeper context.

---

## Configuration

### Vitest (`vitest.config.ts`)

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,                     // skip the imports for describe/it/expect
    environment: 'jsdom',              // or 'node' / 'happy-dom' / 'edge-runtime'
    setupFiles: ['./test/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html', 'lcov'] },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
```

### Jest (`jest.config.ts`)

```ts
export default {
  preset: 'ts-jest',                   // or '@swc/jest' transform
  testEnvironment: 'node',             // or 'jsdom'
  setupFilesAfterEach: ['<rootDir>/test/setup.ts'],
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.{ts,tsx}'],
};
```

Pin major versions of `jest`, `vitest`, `@types/jest`, `ts-jest`, `@vitest/ui` — minor releases occasionally break edge mocks.

---

## Running

| Command | Purpose |
|---------|---------|
| `vitest run` / `jest` | One-shot run, no watch. |
| `vitest` | Watch mode (default for `vitest` without `run`). |
| `vitest related <files>` | Tests related to changed files. |
| `jest --testPathPattern login` / `vitest -t login` | Filter by name / path. |
| `--coverage` | Coverage report. |
| `--reporter=junit --outputFile=results.xml` | JUnit XML for CI. |
| `--shard=1/4` | Split across CI workers (Vitest 1.x+, Jest via `--shard`). |
| `--changedSince=main` | Only tests for changes vs branch. |

Verify flags with `--help` on your installed version.

---

## Common Pitfalls

- **Mixing Jest and Vitest semantics in the same project** — the small API differences (`jest.fn` vs `vi.fn`, hoisting subtleties) trip people up.
- **Forgetting that `vi.mock` / `jest.mock` are hoisted** — calling them mid-test or after an import does nothing. Module mocks must be top-of-file (or inside `vi.hoisted`).
- **`expect(x).resolves.toBe(...)` without `await`** — silently passes. Always `await expect(...).resolves.X`.
- **Sharing mutable state across tests** — module singletons, in-memory caches, env vars. Reset in `beforeEach`.
- **Snapshot tests on dynamic data** — every commit updates the snapshot. Strip dynamic fields or replace with matchers.
- **`describe` blocks deeply nested** — three levels is a smell. Refactor to colocate setup with the test.
- **Coverage as a quality gate** — high coverage doesn't mean tests catch bugs. Combine with mutation testing for real signal (cross-reference mutation-testing).
- **Long-running `beforeAll` that creates state for many tests** — if any test mutates, others break. Use `beforeEach` for mutable setup.
- **Component tests that test framework internals** — assert on rendered output / behavior, not React internals.

---

## Task-Specific Questions

When helping with Jest / Vitest, ask:

1. Jest or Vitest? (Plus version.)
2. ESM or CJS?
3. JavaScript or TypeScript?
4. UI framework if any (React, Vue, Svelte, Solid, none)?
5. Test scope — pure units, components, integration?
6. Existing mocks pattern — module mocks, dependency injection, hand-rolled?
7. CI reporter requirements — JUnit XML, JSON, HTML, Allure?
8. Coverage strategy — gap-finding only, or hard threshold gate?

---

## Related Skills

- **pytest** — Python equivalent for many of the same patterns.
- **junit-testng** — JVM equivalent.
- **xunit-nunit** — .NET equivalent.
- **supertest** — Node API integration testing built on Jest/Vitest.
- **cypress** — for component testing in a real browser.
- **playwright** — Playwright has its own test runner; some teams pair Vitest for units + Playwright for E2E.
- **code-coverage** — for deeper coverage strategy.
- **mutation-testing** — for measuring test quality beyond coverage.
- **flaky-test-management** — when async tests intermittently fail.
- **ci-test-orchestration** — for sharding and parallelism.
