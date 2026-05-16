#!/usr/bin/env node
/**
 * Sync marketplace.json and README.md with skills directory.
 *
 * Scans the skills/ directory for valid skills (directories containing SKILL.md)
 * and updates marketplace.json and the README skills table to match.
 */

const fs = require("fs");
const path = require("path");

const SKILLS_DIR = "skills";
const MARKETPLACE_FILE = ".claude-plugin/marketplace.json";
const README_FILE = "README.md";

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const frontmatter = {};
  const lines = match[1].split("\n");

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    frontmatter[key] = value;
  }

  return frontmatter;
}

function getSkillsWithMetadata() {
  if (!fs.existsSync(SKILLS_DIR)) {
    return [];
  }

  return fs
    .readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) return false;
      const skillFile = path.join(SKILLS_DIR, entry.name, "SKILL.md");
      return fs.existsSync(skillFile);
    })
    .map((entry) => {
      const skillFile = path.join(SKILLS_DIR, entry.name, "SKILL.md");
      const content = fs.readFileSync(skillFile, "utf8");
      const frontmatter = parseFrontmatter(content);

      return {
        dir: entry.name,
        path: `./${SKILLS_DIR}/${entry.name}`,
        name: frontmatter.name || entry.name,
        description: frontmatter.description || "",
      };
    })
    .sort((a, b) => {
      if (a.dir === "qa-context") return -1;
      if (b.dir === "qa-context") return 1;
      return a.name.localeCompare(b.name);
    });
}

function updateSkillCount(description, count) {
  return description.replace(/\d+ quality engineering skills/, `${count} quality engineering skills`);
}

function shortenDescription(description, maxLength = 130) {
  let s = description.split(/\.\s/)[0].trim().replace(/\.$/, "");

  s = s.replace(
    /^When the user (?:wants to|is|needs to|wants|needs|is building|is designing|is processing|is preparing)\s+/i,
    ""
  );
  s = s.charAt(0).toUpperCase() + s.slice(1);

  if (s.length > maxLength) {
    const truncated = s.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");
    return truncated.slice(0, lastSpace > 0 ? lastSpace : maxLength).replace(/[,;:\s]+$/, "") + "…";
  }

  return s + ".";
}

function generateSkillsTable(skills) {
  const header = "| Skill | Description |\n|-------|-------------|";
  const rows = skills.map((skill) => {
    const link = `[${skill.name}](skills/${skill.dir}/)`;
    const description = shortenDescription(skill.description);
    return `| ${link} | ${description} |`;
  });

  return [header, ...rows].join("\n");
}

function updateReadme(skills) {
  const content = fs.readFileSync(README_FILE, "utf8");

  const tableRegex = /(<!-- SKILLS:START -->\n)[\s\S]*?(\n<!-- SKILLS:END -->)/;
  const newTable = generateSkillsTable(skills);

  if (!tableRegex.test(content)) {
    console.log("WARNING: Could not find skill markers in README.md");
    return false;
  }

  const newContent = content.replace(tableRegex, `$1${newTable}$2`);

  if (newContent === content) {
    return false;
  }

  fs.writeFileSync(README_FILE, newContent);
  return true;
}

function updateMarketplace(skills) {
  const marketplace = JSON.parse(fs.readFileSync(MARKETPLACE_FILE, "utf8"));
  const plugin = marketplace.plugins[0];
  const existingSkills = plugin.skills || [];
  const currentSkills = skills.map((s) => s.path);

  if (JSON.stringify(currentSkills) === JSON.stringify(existingSkills)) {
    return { updated: false };
  }

  plugin.skills = currentSkills;
  plugin.description = updateSkillCount(plugin.description, currentSkills.length);

  fs.writeFileSync(MARKETPLACE_FILE, JSON.stringify(marketplace, null, 2) + "\n");

  const added = currentSkills.filter((s) => !existingSkills.includes(s));
  const removed = existingSkills.filter((s) => !currentSkills.includes(s));

  return { updated: true, added, removed };
}

function main() {
  const skills = getSkillsWithMetadata();

  const marketplaceResult = updateMarketplace(skills);
  const readmeUpdated = updateReadme(skills);

  if (!marketplaceResult.updated && !readmeUpdated) {
    console.log("Everything is already in sync");
    return;
  }

  if (marketplaceResult.updated) {
    if (marketplaceResult.added.length) {
      console.log(`Added: ${marketplaceResult.added.join(", ")}`);
    }
    if (marketplaceResult.removed.length) {
      console.log(`Removed: ${marketplaceResult.removed.join(", ")}`);
    }
    console.log(`Updated marketplace.json (${skills.length} skills)`);
  }

  if (readmeUpdated) {
    console.log("Updated README.md skills table");
  }
}

main();
