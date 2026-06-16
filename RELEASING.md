# Releasing quality-skills

## Prerequisites

- All PRs merged to `main` (platform + content sprint)
- `ANTHROPIC_API_KEY` secret set in GitHub repo settings (Settings → Secrets → Actions)
- `validate-skill.yml` v2 gate condition removed (after content sprint merges)
- All skills pass `eval-skills.yml` on main

## Verify before tagging

```bash
# Confirm skill count
ls skills/ | wc -l   # expected: 107

# Run cross-reference audit
node scripts/check-xrefs.js   # must exit 0

# Run MCP tests
cd mcp && node --test index.test.js   # 8/8 passing
```

## Tag and release

```bash
git checkout main && git pull
git tag v2.0.0
git push origin v2.0.0
# → triggers release.yml automatically
```

The `release.yml` workflow will:
1. Count skills and update the README badge
2. Bump `metadata.version` in `.claude-plugin/marketplace.json` to `2.0.0`
3. Create a GitHub Release with auto-generated notes

## Anthropic plugin marketplace submission

After the GitHub Release is created:

1. Verify `.claude-plugin/marketplace.json` shows `"version": "2.0.0"`
2. Check the Anthropic plugin marketplace submission channel (check https://github.com/anthropics or Anthropic developer docs for the current process)
3. Submit with repo URL: `https://github.com/aks-builds/quality-skills`
4. Reference the v2.0.0 GitHub Release URL in the submission

> The marketplace submission process may change — check current Anthropic documentation for the latest instructions before submitting.
