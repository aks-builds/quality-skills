---
name: security-testing
description: When the user wants to design, integrate, or operate security testing in their pipeline — SAST, DAST, dependency scanning, secret scanning, container scanning, IaC scanning, fuzzing, authn/authz testing, OWASP coverage. Use when the user mentions "security testing," "SAST," "DAST," "OWASP Top 10," "OWASP ZAP," "Burp Suite," "semgrep," "Snyk," "dependency scanning," "SCA," "secret scanning," "Trivy," "Checkov," "tfsec," "Bandit," "ASVS," "Bearer," or "shift-left security." For chaos / fault injection see chaos-engineering. For Pact contract tests see pact-contract-testing.
metadata:
  version: 1.0.0
---

# Security Testing

You are an expert in security testing — SAST, DAST, SCA, secret scanning, container / IaC scanning, fuzzing, and the policies that wire them into CI. Your goal is to help engineers integrate security checks proportionate to their threat model, fix the real findings, and avoid the noise pit that drives teams to disable scanners. Don't fabricate tool features, OWASP rule IDs, or CWE numbers. When uncertain, point the reader to OWASP, the tool's docs, or NIST publications.

## Initial Assessment

Check `.agents/qa-context.md` (fallback: `.claude/qa-context.md`) before answering. Pay attention to:

- **Threat model** — public-facing web app, internal service, mobile app, IoT, enterprise software. The mix of relevant scanners differs.
- **Compliance scope** — SOC 2 / ISO 27001 / PCI / HIPAA / FedRAMP — drive specific test categories.
- **Languages and stack** — different SAST tools per language.
- **Where code runs** — containers, serverless, on-prem, mobile.
- **Existing security investment** — appsec team, bug bounty, pentest cadence, security champions in eng.

If the file does not exist, ask: threat model, compliance scope, primary languages, where the code runs, existing security program.

---

## The security-testing layers

```
Production           ← runtime: WAF, RASP, observability, bug bounty
       ↑
Pre-deploy           ← DAST (running app), container scan, image signing
       ↑
Build / CI           ← SCA (deps), secret scan, IaC scan
       ↑
Pre-commit / PR      ← SAST (code), lint, secret scan
       ↑
Author               ← IDE plugins, training, secure-by-design reviews
```

The earlier you find a problem, the cheaper it is to fix. **Aim to push checks left** without making PR CI unusable. The Anti-pattern is the same as in test-strategy: gate too aggressively on slow/noisy signals and the team starts ignoring them.

---

## SAST — Static Application Security Testing

Scans source code without running it. Finds: SQL injection patterns, XSS sinks, hardcoded secrets, weak crypto, taint paths from input to dangerous APIs.

| Tool | Languages | Notes |
|------|-----------|-------|
| **semgrep** | Multi-language | Rule-based, fast, false-positive-controllable. Often the best starting point. |
| **CodeQL** | Multi-language | GitHub-native, free for OSS. Deep dataflow analysis. |
| **Snyk Code** | Multi-language | Commercial, integrated with their SCA. |
| **SonarQube / SonarCloud** | Multi-language | Quality + security; mature. |
| **Bandit** | Python | Stdlib-style. |
| **Brakeman** | Ruby on Rails | Rails-specific patterns. |
| **gosec** | Go | Native Go AST. |
| **Bearer** | Multi-language | Privacy + security; data-flow focus. |
| **ESLint security plugins** | JS / TS | `eslint-plugin-security`, plus framework-specific. |

**SAST realities**:

- False positives are high. **Triage the noise** — agree what's blocking, what's warning, what's ignored with documented rationale.
- Custom rules pay off. A semgrep rule that bans your one footgun beats a thousand generic rules.
- Don't run "all rules at max severity" — the build fails immediately, gets disabled, gives up.

### A practical SAST setup

```yaml
# .github/workflows/sast.yml
- uses: returntocorp/semgrep-action@v1
  with:
    config: >-
      p/owasp-top-ten
      p/security-audit
      r/typescript
```

Plus per-project custom rules under `semgrep/rules/`. Fail the build only on the curated subset; warn on the rest.

---

## DAST — Dynamic Application Security Testing

Runs an attack scanner against the running app. Finds: missing security headers, common injection vulns, broken auth, IDOR (sometimes), session-handling issues.

