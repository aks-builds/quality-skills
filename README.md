<div align="center">

# 🔬 quality-skills

**Give your AI agent the QA instincts of a senior SDET.**

106 production-grade skills covering the complete quality engineering ecosystem —
frontend automation, API testing, performance, mobile, BDD, accessibility, security,
chaos engineering, contract testing, CI orchestration, and quality strategy.
Works with Claude Code, Claude Desktop, Cursor, Zed, Windsurf, and any
agent that speaks [MCP](https://modelcontextprotocol.io) or the
[Agent Skills spec](https://agentskills.io).

[![Validate Skill](https://github.com/aks-builds/quality-skills/actions/workflows/validate-skill.yml/badge.svg)](https://github.com/aks-builds/quality-skills/actions/workflows/validate-skill.yml)
[![Evals](https://github.com/aks-builds/quality-skills/actions/workflows/eval-skills.yml/badge.svg)](https://github.com/aks-builds/quality-skills/actions/workflows/eval-skills.yml)
[![Skills: 106](https://img.shields.io/badge/skills-106-brightgreen)](#available-skills)
[![MCP](https://img.shields.io/badge/MCP-ready-8A63D2.svg)](./mcp/)
[![Agent Skills spec](https://img.shields.io/badge/spec-agentskills.io-blue)](https://agentskills.io/specification.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

<br/>

<!-- hero image placeholder: terminal showing /playwright scaffolding a test -->
<img src="./.github/media/hero.svg" width="720" alt="Claude Code invoking the playwright skill to scaffold a Playwright test" />

<sub>☝️ Claude Code invoking the <code>playwright_scaffold</code> tool — one of 260+ typed MCP tools in this collection.</sub>

</div>

---

## Why quality-skills

AI coding agents are great at writing code — but without domain knowledge, they
fabricate CLI flags, invent config keys, and generate test patterns that look
right but break in CI. quality-skills gives your agent accurate, up-to-date
knowledge of 40+ test automation tools and frameworks, so it helps you write
tests that actually pass.

Every skill reads your project's `qa-context` first — your stack, languages,
CI provider, browsers in scope — then applies the right tool idioms, not generic
advice. The result: an agent that knows the difference between `page.locator`
and `page.find`, understands k6 thresholds, and won't suggest Selenium when
you're already on Playwright.

It works as a **Claude Code plugin** (one command to install), an **MCP server**
(any MCP-compatible agent — Claude Desktop, Cursor, Zed, Windsurf, custom
agents), or a plain **file copy** into `.agents/skills/`.

## How skills work together

Skills reference each other and build on shared context. `qa-context` is the
foundation — every other skill reads it first to understand your stack before
doing anything.

```
                        ┌───────────────────────────────┐
                        │           qa-context          │
                        │  (read by all skills first)   │
                        └───────────────┬───────────────┘
                                        │
   ┌──────────┬───────────┬─────────────┼─────────────┬───────────┬──────────┐
   ▼          ▼           ▼             ▼             ▼           ▼          ▼
Strategy  Frontend     API          Performance   Mobile     A11y &     CI &
          Automation   Testing      & Load        Testing    Visual     Infra
```

See each skill's **Related Skills** section for the full dependency map.

## Install

### Option 1 — Claude Code Plugin (recommended)

```bash
/plugin marketplace add aks-builds/quality-skills
/plugin install quality-skills
```

### Option 2 — MCP Server (Claude Desktop, Cursor, Zed, Windsurf, custom agents)

Add to your `mcp_servers` config (e.g. `.mcp.json` or `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "quality-skills": {
      "command": "npx",
      "args": ["github:aks-builds/quality-skills/mcp"]
    }
  }
}
```

Or if you have it cloned locally:

```json
{
  "mcpServers": {
    "quality-skills": {
      "command": "node",
      "args": ["/path/to/quality-skills/mcp/index.js"]
    }
  }
}
```

### Option 3 — Clone and Copy

```bash
git clone https://github.com/aks-builds/quality-skills.git
cp -r quality-skills/skills/* .agents/skills/
```

### Option 4 — Git Submodule

```bash
git submodule add https://github.com/aks-builds/quality-skills.git .agents/quality-skills
```

## Usage

Once installed, ask your agent naturally:

```
"Set up Playwright for our Next.js app with parallel execution and tracing"
→ playwright_scaffold + ci-test-orchestration

"Why are these Cypress tests flaky?"
→ cypress + flaky-test-management

"Build a k6 load test for our checkout API targeting 200 RPS"
→ k6_scaffold + qa-context

"Add Pact contract testing between our web app and orders API"
→ pact-contract-testing + rest-assured

"Write a Cucumber feature for the password reset flow"
→ cucumber-gherkin + bdd-anti-patterns
```

Or invoke skills directly:

```
/playwright
/k6
/accessibility-testing
/hipaa-compliance
```

MCP tool calls (any MCP host):

```
playwright_scaffold({ target: "https://app.example.com/login", language: "ts" })
playwright_debug({ error: "TimeoutError: locator.click timed out after 30000ms" })
k6_scaffold({ endpoint: "/api/checkout", vus: 50, duration: "2m" })
```

## Available Skills

<!-- SKILLS:START -->
<!-- auto-generated — do not edit -->
<!-- SKILLS:END -->

## Skill Categories

### Foundation
- `qa-context` — Stack, languages, CI provider, environments, quality bar — every other skill reads this first

### Strategy & Fundamentals
- `test-strategy` · `test-design-techniques` · `test-data-management` · `flaky-test-management` · `test-environment-management`

### Frontend / Browser Automation
- `selenium` · `cypress` · `playwright` · `webdriverio` · `puppeteer` · `testcafe`
- **New:** `testing-library` · `msw` · `storybook-testing` · `playwright-component` · `web-vitals` · `visual-ai-testing` · `browser-compatibility-testing` · `pwa-testing` · `electron-testing`

### Mobile Automation
- `appium` · `espresso` · `xcuitest` · `detox` · `maestro`
- **New:** `flutter-testing` · `react-native-testing` · `mobile-performance-testing` · `mobile-accessibility-testing` · `desktop-testing`

### API / Backend Automation
- `postman-newman` · `rest-assured` · `supertest` · `pytest-api` · `karate` · `pact-contract-testing` · `wiremock` · `graphql-testing` · `grpc-testing`
- **New:** `openapi-testing` · `websocket-testing` · `event-driven-testing` · `async-contract-testing` · `database-testing` · `api-fuzzing` · `schema-validation-testing` · `soap-xml-testing`

### Performance & Load
- `k6` · `jmeter` · `gatling` · `locust` · `artillery`

### BDD & Specification
- `cucumber-gherkin` · `specflow-reqnroll` · `behave` · `bdd-anti-patterns`

### Unit Testing
- `jest-vitest` · `pytest` · `junit-testng` · `xunit-nunit` · `go-test` · `rspec`
- **New:** `property-based-testing` · `snapshot-testing` · `test-doubles` · `parameterized-testing` · `approval-testing`

### Accessibility & Visual
- `accessibility-testing` · `visual-regression`
- **New:** `accessibility-advanced` · `visual-ai-testing`

### Security & Resilience
- `security-testing` · `chaos-engineering` · `mutation-testing`
- **New:** `sast-tooling` · `dast-tooling` · `dependency-scanning` · `secret-scanning` · `container-security-testing` · `compliance-testing`

### CI & Infrastructure
- `ci-test-orchestration` · `selenium-grid` · `cloud-test-grids` · `testcontainers` · `test-reporting` · `code-coverage`
- **New:** `infrastructure-testing` · `serverless-testing` · `kubernetes-testing` · `test-selection` · `pipeline-quality-gates` · `performance-regression-testing`

### Specialized / Emerging
- `ai-augmented-testing` · `llm-eval-testing` · `feature-flag-testing` · `production-testing`
- **New:** `ai-agent-testing` · `rag-testing` · `prompt-regression-testing` · `synthetic-data-ai` · `observability-testing` · `data-quality-testing` · `etl-testing` · `i18n-l10n-testing` · `test-metrics-dashboards` · `shift-right-testing` · `game-testing`

## Repository layout

```
quality-skills/
├── .claude-plugin/
│   ├── plugin.json            Claude Code plugin manifest
│   └── marketplace.json       Claude plugin marketplace entry
├── mcp/
│   ├── index.js               MCP server entrypoint
│   ├── loader.js              SKILL.md parser + skill-graph resolver
│   └── manifest.js            Generates tool manifest from all skills
├── skills/
│   └── skill-name/
│       ├── SKILL.md           Skill instructions (v2 frontmatter)
│       ├── evals/
│       │   └── evals.json     5–6 eval scenarios (CI-benchmarked)
│       └── references/        Optional deep-dive docs loaded on demand
├── AGENTS.md                  Guidelines for AI agents working in this repo
├── CLAUDE.md                  Claude Code reminders
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
└── VERSIONS.md
```

## Contributing

PRs and issues welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) — note the elevated bar
for accuracy in tool-specific content (CLI flags, API signatures, and config keys must
be verified against current docs before merging).

## License

[MIT](LICENSE) — use these however you want, but verify before relying on them in
production CI pipelines.
