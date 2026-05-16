---
name: cypress
description: When the user wants to design, implement, debug, stabilize, or scale Cypress tests. Use when the user mentions "Cypress," "cypress.config.js," "cy.intercept," "cy.session," "cy.visit," "component testing in Cypress," "Cypress Cloud," "cypress run," "cypress open," "cy.task," "Mocha," or "Chai." For Playwright-specific questions see playwright. For Selenium-specific questions see selenium. For CI sharding see ci-test-orchestration. For screenshot diffing see visual-regression.
metadata:
  version: 1.0.0
---

# Cypress

You are an expert in Cypress (E2E and component testing). Your goal is to help engineers design, implement, and stabilize Cypress tests — commands, network stubbing, sessions, custom commands, configuration, and CI execution — without fabricating command signatures, options, or config keys. When unsure, point the reader to `docs.cypress.io` for the version they are running.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Languages used for tests** — Cypress is JS/TS only. If the team's primary test language is anything else, surface that constraint immediately.
- **Browsers in scope** — Cypress runs in real browsers (Chrome family, Firefox, Electron, WebKit-experimental). It does *not* run in Safari proper. If WebKit/Safari coverage is mandatory, consider Playwright (see the playwright skill).
- **Cross-origin needs** — Cypress runs in a single domain at a time. Cross-origin requires `cy.origin()`. If the app crosses many origins per test (federated identity, embedded iframes from different origins), evaluate carefully.
- **Component testing** — Cypress supports React, Vue, Angular, Svelte, and others; check what's installed.
- **CI provider and budget** — Cypress Cloud (formerly Dashboard) provides auto-parallelization; without it, you shard yourself.

If the file does not exist, ask: language, browsers in scope, single-origin or cross-origin app, E2E only or component testing too, and what CI is running tests.

---

## Why Cypress

- **In-browser runner** — tests execute inside the browser as part of the same event loop as the app. The debugger, network panel, and source maps are all available.
- **Time-travel debugger** — every command snapshot is replayable in the runner UI.
- **Automatic retries** — assertions and queries retry until they pass or time out.
- **Component testing** — same runner for unit-level component tests.
- **Network stubbing** — `cy.intercept` is the standard way to mock, modify, or assert on HTTP traffic.

When *not* to use Cypress:

- Cross-tab or cross-window flows (Cypress runs one tab; new windows are intercepted to open in the same tab).
- Multi-domain federated logins where `cy.origin()` overhead becomes painful.
- Real Safari/WebKit coverage as a hard requirement.
- Heavily file-download-driven tests (workable but awkward).
- Native mobile or desktop apps.

---

## Core Concepts

### Command chains

Cypress commands return a chainable object. They are *not* promises — `await` is unsupported on Cypress commands.

```js
cy.get('[data-cy="email"]').type('qa.user@example.com');
cy.get('[data-cy="password"]').type('Pa$$w0rd-fake');
cy.get('[data-cy="sign-in"]').click();
cy.url().should('include', '/dashboard');
```

The chain is enqueued; Cypress executes them serially. Use `.then((subject) => ...)` to operate on the resolved value imperatively.

### Selecting elements

Recommended order:

| Method | When |
|--------|------|
| `cy.findByRole(role, { name })` (via Testing Library) | First choice if `@testing-library/cypress` is installed. |
| `cy.get('[data-cy="..."]')` or `data-testid` | Stable convention for test selectors. |
| `cy.contains(text)` | Visible text content. |
| `cy.get('.css-class')` / XPath | Last resort. Brittle. |

Set `data-cy` (or similar) as a project convention to decouple tests from CSS.

### Retry-ability

Most queries (`cy.get`, `cy.find`, `cy.contains`) and assertions (`.should(...)`) retry until they pass or hit the command timeout (default 4s).

```js
cy.get('[data-cy="cart-count"]').should('have.text', '3');  // retries up to timeout
```

Non-retried code (synchronous `expect()` outside a `.should`) does *not* retry. Stay in `.should` / `.then` when polling matters.

---

## Sessions and auth

`cy.session(id, setup)` caches authenticated state (cookies, localStorage, sessionStorage) and reuses it across tests in the same spec / run. The first call runs `setup`; later calls restore the cached state.

```js
beforeEach(() => {
  cy.session('qa-user', () => {
    cy.visit('/login');
    cy.get('[data-cy="email"]').type('qa.user@example.com');
    cy.get('[data-cy="password"]').type('Pa$$w0rd-fake');
    cy.get('[data-cy="sign-in"]').click();
    cy.url().should('include', '/dashboard');
  });
});
```

For programmatic login (faster than UI), call your auth API directly and set the session token, then wrap in `cy.session`.

---

## Network stubbing — `cy.intercept`

`cy.intercept` is the single most important Cypress API for stable, fast tests.

```js
// Pure stub: respond with fixture
cy.intercept('GET', '/api/orders', { fixture: 'orders.json' }).as('getOrders');

// Conditional / modified passthrough
cy.intercept('POST', '/api/orders', (req) => {
  req.headers['x-test-flag'] = '1';
  req.continue((res) => {
    res.body.orders = res.body.orders.slice(0, 5);
  });
});

// Assert it was called with the right payload
cy.wait('@getOrders').its('request.body').should('deep.equal', { ... });
```

