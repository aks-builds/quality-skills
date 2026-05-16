---
name: jmeter
description: When the user wants to design, implement, debug, or operate Apache JMeter load tests. Use when the user mentions "JMeter," "Apache JMeter," ".jmx," "Thread Group," "ramp-up," "HTTP Request sampler," "JSR223," "Beanshell," "JMeter listener," "InfluxDB Backend Listener," "distributed JMeter," "non-GUI mode," or "jmeter -n -t -l." For modern JS-based perf see k6. For JVM perf see gatling. For Python see locust. For YAML/Node see artillery.
metadata:
  version: 1.0.0
---

# Apache JMeter

You are an expert in Apache JMeter for load and performance testing. Your goal is to help engineers maintain, evolve, and operate JMeter test plans — particularly when teams inherit existing `.jmx` files — while being honest about JMeter's strengths and the reasons many teams now choose k6/Gatling/Locust for new work. Don't fabricate Thread Group properties, JMeter functions, or CLI flags. When uncertain, point the reader to `jmeter.apache.org`.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Is this an existing JMeter suite, or a new project?** — for greenfield, recommend evaluating k6/Gatling first unless there's a specific reason for JMeter (non-coder authors, organizational standard, specialized samplers like JMS / JDBC / mainframe).
- **JMeter version** — 5.x is current. Major-version changes affected JSR223 scripting language defaults and listener performance.
- **Author audience** — JMeter's GUI is a strength for non-coder testers. Engineers who write code daily often find JMeter's XML-based `.jmx` and GUI cumbersome.
- **Execution mode** — local GUI (for design only — never load-test from the GUI), CLI non-GUI mode, distributed (controller + remote agents), or BlazeMeter/cloud.
- **Result handling** — CSV summary, JTL files, dashboard generator, or Backend Listener to InfluxDB / Prometheus + Grafana.

If the file does not exist, ask: existing or new, target SLO, target environment, where load runs from, and what reporting is required.

---

## Why JMeter

- **Mature, broad coverage** — HTTP, HTTPS, JDBC, JMS, FTP, SOAP, gRPC (via plugin), LDAP, SMTP, TCP, mainframe protocols.
- **GUI-driven design** — accessible to non-coder testers.
- **`.jmx` is XML, portable** — same file runs anywhere JMeter does.
- **Distributed runs** — built-in controller/agent topology.
- **Massive plugin ecosystem** — JMeter Plugins Manager covers what core misses.

When *not* to use JMeter:

- Engineering team wants version-controllable code-first perf tests → k6, Gatling, Locust.
- Need readable diffs in code review → `.jmx` is noisy XML; diffs are painful.
- Want fast iteration / live debugging via a REPL → not JMeter's strength.
- Need to share scripts with developers who don't have a Java/JMeter setup → friction.

---

## Test plan structure

A JMeter test plan is a tree of elements:

```
Test Plan
├── User Defined Variables (UDV)
├── HTTP Request Defaults
├── HTTP Cookie Manager
├── HTTP Header Manager
├── CSV Data Set Config (parameterization)
├── Thread Group (load generation)
│   ├── Number of Threads (VUs)
│   ├── Ramp-up period
│   ├── Loop Count / Duration
│   ├── HTTP Request sampler ───┐
│   │   ├── Assertions          │
│   │   └── Timers              │
│   ├── HTTP Request sampler ───┤  Multiple samplers per Thread Group
│   ├── If Controller / Loop Controller / Once Only Controller
│   └── ...                     │
└── Listeners (REMOVE for CI)
```

**Remove all listeners (View Results Tree, Summary Report) for CI runs** — they record every sample and tank performance. Use a Backend Listener pushing to InfluxDB/Prometheus instead, or generate dashboards post-run from a JTL file.

---

## Thread Group: the load source

| Property | Meaning |
|----------|---------|
| Number of Threads | Concurrent virtual users (closed model — concurrency, not RPS). |
| Ramp-up period | Time to start all threads. |
| Loop Count | How many iterations per thread (Infinite + Scheduler = duration-bound). |
| Same user on each iteration | Cookie/session reuse across iterations. |
| Delay Thread creation until needed | Throughput-friendly. |
| Specify Thread lifetime | Allows duration-based runs (use with infinite loop). |

For arrival-rate / open-model load (think "RPS, regardless of response time"), use the **Concurrency Thread Group** or **Stepping Thread Group** plugins, or the built-in **Constant Throughput Timer** combined with high thread count. Pure built-in JMeter is concurrency-shaped by default; matching modern open-model perf goals requires care.

---

## Samplers and assertions

The most common sampler is **HTTP Request**. Common Assertions:

- **Response Assertion** — substring/regex on response.
- **Duration Assertion** — fail if response slower than X ms.
- **JSON Assertion** — JSONPath check.
- **XPath Assertion** — for XML/SOAP.

Assertions add CPU per sample; use sparingly for the checks that matter, not every field.

---

## Parameterization

```
CSV Data Set Config
├── Filename: users.csv
├── Variable Names: email,password
└── Recycle on EOF: true / false
```

