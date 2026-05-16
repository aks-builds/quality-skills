---
name: production-testing
description: When the user wants to design or operate production-side testing — synthetic monitoring, canary analysis, real user monitoring, error-budget-driven testing, shift-right verification. Use when the user mentions "production testing," "testing in production," "TiP," "synthetic monitoring," "synthetics," "Datadog Synthetics," "Pingdom," "Checkly," "canary analysis," "Kayenta," "SLO testing," "shift-right," "real-user monitoring," "RUM," or "production smoke." For chaos see chaos-engineering. For feature flags see feature-flag-testing.
metadata:
  version: 1.0.0
---

# Production Testing

You are an expert in shift-right / production-side testing — synthetic monitoring, canary analysis, SLO-driven verification, and the broader practice of using production traffic as an integral part of the quality strategy. Your goal is to help engineers safely extend testing into production where pre-prod environments can't replicate user behavior, scale, or environmental complexity. Don't fabricate tool features or SLO definitions. When uncertain, point the reader to the relevant tool docs and Google's SRE / Site Reliability Engineering books.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Existing observability maturity** — production testing assumes you can observe what's happening. Without dashboards / alerts / SLOs, production testing creates outages instead of learning.
- **Risk tolerance** — production testing has blast radius. Some industries (medical, financial) need stricter controls than others.
- **Deployment cadence** — daily-deploy shops benefit most from production testing; quarterly-release shops benefit from pre-prod investment.
- **Current shift-left investment** — production testing complements, doesn't replace, pre-prod testing.
- **User-impact metrics** — what does "we're degrading user experience" actually measure?

If the file does not exist, ask: observability stack, deployment cadence, risk tolerance, SLO definitions if any.

---

## Why test in production

Some failure modes only exist in production:

- **Scale-related issues** — connection pool exhaustion at 10K RPS; doesn't show up at 100 RPS in staging.
- **Real-data behavior** — query planner with prod statistics differs from staging.
- **Network topology** — cross-region latency, CDN caching, DNS variance.
- **Real user diversity** — locale, time zone, device, network condition, screen reader, accessibility tools.
- **Third-party integration drift** — vendors change behavior without notice.
- **Compounding effects** — A + B + C in production reveals what only-A staging doesn't.

Shift-right testing isn't optional for mature systems — it's the only place some bugs surface.

It also isn't a replacement for shift-left. The combination (cross-reference test-strategy):

```
Pre-prod investment       ← unit, integration, contract, E2E, perf, security
       +
Shift-right verification  ← synthetic, canary, SLO, RUM, observability
       =
Confidence
```

---

## Synthetic monitoring

Scripts that run continuously against production, exercising real flows from outside the system.

| Tool | Notes |
|------|-------|
| **Datadog Synthetics** | Mature, integrates with broader Datadog stack. |
| **Pingdom** | Long-running player; reliable. |
| **Checkly** | Modern; Playwright-based scripts. |
| **New Relic Synthetics** | Enterprise. |
| **Grafana Synthetics** | Open-source-friendly. |
| **AWS CloudWatch Synthetics** | AWS-native. |
| **Sematext, Site24x7, others** | Many alternatives. |

Patterns:

- **Heartbeat** — every minute, ping critical endpoints from multiple regions.
- **Multi-step flow** — login → search → add to cart, end-to-end through prod every 5-10 minutes.
- **API contract** — call critical APIs with known inputs; assert on outputs.
- **TLS / cert checks** — alert before certificates expire.
- **DNS / CDN checks** — verify resolution and CDN behavior.

Synthetics catch the "we deployed, looked at our dashboards, said 'looks good,' and went home" miss — many real outages happen 6 hours later when a downstream cron job runs.

### Important: synthetics aren't user-impact metrics

Synthetic results show what synthetic scripts experience. They're not what users experience. Synthetics are an early-warning system; RUM is the ground truth.

---

## Real user monitoring (RUM)

Instrument the client (web / mobile) to send timing + error data from actual user sessions.

| Tool | Notes |
|------|-------|
| **Datadog RUM**, **New Relic Browser**, **AppDynamics**, **Splunk RUM** | Commercial |
| **Sentry Performance / Web Vitals** | Open + commercial; lightweight |
| **Google Analytics 4 / Search Console** | Free but limited |
| **Custom telemetry to your own stack** | Fits well with OpenTelemetry |

Use RUM for:

- Core Web Vitals (LCP, INP, CLS).
- Error rates per page / per user segment.
- Geographic / network-quality performance breakdown.
- Conversion funnel timing.

RUM tells you what users actually experienced, which staging can never approximate.

---

## SLO-driven testing

Service Level Objectives (SLOs) are numerical targets like "99.9% of /checkout requests under 500ms p99 in any 28-day window."

**SLOs are the basis of production testing**:

- Error budget = the allowed amount of SLO violation in a window.
- Burn rate alerts fire when you're consuming error budget faster than the window allows.
- Canary analysis can be SLO-driven: a deploy is good if SLO metrics on the canary don't burn budget faster than baseline.

Without SLOs, "is this regression bad" is a judgment call. With SLOs, it's math.

---

## Canary analysis

Deploy to a small % of traffic; compare metrics against baseline; promote or rollback.

| Tool | Notes |
|------|-------|
| **Spinnaker + Kayenta** | Mature, Netflix-origin |
| **Argo Rollouts (with analysis templates)** | K8s-native |
| **Flagger** (Weaveworks) | K8s-native, service-mesh integration |
| **LaunchDarkly / Statsig progressive rollouts** | Flag-based canary |
| **Manual canary** | Deploy 1 pod of N; watch dashboards |

