import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { Plan, Task, PlanConfig, DEFAULT_PLAN_CONFIG } from './types.js';
import { randomUUID } from 'crypto';

export class PlanManager {
  private plan: Plan | null = null;
  private config: PlanConfig;
  private planDir: string;

  constructor(workingDirectory: string, config: Partial<PlanConfig> = {}) {
    this.config = { ...DEFAULT_PLAN_CONFIG, ...config };
    this.planDir = join(workingDirectory, '.opencoder');
  }

  get currentPlan(): Plan | null {
    return this.plan;
  }

  get hasPlan(): boolean {
    return this.plan !== null;
  }

  get isApproved(): boolean {
    return this.plan?.status === 'approved' || this.plan?.status === 'in_progress';
  }

  createPlan(goal: string, summary: string, tasks: Omit<Task, 'id' | 'status' | 'attempts' | 'maxAttempts'>[]): Plan {
    this.plan = {
      id: randomUUID().slice(0, 8),
      goal,
      createdAt: new Date(),
      status: 'draft',
      summary,
      tasks: tasks.map((t, i) => ({
        ...t,
        id: `task-${i + 1}`,
        status: 'pending' as const,
        attempts: 0,
        maxAttempts: this.config.maxTaskAttempts,
      })),
      currentTaskIndex: 0,
      verifyCommands: {},
      workingDirectory: dirname(this.planDir),
    };
    return this.plan;
  }

  setVerifyCommands(commands: Plan['verifyCommands']): void {
    if (this.plan) {
      this.plan.verifyCommands = commands;
    }
  }

  approvePlan(): boolean {
    if (!this.plan || this.plan.status !== 'draft') {
      return false;
    }
    this.plan.status = 'approved';
    return true;
  }

  startExecution(): boolean {
    if (!this.plan || this.plan.status !== 'approved') {
      return false;
    }
    this.plan.status = 'in_progress';
    return true;
  }

  getCurrentTask(): Task | null {
    if (!this.plan || this.plan.currentTaskIndex >= this.plan.tasks.length) {
      return null;
    }
    return this.plan.tasks[this.plan.currentTaskIndex];
  }

  getNextTask(): Task | null {
    if (!this.plan) return null;

    // Find next pending task
    for (let i = this.plan.currentTaskIndex; i < this.plan.tasks.length; i++) {
      const task = this.plan.tasks[i];
      if (task.status === 'pending') {
        // Check dependencies
        const depsComplete = task.dependencies.every(depId => {
          const dep = this.plan!.tasks.find(t => t.id === depId);
          return dep?.status === 'completed';
        });
        if (depsComplete) {
          this.plan.currentTaskIndex = i;
          return task;
        }
      }
    }
    return null;
  }

  markTaskInProgress(taskId: string): void {
    const task = this.plan?.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'in_progress';
      task.attempts++;
    }
  }

  markTaskCompleted(taskId: string): void {
    const task = this.plan?.tasks.find(t => t.id === taskId);
    if (task) {
      task.status = 'completed';
      task.error = undefined;
    }
    this.checkPlanCompletion();
  }

  markTaskFailed(taskId: string, error: string): void {
    const task = this.plan?.tasks.find(t => t.id === taskId);
    if (task) {
      task.error = error;
      if (task.attempts >= task.maxAttempts) {
        task.status = 'failed';
        if (this.config.stopOnFirstFailure) {
          this.plan!.status = 'failed';
        }
      } else {
        task.status = 'pending'; // Allow retry
      }
    }
  }

  private checkPlanCompletion(): void {
    if (!this.plan) return;

    const allCompleted = this.plan.tasks.every(t => t.status === 'completed');
    const anyFailed = this.plan.tasks.some(t => t.status === 'failed');

    if (allCompleted) {
      this.plan.status = 'completed';
    } else if (anyFailed && this.config.stopOnFirstFailure) {
      this.plan.status = 'failed';
    }
  }

  async savePlan(): Promise<string> {
    if (!this.plan) throw new Error('No plan to save');

    await mkdir(this.planDir, { recursive: true });
    const planPath = join(this.planDir, `plan-${this.plan.id}.json`);
    await writeFile(planPath, JSON.stringify(this.plan, null, 2));
    return planPath;
  }

  async loadPlan(planId: string): Promise<Plan | null> {
    try {
      const planPath = join(this.planDir, `plan-${planId}.json`);
      const content = await readFile(planPath, 'utf-8');
      this.plan = JSON.parse(content);
      return this.plan;
    } catch {
      return null;
    }
  }

  formatPlanAsMarkdown(): string {
    if (!this.plan) return 'No plan created.';

    const lines: string[] = [
      `# Implementation Plan`,
      ``,
      `**Goal:** ${this.plan.goal}`,
      `**Status:** ${this.plan.status}`,
      `**Created:** ${this.plan.createdAt}`,
      ``,
      `## Summary`,
      ``,
      this.plan.summary,
      ``,
      `## Tasks`,
      ``,
    ];

    for (const task of this.plan.tasks) {
      const statusIcon = {
        pending: '⬜',
        in_progress: '🔄',
        completed: '✅',
        failed: '❌',
        skipped: '⏭️',
      }[task.status];

      lines.push(`### ${statusIcon} ${task.id}: ${task.title}`);
      lines.push(``);
      lines.push(task.description);
      if (task.error) {
        lines.push(``);
        lines.push(`**Error:** ${task.error}`);
      }
      lines.push(``);
    }

    if (this.plan.verifyCommands.build || this.plan.verifyCommands.test) {
      lines.push(`## Verification Commands`);
      lines.push(``);
      if (this.plan.verifyCommands.build) {
        lines.push(`- **Build:** \`${this.plan.verifyCommands.build}\``);
      }
      if (this.plan.verifyCommands.test) {
        lines.push(`- **Test:** \`${this.plan.verifyCommands.test}\``);
      }
      lines.push(``);
    }

    return lines.join('\n');
  }

  getProgress(): { completed: number; total: number; percentage: number } {
    if (!this.plan) return { completed: 0, total: 0, percentage: 0 };

    const completed = this.plan.tasks.filter(t => t.status === 'completed').length;
    const total = this.plan.tasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { completed, total, percentage };
  }

  clearPlan(): void {
    this.plan = null;
  }
}
