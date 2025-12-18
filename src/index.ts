#!/usr/bin/env node
import { Command } from 'commander';
import { startRepl } from './cli/repl.js';
import { loadConfig } from './config/config.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('opencoder')
  .description('Model-agnostic agentic coding CLI tool')
  .version('0.1.0')
  .option('-m, --model <model>', 'Model to use (overrides config)')
  .option('-p, --provider <provider>', 'Provider to use (ollama, openai)', 'ollama')
  .option('-u, --url <url>', 'Provider base URL')
  .action(async (options) => {
    try {
      const config = await loadConfig(options);
      console.log(chalk.cyan.bold('\n  OpenCoder v0.1.0'));
      console.log(chalk.gray(`  Provider: ${config.provider} | Model: ${config.model}\n`));
      await startRepl(config);
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
