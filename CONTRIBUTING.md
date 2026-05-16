# Contributing

Thanks for your interest in improving these skills. Test automation guidance ends up shaping CI pipelines and production confidence, so we hold contributions to a high standard for accuracy.

## Before You Submit

1. **Read [AGENTS.md](AGENTS.md)** — covers the spec, naming rules, and QA-specific authoring rules.
2. **Verify your claims** — CLI flags, config keys, API signatures, and version-gated features must be sourced. Cite the authoritative docs where relevant.
3. **No real credentials or hostnames** — every example must use synthetic data.

## Adding a New Skill

1. Create `skills/your-skill-name/SKILL.md` with valid YAML frontmatter (`name`, `description`, `metadata.version`).
2. Keep `SKILL.md` under 500 lines. Push detailed reference material to `skills/your-skill-name/references/`.
3. Add `skills/your-skill-name/evals/evals.json` with 5-6 evals (mainline, sub-task, casual phrasing, multi-step, off-scope handoff).
4. Cross-reference at least 3 related skills at the bottom of the file under **Related Skills**.
5. Add the skill to:
   - The skills table in `README.md` (the `sync-skills.js` workflow does this automatically once you push to `main`).
   - `VERSIONS.md` with the initial version.
6. Open a PR with the conventional commit format: `feat: add your-skill-name skill`.

## Improving an Existing Skill

- Bump `metadata.version` in the frontmatter (semver: patch for typo, minor for new section, major for breaking restructure).
- Update `VERSIONS.md`.
- Use the commit prefix `fix:` (correctness) or `docs:` (clarity).

## Reporting Errors

If you find a wrong CLI flag, an incorrect API signature, an outdated config key, or version-confused guidance: **open an issue immediately**, even if you don't have a fix. Errors in this kind of content propagate into real CI pipelines and silently break test suites.
