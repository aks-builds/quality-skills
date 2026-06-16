# SKILL.md v2 Specification

## New Frontmatter Fields (v2.0.0)

Five fields added to every skill's YAML frontmatter. All are required in v2.

### `depends_on` (array of strings)

Explicit skill dependency chain. The MCP skill-graph resolver loads these before
the current skill's content.

```yaml
depends_on:
  - qa-context
```

### `tags` (array of strings)

Searchable labels. Use lowercase kebab-case. Minimum 2, maximum 8.

```yaml
tags:
  - browser
  - e2e
  - typescript
  - automation
```

### `audience` (array of strings)

Who this skill is for. Valid values: `qa-engineer`, `sdet`, `developer`,
`architect`, `devops`, `clinician`, `informatics-engineer`, `compliance-officer`.

```yaml
audience:
  - qa-engineer
  - sdet
  - developer
```

### `bundle` (string)

Which repo/plugin this skill belongs to. Must match the repo name exactly.

```yaml
bundle: quality-skills
```

Valid values: `quality-skills`, `healthcare-skills`

### `mcp_tools` (array of objects)

Typed MCP tool declarations. Each skill declares 2–3 tools. Each tool must have
`name`, `description`, and `input_schema` (valid JSON Schema object).

Tool names must follow the pattern `<skill_name_underscored>_<action>`.

**Action vocabulary:** `scaffold`, `debug`, `audit`, `migrate`, `checklist`,
`validate`, `generate`, `troubleshoot`

```yaml
mcp_tools:
  - name: playwright_scaffold
    description: "Generate a Playwright test for a given URL or component"
    input_schema:
      type: object
      properties:
        target:
          type: string
          description: "URL or component path to test"
        language:
          type: string
          enum: [ts, js, py]
          default: ts
      required: [target]
  - name: playwright_debug
    description: "Diagnose a failing Playwright test from its error output"
    input_schema:
      type: object
      properties:
        error:
          type: string
          description: "Full error message or stack trace"
        test_code:
          type: string
          description: "The test that is failing (optional)"
      required: [error]
  - name: playwright_audit
    description: "Review an existing Playwright test suite for anti-patterns"
    input_schema:
      type: object
      properties:
        focus:
          type: string
          enum: [locators, fixtures, parallelism, ci, all]
          default: all
```

## Complete v2 Frontmatter Example

```yaml
---
name: playwright
description: When the user wants to design, implement, debug, or scale Playwright tests…
metadata:
  version: 2.0.0
  author: aks-builds
  license: MIT
depends_on:
  - qa-context
tags:
  - browser
  - e2e
  - typescript
  - automation
audience:
  - qa-engineer
  - sdet
  - developer
bundle: quality-skills
mcp_tools:
  - name: playwright_scaffold
    description: "Generate a Playwright test for a given URL or component"
    input_schema:
      type: object
      properties:
        target: { type: string }
        language: { type: string, enum: [ts, js, py], default: ts }
      required: [target]
  - name: playwright_debug
    description: "Diagnose a failing Playwright test from its error output"
    input_schema:
      type: object
      properties:
        error: { type: string }
      required: [error]
  - name: playwright_audit
    description: "Review an existing Playwright test suite for anti-patterns"
    input_schema:
      type: object
      properties:
        focus: { type: string, enum: [locators, fixtures, parallelism, ci, all], default: all }
---
```
