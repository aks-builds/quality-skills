---
name: test-environment-management
description: When the user wants to design or audit where tests run — local dev, CI runners, ephemeral preview environments, shared staging, prod-shadow, or production canaries. Use when the user mentions "test environment," "test envs," "preview environments," "ephemeral environments," "staging," "PR environments," "review apps," "dev environment," "Vercel previews," "Render preview," "Heroku review apps," or "where should tests run." For local in-process containers see testcontainers. For data scope see test-data-management. For overall strategy see test-strategy.
metadata:
  version: 1.0.0
---

# Test Environment Management

You are an expert in test environment strategy — where tests run, what they share, how environments are provisioned, and how to keep them reliable and cheap. Your goal is to help engineers map test categories to environments correctly, design ephemeral-where-it-helps / shared-where-it-makes-sense, and avoid the most common environment-related test-quality failures. Don't fabricate cloud features or CI capabilities; anchor in real, documented options.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Existing environments** — what's there now (local, CI, dev, staging, prod-shadow), what works, what doesn't.
- **Test categories in use** — unit / integration / E2E / contract / perf / a11y / security — each has different environment needs.
- **Cloud / infra provider** — AWS / GCP / Azure / on-prem — provisioning options differ.
- **Cost constraints** — ephemeral environments aren't free; cost discipline matters.
- **Compliance scope** — non-prod environments still need to honor regulatory constraints (cross-reference test-data-management).

If the file does not exist, ask: current environments, infra provider, cost constraints, compliance scope, what's painful today.

---

## The environment ladder

Most teams need a subset of these:

| Environment | Purpose | Lifetime |
|-------------|---------|----------|
| **Local** | Fastest iteration; unit + integration tests | Always available |
| **CI runner** | Per-PR / per-commit validation | Per build |
| **Ephemeral / preview** | Branch-specific full-stack environment | Lifetime of a PR |
| **Dev** | Shared developer environment | Long-lived, mutable |
| **QA / Staging** | Manual + automated test environment | Long-lived |
| **Pre-prod / prod-shadow** | Production-like, often using production data shape (sanitized) | Long-lived |
| **Production canary** | Small slice of real traffic; shift-right validation | Always |
| **Production** | Real users; observed via synthetic monitoring | Always |

Not every team needs all of these. A small SaaS might have Local → CI → Staging → Production. An enterprise might have all seven. Match to risk and cost.

---

## What runs where

### Local

- Unit tests.
- Integration tests with Testcontainers (cross-reference).
- Component tests.
- Pre-commit hooks for lint / typecheck / fast tests.

Local should be fast. If `npm test` takes 10 minutes, engineers stop running it.

### CI runner

- Everything that ran locally, plus everything that needs CI-only infrastructure.
- Smoke E2E (5-10 critical flows).
- Contract tests (consumer side).
- SAST / lint / dependency scans.
- Coverage reporting.

Resources matter: tests that pass on a fast laptop fail in a 2-CPU CI container. Set timeouts deliberately for CI.

### Ephemeral / preview environment

Per-PR, full-stack environment. Spun up on PR open, torn down on close.

| Provider | Mechanism |
|----------|-----------|
| Vercel | Automatic per-branch preview |
| Netlify | Automatic per-branch deploy |
| Render / Railway / Fly.io | Preview environments per PR |
| AWS | Custom — Terraform / CDK + GHA, or Copilot, or Architect |
| Kubernetes | Argo CD apps-of-apps, vcluster, custom operators |

What ephemeral environments enable:

- Reviewers click a URL and try the change.
- Full E2E suite runs against the actual deployed change before merge.
- Catches integration bugs that local mocks miss.

What they don't replace: a long-lived staging for cross-cutting features that span PRs.

### Staging / QA

Long-lived shared environment. Useful for:

- Manual exploratory testing.
- Cross-feature smoke checks.
- Pre-release validation.

Risks of shared staging:

