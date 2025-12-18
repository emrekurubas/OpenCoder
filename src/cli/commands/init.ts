import { ConversationContext } from '../../agent/index.js';
import { Agent } from '../../agent/agent.js';
import chalk from 'chalk';

export async function initCommand(
  agent: Agent,
  context: ConversationContext
): Promise<string> {
  console.log(chalk.cyan('\nAnalyzing codebase...\n'));

  const prompt = `Please analyze this codebase and create an OPENCODER.md file in the current directory.

The file should include:
1. Build/test/lint commands - how to develop in this codebase
2. High-level architecture - the "big picture" that requires reading multiple files to understand
3. Key patterns and conventions used

First, use the glob tool to find important files (package.json, Cargo.toml, go.mod, etc.) and source files.
Then read key configuration and entry point files to understand the project.
Finally, create the OPENCODER.md file.

Keep the file concise and focused on what's useful for an AI assistant working in this codebase.
Prefix the file with:
# OPENCODER.md

This file provides guidance to OpenCoder when working with code in this repository.`;

  return await agent.run(prompt, context);
}
