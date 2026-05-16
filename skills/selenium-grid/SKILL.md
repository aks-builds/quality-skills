---
name: selenium-grid
description: When the user wants to design, deploy, scale, or troubleshoot a self-hosted Selenium Grid 4 cluster — hub, nodes, distributors, sessions, K8s deployment, autoscaling. Use when the user mentions "Selenium Grid," "Selenium Grid 4," "grid hub," "grid node," "selenium docker-selenium," "session queue," "selenoid," "moon," "GridRouter," or "self-hosted grid." For Selenium tests themselves see selenium. For cloud-hosted grid see cloud-test-grids. For mobile see appium.
metadata:
  version: 1.0.0
---

# Selenium Grid

You are an expert in Selenium Grid 4 (and the broader self-hosted browser-farm ecosystem — Selenoid, Moon, Selenosis). Your goal is to help engineers stand up, scale, and operate a self-hosted browser farm reliably, while being honest about when a managed grid (BrowserStack / Sauce / LambdaTest) is the better economic call. Don't fabricate Grid 4 component names or CLI flags. When uncertain, point the reader to `selenium.dev/documentation/grid` or the `docker-selenium` repo.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Why self-host?** — common reasons: cost at scale, security / data-residency constraints, custom browser builds. If none apply, managed cloud grids are often cheaper net-of-opex.
- **Existing infrastructure** — Kubernetes? Docker on bare metal? Cloud VMs?
- **Scale** — sessions per hour? Peak concurrency?
- **Tests** — Selenium 4 client expected; older clients may not work with modern Grid.
- **Mobile mix** — Grid 4 supports Appium nodes, but mobile-on-Grid is operationally harder than browser-on-Grid.

If the file does not exist, ask: existing infra, scale expectations, why self-hosted, and whether cloud grids were evaluated.

---

## When to self-host

| Case for self-host | Case against |
|--------------------|--------------|
| High-volume runs make managed grids expensive | Low/medium volume — managed grids are cheaper net-of-opex |
| Data-residency / security policy forbids sending traffic to a vendor | Cloud grids in compliant regions may satisfy this |
| Custom browser builds, internal browser extensions | Managed grids usually provide stock browser builds only |
| Heavy parallelism (1000+ concurrent sessions) | Many cloud vendors handle this transparently |
| Already running K8s with idle capacity | New infra investment may exceed cloud grid cost |
| Specific Linux distro / browser version pinning | Lock-in to vendor's catalog |

For most teams running < 1000 sessions / day, **managed grids are usually the right answer**. Self-hosting becomes attractive at higher volume or with strong policy constraints.

---

## Grid 4 architecture (high level)

Selenium Grid 4 is a set of cooperating components:

| Component | Role |
|-----------|------|
| **Router** | Entry point. Routes session requests / commands. |
| **Distributor** | Picks a node for a new session based on capabilities and load. |
| **Session Queue** | Queues new session requests when no node is free. |
| **Session Map** | Tracks active sessions to nodes. |
| **Event Bus** | Internal pub-sub. |
| **Node** | Hosts browsers. Reports capacity and capabilities. |

Deployment modes:

- **Standalone** — all components in one process. Local dev only.
- **Hub and Node** — hub runs Router + Distributor + Queue + SessionMap + EventBus; nodes register with hub.
- **Fully Distributed** — each component is its own service. Production-scale.

Modern docker-selenium images bundle the typical modes. For K8s, the `selenium-grid` Helm chart is the standard starting point.

---

## docker-selenium (the practical entry point)

```yaml
# docker-compose.yml — Hub + Node mode
version: '3'
services:
  selenium-hub:
    image: selenium/hub:<pinned-version>
    container_name: selenium-hub
    ports:
      - "4442:4442"  # event bus publish
      - "4443:4443"  # event bus subscribe
      - "4444:4444"  # router
    shm_size: 2gb

  chrome:
    image: selenium/node-chrome:<pinned-version>
    shm_size: 2gb
    depends_on:
      - selenium-hub
    environment:
      - SE_EVENT_BUS_HOST=selenium-hub
      - SE_EVENT_BUS_PUBLISH_PORT=4442
      - SE_EVENT_BUS_SUBSCRIBE_PORT=4443
      - SE_NODE_MAX_SESSIONS=4

  firefox:
    image: selenium/node-firefox:<pinned-version>
    shm_size: 2gb
    depends_on:
      - selenium-hub
    environment:
      - SE_EVENT_BUS_HOST=selenium-hub
      - SE_EVENT_BUS_PUBLISH_PORT=4442
      - SE_EVENT_BUS_SUBSCRIBE_PORT=4443
```

Pin image tags (`:4.x.y`, never `:latest`). `shm_size: 2gb` is critical — small `/dev/shm` is one of the most common sources of Chromium crashes.

Connect tests to `http://hub:4444` via `RemoteWebDriver`.

---

## Kubernetes deployment

For production-scale, K8s with the Selenium Grid Helm chart:

```bash
helm repo add docker-selenium https://www.selenium.dev/docker-selenium
helm install selenium-grid docker-selenium/selenium-grid --version <pinned>
```

Helm chart provides: hub deployment, per-browser node deployments, optional autoscaling.

### KEDA-based autoscaling

The recommended autoscaling pattern uses **KEDA** (Kubernetes Event-driven Autoscaling) with the Selenium-Grid trigger:

- KEDA monitors the session queue.
- When session-queue depth grows, KEDA scales up the node deployment.
- When queue empties, scales back down.

