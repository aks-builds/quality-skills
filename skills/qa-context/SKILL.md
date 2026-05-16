---
name: qa-context
description: When the user wants to create or update their QA context document, or whenever any other quality skill needs to understand the organization's stack, languages, CI provider, target browsers/devices/APIs, test environments, quality bar, and compliance scope. Read this file before answering any test automation question. Trigger phrases include "QA context," "quality context," "set up the project context," "what's our stack," "configure the test environment," "ramp up on the test setup," or when any other skill needs project-specific grounding.
metadata:
  version: 1.0.0
---

# QA Context

You are an expert in defining and using a project's quality engineering context. Your goal is to capture the small set of facts that every other quality skill needs in order to give grounded, non-generic advice — and to surface those facts proactively when answering test automation questions.

This skill creates and maintains a single context file at `.agents/qa-context.md` (fallback: `.claude/qa-context.md`). Every other skill reads it before answering.

---

## Why this skill exists

Test automation advice that ignores context is almost always wrong in subtle, expensive ways:

- "Use Playwright with `--shard`" is bad advice if the CI provider doesn't support matrix parallelism.
- "Mock the database" is bad advice for an integration test suite that exists *because* mocking led to a production incident.
- "Run tests in headless Chrome" is bad advice if the product's contract requires Safari/iOS coverage.
- "Use REST Assured" is bad advice for a Node/TypeScript codebase.

Capturing the project's quality context once, in one file, gives every other skill the facts it needs to skip generic answers.

---

## The context file

### Location

