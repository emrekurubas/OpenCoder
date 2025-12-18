import { readFile } from 'fs/promises';
import { Tool, ToolDefinition, ToolResult, ToolContext } from './base.js';
import { resolvePath } from '../utils/paths.js';

export class ReadFileTool extends Tool {
  readonly definition: ToolDefinition = {
    name: 'read_file',
    description: 'Read the contents of a file at the specified path',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to read (absolute or relative to working directory)',
        required: true,
      },
      offset: {
        type: 'number',
        description: 'Line number to start reading from (1-indexed)',
        required: false,
      },
      limit: {
        type: 'number',
        description: 'Maximum number of lines to read',
        required: false,
      },
    },
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const rawPath = params.path as string;
    const offset = (params.offset as number) || 1;
    const limit = (params.limit as number) || 2000;

    if (!rawPath) {
      return this.failure('Path is required');
    }

    const path = resolvePath(rawPath, context.workingDirectory);

    try {
      const content = await readFile(path, 'utf-8');
      const lines = content.split('\n');

      const startLine = Math.max(0, offset - 1);
      const endLine = Math.min(lines.length, startLine + limit);
      const selectedLines = lines.slice(startLine, endLine);

      // Format with line numbers
      const numberedLines = selectedLines.map((line, i) => {
        const lineNum = (startLine + i + 1).toString().padStart(6, ' ');
        return `${lineNum}│ ${line}`;
      });

      const output = numberedLines.join('\n');
      const totalLines = lines.length;
      const shownLines = selectedLines.length;

      let header = `File: ${path} (${totalLines} lines total)`;
      if (shownLines < totalLines) {
        header += `\nShowing lines ${startLine + 1}-${endLine} of ${totalLines}`;
      }

      return this.success(`${header}\n${'─'.repeat(50)}\n${output}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.failure(`File not found: ${path}`);
      }
      if ((error as NodeJS.ErrnoException).code === 'EISDIR') {
        return this.failure(`Path is a directory, not a file: ${path}`);
      }
      return this.failure(`Error reading file: ${error}`);
    }
  }
}