Without autoscaling, nodes idle (waste cost) or saturate (sessions queue forever).

---

## Resource sizing

Each Chromium / Firefox process needs:

- ~1-2 GB RAM per browser session.
- 1 vCPU per browser is comfortable; 0.5 vCPU works under light load.
- 2 GB `/dev/shm` per container.
- Network bandwidth proportional to test verbosity.

`SE_NODE_MAX_SESSIONS` controls how many sessions one node accepts. Going too high → memory pressure, OOM kills, mystery failures.

Plan: peak concurrency × per-session resources × headroom (~30%).

---

## Capacity and queueing

| Component | Tunable |
|-----------|---------|
| `SE_SESSION_REQUEST_TIMEOUT` | How long a session request waits before failing. |
| `SE_NODE_MAX_SESSIONS` | Sessions per node. |
| `SE_NODE_OVERRIDE_MAX_SESSIONS` | Force a count regardless of CPU. |
| `SE_OPTS` / Java opts | JVM tuning for hub. |
| `SE_RELAX_CHECKS` | Loosen sanity checks (rarely needed). |

Watch for: long session-request queues, OOM kills, hub overload symptoms (rejected sessions). Wire metrics into Prometheus / Grafana.

---

## Alternative: Selenoid / Moon / Selenosis

| Project | Notes |
|---------|-------|
| **Selenoid** | Aerokube's lightweight Go-based hub. Lower overhead than Java hub. |
| **Moon** | Aerokube's Kubernetes-native browser orchestration. Commercial. |
| **Selenosis** | Open-source K8s-native alternative. |
| **Zalenium** | Older, archived; mentioned for historical reference. |

Selenoid / Moon are popular for teams with very high volume — they generally do better per-session resource accounting than vanilla Grid. They speak WebDriver / use compatible APIs, so tests need minimal change.

---

## Common operational issues

### Crashing browsers

- Symptom: sessions die mid-test, "tab crashed" / "renderer killed."
- Causes: `/dev/shm` too small (most common), memory pressure, OOM killer, browser version mismatch.
- Fix: raise `shm_size`, raise memory limits, pin browser version.

### Stuck sessions

- Symptom: sessions queue forever; `selenium-hub` doesn't release them.
- Causes: client crashes without sending DELETE /session; session timeout misconfigured.
- Fix: set reasonable `SE_NODE_SESSION_TIMEOUT`; ensure clients close drivers in `finally` blocks.

### Network connectivity

- Symptom: tests can reach the hub but the hub can't reach the node, or vice versa.
- Causes: K8s service / network policy / overlay network issues.
- Fix: verify connectivity with `curl` from inside each pod; check NetworkPolicy.

### Image drift

- Symptom: tests pass on Tuesday, fail on Wednesday; no code changes.
- Causes: `:latest` tag, image auto-update.
- Fix: pin every image. Tag and verify before rolling.

---

## Sessions per machine — sanity numbers

These are rough; benchmark for your workload:

- **Chrome / Edge headless on 4 vCPU / 8 GB**: 4-6 concurrent sessions sustainable.
- **Firefox headless**: similar.
- **Headed (with display)**: ~half.
- **Mobile via Appium nodes**: 1-2 per node depending on emulator / simulator overhead.

Going much higher than these saves $ but increases flake rate sharply.

---

## Monitoring

Critical metrics:

- Session queue depth.
- Session requests rejected.
- Active sessions per node.
- Node uptime / restarts.
- Hub CPU / memory.
- Browser crash count.

Grid 4 exposes metrics via Prometheus. Scrape into Grafana. Alert on:

- Queue depth > N for > M minutes.
- Rejection rate > X%.
- Node down for > Y minutes.

---

## Common Pitfalls

- **`:latest` image tags** — guaranteed eventual surprise.
- **`/dev/shm` default size** — Chromium crashes.
- **Too many sessions per node** — flake rate climbs.
- **No autoscaling** — idle waste or saturation.
- **Mobile + browser on the same nodes** — pin separate deployments.
- **No metrics** — debugging crashes blind.
- **Self-hosting before measuring whether managed would be cheaper** — opex matters; do the math.
- **Browser version drift across nodes** — tests pass on chrome-node-1, fail on chrome-node-2.
- **Forgetting client `driver.quit()`** — sessions leak; the hub fills up.
- **Treating Selenium Grid as a one-time setup** — it's ongoing infra. Budget for ops time.

---

## When to consider migrating away from Selenium Grid

- **You're spending more on Grid ops than a managed grid would cost.**
- **Tests have moved to Playwright / Cypress** — these have different infrastructure stories; you may not need a WebDriver grid.
- **Flake rate from Grid issues exceeds product code flake** — the grid itself is the bug.

---

## Task-Specific Questions

When helping with Selenium Grid, ask:

1. Existing infra — Docker, K8s, bare metal?
2. Scale — peak concurrent sessions, sessions per day?
3. Why self-hosted vs cloud?
4. Browsers + mobile mix?
5. Autoscaling in scope?
6. Existing monitoring stack (Prometheus / Grafana / Datadog)?
7. Budget for ongoing ops?

---

## Related Skills

- **selenium** — the test-author side.
- **cloud-test-grids** — the managed alternative.
- **appium** — for mobile-on-Grid setups.
- **ci-test-orchestration** — for wiring tests to the grid.
- **test-environment-management** — Grid is part of the environment.
- **flaky-test-management** — Grid issues are a major flake source.
- **production-testing** — Grid operates like a production service; the same observability hygiene applies.
