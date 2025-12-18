import { readFile, writeFile } from 'fs/promises';
import { Tool, ToolDefinition, ToolResult, ToolContext } from './base.js';
import { resolvePath } from '../utils/paths.js';

export class EditFileTool extends Tool {
  readonly definition: ToolDefinition = {
    name: 'edit_file',
    description: 'Edit a file. Modes: "replace" (default) finds and replaces old_string with new_string. "insert" adds new_string at a position. "append" adds new_string at end of file.',
    parameters: {
      path: {
        type: 'string',
        description: 'Path to the file to edit (absolute or relative to working directory)',
        required: true,
      },
      mode: {
        type: 'string',
        description: 'Edit mode: "replace" (find/replace), "insert" (insert at line), "append" (add to end). Default: replace',
        required: false,
      },
      old_string: {
        type: 'string',
        description: 'For replace mode: the exact string to find and replace',
        required: false,
      },
      new_string: {
        type: 'string',
        description: 'The new content (replacement text, text to insert, or text to append)',
        required: true,
      },
      line_number: {
        type: 'number',
        description: 'For insert mode: line number to insert before (1-indexed)',
        required: false,
      },
      replace_all: {
        type: 'boolean',
        description: 'For replace mode: replace all occurrences instead of just the first',
        required: false,
      },
    },
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const rawPath = params.path as string;
    const mode = (params.mode as string) || 'replace';
    const oldString = params.old_string as string;
    const newString = params.new_string as string;
    const lineNumber = params.line_number as number;
    const replaceAll = (params.replace_all as boolean) ?? false;

    if (!rawPath) {
      return this.failure('Path is required');
    }

    if (newString === undefined || newString === null) {
      return this.failure('new_string is required');
    }

    const path = resolvePath(rawPath, context.workingDirectory);

    try {
      const content = await readFile(path, 'utf-8');

      let newContent: string;
      let message: string;

      switch (mode) {
        case 'append':
          // Append to end of file
          newContent = content.endsWith('\n')
            ? content + newString
            : content + '\n' + newString;
          message = `Successfully appended content to ${path}`;
          break;

        case 'insert':
          if (!lineNumber || lineNumber < 1) {
            return this.failure('line_number is required for insert mode and must be >= 1');
          }
          const lines = content.split('\n');
          const insertIdx = Math.min(lineNumber - 1, lines.length);
          lines.splice(insertIdx, 0, newString);
          newContent = lines.join('\n');
          message = `Successfully inserted content at line ${lineNumber} in ${path}`;
          break;

        case 'replace':
        default:
          if (!oldString) {
            return this.failure('old_string is required for replace mode');
          }

          if (!content.includes(oldString)) {
            return this.failure(
              `Could not find the specified string in ${path}. Make sure the old_string matches exactly, including whitespace and indentation.`
            );
          }

          // Count occurrences
          const occurrences = content.split(oldString).length - 1;

          if (occurrences > 1 && !replaceAll) {
            return this.failure(
              `Found ${occurrences} occurrences of the string. Set replace_all: true to replace all, or provide more context to make the match unique.`
            );
          }

          if (replaceAll) {
            newContent = content.split(oldString).join(newString);
            message = `Successfully replaced ${occurrences} occurrence(s) in ${path}`;
          } else {
            newContent = content.replace(oldString, newString);
            message = `Successfully replaced 1 occurrence in ${path}`;
          }
          break;
      }

      await writeFile(path, newContent, 'utf-8');
      return this.success(message);

    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return this.failure(`File not found: ${path}`);
      }
      return this.failure(`Error editing file: ${error}`);
    }
  }
}
