import { Tool, formatToolsForPrompt } from './base.js';
import { ReadFileTool } from './read.js';
import { WriteFileTool } from './write.js';
import { EditFileTool } from './edit.js';
import { BashTool } from './bash.js';
import { GlobTool } from './glob.js';

export { Tool, ToolDefinition, ToolResult, ToolContext, formatToolsForPrompt } from './base.js';
export { ReadFileTool } from './read.js';
export { WriteFileTool } from './write.js';
export { EditFileTool } from './edit.js';
export { BashTool } from './bash.js';
export { GlobTool } from './glob.js';

export function createDefaultTools(): Tool[] {
  return [
    new ReadFileTool(),
    new WriteFileTool(),
    new EditFileTool(),
    new BashTool(),
    new GlobTool(),
  ];
}

export function getToolByName(tools: Tool[], name: string): Tool | undefined {
  return tools.find((t) => t.definition.name === name);
}
