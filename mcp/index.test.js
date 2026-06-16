import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadAllSkills, buildToolManifest, findSkillForTool } from './manifest.js';
import { resolveSkillGraph } from './loader.js';

describe('loadAllSkills', () => {
  test('loads at least one skill', async () => {
    const skills = await loadAllSkills();
    assert.ok(skills.length > 0, 'Expected at least one skill to load');
  });

  test('each skill has a name and content', async () => {
    const skills = await loadAllSkills();
    for (const skill of skills) {
      assert.ok(typeof skill.name === 'string', `skill.name must be a string, got ${typeof skill.name}`);
      assert.ok(typeof skill.content === 'string', `${skill.name}.content must be a string`);
    }
  });
});

describe('buildToolManifest', () => {
  test('returns an array', async () => {
    const skills = await loadAllSkills();
    const manifest = buildToolManifest(skills);
    assert.ok(Array.isArray(manifest));
  });

  test('each tool has name, description, inputSchema, _skillName', async () => {
    const skills = await loadAllSkills();
    const manifest = buildToolManifest(skills);
    for (const tool of manifest) {
      assert.ok(tool.name, `tool.name missing`);
      assert.ok(tool.description, `${tool.name}: description missing`);
      assert.ok(tool.inputSchema, `${tool.name}: inputSchema missing`);
      assert.ok(tool._skillName, `${tool.name}: _skillName missing`);
    }
  });

  test('tool names follow <skill>_<action> pattern', async () => {
    const skills = await loadAllSkills();
    const manifest = buildToolManifest(skills);
    for (const tool of manifest) {
      assert.match(
        tool.name,
        /^[a-z][a-z0-9_]*_[a-z]+$/,
        `${tool.name}: must match pattern <skill>_<action>`
      );
    }
  });
});

describe('findSkillForTool', () => {
  test('returns undefined for unknown tool', async () => {
    const skills = await loadAllSkills();
    const result = findSkillForTool(skills, 'nonexistent_tool_xyz');
    assert.equal(result, undefined); // Array.find returns undefined, not null
  });
});

describe('resolveSkillGraph', () => {
  test('returns skill content when depends_on is empty', async () => {
    const skills = await loadAllSkills();
    const skill = { name: 'test-skill', content: 'test content', depends_on: [] };
    const result = await resolveSkillGraph(skill, skills);
    assert.equal(result, 'test content');
  });

  test('prepends dependency content when depends_on is set', async () => {
    const skills = await loadAllSkills();
    const depSkill = skills[0];
    if (!depSkill) return;
    const skill = {
      name: 'test-consumer',
      content: 'consumer content',
      depends_on: [depSkill.name],
    };
    const result = await resolveSkillGraph(skill, skills);
    assert.ok(result.includes(depSkill.content), 'Expected dep content to be prepended');
    assert.ok(result.includes('consumer content'), 'Expected own content to be present');
  });
});
