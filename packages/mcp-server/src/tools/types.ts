import type { ZodRawShape } from 'zod';

export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * A tool definition. `schema` is a Zod raw shape: the MCP SDK validates
 * incoming arguments against it AND derives the JSON Schema advertised to
 * clients via tools/list. Omit `schema` for tools that take no arguments.
 */
export interface ToolDef {
  name: string;
  description: string;
  schema?: ZodRawShape;
  handler: (args: Record<string, any>) => Promise<ToolResult>;
}
