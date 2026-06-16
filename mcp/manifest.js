import { readdir } from 'fs/promises';
import { parseSkillFile, SKILLS_DIR } from './loader.js';

export async function loadAllSkills() {
  const entries = await readdir(SKILLS_DIR, { withFileTypes: true });
  const results = await Promise.all(
    entries
      .filter(e => e.isDirectory())
      .map(e => parseSkillFile(e.name).catch(() => null))
  );
  return results.filter(Boolean);
}

export function buildToolManifest(skills) {
  return skills.flatMap(skill =>
    (skill.mcp_tools || []).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.input_schema,
      _skillName: skill.name,
    }))
  );
}

export function findSkillForTool(skills, toolName) {
  return skills.find(skill =>
    (skill.mcp_tools || []).some(t => t.name === toolName)
  );
}
