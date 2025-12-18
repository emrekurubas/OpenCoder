import * as readline from 'readline';
import chalk from 'chalk';
import type { OpenCoderConfig } from '../config/config.js';
import { createProvider } from '../providers/index.js';
import { OllamaProvider } from '../providers/ollama.js';
import { createDefaultTools } from '../tools/index.js';
import { Agent } from '../agent/agent.js';
import { createContext, clearContext, getMessageCount } from '../agent/index.js';
import {
  initCommand,
  togglePlanMode,
  showHelp,
  createPlanningContext,
  createPlan,
  approvePlan,
  executePlan,
  showPlanStatus,
  clearPlan,
} from './commands/index.js';
import { renderMarkdown, formatToolCall, formatToolResult } from './renderer.js';

export async function startRepl(config: OpenCoderConfig): Promise<void> {
  // Handle unhandled rejections to prevent crashes
  process.on('unhandledRejection', (reason) => {
    console.error(chalk.red('\nUnhandled error:'), reason);
  });

  const provider = createProvider(config);
  const tools = createDefaultTools();
  const workingDirectory = process.cwd();
  const context = createContext(workingDirectory);
  const planningContext = createPlanningContext(workingDirectory);

  // Check connection for Ollama provider
  if (provider instanceof OllamaProvider) {
    process.stdout.write(chalk.gray('Checking server connection... '));
    const status = await provider.checkConnection();
    if (!status.connected) {
      console.log(chalk.red('✗'));
      console.log(chalk.red(`\nCannot connect to ${config.baseUrl}`));
      console.log(chalk.gray(`Error: ${status.error}\n`));
      console.log(chalk.yellow('Check that your Ollama server is running and accessible.\n'));
      process.exit(1);
    }
    console.log(chalk.green('✓'));
    if (status.models && !status.models.includes(config.model)) {
      console.log(chalk.yellow(`\nWarning: Model "${config.model}" not found on server.`));
      console.log(chalk.gray(`Available models: ${status.models.join(', ')}\n`));
    }
  }

  const agent = new Agent({
    provider,
    tools,
    onToolCall: (name, params) => {
      console.log(formatToolCall(name, params));
    },
    onToolResult: (name, success, output) => {
      console.log(formatToolResult(name, success, output));
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.green('> '),
    terminal: process.stdin.isTTY ?? true,
  });

  console.log(chalk.gray('Type /help for available commands\n'));

  // Keep the event loop alive - readline alone doesn't always keep it running
  const keepAlive = setInterval(() => {}, 1 << 30); // ~12 days, effectively infinite

  rl.prompt();

  const handleLine = async (line: string) => {
    const input = line.trim();

    if (!input) {
      return;
    }

    // Handle slash commands
    if (input.startsWith('/')) {
      const [command, ...args] = input.split(' ');
      const commandLower = command.toLowerCase();

      if (commandLower === '/exit' || commandLower === '/quit') {
        console.log(chalk.gray('\nGoodbye!\n'));
        rl.close();
        process.exit(0);
      }

      if (commandLower === '/help') {
        showHelp();
        return;
      }

      if (commandLower === '/clear') {
        clearContext(context);
        console.log(chalk.gray('\nConversation cleared.\n'));
        return;
      }

      if (commandLower === '/readonly') {
        togglePlanMode(context);
        return;
      }

      if (commandLower === '/plan') {
        const goal = args.join(' ').trim();
        if (!goal) {
          console.log(chalk.yellow('\nUsage: /plan <goal>'));
          console.log(chalk.gray('Example: /plan Create a REST API with user authentication\n'));
          return;
        }
        try {
          await createPlan(goal, agent, planningContext, workingDirectory);
        } catch (error) {
          console.error(chalk.red('\nError creating plan:'), error instanceof Error ? error.message : error);
        }
        return;
      }

      if (commandLower === '/plan-approve') {
        approvePlan(planningContext);
        return;
      }

      if (commandLower === '/plan-run') {
        await executePlan(agent, planningContext, workingDirectory);
        return;
      }

      if (commandLower === '/plan-status') {
        showPlanStatus(planningContext);
        return;
      }

      if (commandLower === '/plan-clear') {
        clearPlan(planningContext);
        return;
      }

      if (commandLower === '/init') {
        try {
          const response = await initCommand(agent, context);
          console.log('\n' + renderMarkdown(response) + '\n');
        } catch (error) {
          console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
        }
        return;
      }

      console.log(chalk.red(`Unknown command: ${command}`));
      console.log(chalk.gray('Type /help for available commands'));
      return;
    }

    // Regular message - send to agent
    try {
      const response = await agent.run(input, context);
      console.log('\n' + renderMarkdown(response) + '\n');
    } catch (error) {
      console.error(chalk.red('\nError:'), error instanceof Error ? error.message : error);
      console.log('');
    }

    // Show message count in prompt if conversation is long
    const count = getMessageCount(context);
    if (count > 10) {
      rl.setPrompt(chalk.green(`[${count}] > `));
    }
  };

  rl.on('line', (line) => {
    rl.pause(); // Pause while processing
    handleLine(line)
      .catch((err) => {
        console.error(chalk.red('\nUnexpected error:'), err);
      })
      .finally(() => {
        rl.resume(); // Resume after processing
        rl.prompt();
      });
  });

  rl.on('close', () => {
    clearInterval(keepAlive);
    console.log(chalk.gray('\n[DEBUG] readline closed'));
    console.log(chalk.gray('Goodbye!\n'));
    process.exit(0);
  });

  process.stdin.on('end', () => {
    console.log(chalk.gray('\n[DEBUG] stdin ended'));
  });

  process.on('exit', (code) => {
    console.log(chalk.gray(`\n[DEBUG] process exit with code: ${code}`));
  });

  process.on('uncaughtException', (err) => {
    console.error(chalk.red('\n[DEBUG] uncaughtException:'), err);
  });

  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log(chalk.gray('\n\nInterrupted. Type /exit to quit.\n'));
    rl.prompt();
  });
}
