import { Agent } from '../agent/agent.js';
import { ConversationContext, createContext, clearContext, addUserMessage } from '../agent/context.js';
import { PlanManager } from './plan-manager.js';
import { Verifier } from './verifier.js';
import { Task, ExecutionResult, PlanConfig, DEFAULT_PLAN_CONFIG } from './types.js';
import chalk from 'chalk';

export interface ExecutorCallbacks {
  onTaskStart?: (task: Task) => void;
  onTaskComplete?: (task: Task, result: ExecutionResult) => void;
  onTaskFailed?: (task: Task, error: string, willRetry: boolean) => void;
  onVerification?: (success: boolean, output: string) => void;
  onProgress?: (completed: number, total: number) => void;
  onPlanComplete?: (success: boolean) => void;
}

export class Executor {
  private agent: Agent;
  private planManager: PlanManager;
  private verifier: Verifier;
  private config: PlanConfig;
  private callbacks: ExecutorCallbacks;
  private context: ConversationContext;
  private isRunning: boolean = false;
  private shouldStop: boolean = false;

  constructor(
    agent: Agent,
    planManager: PlanManager,
    workingDirectory: string,
    config: Partial<PlanConfig> = {},
    callbacks: ExecutorCallbacks = {}
  ) {
    this.agent = agent;
    this.planManager = planManager;
    this.verifier = new Verifier(workingDirectory);
    this.config = { ...DEFAULT_PLAN_CONFIG, ...config };
    this.callbacks = callbacks;
    this.context = createContext(workingDirectory);
  }

  stop(): void {
    this.shouldStop = true;
  }

  get running(): boolean {
    return this.isRunning;
  }

  async execute(): Promise<boolean> {
    if (!this.planManager.isApproved) {
      throw new Error('Plan must be approved before execution');
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.planManager.startExecution();

    const plan = this.planManager.currentPlan!;
    let allSuccess = true;

    // Add plan context to conversation
    const planContext = `You are implementing a plan. Here's the overall goal and context:

Goal: ${plan.goal}

Summary: ${plan.summary}

You will receive individual tasks to implement. After each task, the build/tests will be run to verify your work.
If something fails, you'll be asked to fix it. Focus on completing one task at a time.`;

    addUserMessage(this.context, planContext);

    while (!this.shouldStop) {
      const task = this.planManager.getNextTask();
      if (!task) break;

      this.callbacks.onTaskStart?.(task);
      this.planManager.markTaskInProgress(task.id);

      const result = await this.executeTask(task);

      if (result.success) {
        this.planManager.markTaskCompleted(task.id);
        this.callbacks.onTaskComplete?.(task, result);
      } else {
        const willRetry = task.attempts < task.maxAttempts;
        this.planManager.markTaskFailed(task.id, result.output);
        this.callbacks.onTaskFailed?.(task, result.output, willRetry);

        if (!willRetry) {
          allSuccess = false;
          if (this.config.stopOnFirstFailure) {
            break;
          }
        }
      }

      const progress = this.planManager.getProgress();
      this.callbacks.onProgress?.(progress.completed, progress.total);
    }

    this.isRunning = false;

    const finalSuccess = this.planManager.currentPlan?.status === 'completed';
    this.callbacks.onPlanComplete?.(finalSuccess);

    return finalSuccess;
  }

  private async executeTask(task: Task): Promise<ExecutionResult> {
    const prompt = this.buildTaskPrompt(task);

    try {
      const response = await this.agent.run(prompt, this.context);

      // Run verification if configured
      let verification = undefined;
      const plan = this.planManager.currentPlan!;

      if (this.config.runBuildAfterEachTask && plan.verifyCommands.build) {
        verification = await this.verifier.runBuild(plan.verifyCommands.build);
        this.callbacks.onVerification?.(verification.success, verification.output);

        if (!verification.success) {
          // Try to fix the error
          const fixResult = await this.attemptFix(task, verification.output);
          if (fixResult.success) {
            // Re-verify
            verification = await this.verifier.runBuild(plan.verifyCommands.build);
            this.callbacks.onVerification?.(verification.success, verification.output);
          }
        }
      }

      if (this.config.runTestAfterEachTask && plan.verifyCommands.test && verification?.success !== false) {
        const testResult = await this.verifier.runTests(plan.verifyCommands.test);
        this.callbacks.onVerification?.(testResult.success, testResult.output);

        if (!testResult.success) {
          verification = testResult;
        }
      }

      return {
        task,
        success: verification?.success !== false,
        output: response,
        verification,
      };
    } catch (error) {
      return {
        task,
        success: false,
        output: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildTaskPrompt(task: Task): string {
    const attemptInfo = task.attempts > 0
      ? `\n\nThis is attempt ${task.attempts + 1}/${task.maxAttempts}. Previous attempt failed with: ${task.error}`
      : '';

    return `## Task: ${task.title}

${task.description}${attemptInfo}

Instructions:
- Implement this specific task only
- Use the tools to create/modify files as needed
- Be thorough but focused on this task
- After you're done, the build will be run to verify your changes`;
  }

  private async attemptFix(task: Task, error: string): Promise<{ success: boolean; output: string }> {
    const fixPrompt = `The build/test failed after implementing "${task.title}".

Error output:
\`\`\`
${error}
\`\`\`

Please analyze the error and fix the issue. Use the tools to read the relevant files, understand the problem, and make the necessary corrections.`;

    try {
      const response = await this.agent.run(fixPrompt, this.context);
      return { success: true, output: response };
    } catch (err) {
      return { success: false, output: err instanceof Error ? err.message : String(err) };
    }
  }

  formatStatus(): string {
    const plan = this.planManager.currentPlan;
    if (!plan) return 'No plan loaded.';

    const progress = this.planManager.getProgress();
    const lines: string[] = [
      chalk.cyan.bold('Execution Status'),
      '',
      `Plan: ${plan.goal}`,
      `Status: ${plan.status}`,
      `Progress: ${progress.completed}/${progress.total} (${progress.percentage}%)`,
      '',
      'Tasks:',
    ];

    for (const task of plan.tasks) {
      const icon = {
        pending: '⬜',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌',
        skipped: '⏭️',
      }[task.status];

      lines.push(`  ${icon} ${task.title}${task.attempts > 0 ? ` (attempt ${task.attempts})` : ''}`);
    }

    return lines.join('\n');
  }
}
