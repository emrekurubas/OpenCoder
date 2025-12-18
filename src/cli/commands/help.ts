import chalk from 'chalk';

export function showHelp(): void {
  console.log(`
${chalk.cyan.bold('OpenCoder Commands')}

${chalk.yellow.bold('Basic')}
  ${chalk.yellow('/init')}          Analyze codebase and create OPENCODER.md
  ${chalk.yellow('/clear')}         Clear conversation history
  ${chalk.yellow('/help')}          Show this help message
  ${chalk.yellow('/exit')}          Exit OpenCoder (also: /quit, Ctrl+C)

${chalk.yellow.bold('Planning Mode')}
  ${chalk.yellow('/plan <goal>')}   Create an implementation plan for a goal
  ${chalk.yellow('/plan-approve')}  Approve the current plan
  ${chalk.yellow('/plan-run')}      Execute the approved plan
  ${chalk.yellow('/plan-status')}   Show current plan status
  ${chalk.yellow('/plan-clear')}    Clear/cancel the current plan
  ${chalk.yellow('/readonly')}      Toggle read-only mode (no changes)

${chalk.cyan.bold('How Planning Works')}
1. Use ${chalk.yellow('/plan <goal>')} to describe what you want to build
2. The AI creates a step-by-step implementation plan
3. Review the plan and use ${chalk.yellow('/plan-approve')} to approve it
4. Use ${chalk.yellow('/plan-run')} to start automatic execution
5. The AI implements each task, verifies builds, and self-corrects errors

${chalk.cyan.bold('Tips')}
- Type your request and press Enter to chat with the AI
- The AI can read, write, and edit files in your codebase
- Use planning mode for larger features that need multiple steps
`);
}