Canary analysis automates the "watch the dashboards" step:

- Define metrics that must not regress (error rate, latency p99, business KPIs).
- Define statistical comparison vs baseline (Kayenta uses Mann-Whitney; others have different stats).
- Automatic rollback if canary regresses.

For most teams: start with manual canary (1% traffic, eyes on dashboards) before adopting automated canary analysis.

---

## Feature-flag-driven rollouts

Cross-reference feature-flag-testing. Progressive flag rollouts ARE production testing:

- Deploy with flag off (100% existing behavior).
- Enable for 1%, monitor 24 hours.
- Ramp 5% → 25% → 50% → 100%, each step a checkpoint.
- Kill switch ready for instant rollback.

The flag-driven model decouples deploy from release — you can deploy code without exposing users, then "release" by flipping flags. Powerful for safety.

---

## Game days as production testing

Cross-reference chaos-engineering. Scheduled chaos experiments in production (with strict guardrails) are a form of production testing:

- Kill an instance — verify failover.
- Inject network latency between services — verify timeouts and retries.
- Drop an AZ — verify regional resilience.

This tests behavior staging can't replicate at production scale.

---

## Shadow traffic

Send production requests to a new service version *in addition* to the current production version. Compare outputs without affecting users.

Tools / patterns:

- **Diffy** (Twitter, open-source) — HTTP diff testing.
- **Envoy / service mesh shadow** — duplicate requests to shadow.
- **Custom mirroring** at the gateway / load balancer.

Use cases:

- Validating a rewrite of a service produces the same outputs.
- Testing performance characteristics at production scale.
- Migration validation.

Beware of side effects — shadow traffic shouldn't double-charge, double-email, or double-write to shared state. Shadow code must be read-only or fully isolated.

---

## Internal-only and dogfooding

Less formal but valuable: route the team's own traffic to the new version first.

- Deploy new version to internal users (employees) only.
- Internal users hit real bugs the team can fix before customer exposure.
- Pairs with feature flags / canary infrastructure.

For SaaS, internal staging often == "dogfooding tier on real production data."

---

## What NOT to do in production testing

- **Test that may corrupt user data.** No mutations against real data unless explicitly safe.
- **Test that may charge customers.** No payment-flow tests against real payment processors with real cards.
- **Load test from outside.** Cloud-grade load testing against production with no coordination = self-inflicted DDoS.
- **Test without observability.** Production tests without dashboards = inducing outages, not learning.
- **Test without rollback plan.** What happens when the test reveals a problem?
- **Test that bypasses regular customer protections.** Auth, rate limits, audit logging must apply.

---

## A production-testing stack

A reasonable shape for a mature team:

```
Layer                     Frequency      Tool examples
──────────────────────────────────────────────────────────────
Synthetic monitoring      every 1-5 min   Datadog Synthetics, Checkly
Real user monitoring      continuous      Datadog RUM, Sentry
SLO + error budget         continuous      Datadog SLOs, hand-rolled
Canary analysis            per deploy      Flagger, Kayenta
Feature flag rollouts      per launch      LaunchDarkly, Statsig
Chaos game days            quarterly       Chaos Mesh, AWS FIS
Internal dogfooding        per deploy      Internal-traffic routing
Shadow traffic             per migration   Envoy, Diffy
```

Pick the layers that match your maturity. Don't try all of them on day one.

---

## Common Pitfalls

- **Synthetic monitoring without alerting** — checks run, no one looks.
- **Alerts that fire too often** — alert fatigue silences real signals.
- **No SLOs / error budgets** — "is this bad?" is forever a debate.
- **Canary analysis without baseline definition** — what are we comparing against?
- **Production tests with side effects** — double-billing, double-emailing.
- **Heavy load tests against production without coordination** — DDoS yourself.
- **No rollback plan** — production test surfaces a problem at 2am, no one knows what to do.
- **RUM data not segmented** — average latency is meaningless; per-region / per-device tells the story.
- **Synthetic tests written once, never updated** — drift past relevance.
- **No on-call coverage during production tests** — surprise outage with no responder.
- **Treating production testing as a substitute for pre-prod** — production reveals what pre-prod misses, doesn't replace it.

---

## Building a production-testing program

1. **Define SLOs** for critical user-facing endpoints. Set error budgets.
2. **Deploy synthetics** for the same flows your SLOs cover.
3. **Wire alerts** on SLO burn rate (not just hard thresholds).
4. **Add RUM** to client-side products.
5. **Introduce feature flags + canary** for safer rollouts.
6. **Practice game days** in pre-prod first; production with strict guardrails later.
7. **Iterate** — every production incident becomes a new synthetic / new alert / new game day.

---

## Task-Specific Questions

When helping with production testing, ask:

1. Existing observability stack — Datadog, New Relic, Grafana Loki/Mimir/Tempo, ELK?
2. SLOs defined? Error budgets?
3. Deployment frequency?
4. Risk tolerance / industry constraints?
5. Current shift-left maturity?
6. On-call structure?
7. Specific production failure modes you've experienced?

---

## Related Skills

- **chaos-engineering** — closely related; chaos in production IS production testing.
- **feature-flag-testing** — progressive rollouts are production testing.
- **test-strategy** — shift-right is part of the overall pyramid.
- **flaky-test-management** — production observability data informs which pre-prod tests need fixing.
- **llm-eval-testing** — for LLM products, production monitoring is essential; evals don't suffice alone.
- **security-testing** — runtime monitoring of security events.
- **k6** / **gatling** / **jmeter** — load testing tools, normally not pointed at production but capacity planning informed by RUM.
- **test-environment-management** — production is the final environment in the ladder.