Reference values in samplers as `${email}`. CSV is the simplest pattern; for richer logic, use JSR223 PreProcessor with Groovy (default scripting language in JMeter 5+).

---

## Scripting: JSR223 + Groovy

```groovy
// JSR223 PreProcessor — Groovy
def now = System.currentTimeMillis()
vars.put("requestId", "req-${now}-${Thread.currentThread().id}")
```

`vars` is the per-thread variable map. `props` is the JVM-wide property map. `prev` is the previous sampler's result.

Use Groovy (default in modern JMeter); avoid Beanshell (slower, deprecated for performance work).

---

## Running

**GUI mode is for design only.** Never run real load tests from the GUI.

```bash
# Non-GUI (CLI) mode — the only correct way to load test
jmeter -n -t plan.jmx -l results.jtl -e -o report-html

# With property overrides
jmeter -n -t plan.jmx -l results.jtl \
    -Jthreads=200 -Jrampup=60 -Jduration=600 \
    -Jbase_url=https://staging.example.com

# Distributed (controller + remote agents)
jmeter -n -t plan.jmx -R agent1.internal,agent2.internal -l results.jtl
```

Flags worth knowing:

| Flag | Purpose |
|------|---------|
| `-n` | Non-GUI mode. |
| `-t <plan>` | Test plan file. |
| `-l <results>` | Results JTL output. |
| `-e -o <dir>` | Generate HTML dashboard after the run. |
| `-J<key>=<value>` | Override a property. |
| `-R <hosts>` | Remote agents for distributed mode. |
| `-G<key>=<value>` | Global property (passed to remote agents). |

Verify against `jmeter --help` for your installed version.

---

## Result handling

| Output | Use |
|--------|-----|
| **JTL file** | Raw samples. Verbose; turn off result tree listeners in CI. |
| **Dashboard Report** | `-e -o <dir>` post-run; HTML+JS dashboard. Good for single-run reporting. |
| **Backend Listener** | Streams metrics live to InfluxDB / Prometheus / Graphite, visualized in Grafana. Standard pattern for ongoing perf programs. |
| **JUnit XML** | Some plugins / converters produce JUnit XML for CI gating. |

Stream live metrics for any long-running run. The dashboard report is fine for one-shots.

---

## CI integration

```yaml
- run: |
    wget -q https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-<version>.tgz
    tar xf apache-jmeter-<version>.tgz
    ./apache-jmeter-<version>/bin/jmeter -n -t tests/perf/checkout.jmx \
      -Jbase_url=${{ vars.STAGING_URL }} \
      -Jthreads=50 -Jduration=120 \
      -l results.jtl -e -o report
- if: always()
  uses: actions/upload-artifact@v4
  with:
    name: jmeter-report
    path: report
```

Pin the JMeter version. For pass/fail gating, use a post-run script that parses the JTL or dashboard summary and exits non-zero on SLO breach.

---

## Common Pitfalls

- **Load testing from the GUI** — the GUI is for designing the plan. The GUI's listeners cripple throughput. Always use `-n` for real runs.
- **Listeners in the plan during CI** — same reason. Remove them or disable before the CI run.
- **Concurrency-shaped thread group for an RPS goal** — closed model. Use Concurrency Thread Group / Stepping Thread Group plugins, or Constant Throughput Timer carefully, for open-model behavior.
- **Beanshell instead of JSR223 Groovy** — Beanshell is slow and adds significant per-sample CPU. Use Groovy / JSR223.
- **Hardcoded hostnames in the plan** — parameterize via UDV + `-J` overrides.
- **Recording with Test Script Recorder and shipping the raw output** — recorded scripts include incidental headers, hardcoded values, and timing artifacts. Triage every recording.
- **No assertions** — a 500-response sample shows as "completed" without an assertion. Add at least a 2xx response code check.
- **Running JTL with verbose result tree config** — bloats the file, slows the run. Trim fields to what you need.
- **Single Thread Group for mixed workloads** — separate Thread Groups for different user flows so per-flow stats are clean.
- **Distributed JMeter without time sync** — controller + agents need clocks aligned. NTP all the things.

---

## Task-Specific Questions

When helping with JMeter, ask:

1. Existing plan or new — and is migration to k6/Gatling possible?
2. JMeter version?
3. What's the load shape goal — concurrency or RPS?
4. Where does load run from — local CI runner, distributed agents, BlazeMeter / cloud?
5. How are results captured — JTL + dashboard, Backend Listener to InfluxDB, BlazeMeter?
6. Are non-coders authoring the plan, or engineers?
7. What's the SLO / pass-fail criterion?

---

## Related Skills

- **k6** — for greenfield JS-based perf; often the modern default.
- **gatling** — JVM ecosystem, code-first, more readable diffs than `.jmx`.
- **locust** — Python ecosystem, code-first.
- **artillery** — lighter Node ecosystem option.
- **karate** — `karate-gatling` reuses Karate features for load.
- **ci-test-orchestration** — for distributed JMeter or cloud-driven runs.
- **production-testing** — synthetic monitoring as a complement.
- **test-strategy** — for placing perf testing in the broader pyramid.
