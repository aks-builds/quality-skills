# Quality Skills for AI Agents

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Validate Skill](https://github.com/aks-builds/quality-skills/actions/workflows/validate-skill.yml/badge.svg)](https://github.com/aks-builds/quality-skills/actions/workflows/validate-skill.yml)
[![Sync Skills](https://github.com/aks-builds/quality-skills/actions/workflows/sync-skills.yml/badge.svg)](https://github.com/aks-builds/quality-skills/actions/workflows/sync-skills.yml)
[![Agent Skills spec](https://img.shields.io/badge/spec-agentskills.io-blue)](https://agentskills.io/specification.md)
[![Skills: 56](https://img.shields.io/badge/skills-56-brightgreen)](#available-skills)

A collection of AI agent skills focused on test automation and quality engineering. Built for QA engineers, SDETs, test automation leads, and developers who want AI coding agents to help with frontend automation, API testing, performance testing, mobile automation, BDD, accessibility, visual regression, security testing, contract testing, CI orchestration, and quality strategy. Works with Claude Code, OpenAI Codex, Cursor, Windsurf, and any agent that supports the [Agent Skills spec](https://agentskills.io).

> **Important**: These skills are tools for *test automation engineering*. They help you build reliable test suites and quality processes — they are not a replacement for hands-on testing skill, judgement, or domain knowledge of the system under test. See [AGENTS.md](AGENTS.md) for the accuracy contract.

## What are Skills?

Skills are markdown files that give AI agents specialized knowledge and workflows for specific tasks. When you add these to your project, your agent can recognize when you're working on a test automation task and apply the right tooling, idioms, and quality practices.

## How Skills Work Together

Skills reference each other and build on shared context. The `qa-context` skill is the foundation — every other skill checks it first to understand your stack, languages, target browsers/devices/APIs, CI provider, environments, and quality bar before doing anything.

```
                              ┌──────────────────────────────────────┐
                              │             qa-context               │
                              │    (read by all other skills first)  │
                              └──────────────────┬───────────────────┘
                                                 │
   ┌──────────────┬───────────────┬──────────────┼──────────────┬───────────────┬──────────────┐
   ▼              ▼               ▼              ▼              ▼               ▼              ▼
┌──────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ Strategy │ │ Frontend   │ │   API      │ │Performance │ │  Mobile    │ │ Acc &      │ │  CI &      │
│          │ │            │ │            │ │            │ │            │ │ Visual     │ │ Infra      │
├──────────┤ ├────────────┤ ├────────────┤ ├────────────┤ ├────────────┤ ├────────────┤ ├────────────┤
│test-strat│ │selenium    │ │postman-new │ │k6          │ │appium      │ │a11y-test   │ │ci-test-orc │
│test-data │ │cypress     │ │rest-assure │ │jmeter      │ │espresso    │ │visual-regr │ │selenium-grd│
│flaky-tst │ │playwright  │ │supertest   │ │gatling     │ │xcuitest    │ │            │ │cloud-grids │
│test-env  │ │webdriverio │ │pytest-api  │ │locust      │ │detox       │ │            │ │testcontnrs │
│test-desig│ │puppeteer   │ │karate      │ │artillery   │ │maestro     │ │            │ │test-report │
│          │ │testcafe    │ │pact-ct     │ │            │ │            │ │            │ │            │
│          │ │            │ │wiremock    │ │            │ │            │ │            │ │            │
│          │ │            │ │graphql-tst │ │            │ │            │ │            │ │            │
│          │ │            │ │grpc-tst    │ │            │ │            │ │            │ │            │
└────┬─────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
     │             │              │              │              │              │              │
     └─────────────┴──────┬───────┴──────────────┴──────────────┴──────────────┴──────────────┘
                          │
       BDD, unit testing, security/resilience, and specialized skills cross-reference broadly:
         cucumber-gherkin ↔ playwright ↔ cypress ↔ pytest
         security-testing ↔ chaos-engineering ↔ mutation-testing
         ai-augmented-testing ↔ llm-eval-testing ↔ feature-flag-testing
```

See each skill's **Related Skills** section for the full dependency map.

## Available Skills

<!-- SKILLS:START -->
| Skill | Description |
|-------|-------------|
| [qa-context](skills/qa-context/) | Create or update their QA context document, or whenever any other quality skill needs to understand the organization's stack… |
| [accessibility-testing](skills/accessibility-testing/) | Design, implement, or operate accessibility (a11y) testing — automated scans, manual audits, screen-reader testing, WCAG… |
| [ai-augmented-testing](skills/ai-augmented-testing/) | Evaluate, adopt, or operate AI-augmented testing tools and approaches — autonomous test generation, self-healing locators… |
| [appium](skills/appium/) | Design, implement, debug, or scale Appium tests for iOS and Android mobile automation. |
| [artillery](skills/artillery/) | Design, implement, debug, or operate Artillery load tests. |
| [bdd-anti-patterns](skills/bdd-anti-patterns/) | Audit, refactor, or rescue a Cucumber / Gherkin / SpecFlow / Reqnroll / behave BDD suite from common failure modes. |
| [behave](skills/behave/) | Design, implement, debug, or operate BDD tests on Python using behave. |
| [chaos-engineering](skills/chaos-engineering/) | Design, run, or operate chaos experiments to validate system resilience. |
| [ci-test-orchestration](skills/ci-test-orchestration/) | Design, audit, or optimize how tests run in CI — sharding, matrix builds, parallelism, retry policy, test selection, artifact… |
| [cloud-test-grids](skills/cloud-test-grids/) | Design, integrate, or operate against a cloud-hosted browser / device test grid — BrowserStack, Sauce Labs, LambdaTest, AWS… |
| [code-coverage](skills/code-coverage/) | Measure, interpret, or improve code coverage — line, branch, function, statement, condition, MC/DC coverage. |
| [cucumber-gherkin](skills/cucumber-gherkin/) | Design, implement, debug, or evolve BDD scenarios using Cucumber and the Gherkin syntax across any language (Java, JS, Ruby, JVM… |
| [cypress](skills/cypress/) | Design, implement, debug, stabilize, or scale Cypress tests. |
| [detox](skills/detox/) | Design, implement, debug, or stabilize Detox tests for React Native E2E testing. |
| [espresso](skills/espresso/) | Design, implement, debug, or stabilize Espresso tests for native Android UI automation. |
| [feature-flag-testing](skills/feature-flag-testing/) | Test code controlled by feature flags — variation coverage, flag combinations, canary / progressive rollout, A/B test… |
| [flaky-test-management](skills/flaky-test-management/) | Detect, triage, root-cause, quarantine, or eliminate flaky tests. |
| [gatling](skills/gatling/) | Design, implement, debug, or operate Gatling load tests. |
| [go-test](skills/go-test/) | Design, implement, debug, or optimize Go tests using the standard testing package, testify, and related Go ecosystem libraries. |
| [graphql-testing](skills/graphql-testing/) | Design, implement, debug, or evolve tests for GraphQL APIs — queries, mutations, subscriptions, schema, resolvers, and clients. |
| [grpc-testing](skills/grpc-testing/) | Design, implement, debug, or load-test gRPC services. |
| [jest-vitest](skills/jest-vitest/) | Design, implement, debug, or optimize Jest or Vitest unit / integration tests in JavaScript or TypeScript. |
| [jmeter](skills/jmeter/) | Design, implement, debug, or operate Apache JMeter load tests. |
| [junit-testng](skills/junit-testng/) | Design, implement, debug, or optimize JUnit 5 (Jupiter) or TestNG tests on the JVM. |
| [k6](skills/k6/) | Design, implement, debug, or operate k6 load tests. |
| [karate](skills/karate/) | Design, implement, debug, or scale Karate tests for API testing (and optionally UI/mocking/perf). |
| [llm-eval-testing](skills/llm-eval-testing/) | Design, build, or operate evaluations (evals) for LLM-powered products — chatbots, RAG systems, agents, classification… |
| [locust](skills/locust/) | Design, implement, debug, or operate Locust load tests in Python. |
| [maestro](skills/maestro/) | Design, implement, debug, or operate Maestro mobile UI flows. |
| [mutation-testing](skills/mutation-testing/) | Measure or improve the *quality* of their existing test suite via mutation testing. |
| [pact-contract-testing](skills/pact-contract-testing/) | Design, implement, or operate consumer-driven contract testing with Pact. |
| [playwright](skills/playwright/) | Design, implement, debug, stabilize, or scale Playwright tests. |
| [postman-newman](skills/postman-newman/) | Design, organize, or run Postman collections — locally, in CI via Newman, or shared across a team. |
| [production-testing](skills/production-testing/) | Design or operate production-side testing — synthetic monitoring, canary analysis, real user monitoring, error-budget-driven… |
| [puppeteer](skills/puppeteer/) | Design, implement, debug, or scale Puppeteer scripts for browser automation, scraping, PDF generation, or screenshot capture. |
| [pytest](skills/pytest/) | Design, implement, debug, or optimize pytest tests in Python. |
| [pytest-api](skills/pytest-api/) | Design, implement, debug, or scale Python API tests using pytest + requests/httpx. |
| [rest-assured](skills/rest-assured/) | Design, implement, debug, or scale REST Assured tests for Java/JVM API testing. |
| [rspec](skills/rspec/) | Design, implement, debug, or optimize RSpec tests in Ruby. |
| [security-testing](skills/security-testing/) | Design, integrate, or operate security testing in their pipeline — SAST, DAST, dependency scanning, secret scanning, container… |
| [selenium](skills/selenium/) | Design, implement, debug, or migrate Selenium WebDriver tests. |
| [selenium-grid](skills/selenium-grid/) | Design, deploy, scale, or troubleshoot a self-hosted Selenium Grid 4 cluster — hub, nodes, distributors, sessions, K8s… |
| [specflow-reqnroll](skills/specflow-reqnroll/) | Design, implement, debug, or migrate BDD tests on .NET using SpecFlow or its open-source successor Reqnroll. |
| [supertest](skills/supertest/) | Design, implement, debug, or scale supertest-based API tests in Node.js. |
| [test-data-management](skills/test-data-management/) | Design or audit how test data is generated, managed, masked, and reset between tests. |
| [test-design-techniques](skills/test-design-techniques/) | Design test cases systematically — boundary value analysis, equivalence partitioning, pairwise / combinatorial, state-transition… |
| [test-environment-management](skills/test-environment-management/) | Design or audit where tests run — local dev, CI runners, ephemeral preview environments, shared staging, prod-shadow, or… |
| [test-reporting](skills/test-reporting/) | Design, integrate, or improve test reporting — JUnit XML aggregation, HTML dashboards, Allure, Cucumber Reports, screenshots /… |
| [test-strategy](skills/test-strategy/) | Design, audit, or evolve a test strategy — the shape of their test pyramid, the balance of unit / integration / E2E / contract /… |
| [testcafe](skills/testcafe/) | Design, implement, debug, or migrate TestCafe tests. |
| [testcontainers](skills/testcontainers/) | Use Docker-backed real infrastructure (Postgres, Kafka, Redis, Mongo, S3, etc.) inside tests via the Testcontainers libraries. |
| [visual-regression](skills/visual-regression/) | Design, integrate, or operate visual regression testing — pixel diffs, DOM snapshots, AI-powered visual diffs, baseline… |
| [webdriverio](skills/webdriverio/) | Design, implement, debug, or scale WebdriverIO tests. |
| [wiremock](skills/wiremock/) | Virtualize HTTP services for testing — mocking downstream dependencies, simulating slow/error responses, recording-and-replay, or… |
| [xcuitest](skills/xcuitest/) | Design, implement, debug, or stabilize XCUITest tests for native iOS UI automation. |
| [xunit-nunit](skills/xunit-nunit/) | Design, implement, debug, or optimize unit / integration tests in .NET using xUnit, NUnit, or MSTest. |
<!-- SKILLS:END -->

## Installation

### Option 1: Claude Code Plugin

```bash
/plugin marketplace add aks-builds/quality-skills
/plugin install quality-skills
```

### Option 2: Clone and Copy

```bash
git clone https://github.com/aks-builds/quality-skills.git
cp -r quality-skills/skills/* .agents/skills/
```

### Option 3: Git Submodule

```bash
git submodule add https://github.com/aks-builds/quality-skills.git .agents/quality-skills
```

Then reference skills from `.agents/quality-skills/skills/`.

> Path varies by agent — Claude Code reads `.claude/skills/`, the agentskills.io standard is `.agents/skills/`. Check your agent's documentation.

## Usage

Once installed, just ask your agent to help with test automation tasks:

```
"Set up Playwright for our Next.js app with parallel execution and tracing"
→ Uses playwright, ci-test-orchestration

"Why are these Cypress tests flaky?"
→ Uses cypress, flaky-test-management

"Build a k6 load test for our checkout API with a 200 RPS target"
→ Uses k6, qa-context

"Add Pact consumer-driven contract testing between our web app and orders API"
→ Uses pact-contract-testing, rest-assured

"Write a Cucumber feature for the password reset flow"
→ Uses cucumber-gherkin, bdd-anti-patterns
```

You can also invoke skills directly:

```
/playwright
/k6
/accessibility-testing
```

## Skill Categories

### Foundation
- `qa-context` — Stack, languages, CI provider, environments, quality bar — every other skill reads this first

### Strategy & Fundamentals
- `test-strategy` — Pyramid/trophy, shift-left vs. shift-right, risk-based testing
- `test-design-techniques` — Boundary, equivalence, pairwise, state-transition
- `test-data-management` — Synthetic data, fixtures, factories
- `flaky-test-management` — Detection, quarantine, root cause
- `test-environment-management` — Preview envs, ephemeral environments

### Frontend / Browser Automation
- `selenium` — WebDriver, Grid, BiDi
- `cypress` — Runner, commands, network stubbing, component testing
- `playwright` — Multi-browser, fixtures, traces, codegen
- `webdriverio` — Config, services, mobile + web
- `puppeteer` — When to use vs. Playwright
- `testcafe` — Proxy-based, no WebDriver

### Mobile Automation
- `appium` — iOS + Android, capabilities, drivers
- `espresso` — Android native
- `xcuitest` — iOS native
- `detox` — React Native
- `maestro` — Modern cross-platform

### API / Backend Automation
- `postman-newman` — Collections, environments, CI
- `rest-assured` — Java fluent API
- `supertest` — Node, Express/Koa
- `pytest-api` — Python requests + pytest
- `karate` — DSL, parallel execution
- `pact-contract-testing` — Consumer-driven contracts
- `wiremock` — Service virtualization
- `graphql-testing` — Query/mutation testing
- `grpc-testing` — Protobuf, reflection

### Performance & Load
- `k6` — JS scripting, thresholds
- `jmeter` — GUI + CLI, distributed
- `gatling` — Scala/Java DSL
- `locust` — Python user classes
- `artillery` — YAML scenarios

### BDD & Specification
- `cucumber-gherkin` — `.feature` files, step definitions
- `specflow-reqnroll` — .NET BDD
- `behave` — Python BDD
- `bdd-anti-patterns` — What not to do

### Unit Testing
- `jest-vitest` — JS/TS
- `pytest` — Python
- `junit-testng` — Java
- `xunit-nunit` — .NET
- `go-test` — Go + testify
- `rspec` — Ruby

### Accessibility & Visual
- `accessibility-testing` — axe-core, pa11y, Lighthouse
- `visual-regression` — Percy, Chromatic, Applitools, Playwright snapshots

### Security & Resilience
- `security-testing` — OWASP ZAP, Burp, dependency scanning
- `chaos-engineering` — Failure injection
- `mutation-testing` — Stryker, PIT, mutmut

### CI & Infrastructure
- `ci-test-orchestration` — Sharding, parallelization, retry policy
- `selenium-grid` — Hub/node, k8s
- `cloud-test-grids` — BrowserStack, Sauce Labs, LambdaTest
- `testcontainers` — Docker-backed integration tests
- `test-reporting` — JUnit XML, Allure, dashboards

### Specialized / Emerging
- `code-coverage` — istanbul, JaCoCo, coverage.py
- `ai-augmented-testing` — Testim, Mabl, AI codegen
- `llm-eval-testing` — Evals for AI products
- `feature-flag-testing` — LD/Split/Unleash, canary, A/B
- `production-testing` — Synthetic monitoring, observability-driven testing

## Contributing

PRs and issues welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) — note the elevated bar for accuracy in tool-specific content (CLI flags, API signatures, config keys must be verified).

## License

[MIT](LICENSE) — Use these however you want, but verify before relying on them in production CI pipelines.
