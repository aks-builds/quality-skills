# AGENTS.md

Guidelines for AI agents working in this repository.

## Repository Overview

This repository contains **Agent Skills** for AI agents working on test automation and quality engineering, following the [Agent Skills specification](https://agentskills.io/specification.md). Skills install to `.agents/skills/` (the cross-agent standard). This repo also serves as a **Claude Code plugin marketplace** via `.claude-plugin/marketplace.json`.

- **Name**: Quality Skills
- **Focus**: Test automation across frontend, API, performance, mobile; BDD; unit testing; accessibility; visual regression; security testing; chaos engineering; contract testing; CI test orchestration; quality strategy
- **License**: MIT

## Repository Structure

```
quality-skills/
├── .claude-plugin/
│   └── marketplace.json    # Claude Code plugin marketplace manifest
├── skills/                 # Agent Skills
│   └── skill-name/
│       ├── SKILL.md        # Required skill file (<500 lines)
│       ├── evals/          # evals.json with 5-6 scenarios
│       └── references/     # Optional deep-dive docs loaded on demand
├── AGENTS.md
├── CLAUDE.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
└── VERSIONS.md
```

## Agent Skills Specification

Skills follow the [Agent Skills spec](https://agentskills.io/specification.md).

### Required Frontmatter

```yaml
---
name: skill-name
description: What this skill does and when to use it. Include trigger phrases.
metadata:
  version: 1.0.0
---
```

### Frontmatter Field Constraints

| Field         | Required | Constraints                                                      |
|---------------|----------|------------------------------------------------------------------|
| `name`        | Yes      | 1-64 chars, lowercase `a-z`, numbers, hyphens. Must match dir.   |
| `description` | Yes      | 1-1024 chars. Describe what it does and when to use it.          |
| `license`     | No       | License name (default: MIT)                                      |
| `metadata`    | No       | Key-value pairs (author, version, etc.)                          |

### Name Field Rules

- Lowercase letters, numbers, and hyphens only
- Cannot start or end with hyphen
- No consecutive hyphens (`--`)
- Must match parent directory name exactly

**Valid**: `playwright`, `rest-assured`, `flaky-test-management`
**Invalid**: `Playwright`, `-cypress`, `flaky--tests`

### Optional Skill Directories

```
skills/skill-name/
├── SKILL.md        # Required - main instructions (<500 lines)
├── evals/          # Required - evals.json with 5-6 evals
├── references/     # Optional - detailed docs loaded on demand
├── scripts/        # Optional - executable code (kept minimal)
└── assets/         # Optional - templates, data files
```

## Writing Style Guidelines

### Structure

- Keep `SKILL.md` under 500 lines (move details to `references/`)
- Use H2 (`##`) for main sections, H3 (`###`) for subsections
- Use bullet points and tables liberally — config matrices, CLI flag references, and version compatibility benefit from structured layout
- Short paragraphs (2-4 sentences max)

### Tone

- Direct and instructional
- Second person ("You are an expert in Playwright")
- Professional and precise — readers are building production-grade test suites

### Clarity Principles

- Clarity over cleverness
- Specific over vague
- Active voice over passive
- One idea per section

### Description Field Best Practices

The `description` is critical for skill discovery. Include:
1. What the skill does
2. When to use it (trigger phrases users actually say)
3. Related skills for scope boundaries

```yaml
description: When the user wants to design, implement, debug, or stabilize Playwright tests. Also use when the user mentions "Playwright," "playwright.config.ts," "test.beforeEach," "page object model," "fixtures," "tracing," "codegen," "browser context," or "Playwright MCP." For Cypress-specific questions see cypress. For CI sharding and parallelism see ci-test-orchestration.
```

## QA-Specific Authoring Rules

These rules are mandatory because misinformation in a test automation context creates flaky suites, false-positive coverage, and broken CI pipelines that mask real production bugs.

### Accuracy

- **Never invent CLI flags**: do not fabricate command-line options for any tool (`cypress run`, `playwright test`, `k6 run`, `jmeter -n`, `appium`, `mvn test`, `pytest`, etc.). If you reference a flag, it must be one you've verified — otherwise say "check `--help` for the current flag name."
- **Never invent API method signatures**: do not guess at parameter names, types, or order for `cy.intercept`, `page.locator`, `request.send`, `http.get`, etc. Cite or paraphrase the official docs.
- **Never invent config keys**: `cypress.config.js`, `playwright.config.ts`, `pytest.ini`, `karate-config.js`, `jest.config.js`, `webdriverio.conf.js`, JMeter `.jmx` — fields must be real or marked as illustrative pseudo-config.
- **Be explicit about version compatibility**: features may be version-gated (Selenium 4 vs 3, Cypress 12 vs 13, Playwright 1.x cadence). Note the minimum version or say "verify against the version you're running."
- **Cite the source of truth**: every tool claim should link to (or name) the authoritative docs page.

### Test data and credentials in examples

- Use **synthetic data** in every example. Generate values that look real but aren't.
- Never paste real production hostnames, real customer emails, real API keys, real tokens, or real user IDs.
- For login/auth examples, use clearly fake credentials like `qa.user@example.com` / `Pa$$w0rd-fake` and call them out as placeholders.
- For API examples, use `https://api.example.com` / `bearer-token-placeholder`.

### Scope

- These skills target QA engineers, SDETs, test automation leads, and developers writing tests.
- They are **not** for general programming tutorials, language fundamentals, or framework-agnostic dev work.
- When the user appears to ask for application development guidance (not test-related), redirect them appropriately.

## Skill Categories

| Category | Skills (representative) |
|----------|------------------------|
| Foundation | `qa-context` |
| Strategy & fundamentals | `test-strategy`, `test-design-techniques`, `test-data-management`, `flaky-test-management`, `test-environment-management` |
| Frontend automation | `selenium`, `cypress`, `playwright`, `webdriverio`, `puppeteer`, `testcafe` |
| Mobile automation | `appium`, `espresso`, `xcuitest`, `detox`, `maestro` |
| API automation | `postman-newman`, `rest-assured`, `supertest`, `pytest-api`, `karate`, `pact-contract-testing`, `wiremock`, `graphql-testing`, `grpc-testing` |
| Performance | `k6`, `jmeter`, `gatling`, `locust`, `artillery` |
| BDD | `cucumber-gherkin`, `specflow-reqnroll`, `behave`, `bdd-anti-patterns` |
| Unit testing | `jest-vitest`, `pytest`, `junit-testng`, `xunit-nunit`, `go-test`, `rspec` |
| Accessibility & visual | `accessibility-testing`, `visual-regression` |
| Security & resilience | `security-testing`, `chaos-engineering`, `mutation-testing` |
| CI & infrastructure | `ci-test-orchestration`, `selenium-grid`, `cloud-test-grids`, `testcontainers`, `test-reporting` |
| Specialized | `code-coverage`, `ai-augmented-testing`, `llm-eval-testing`, `feature-flag-testing`, `production-testing` |

See `README.md` for the canonical list.

## Skill Cross-References

Every skill references `qa-context` as its foundation. Beyond that, skills reference each other for scope clarity (e.g., `playwright` points at `ci-test-orchestration` for sharding, at `visual-regression` for screenshot diffing, at `accessibility-testing` for axe integration).

When adding a new skill, include a **Related Skills** section at the bottom listing 3-6 closely related skills.

## Git Workflow

### Branch Naming

- New skills: `feature/skill-name`
- Improvements: `fix/skill-name-description`
- Documentation: `docs/description`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat: add playwright skill`
- `fix: correct k6 threshold syntax in performance skill`
- `docs: update README`

### Pull Request Checklist

- [ ] `name` matches directory name exactly
- [ ] `name` follows naming rules (lowercase, hyphens, no `--`)
- [ ] `description` is 1-1024 chars with trigger phrases
- [ ] `SKILL.md` is under 500 lines
- [ ] No invented CLI flags, API signatures, or config keys
- [ ] No real credentials, hostnames, or user data in examples
- [ ] References section at the bottom links related skills
