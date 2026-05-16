# Security Policy

## Reporting a vulnerability

**Do not open a public GitHub issue for security concerns.**

If you find:

- A skill that recommends an insecure testing practice (hardcoded credentials in CI, secrets in test data files, etc.).
- An example that contains real credentials, tokens, or production hostnames.
- A leaked secret in any file in this repo.
- A supply-chain concern in the GitHub Actions workflows or any script under `.github/scripts/`.

please report it privately via one of the following:

1. **GitHub Security Advisories** — open a draft advisory at <https://github.com/aks-builds/quality-skills/security/advisories/new>. This is preferred.
2. **Email** — `its.aks@outlook.com` with the subject prefix `[quality-skills security]`.

Please include:

- The affected file path (e.g., `skills/<skill-name>/SKILL.md` and line number).
- A description of the issue and the potential impact.
- A reference if the issue is a documentation / accuracy concern that intersects with security.

You should receive acknowledgement within 7 days. Coordinated disclosure timelines will be discussed case-by-case; the default is 30 days from acknowledgement to public fix.

## Scope

This repository contains **markdown skill files** plus a small Node script and GitHub Actions workflows. It does not run a server, store data, or process production credentials directly. The security surface is:

- Correctness of testing guidance (most important — bad CI advice has real-world security impact).
- Synthetic-data hygiene in examples.
- Integrity of the workflows under `.github/`.

## Out of scope

- Issues in third-party agent runtimes (Claude Code, Cursor, Windsurf, etc.) — report those to the runtime vendor.
- Vulnerabilities in the tools the skills describe (Selenium, Cypress, Playwright, k6, JMeter, etc.) — report those to the respective project maintainers.