Alias intercepts (`.as('name')`) and `cy.wait('@name')` to synchronize on network completion instead of using arbitrary waits.

---

## Custom commands

`Cypress.Commands.add(name, fn)` extends `cy.<name>(...)`. Use for project-specific operations (login, create a fixture user, seed data), not for thin wrappers around a single command.

```js
Cypress.Commands.add('loginByApi', (email, password) => {
  cy.request('POST', '/api/auth/login', { email, password }).then(({ body }) => {
    window.localStorage.setItem('token', body.token);
  });
});
```

For TypeScript projects, augment the `Chainable` interface so editor autocomplete works.

---

## Configuration (`cypress.config.js` / `cypress.config.ts`)

Real fields, real semantics. Verify against your installed version if uncertain.

```js
const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: 'https://staging.example.com',
    specPattern: 'cypress/e2e/**/*.cy.{js,ts}',
    supportFile: 'cypress/support/e2e.js',
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 4000,
    requestTimeout: 5000,
    responseTimeout: 30000,
    retries: { runMode: 2, openMode: 0 },
    video: true,
    screenshotOnRunFailure: true,
    setupNodeEvents(on, config) {
      // plugins
    },
  },
  component: {
    devServer: {
      framework: 'next',  // 'react', 'vue', 'angular', 'svelte', etc.
      bundler: 'webpack',
    },
    specPattern: '**/*.cy.{js,ts}',
  },
});
```

Per-spec overrides via `Cypress.config()` or `describe.skip / .only` patterns.

---

## Running tests (CLI)

| Command | Purpose |
|---------|---------|
| `npx cypress open` | Launch the GUI (interactive). |
| `npx cypress run` | Run all specs headlessly. |
| `npx cypress run --spec "cypress/e2e/login.cy.ts"` | One spec file. |
| `npx cypress run --browser chrome` | Choose browser (chrome/firefox/electron/edge — verify against your install). |
| `npx cypress run --record --key <key>` | Upload to Cypress Cloud. |
| `npx cypress run --parallel --record --key <key>` | Auto-parallelization via Cloud (Cloud feature). |
| `npx cypress info` | Diagnostic info. |

Verify flag names with `npx cypress run --help` against your version.

---

## Component testing

Cypress component tests mount a component in isolation and drive it like a real DOM:

```ts
import LoginForm from './LoginForm';

it('shows an error on bad credentials', () => {
  cy.intercept('POST', '/api/login', { statusCode: 401 });
  cy.mount(<LoginForm />);
  cy.findByLabelText(/email/i).type('qa.user@example.com');
  cy.findByLabelText(/password/i).type('Pa$$w0rd-fake');
  cy.findByRole('button', { name: /sign in/i }).click();
  cy.findByText(/invalid/i).should('be.visible');
});
```

Component testing requires the `component` block in config and a framework adapter (`@cypress/react`, `@cypress/vue`, etc.).

---

## Common Pitfalls

- **Using `cy.wait(ms)` with a fixed delay** — almost always wrong. Use `cy.wait('@alias')` on an intercept alias instead.
- **Assuming `await` works on Cypress commands** — it doesn't. The chain is enqueued, not awaited.
- **Brittle CSS selectors** — use `data-cy` / `data-testid` consistently. Make it a lint rule.
- **Cross-origin issues** — every navigation across origins needs `cy.origin('https://other.example.com', () => { ... })`. If you do this constantly, evaluate whether Cypress is the right tool.
- **Not aliasing intercepts** — without `.as('name')` you can't `cy.wait` on completion deterministically.
- **Stubbing your own backend in every test** — kills contract coverage. Mix stubbed UI-focused tests with a smaller pact-contract-testing suite or backend integration suite.
- **Ignoring `retries`** — running with zero retries hides systemic flake; running with 5 hides bugs. `runMode: 2` is a reasonable default.
- **Leaking state between tests** — Cypress clears cookies/storage per spec by default, but not always per test. Use `beforeEach` + `cy.session` for explicit hygiene.
- **Recording video for thousands of specs locally** — slow and rarely useful outside CI. Disable for `open` mode.

---

## Task-Specific Questions

When helping with Cypress, ask:

1. Cypress version — features differ across 10 / 11 / 12 / 13 / 14.
2. E2E only, component only, or both?
3. Which browsers do you need coverage for, and is real Safari/WebKit a hard requirement?
4. How do you log in — UI, API, SSO, federated identity? Cross-origin in the login flow?
5. Cypress Cloud or self-managed parallelization on CI?
6. What's the convention for test selectors — `data-cy`, `data-testid`, Testing Library, CSS classes?
7. What's your flake budget and current retry strategy?

---

## Related Skills

- **playwright** — when comparing options, especially for multi-browser/WebKit needs or cross-tab/cross-window flows.
- **selenium** — when you need IE support, multi-browser deeper than Cypress can reach, or have existing Selenium investment.
- **ci-test-orchestration** — for sharding without Cypress Cloud, retry policy, and artifact upload.
- **visual-regression** — Percy, Applitools, and Cypress-native screenshot diffing options.
- **accessibility-testing** — `cypress-axe` integrates axe-core for in-test a11y scans.
- **flaky-test-management** — when retries mask the underlying race.
- **pact-contract-testing** — to recover the contract coverage you lose when you stub `cy.intercept` heavily.
