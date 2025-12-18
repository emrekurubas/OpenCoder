import { glob } from 'glob';
import { Tool, ToolDefinition, ToolResult, ToolContext } from './base.js';
import { resolvePath } from '../utils/paths.js';

export class GlobTool extends Tool {
  readonly definition: ToolDefinition = {
    name: 'glob',
    description: 'Find files matching a glob pattern. Use patterns like "**/*.ts" or "src/**/*.js"',
    parameters: {
      pattern: {
        type: 'string',
        description: 'Glob pattern to match files',
        required: true,
      },
      cwd: {
        type: 'string',
        description: 'Directory to search in (defaults to context working directory)',
        required: false,
      },
      ignore: {
        type: 'array',
        description: 'Patterns to ignore (e.g., ["node_modules/**", "dist/**"])',
        required: false,
      },
    },
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const pattern = params.pattern as string;
    const rawCwd = params.cwd as string | undefined;
    const cwd = rawCwd ? resolvePath(rawCwd, context.workingDirectory) : context.workingDirectory;
    const ignore = (params.ignore as string[]) || ['node_modules/**', '.git/**', 'dist/**'];

    if (!pattern) {
      return this.failure('Pattern is required');
    }

    try {
      const files = await glob(pattern, {
        cwd,
        ignore,
        nodir: true,
        absolute: true,
      });

      if (files.length === 0) {
        return this.success(`No files found matching pattern: ${pattern}`);
      }

      // Sort by path
      files.sort();

      // Truncate if too many files
      const maxFiles = 100;
      let output: string;
      if (files.length > maxFiles) {
        output = files.slice(0, maxFiles).join('\n');
        output += `\n... and ${files.length - maxFiles} more files`;
      } else {
        output = files.join('\n');
      }

      return this.success(`Found ${files.length} files:\n${output}`);
    } catch (error) {
      return this.failure(`Error searching for files: ${error}`);
    }
  }
}
