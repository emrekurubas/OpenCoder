export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  default?: unknown;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, ToolParameter>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ToolContext {
  workingDirectory: string;
}

export abstract class Tool {
  abstract readonly definition: ToolDefinition;

  abstract execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult>;

  protected success(output: string): ToolResult {
    return { success: true, output };
  }

  protected failure(error: string): ToolResult {
    return { success: false, output: '', error };
  }
}

export function formatToolsForPrompt(tools: Tool[]): string {
  const toolDescriptions = tools.map((tool) => {
    const params = Object.entries(tool.definition.parameters)
      .map(([name, param]) => {
        const required = param.required !== false ? ' (required)' : '';
        return `    - ${name}: ${param.type}${required} - ${param.description}`;
      })
      .join('\n');

    return `- ${tool.definition.name}: ${tool.definition.description}\n  Parameters:\n${params}`;
  });

  return `YOU HAVE ACCESS TO THESE TOOLS - USE THEM:
${toolDescriptions.join('\n\n')}

HOW TO USE TOOLS:
Output a tool call like this (the system will execute it):
<tool_call>
{"name": "write_file", "parameters": {"path": "game.py", "content": "import curses\\n..."}}
</tool_call>

EXAMPLE - Creating a Python file:
<tool_call>
{"name": "write_file", "parameters": {"path": "hello.py", "content": "print('Hello World!')"}}
</tool_call>

YOU CAN CREATE FILES. YOU CAN RUN COMMANDS. USE THE TOOLS ABOVE.
Do NOT say you cannot create files - use write_file instead.
Do NOT put code in markdown blocks - use write_file to save it.`;
}
