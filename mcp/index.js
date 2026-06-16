#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { loadAllSkills, buildToolManifest, findSkillForTool } from './manifest.js';
import { resolveSkillGraph } from './loader.js';

const skills = await loadAllSkills();
const toolManifest = buildToolManifest(skills);

const server = new Server(
  { name: 'quality-skills', version: '2.0.0' },
  { capabilities: { resources: {}, tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolManifest.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const skill = findSkillForTool(skills, name);
  if (!skill) {
    throw new Error(`Unknown tool: ${name}`);
  }
  const content = await resolveSkillGraph(skill, skills);
  const argsBlock = Object.keys(args || {}).length > 0
    ? `\n\n**Call context:** ${JSON.stringify(args, null, 2)}`
    : '';
  return {
    content: [{ type: 'text', text: content + argsBlock }],
  };
});

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: skills.map(skill => ({
    uri: `skills://${skill.name}`,
    name: skill.name,
    description: skill.description || skill.name,
    mimeType: 'text/markdown',
  })),
}));

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const skillName = request.params.uri.replace('skills://', '');
  const skill = skills.find(s => s.name === skillName);
  if (!skill) {
    throw new Error(`Resource not found: ${request.params.uri}`);
  }
  return {
    contents: [{
      uri: request.params.uri,
      mimeType: 'text/markdown',
      text: skill.content,
    }],
  };
});

const transport = new StdioServerTransport();
await server.connect(transport);
