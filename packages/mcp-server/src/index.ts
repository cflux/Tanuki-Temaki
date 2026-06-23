#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { seriesTools } from './tools/series.js';
import { userTools } from './tools/user.js';
import type { ToolDef } from './tools/types.js';

const server = new McpServer({
  name: 'tanuki-temaki',
  version: '0.1.0',
});

const allTools: ToolDef[] = [...seriesTools, ...userTools];

for (const tool of allTools) {
  // Wrap each handler so any error is reported as a tool result rather than
  // crashing the transport. The SDK validates args against `tool.schema`
  // (a Zod shape) before invoking this callback, and derives the JSON Schema
  // advertised to clients from the same shape.
  const wrapped = async (args: Record<string, unknown>) => {
    try {
      return await tool.handler(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  };

  if (tool.schema) {
    server.tool(tool.name, tool.description, tool.schema, wrapped);
  } else {
    server.tool(tool.name, tool.description, wrapped);
  }
}

const transport = new StdioServerTransport();
await server.connect(transport);
