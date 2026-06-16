#!/usr/bin/env node
// Cross-reference audit: every skill must have ## Related Skills with ≥3 skill links.
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(__dirname, '..', 'skills');
const MIN_LINKS = 3;
const issues = [];

for (const dir of readdirSync(SKILLS_DIR, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  let content;
  try {
    content = readFileSync(join(SKILLS_DIR, dir.name, 'SKILL.md'), 'utf8');
  } catch {
    issues.push(`${dir.name}: cannot read SKILL.md`);
    continue;
  }

  const match = content.match(/## Related Skills([\s\S]*?)(?=\n## |\n---|\s*$)/);
  if (!match) {
    issues.push(`${dir.name}: missing "## Related Skills" section`);
    continue;
  }

  const links = match[1].match(/`[a-z][a-z0-9-]+`/g) || [];
  if (links.length < MIN_LINKS) {
    issues.push(`${dir.name}: only ${links.length} related skill link(s) — needs ≥ ${MIN_LINKS}`);
  }
}

if (issues.length === 0) {
  console.log(`✅ All skills have ≥${MIN_LINKS} Related Skills links.`);
  process.exit(0);
} else {
  console.error(`❌ ${issues.length} skill(s) need Related Skills attention:\n` + issues.join('\n'));
  process.exit(1);
}
