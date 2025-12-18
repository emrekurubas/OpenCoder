import { Agent } from '../agent/agent.js';
import { ConversationContext, createContext } from '../agent/context.js';
import { PlanManager } from './plan-manager.js';
import { Task, Plan } from './types.js';

interface ParsedPlan {
  summary: string;
  tasks: Array<{
    title: string;
    description: string;
    dependencies: string[];
    verifyCommand?: string;
  }>;
  verifyCommands: {
    build?: string;
    test?: string;
    lint?: string;
  };
}

export class Planner {
  private agent: Agent;
  private planManager: PlanManager;
  private context: ConversationContext;

  constructor(agent: Agent, planManager: PlanManager, workingDirectory: string) {
    this.agent = agent;
    this.planManager = planManager;
    this.context = createContext(workingDirectory);
  }

  async createPlan(goal: string): Promise<{ success: boolean; plan?: Plan | null; error?: string }> {
    const prompt = this.buildPlanningPrompt(goal);

    try {
      const response = await this.agent.run(prompt, this.context);

      // Parse the plan from the response
      const parsed = this.parsePlanResponse(response);

      if (!parsed) {
        return { success: false, error: 'Could not parse plan from AI response' };
      }

      // Create the plan in the manager
      const plan = this.planManager.createPlan(goal, parsed.summary, parsed.tasks);
      this.planManager.setVerifyCommands(parsed.verifyCommands);

      return { success: true, plan };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private buildPlanningPrompt(goal: string): string {
    return `You are a software architect. Create a detailed implementation plan for the following goal.

## Goal
${goal}

## Instructions

1. First, explore the codebase using glob and read_file to understand the existing structure
2. Then create a step-by-step implementation plan

Your plan should:
- Break the work into small, testable tasks (5-15 tasks typically)
- Order tasks by dependencies (foundational work first)
- Each task should be completable in one focused session
- Include verification steps where appropriate

## Output Format

After exploring, output your plan in this EXACT format:

<plan>
<summary>
A 2-3 sentence overview of the implementation approach.
</summary>

<verify>
build: npm run build
test: npm test
</verify>

<tasks>
<task id="1">
<title>Short task title</title>
<description>
Detailed description of what to implement.
Include specific files to create/modify.
</description>
<depends></depends>
</task>

<task id="2">
<title>Another task</title>
<description>
Details here...
</description>
<depends>1</depends>
</task>
</tasks>
</plan>

Now explore the codebase and create the plan:`;
  }

  private parsePlanResponse(response: string): ParsedPlan | null {
    try {
      // Extract plan block
      const planMatch = response.match(/<plan>([\s\S]*?)<\/plan>/);
      if (!planMatch) {
        // Try to parse without XML tags (for models that don't follow format exactly)
        return this.parsePlanFallback(response);
      }

      const planContent = planMatch[1];

      // Extract summary
      const summaryMatch = planContent.match(/<summary>([\s\S]*?)<\/summary>/);
      const summary = summaryMatch ? summaryMatch[1].trim() : 'Implementation plan';

      // Extract verify commands
      const verifyMatch = planContent.match(/<verify>([\s\S]*?)<\/verify>/);
      const verifyCommands: ParsedPlan['verifyCommands'] = {};

      if (verifyMatch) {
        const verifyContent = verifyMatch[1];
        const buildMatch = verifyContent.match(/build:\s*(.+)/);
        const testMatch = verifyContent.match(/test:\s*(.+)/);
        const lintMatch = verifyContent.match(/lint:\s*(.+)/);

        if (buildMatch) verifyCommands.build = buildMatch[1].trim();
        if (testMatch) verifyCommands.test = testMatch[1].trim();
        if (lintMatch) verifyCommands.lint = lintMatch[1].trim();
      }

      // Extract tasks
      const tasks: ParsedPlan['tasks'] = [];
      const taskRegex = /<task[^>]*>([\s\S]*?)<\/task>/g;
      let taskMatch;

      while ((taskMatch = taskRegex.exec(planContent)) !== null) {
        const taskContent = taskMatch[1];

        const titleMatch = taskContent.match(/<title>([\s\S]*?)<\/title>/);
        const descMatch = taskContent.match(/<description>([\s\S]*?)<\/description>/);
        const depsMatch = taskContent.match(/<depends>([\s\S]*?)<\/depends>/);

        if (titleMatch && descMatch) {
          const dependencies = depsMatch
            ? depsMatch[1].split(',').map(d => `task-${d.trim()}`).filter(d => d !== 'task-')
            : [];

          tasks.push({
            title: titleMatch[1].trim(),
            description: descMatch[1].trim(),
            dependencies,
          });
        }
      }

      if (tasks.length === 0) {
        return this.parsePlanFallback(response);
      }

      return { summary, tasks, verifyCommands };
    } catch (error) {
      console.error('Error parsing plan:', error);
      return null;
    }
  }

  private parsePlanFallback(response: string): ParsedPlan | null {
    // Try to extract tasks from numbered lists or markdown headers
    const tasks: ParsedPlan['tasks'] = [];

    // Look for numbered tasks: "1. Task title" or "### 1. Task title"
    const taskPatterns = [
      /(?:^|\n)(?:#{1,3}\s*)?(\d+)\.\s+(.+?)(?:\n|$)([\s\S]*?)(?=(?:\n(?:#{1,3}\s*)?\d+\.|$))/g,
      /(?:^|\n)(?:Task\s*)?(\d+)[.:]\s*(.+?)(?:\n|$)([\s\S]*?)(?=(?:\nTask\s*\d+|$))/gi,
    ];

    for (const pattern of taskPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        tasks.push({
          title: match[2].trim(),
          description: match[3]?.trim() || match[2].trim(),
          dependencies: [],
        });
      }
      if (tasks.length > 0) break;
    }

    if (tasks.length === 0) {
      return null;
    }

    // Add sequential dependencies
    for (let i = 1; i < tasks.length; i++) {
      tasks[i].dependencies = [`task-${i}`];
    }

    return {
      summary: 'Implementation plan extracted from AI response.',
      tasks,
      verifyCommands: {},
    };
  }
}
