import { Agent } from '../../agent/agent.js';
import { ConversationContext } from '../../agent/index.js';
import { PlanManager, Planner, Executor, ExecutorCallbacks } from '../../planning/index.js';
import chalk from 'chalk';

export interface PlanningContext {
  planManager: PlanManager;
  executor: Executor | null;
  planner: Planner | null;
}

export function createPlanningContext(workingDirectory: string): PlanningContext {
  return {
    planManager: new PlanManager(workingDirectory),
    executor: null,
    planner: null,
  };
}

export async function createPlan(
  goal: string,
  agent: Agent,
  planningContext: PlanningContext,
  workingDirectory: string
): Promise<void> {
  const { planManager } = planningContext;

  if (planManager.hasPlan && planManager.currentPlan?.status !== 'completed') {
    console.log(chalk.yellow('\nA plan already exists. Use /plan-clear to remove it first.\n'));
    return;
  }

  const planner = new Planner(agent, planManager, workingDirectory);
  planningContext.planner = planner;

  console.log(chalk.cyan('\nCreating implementation plan...'));
  console.log(chalk.gray('The AI will explore the codebase and design a plan.\n'));

  try {
    const result = await planner.createPlan(goal);

    if (result.success && result.plan) {
      console.log(chalk.green('\n✓ Plan created successfully!'));

      // Save plan to disk
      try {
        const planPath = await planManager.savePlan();
        console.log(chalk.gray(`Plan saved to: ${planPath}`));
      } catch (saveError) {
        console.log(chalk.yellow(`Could not save plan to disk: ${saveError}`));
      }

      console.log('\n' + planManager.formatPlanAsMarkdown());
      console.log(chalk.cyan('\nReview the plan above.'));
      console.log(chalk.gray('Use /plan-approve to approve and start execution.'));
      console.log(chalk.gray('Use /plan-clear to discard and start over.\n'));
    } else {
      console.log(chalk.red(`\n✗ Could not create plan: ${result.error}\n`));
    }
  } catch (error) {
    console.log(chalk.red(`\n✗ Error creating plan: ${error instanceof Error ? error.message : error}\n`));
  }
}

export function approvePlan(planningContext: PlanningContext): boolean {
  const { planManager } = planningContext;

  if (!planManager.hasPlan) {
    console.log(chalk.yellow('\nNo plan to approve. Use /plan <goal> to create one.\n'));
    return false;
  }

  if (planManager.isApproved) {
    console.log(chalk.yellow('\nPlan is already approved.\n'));
    return false;
  }

  const approved = planManager.approvePlan();
  if (approved) {
    console.log(chalk.green('\n✓ Plan approved!'));
    console.log(chalk.gray('Use /plan-run to start execution.\n'));
    return true;
  } else {
    console.log(chalk.red('\nFailed to approve plan.\n'));
    return false;
  }
}

export async function executePlan(
  agent: Agent,
  planningContext: PlanningContext,
  workingDirectory: string
): Promise<void> {
  const { planManager } = planningContext;

  if (!planManager.hasPlan) {
    console.log(chalk.yellow('\nNo plan to execute. Use /plan <goal> to create one.\n'));
    return;
  }

  if (!planManager.isApproved) {
    console.log(chalk.yellow('\nPlan must be approved first. Use /plan-approve.\n'));
    return;
  }

  const callbacks: ExecutorCallbacks = {
    onTaskStart: (task) => {
      console.log(chalk.cyan(`\n▶ Starting task: ${task.title}`));
      console.log(chalk.gray(`  ${task.description.substring(0, 100)}${task.description.length > 100 ? '...' : ''}`));
    },
    onTaskComplete: (task) => {
      console.log(chalk.green(`✓ Completed: ${task.title}`));
    },
    onTaskFailed: (task, error, willRetry) => {
      console.log(chalk.red(`✗ Failed: ${task.title}`));
      if (willRetry) {
        console.log(chalk.yellow(`  Will retry (attempt ${task.attempts}/${task.maxAttempts})`));
      }
      console.log(chalk.gray(`  Error: ${error.substring(0, 200)}...`));
    },
    onVerification: (success, output) => {
      if (success) {
        console.log(chalk.green('  ✓ Build/test passed'));
      } else {
        console.log(chalk.red('  ✗ Build/test failed'));
        console.log(chalk.gray(`  ${output.substring(0, 300)}...`));
      }
    },
    onProgress: (completed, total) => {
      const percentage = Math.round((completed / total) * 100);
      console.log(chalk.blue(`\n📊 Progress: ${completed}/${total} tasks (${percentage}%)`));
    },
    onPlanComplete: (success) => {
      console.log('');
      if (success) {
        console.log(chalk.green.bold('🎉 Plan completed successfully!'));
      } else {
        console.log(chalk.red.bold('⚠ Plan finished with failures.'));
      }
    },
  };

  const executor = new Executor(
    agent,
    planManager,
    workingDirectory,
    {
      runBuildAfterEachTask: true,
      runTestAfterEachTask: false,
      maxTaskAttempts: 3,
      stopOnFirstFailure: false,
    },
    callbacks
  );

  planningContext.executor = executor;

  console.log(chalk.cyan('\n🚀 Starting plan execution...\n'));

  try {
    const success = await executor.execute();

    // Save the plan state
    try {
      const planPath = await planManager.savePlan();
      console.log(chalk.gray(`\nPlan saved to: ${planPath}`));
    } catch {
      // Ignore save errors
    }

    if (success) {
      console.log(chalk.green('\nAll tasks completed! 🎉\n'));
    } else {
      console.log(chalk.yellow('\nSome tasks failed. Review the output above.\n'));
    }
  } catch (error) {
    console.log(chalk.red(`\nExecution error: ${error instanceof Error ? error.message : error}\n`));
  }
}

export function showPlanStatus(planningContext: PlanningContext): void {
  const { planManager, executor } = planningContext;

  if (!planManager.hasPlan) {
    console.log(chalk.gray('\nNo active plan. Use /plan <goal> to create one.\n'));
    return;
  }

  if (executor && executor.running) {
    console.log('\n' + executor.formatStatus() + '\n');
  } else {
    console.log('\n' + planManager.formatPlanAsMarkdown() + '\n');
  }
}

export function clearPlan(planningContext: PlanningContext): void {
  const { planManager, executor } = planningContext;

  if (executor && executor.running) {
    executor.stop();
    console.log(chalk.yellow('\nStopping execution...'));
  }

  planManager.clearPlan();
  planningContext.executor = null;
  console.log(chalk.green('\nPlan cleared.\n'));
}

// Legacy toggle function for simple read-only mode
export function togglePlanMode(context: ConversationContext): void {
  context.planMode = !context.planMode;
  if (context.planMode) {
    console.log(chalk.yellow('\nEntered read-only mode.'));
    console.log(chalk.gray('The AI will explore without making changes.'));
    console.log(chalk.gray('Use /plan again to exit.\n'));
  } else {
    console.log(chalk.green('\nExited read-only mode.\n'));
  }
}

export function enterPlanMode(context: ConversationContext): void {
  context.planMode = true;
}

export function exitPlanMode(context: ConversationContext): void {
  context.planMode = false;
}