- Test data pollution (every PR's test runs leave residue).
- Environment drift from production (config, infra, data shape).
- Outage-prone: one team's broken commit blocks everyone.

Mitigations: reset staging on a schedule (nightly), use ephemeral envs for PR-specific testing, monitor drift.

### Pre-prod / prod-shadow

Production-like. Same infra topology, same scale, sanitized data. Used for:

- Performance tests against realistic infra (cross-reference k6 / jmeter / gatling).
- Final smoke before production deploy.
- Disaster-recovery drills.

Pre-prod is expensive. Justify the cost against the risk it mitigates.

### Production canary / synthetic monitoring

Real production, but observed continuously and protected. Cross-reference production-testing.

---

## Ephemeral environment design

### Provisioning model

| Model | Trade-off |
|-------|-----------|
| **Full clone per PR** | Most realistic; expensive; slow to spin up |
| **Branch-deployed, shared backing services** | Cheap; coupling via shared DB / queue |
| **Branch-deployed, namespaced backing services** | Middle ground; per-branch DB schema or namespace |
| **Local docker-compose only** | Fast; least realistic; doesn't catch cloud-specific issues |

Most teams converge on branch-deployed app + namespaced backing services (per-branch DB schema, per-branch Redis db number, per-branch S3 prefix).

### Lifecycle

1. **PR open** → preview environment provisions.
2. **Commits to PR branch** → preview environment redeploys.
3. **PR merged / closed** → preview environment tears down (auto-cleanup; otherwise costs balloon).
4. **Stale PRs older than 30 days** → reaper sweeps unused preview envs.

### Cost discipline

- Auto-stop idle environments at night / weekends.
- Smaller instance types in preview than prod.
- Aggressive teardown on PR close.
- Cap the number of concurrent previews (e.g., 50; older ones queue or get killed).
- Tag everything for cost attribution.

### Configuration

- Same Terraform / Helm / config-as-code as prod, with environment-specific values.
- Secrets injected per-env from a secret manager — never committed.
- Feature flags default to safe / off in preview unless the PR is specifically testing them.

---

## Shared-staging hygiene

If you must rely on shared staging:

- **Nightly reset** — wipe non-essential data, redeploy from main.
- **Owner per service** — when staging breaks, who's on-call?
- **Test data namespacing** — every test creates resources with unique IDs prefixed (`qa-pr-1234-...`) so cleanup scripts can target them.
- **No long-lived test users** — accounts created during a test live for the test, not forever.
- **Observability** — staging should be monitored like (a lighter version of) prod.

---

## Local environment

A good local environment lets engineers:

- Run the full app with one command (`docker compose up` or equivalent).
- Run unit + integration tests in seconds.
- Run E2E smoke locally before pushing.

Components:

- **Docker Compose** for backing services (DB, Redis, queue, S3 emulator) — or Testcontainers (cross-reference).
- **`.env.example`** committed, `.env` gitignored.
- **Seed data scripts** that produce a usable state in 30 seconds.
- **Idempotent setup** — `make setup` from scratch produces the same result.

Don't make local require AWS credentials, real third-party API keys, or VPN access unless absolutely necessary. Each barrier costs onboarding hours.

---

## Resource constraints in CI

CI containers are typically smaller than developer machines:

- **CPU**: 2-4 vCPU is common.
- **RAM**: 4-8 GB.
- **Disk**: limited; clean up between test classes.
- **`/dev/shm`**: small by default (64MB in some Docker setups); cause of Chromium / Postgres misbehavior.

Mitigations:

- Test against the same container locally to catch sizing issues: `docker run --cpus=2 --memory=4g ...`.
- Increase `/dev/shm`: `docker run --shm-size=2g ...`.
- Cleanup between tests: temp directories, container reuse, cache invalidation.

---

## Drift management

Environment drift = staging / dev / prod slowly diverging in config, infra, dependencies.

Symptoms: "works on staging, fails on prod." Mitigations:

- **Infrastructure as code** — one source of truth; environments are parameterized.
- **Drift detection** — `terraform plan` regularly against each env; flag unexpected diffs.
- **Pinned dependency versions** across environments.
- **Same DB / Redis / Kafka versions** across envs (a common silent source of "works here, breaks there").

---

## Compliance in non-prod environments

PCI / HIPAA / SOC 2 / GDPR don't stop at the production boundary. Non-prod environments holding real customer data are in scope.

- **No real cardholder data in non-prod** (PCI DSS).
- **HIPAA**: PHI in non-prod requires a BAA-covered environment; rarely worth the cost.
- **GDPR**: pseudonymized non-prod data may need to honor erasure requests.

Cross-reference test-data-management for the data side.

---

## Common Pitfalls

- **Long-lived shared dev environment as the only non-local env** — pollution, outage cascade, slow ownership.
- **Ephemeral environments without auto-teardown** — costs balloon.
- **Tests assuming a particular environment's data state** — `assert users.count == 1` works on a fresh env; flakes on shared staging.
- **Local environment that requires production credentials** — onboarding nightmare.
- **CI flake from resource constraints written off as "test flake"** — investigate.
- **Production-shape data in non-prod without masking** — compliance violation.
- **No drift detection** — environments quietly diverge for months, until a deploy fails surprising.
- **Same DB in all environments** — accidental cross-env contamination.
- **Long-running test that holds an env locked** — blocks others; design for parallel access.
- **No ownership for the test environments themselves** — when staging is broken, no one's on call.

---

## Building an environment strategy

1. Read qa-context.md for stack, scale, compliance.
2. Decide the minimum set of environments (most teams: local, CI, ephemeral, staging, prod).
3. Map each test category to the right environment (unit local, contract on CI, E2E on ephemeral, perf on prod-shadow).
4. Establish auto-teardown for anything ephemeral.
5. Designate an owner per long-lived environment.
6. Set up drift detection.
7. Treat the test environments themselves as a product — they need monitoring, alerting, on-call.

---

## Task-Specific Questions

When helping with environments, ask:

1. What environments exist today, and what works / doesn't?
2. Infra provider — AWS, GCP, Azure, Kubernetes, on-prem?
3. Cost constraints?
4. Compliance scope on non-prod data?
5. Existing IaC / config-as-code setup?
6. CI provider and runner sizing?
7. How fast does a "spin up a fresh env" need to be (1 minute? 30 minutes?)?

---

## Related Skills

- **qa-context** — the strategy starts here.
- **test-strategy** — for which categories of tests go in which environment.
- **test-data-management** — for what data lives in each environment.
- **testcontainers** — for local-equivalent infra in tests.
- **ci-test-orchestration** — for the CI half of the environment story.
- **production-testing** — for shift-right monitoring as part of the environment ladder.
- **flaky-test-management** — environment is a top flake source.
- **chaos-engineering** — pre-prod environments are where you can practice failure injection safely.
