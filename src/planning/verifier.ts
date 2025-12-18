import { exec } from 'child_process';
import { promisify } from 'util';
import { VerificationResult } from './types.js';

const execAsync = promisify(exec);

export class Verifier {
  private workingDirectory: string;
  private timeout: number;

  constructor(workingDirectory: string, timeout: number = 60000) {
    this.workingDirectory = workingDirectory;
    this.timeout = timeout;
  }

  async runCommand(command: string): Promise<VerificationResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.workingDirectory,
        timeout: this.timeout,
        maxBuffer: 10 * 1024 * 1024,
        shell: '/bin/bash',
      });

      const output = stdout + (stderr ? `\nstderr:\n${stderr}` : '');

      return {
        success: true,
        command,
        output: output.trim() || '(completed with no output)',
        exitCode: 0,
      };
    } catch (error) {
      const execError = error as Error & {
        stdout?: string;
        stderr?: string;
        code?: number;
        killed?: boolean;
      };

      let output = '';
      if (execError.stdout) output += execError.stdout;
      if (execError.stderr) output += (output ? '\n' : '') + execError.stderr;
      if (!output && execError.message) output = execError.message;

      return {
        success: false,
        command,
        output: output.trim(),
        exitCode: execError.code || 1,
      };
    }
  }

  async runBuild(buildCommand: string): Promise<VerificationResult> {
    return this.runCommand(buildCommand);
  }

  async runTests(testCommand: string): Promise<VerificationResult> {
    return this.runCommand(testCommand);
  }

  async runLint(lintCommand: string): Promise<VerificationResult> {
    return this.runCommand(lintCommand);
  }

  async verifyAll(commands: {
    build?: string;
    test?: string;
    lint?: string;
  }): Promise<{ success: boolean; results: VerificationResult[] }> {
    const results: VerificationResult[] = [];
    let allSuccess = true;

    // Run in order: lint -> build -> test
    if (commands.lint) {
      const result = await this.runLint(commands.lint);
      results.push(result);
      if (!result.success) allSuccess = false;
    }

    if (commands.build && allSuccess) {
      const result = await this.runBuild(commands.build);
      results.push(result);
      if (!result.success) allSuccess = false;
    }

    if (commands.test && allSuccess) {
      const result = await this.runTests(commands.test);
      results.push(result);
      if (!result.success) allSuccess = false;
    }

    return { success: allSuccess, results };
  }

  formatResults(results: VerificationResult[]): string {
    return results.map(r => {
      const icon = r.success ? '✓' : '✗';
      const status = r.success ? 'PASS' : 'FAIL';
      let output = `${icon} ${status}: ${r.command}`;
      if (!r.success && r.output) {
        // Truncate long output
        const maxLen = 500;
        const truncated = r.output.length > maxLen
          ? r.output.substring(0, maxLen) + '...'
          : r.output;
        output += `\n${truncated}`;
      }
      return output;
    }).join('\n\n');
  }
}
