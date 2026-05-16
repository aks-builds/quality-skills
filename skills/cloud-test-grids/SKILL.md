---
name: cloud-test-grids
description: When the user wants to design, integrate, or operate against a cloud-hosted browser / device test grid — BrowserStack, Sauce Labs, LambdaTest, AWS Device Farm, Firebase Test Lab, Perfecto, Kobiton. Use when the user mentions "BrowserStack," "Sauce Labs," "Sauce," "LambdaTest," "AWS Device Farm," "Firebase Test Lab," "cloud grid," "cloud-hosted devices," "real-device cloud," or "bstack:options / sauce:options / lt:options." For self-hosted grids see selenium-grid. For specific test tools see playwright / cypress / selenium / appium.
metadata:
  version: 1.0.0
---

# Cloud Test Grids

You are an expert in managed cloud-hosted browser and device test farms — BrowserStack, Sauce Labs, LambdaTest, AWS Device Farm, Firebase Test Lab, Perfecto, Kobiton, and friends. Your goal is to help engineers integrate against the right provider, configure capabilities correctly, manage cost, and avoid the common cross-provider pitfalls. Don't fabricate provider features, capability names, or pricing. When uncertain, point the reader to the provider's docs.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **What are you testing?** — Web (browsers), mobile (real or virtual), or both. Different providers excel at different things.
- **Real device vs emulator/simulator** — affects cost dramatically.
- **Compliance** — some providers offer FedRAMP / HIPAA / dedicated environments; data residency matters for some orgs.
- **Existing tool** — Selenium / Playwright / Cypress / Appium / WebDriverIO. Some providers integrate more tightly with specific tools.
- **Scale** — minutes per month, concurrent sessions.

If the file does not exist, ask: web / mobile / both, real / virtual devices, compliance scope, primary test tool, scale.

---

## When cloud grids are worth it

- **You need 50+ browser × OS combinations.** Self-host is operationally impractical.
- **You need real mobile devices** — iOS especially. AWS Device Farm, Firebase Test Lab, BrowserStack, Sauce all offer real device pools.
- **You don't want to operate browser/device infrastructure.** Opex on Grid + iOS Mac builders is significant.
- **You need geographic distribution** — some providers offer test locations in EU / APAC / etc.
- **Low-to-medium volume** — usually cheaper net-of-opex than self-host.

When self-host wins: see selenium-grid for the inverse case.

---

## Major providers

| Provider | Strengths | Notes |
|----------|-----------|-------|
| **BrowserStack** | Broad browser + device coverage, mature, App Live (manual), Automate (programmatic) | Industry default; expensive at scale |
| **Sauce Labs** | Mature, strong CI integrations, Sauce Connect tunneling | Long-running player; mature analytics |
| **LambdaTest** | Wider catalog, often more affordable, AI-test features | Newer entrant; aggressive expansion |
| **AWS Device Farm** | Real-device cloud, native AWS integration, IAM-driven | Mobile-focused; less ergonomic for web |
| **Firebase Test Lab** | Real Android devices + iOS via integration, Google's runtime | Android-strong; iOS coverage smaller |
| **Perfecto** | Enterprise mobile, regulated industries | Heavyweight |
| **Kobiton** | Real-device mobile, manual + automation | |
| **Headspin** | Real-device + perf instrumentation | Specialized for perf testing on mobile |
| **TestGrid** | Open-source-style cloud option | Emerging |

For most teams the choice narrows to BrowserStack vs Sauce Labs vs LambdaTest (web + mobile), with AWS Device Farm / Firebase Test Lab as Android-specific options.

---

## Capability namespacing

Each provider adds vendor-specific options to W3C capabilities under their namespace:

```js
// BrowserStack
{
  browserName: 'chrome',
  'bstack:options': {
    os: 'Windows',
    osVersion: '11',
    sessionName: 'Login smoke',
    buildName: 'CI #1234',
    projectName: 'Web',
    seleniumVersion: '4.15.0',
  },
}

// Sauce Labs
{
  browserName: 'chrome',
  'sauce:options': {
    name: 'Login smoke',
    build: 'CI #1234',
    seleniumVersion: '4.15.0',
    timeZone: 'US/Pacific',
  },
}

// LambdaTest
{
  browserName: 'chrome',
  'LT:Options': {
    platform: 'Windows 11',
    build: 'CI #1234',
    name: 'Login smoke',
    selenium_version: '4.15.0',
  },
}
```

**Verify exact field names against the provider's current docs** — they evolve. Endpoints and authentication mechanics also differ; the test client connects to `hub.<vendor>.com/wd/hub` (or equivalent) with user/access-key auth.

---

## Tunneling for internal apps

Cloud grids run outside your network. If the app under test is behind a VPN / internal load balancer, the grid can't reach it without a tunnel.

| Provider | Tunnel |
|----------|--------|
| BrowserStack | BrowserStack Local |
| Sauce Labs | Sauce Connect Proxy |
| LambdaTest | LambdaTest Tunnel |
| AWS Device Farm | VPC integration |

Tunnel = a binary you run inside your network that the cloud grid uses as a path back to your app. Critical for testing staging environments that aren't public.

---

## Configuring tests

### Playwright