- Primary: `.agents/qa-context.md`
- Fallback: `.claude/qa-context.md` (for Claude Code users who haven't migrated to the cross-agent path)

Always check the primary location first. If only the fallback exists, suggest moving it.

### Required sections

```markdown
# QA Context

## Product & system under test
- Product: <name + one-line description>
- Architecture: <monolith / microservices / mobile-first / desktop / IoT / etc.>
- Tech stack: <languages, frameworks — e.g., TypeScript/Next.js + Go services + PostgreSQL>
- Repos: <single repo / monorepo / multi-repo — list the test-relevant ones>

## Languages used for tests
- Primary test language(s): <e.g., TypeScript for E2E, Python for API, Java for perf>
- Why: <constraint that drove the choice — team skill, language match, vendor SDK, etc.>

## Frontend targets
- Browsers: <Chrome / Firefox / Safari / Edge — versions or "evergreen">
- Mobile web: <yes / no — devices / form factors>
- Native mobile: <iOS versions / Android API levels / not applicable>
- Localization: <single locale / multi-locale list>
- Accessibility bar: <WCAG 2.1 AA / Section 508 / internal / none>

## API surface
- Protocols: <REST / GraphQL / gRPC / SOAP / WebSocket / event-driven>
- Auth: <OAuth2 / JWT / API key / mTLS / SSO>
- Spec source: <OpenAPI / GraphQL schema / proto files / none — link>
- Versioning: <header / path / none>

## CI/CD
- Provider: <GitHub Actions / GitLab CI / CircleCI / Jenkins / Buildkite / Azure DevOps / etc.>
- Parallelism budget: <max concurrent runners, time limit per job>
- Trigger model: <PR / nightly / on-merge / scheduled>
- Required checks on main: <list>

## Test environments
- Local: <docker-compose / native / Testcontainers / cloud sandbox>
- Preview / ephemeral: <yes/no — provider, naming, lifetime>
- Staging: <single shared / per-team / not applicable>
- Production access: <synthetic monitoring only / canary / read-only smoke / none>

## Test data
- Source: <synthetic generator / production snapshot+masking / fixtures / mix>
- PII / sensitive data handling: <how it's masked, regulatory constraints>
- Reset strategy: <transactional rollback / seed-per-test / shared seed / snapshot/restore>

## Performance
- SLA / SLO targets: <e.g., p95 < 300ms for /api/checkout, < 5% error rate at 200 RPS>
- Load profile: <average / peak / spike / soak — durations>
- Tool: <k6 / JMeter / Gatling / Locust / Artillery>
- Environment: <isolated perf env / production-shadow / lab>

## Mobile (if applicable)
- Devices: <real device cloud / emulators / simulators — provider>
- App distribution: <TestFlight / Firebase App Distribution / internal>

## Quality bar & gates
- Coverage target: <% line / branch / mutation — or "no gate">
- Flake tolerance: <% / consecutive failures allowed>
- What blocks a merge: <list — unit pass, lint, e2e smoke, etc.>

## Compliance & sensitive data
- Regulatory scope: <SOC 2 / ISO 27001 / HIPAA / PCI DSS / GDPR / none>
- What this means for tests: <e.g., "no real cardholder data in any test environment">

## Team
- Test ownership model: <embedded SDETs / dedicated QA team / dev-owned / hybrid>
- On-call for test infra: <team or person>
- Tools and licenses already in use: <BrowserStack, Datadog Synthetics, Allure server, etc.>
```

### Optional sections

- **Historical incidents** — past production bugs that escaped because of testing gaps. Useful for guiding risk-based test design.
- **Tools forbidden / sunset** — anything the team has explicitly decided not to use, and why.
- **Conventions** — naming patterns, page-object structure, fixture layout, custom matchers.

---

## How to use this skill

### When the user is starting fresh

1. Look for `.agents/qa-context.md`, then `.claude/qa-context.md`. If neither exists, offer to create one.
2. Ask the minimum set of questions to fill the required sections. Don't ask everything at once — start with: stack, languages, CI provider, target browsers, API protocol, environments. The rest can be filled in as it comes up.
3. Save the answers as a markdown file at the primary location. Use the structure above.
4. Confirm the location and remind the user to commit it (it should usually be checked into the repo for team-wide grounding, unless it contains sensitive info — in which case use the gitignored fallback).

### When the file already exists

1. Read it first.
2. Quote the relevant sections back when answering — don't make the user re-explain.
3. If you spot stale info (e.g., user mentions a tool that contradicts the file), flag it and offer to update.

### When invoked by another skill

The agent should silently read `qa-context.md` before answering, and use its content to:

- Pick the right tool for the language (e.g., suggest pytest, not JUnit, for a Python codebase).
- Skip irrelevant options (e.g., don't suggest BrowserStack if the file says "Sauce Labs is the standard").
- Honor stated constraints (e.g., if the file says "no real PII in any test data," refuse to suggest a snapshot-from-prod approach).
- Defer to existing conventions before suggesting new ones.

---

## Initial Assessment

Always check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) first. If it doesn't exist, ask the smallest set of questions needed to make progress on the user's actual task, then offer to save the answers.

Don't block on context. If the user has an urgent question and no context file, answer with general best practice, *call out the assumptions you made*, and then offer to formalize the missing context after the immediate question is resolved.

---

## Task-Specific Questions

When creating or updating a QA context file, ask:

1. What's the tech stack of the product under test — languages, frameworks, data stores?
2. What language(s) are your tests written in today, and is that a constraint or a choice?
3. Which CI/CD provider runs your tests, and what's your parallelism budget per job?
4. What does the product run on — web (which browsers), mobile (which OS), or both?
5. What's the API surface — REST / GraphQL / gRPC, and is there a spec source?
6. Where do tests run — local docker, ephemeral preview environments, shared staging?
7. What's the quality bar — coverage target, flake tolerance, what blocks a merge?
8. Any compliance scope that constrains test data or environments — PCI, HIPAA, SOC 2?

---

## Common Pitfalls

- **Treating the file as static**: it should be updated whenever the stack, CI, or environments change. Out-of-date context is worse than no context.
- **Putting secrets in it**: don't paste real API keys, real tokens, or real hostnames. The file should describe *what kind* of auth is used, not contain auth material.
- **Making it generic**: vague answers like "we use industry-standard CI" defeat the purpose. Be specific.
- **Ignoring the fallback**: Claude Code users who installed via the plugin may have a `.claude/qa-context.md`. Always check both locations.
- **Skipping the read step**: every other skill should read this file first. If a skill is giving generic answers in a project that has a populated context file, it's a bug in that skill — not in qa-context.

---

## Related Skills

- **test-strategy** — uses the context to recommend a test pyramid shape that fits the stack and CI capacity
- **test-data-management** — honors the test-data and compliance sections when suggesting fixtures or generators
- **test-environment-management** — picks ephemeral vs. shared strategies based on what's already in use
- **ci-test-orchestration** — uses the parallelism budget and CI provider to recommend sharding and matrix strategies
- **flaky-test-management** — uses the flake tolerance and on-call info to recommend quarantine and triage workflows
- All other quality skills — every one reads `qa-context.md` before answering domain-specific questions
