import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import matter from 'gray-matter';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const SKILLS_DIR = join(__dirname, '..', 'skills');

export async function parseSkillFile(skillName) {
  const filePath = join(SKILLS_DIR, skillName, 'SKILL.md');
  const raw = await readFile(filePath, 'utf8');
  const { data: frontmatter, content } = matter(raw);
  return { name: skillName, ...frontmatter, content };
}

export async function loadSkillContent(skillName, allSkills) {
  const skill = allSkills.find(s => s.name === skillName);
  if (!skill) throw new Error(`Skill not found: ${skillName}`);
  return skill.content;
}

// Resolves one level of depends_on. Transitive (multi-hop) dependencies are not traversed —
// if a depended-on skill itself has depends_on, those are silently excluded.
export async function resolveSkillGraph(skill, allSkills) {
  const deps = Array.isArray(skill.depends_on) ? skill.depends_on : [];
  const depContents = await Promise.all(
    deps.map(dep => loadSkillContent(dep, allSkills))
  );
  const sections = [...depContents, skill.content];
  return sections.join('\n\n---\n\n');
}