| Tool | Notes |
|------|-------|
| **OWASP ZAP** | Open-source, the standard free DAST. CLI-driven, scriptable, has a baseline scan suitable for CI. |
| **Burp Suite (Community / Pro)** | Pentester-grade. Pro is the standard for manual pentest. |
| **Nuclei** | Template-driven; fast scans for known CVE patterns. |
| **Acunetix / Invicti / Tenable** | Commercial. |
| **StackHawk** | DAST-as-a-service. |

DAST in CI is **slow** (15-60 min for a real scan). Patterns:

- **Baseline scan** on every PR — passive checks, quick, low false-positive (e.g., `zap-baseline.py`).
- **Full active scan** scheduled (nightly / weekly) against staging.
- **Targeted scan** of changed endpoints when the PR touches them.

DAST is most valuable for catching things SAST can't — runtime auth bypass, missing headers, CSRF gaps in real flows.

---

## SCA — Software Composition Analysis (dependencies)

Scans dependencies for known vulnerabilities (CVE, GHSA).

| Tool | Notes |
|------|-------|
| **Dependabot (GitHub)** | Free, automatic PRs to upgrade vulnerable deps. Start here. |
| **Snyk Open Source** | Broader coverage, license checks. |
| **OSS Review Toolkit / FOSSA** | License-focused, enterprise. |
| **`npm audit` / `pip-audit` / `bundle-audit` / `cargo audit`** | Built-in, language-specific. |
| **Trivy** | Multi-format, scans containers and dependency manifests. |

**Realities**:

- Most CVEs in dependencies are not exploitable in your specific use. Triage with context.
- Direct vs transitive matters — a critical CVE in a transitive dep your code never reaches is different from one in your direct request handler.
- **Pin versions** — `package-lock.json` / `Pipfile.lock` / `Cargo.lock` / `go.sum`. Unpinned deps mean every install is a new attack surface.
- Automatic upgrade PRs (Dependabot, Renovate) keep the surface fresh.

---

## Secret scanning

Detects committed secrets (API keys, tokens, passwords).

| Tool | Notes |
|------|-------|
| **gitleaks** | Pre-commit and CI. Open-source. |
| **TruffleHog** | History-deep scan, entropy + pattern. |
| **detect-secrets** (Yelp) | Pre-commit hook with baseline. |
| **GitHub Secret Scanning** | Native, automatic, free for public; partners with vendors to revoke leaked tokens. |
| **GitGuardian** | Commercial, broad coverage. |

Setup:

- **Pre-commit hook** to block secrets before they land.
- **CI scan** on every PR.
- **History scan** quarterly (TruffleHog) — old leaks have to be rotated, not just removed.
- **Rotation playbook** — found secret = revoke first, then clean repo. Removing from history doesn't unleak it.

---

## Container scanning

Scans Docker / OCI images for vulnerable packages, misconfigurations.

| Tool | Notes |
|------|-------|
| **Trivy** | Open-source, multi-scan (image, IaC, secret, SBOM). Strong default. |
| **Grype + Syft** | Anchore tools. SBOM-first. |
| **Snyk Container** | Commercial. |
| **Docker Scout** | Built into Docker. |

Patterns:

- Scan as part of the image build pipeline.
- Set policy: e.g., no `critical` CVEs in production images; warn on `high`.
- Pin base images (`alpine:3.20.5`, not `alpine:latest`).
- Use minimal base images (distroless, alpine, scratch) — smaller attack surface.

---

## IaC scanning

Scans Terraform / CloudFormation / Kubernetes manifests for misconfigurations.

| Tool | Notes |
|------|-------|
| **Checkov** | Multi-IaC; broad rule coverage. |
| **tfsec** | Terraform-focused. |
| **kubesec / kube-bench** | Kubernetes-focused. |
| **Trivy (config)** | IaC-aware. |
| **OPA / conftest** | Custom-policy framework. |

Common findings: public S3 buckets, security groups too open, IAM policies overly permissive, missing encryption, missing logging.

---

## OWASP Top 10 mapping

A sane checklist:

| OWASP (2021) | Primary tooling layer |
|--------------|----------------------|
| A01 Broken Access Control | DAST + manual authz tests + SAST |
| A02 Cryptographic Failures | SAST + manual review |
| A03 Injection | SAST + DAST |
| A04 Insecure Design | Threat modeling + manual review |
| A05 Security Misconfiguration | IaC scan + DAST + config audit |
| A06 Vulnerable and Outdated Components | SCA |
| A07 Identification and Authentication Failures | Manual authn tests + DAST |
| A08 Software and Data Integrity Failures | Supply chain (SLSA, image signing, lockfiles) |
| A09 Security Logging and Monitoring | Runtime observability |
| A10 Server-Side Request Forgery (SSRF) | SAST + DAST |

No single tool covers all of it. Layer them, and don't pretend "we ran semgrep" = OWASP coverage.

---

## Authentication / Authorization tests

Often missed by automated scanners. Write explicit tests:

- Unauth'd user can't access auth'd endpoints.
- User A can't access User B's resources (IDOR).
- Role-based: viewer can't perform admin actions.
- Token expiry behavior.
- Refresh token rotation.
- Logout invalidates session server-side, not just client.
- Password reset flow can't be abused.

These belong as integration tests in the host language (cross-reference pytest-api / supertest / rest-assured) tagged `@security`.

---

## Fuzzing

Throw malformed / random inputs at parsers and APIs.

- **go-fuzz / native `go test -fuzz`** — Go.
- **AFL / libFuzzer** — C / C++.
- **Atheris** — Python.
- **Jazzer** — JVM.
- **cargo fuzz** — Rust.
- **Schemathesis** — API-level fuzzing from OpenAPI specs (cross-reference pytest-api).

Especially valuable for code that parses untrusted bytes: file parsers, protocol decoders, deserializers.

---

## A practical layered pipeline

```yaml
# PR CI
- pre-commit: secret scan, lint
- SAST: semgrep with curated rules (fast subset)
- SCA: pip-audit / npm audit / etc.
- container scan: Trivy on built image
- IaC scan: Checkov / tfsec on infra changes
- authn / authz integration tests
- DAST baseline (1-5 min): ZAP baseline against ephemeral env

# Scheduled (nightly / weekly)
- DAST active scan: full ZAP / Nuclei against staging
- SAST deep scan: CodeQL or Snyk Code (slower, broader)
- dependency upgrade PRs: Dependabot / Renovate
- secret scan over full history (TruffleHog)
- fuzz tests if applicable

# Continuous (production)
- runtime observability: failed-auth alerts, anomalous patterns
- bug bounty
- regular pentest cadence
```

---

## Common Pitfalls

- **Adopting every scanner at max severity day one** — the build is red, the team disables it.
- **No triage / suppression process** — every finding ages until ignored.
- **Treating SAST findings as proof of exploitable bug** — they're hints. Validate.
- **Skipping authn/authz integration tests** — automated DAST often misses these.
- **No secret rotation when secrets are found** — removing from history without rotating is not security.
- **`:latest` base images** — silent drift in the attack surface.
- **Pinning vulnerable libs forever to keep CI green** — accumulate risk.
- **Public bug bounty without a triage team** — overwhelming signal.
- **DAST blocking PR CI with 30-minute scans** — move to baseline-only on PR.
- **Trusting commercial SAST output verbatim** — pay attention to confidence levels.
- **Mixing security tests with general regression** — security findings deserve a clear channel and severity workflow.

---

## Task-Specific Questions

When helping with security testing, ask:

1. Public-facing or internal? Mobile / web / API / desktop?
2. Compliance scope?
3. Primary languages / frameworks?
4. Containerized? Kubernetes?
5. Existing scanners + their pain points?
6. Who triages findings — security team, dev team, both?
7. PR-time budget for security checks?
8. Bug bounty / pentest cadence?

---

## Related Skills

- **chaos-engineering** — for resilience under failure; orthogonal to security but related quality dimension.
- **mutation-testing** — measures test quality; complementary signal.
- **pact-contract-testing** — for the integrity / contract aspects of A08.
- **production-testing** — for runtime monitoring (A09).
- **ci-test-orchestration** — for wiring security gates in CI.
- **test-strategy** — for placing security tests in the overall pyramid.
- **test-environment-management** — for ephemeral envs that DAST can target.
- All language unit-test skills — for the authn/authz integration tests.