Playwright's cloud-grid story varies by provider. Some (BrowserStack, LambdaTest) offer dedicated Playwright endpoints; others require running Playwright in headed mode against their generic grid. Check current provider support — Playwright + cloud grids is a faster-moving area than Selenium + cloud grids.

### Cypress

Cypress is more constrained — its in-browser runtime makes traditional cloud-grid integration awkward. Cypress Cloud (their own offering) is the primary path for parallel + recorded runs. Some third parties offer Cypress on their infrastructure; verify maturity.

### Selenium / WebDriverIO

The most mature cloud-grid integration. Standard `RemoteWebDriver` pointing at the provider's hub URL with provider-specific capabilities.

### Appium

Same WebDriver model — `RemoteWebDriver` against the provider's mobile cloud endpoint with `appium:` capabilities plus provider-specific options.

---

## Cost discipline

Cloud grids charge per minute or per parallel session. Costs creep:

| Lever | Effect |
|-------|--------|
| Right-size session count | Don't pay for 50 parallel when you use 10. |
| Time out aggressively | A hung session = wasted minutes. Set client-side and provider-side timeouts. |
| Cancel-on-new-push in CI | Don't run obsolete commits. |
| Tunnel reuse | Each tunnel session has startup cost; reuse where possible. |
| Headless when possible | Some providers charge differently for headed vs headless. |
| Test selection on PR | Don't run full E2E on every PR. |
| Avoid real-device when emulator suffices | Real devices cost 5-10x more on average. |
| Schedule heavy runs off-peak | Some providers offer credits for batch runs. |

Track spend monthly. CI engineering teams routinely save 30-50% by auditing usage.

---

## Real device vs virtual

| Aspect | Real device | Emulator / simulator |
|--------|-------------|----------------------|
| Cost | High | Low |
| Realism | Highest — actual chipset, GPU, sensors | Approximate |
| Push notifications | Real | Partial |
| Biometric / camera / NFC | Real | Mocked or unavailable |
| Performance numbers | Accurate | Misleading |
| Parallel capacity | Limited by physical inventory | Effectively unlimited |
| Speed | Slower | Faster |

Use real devices for the layers that matter (golden-path UX validation, payments / biometric flows, production-shape perf). Use emulators / simulators for the bulk of regression.

---

## Session lifecycle

A cloud-grid session typically:

1. Client requests a new session with capabilities.
2. Grid allocates a node matching capabilities (browser × OS × version × locale).
3. Client receives session ID, drives the browser via WebDriver protocol.
4. Session ends on `driver.quit()` or timeout.

Each session is independent — no implicit state between sessions. For shared state (auth), use storage-state restoration patterns at the test framework level (cross-reference playwright / selenium).

---

## Observability

Providers offer dashboards with:

- Session video / screenshots.
- Network log / HAR.
- Console log.
- Device / OS information.
- Timing breakdown.

Wire your CI run identifier into the session name / build name so failures are traceable from CI to provider dashboard. E.g., `buildName: ${CI_BUILD_ID}`, `sessionName: ${TEST_NAME}`.

For longer-term analysis, push session metadata into your own analytics pipeline.

---

## Common Pitfalls

- **Hardcoded credentials in the test repo** — provider username/access key must come from CI secrets. Never commit.
- **Not naming sessions** — every failure is a needle-in-haystack search in the provider dashboard.
- **Skipping the tunnel for internal apps** — tests fail with DNS errors that look mysterious.
- **Selecting too many OS × browser combinations** — costs explode, signal is mostly redundant.
- **Real devices for cases where emulators would do** — 5-10x cost premium for marginal additional coverage.
- **No timeout discipline** — hung sessions waste budget.
- **Vendor-specific capability lock-in in test code** — abstract capabilities behind a config function for easy provider switching.
- **Not using provider's CI integration** — most have GitHub Actions / GitLab / Jenkins plugins that handle build/session linking.
- **Mixing dev and prod runs in the same project** — confuses dashboards and analytics.
- **Ignoring provider rate limits** — quietly throttled sessions show up as flake.
- **Self-hosted tunnel binaries getting stale** — pin and update.

---

## Choosing a provider

Most teams converge on one of:

- **BrowserStack** if breadth + ergonomics matter and budget allows.
- **Sauce Labs** if mature analytics + CI integration matter; many large enterprises here.
- **LambdaTest** if cost matters more than ecosystem maturity.
- **AWS Device Farm / Firebase Test Lab** for mobile-heavy teams already deep in those clouds.

Run a 30-day pilot with two providers on the same test suite; compare reliability, speed, cost, support quality.

---

## Task-Specific Questions

When helping with cloud test grids, ask:

1. Web, mobile, or both?
2. Real devices, virtual, or both?
3. Compliance / data-residency constraints?
4. Existing provider, or evaluating?
5. Primary test tool — Selenium / Playwright / Cypress / Appium / WDIO?
6. Internal app requiring tunnel?
7. Approximate monthly spend budget?

---

## Related Skills

- **selenium-grid** — for the self-hosted alternative.
- **selenium** / **playwright** / **cypress** / **webdriverio** — for the test-author side.
- **appium** — for mobile-on-cloud-grid.
- **ci-test-orchestration** — for wiring CI to the grid.
- **test-environment-management** — cloud grids are an environment-tier concern.
- **flaky-test-management** — grid issues are a flake source.
- **production-testing** — production synthetic monitoring sometimes overlaps cloud-grid usage.
