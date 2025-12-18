import { exec } from 'child_process';
import { promisify } from 'util';
import { Tool, ToolDefinition, ToolResult, ToolContext } from './base.js';
import { resolvePath } from '../utils/paths.js';

const execAsync = promisify(exec);

export class BashTool extends Tool {
  readonly definition: ToolDefinition = {
    name: 'bash',
    description: 'Execute a bash command and return the output. Use for running tests, git commands, npm scripts, etc.',
    parameters: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
        required: true,
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command (defaults to context working directory)',
        required: false,
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 60000)',
        required: false,
      },
    },
  };

  async execute(params: Record<string, unknown>, context: ToolContext): Promise<ToolResult> {
    const command = params.command as string;
    const rawCwd = params.cwd as string | undefined;
    const cwd = rawCwd ? resolvePath(rawCwd, context.workingDirectory) : context.workingDirectory;
    const timeout = (params.timeout as number) || 60000;

    if (!command) {
      return this.failure('Command is required');
    }

    // Basic security check - block obviously dangerous commands
    const dangerousPatterns = [
      /rm\s+-rf\s+\/(?!\w)/,  // rm -rf /
      /:\(\)\{.*\}/,          // fork bomb
      /mkfs\./,               // filesystem formatting
      /dd\s+if=/,             // dd with if=
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(command)) {
        return this.failure('This command has been blocked for safety reasons.');
      }
    }

    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer
        shell: '/bin/bash',
      });

      let output = '';
      if (stdout) {
        output += stdout;
      }
      if (stderr) {
        output += (output ? '\n' : '') + `stderr:\n${stderr}`;
      }

      if (!output.trim()) {
        output = '(Command completed with no output)';
      }

      // Truncate if too long
      const maxLength = 30000;
      if (output.length > maxLength) {
        output = output.substring(0, maxLength) + '\n... (output truncated)';
      }

      return this.success(output);
    } catch (error) {
      const execError = error as Error & { stdout?: string; stderr?: string; code?: number };

      let errorOutput = `Command failed`;
      if (execError.code) {
        errorOutput += ` with exit code ${execError.code}`;
      }
      if (execError.stdout) {
        errorOutput += `\nstdout:\n${execError.stdout}`;
      }
      if (execError.stderr) {
        errorOutput += `\nstderr:\n${execError.stderr}`;
      }
      if (!execError.stdout && !execError.stderr && execError.message) {
        errorOutput += `\n${execError.message}`;
      }

      return this.failure(errorOutput);
    }
  }
}
