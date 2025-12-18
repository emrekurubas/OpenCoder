import { writeFile, mkdir } from 'fs/promises';
import { dirname } from 'path';
import { Tool, ToolDefinition, ToolResult, ToolContext } from './base.js';
import { resolvePath } from '../utils/paths.js';

export class WriteFileTool extends Tool {
  readonly definition: ToolDefinition = {
    name: 'write_file',
    description: 'Write content to a file, creating it if it does not exist',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to write (absolute or relative to working directory)',
        required: true,
      },
      content: {
        type: 'string',
        description: 'Content to write to the file',
        required: true,
      },
    },
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const rawPath = params.path as string;
    const content = params.content as string;

    if (!rawPath) {
      return this.failure('Path is required');
    }

    if (content === undefined || content === null) {
      return this.failure('Content is required');
    }

    const path = resolvePath(rawPath, context.workingDirectory);

    try {
      // Ensure parent directory exists
      const dir = dirname(path);
      await mkdir(dir, { recursive: true });

      await writeFile(path, content, 'utf-8');

      const lineCount = content.split('\n').length;
      return this.success(`Successfully wrote ${lineCount} lines to ${path}`);
    } catch (error) {
      return this.failure(`Error writing file: ${error}`);
    }
  }
}
