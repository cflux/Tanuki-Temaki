#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { seriesTools } from './tools/series.js';
import { userTools } from './tools/user.js';

const server = new McpServer({
  name: 'tanuki-temaki',
  version: '0.1.0',
});

const allTools = [...seriesTools, ...userTools];

for (const tool of allTools) {
  server.tool(
    tool.name,
    tool.description,
    tool.inputSchema.properties as Record<string, unknown>,
    async (args: Record<string, unknown>) => {
      try {
        return await tool.handler(args);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: 'text' as const, text: `Error: ${message}` }],
          isError: true,
        };
      }
    }
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
