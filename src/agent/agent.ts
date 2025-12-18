import type { AIProvider } from '../providers/base.js';
import type { Tool, ToolContext } from '../tools/base.js';
import { formatToolsForPrompt, getToolByName } from '../tools/index.js';
import {
  ConversationContext,
  addSystemMessage,
  addUserMessage,
  addAssistantMessage,
} from './context.js';
import { parseToolCalls, formatToolResult } from './parser.js';
import chalk from 'chalk';
import ora from 'ora';

const MAX_TOOL_ITERATIONS = 20;

export interface AgentConfig {
  provider: AIProvider;
  tools: Tool[];
  onToolCall?: (toolName: string, params: Record<string, unknown>) => void;
  onToolResult?: (toolName: string, success: boolean, output: string) => void;
  onThinking?: () => void;
}

export class Agent {
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  async run(
    userMessage: string,
    context: ConversationContext
  ): Promise<string> {
    // Build system prompt with tools
    const systemPrompt = this.buildSystemPrompt(context);
    addSystemMessage(context, systemPrompt);

    // Add user message
    addUserMessage(context, userMessage);

    let iteration = 0;
    let finalResponse = '';

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      // Show thinking spinner
      const spinner = ora({
        text: chalk.gray('Thinking...'),
        spinner: 'dots',
      }).start();

      try {
        // Get AI response
        const response = await this.config.provider.chat(context.messages);
        spinner.stop();

        // Parse response for tool calls
        const { text, toolCalls } = parseToolCalls(response.content);

        // If there's text before tool calls, show it
        if (text) {
          finalResponse = text;
        }

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          addAssistantMessage(context, response.content);
          return finalResponse || response.content;
        }

        // Execute tool calls
        const toolResults: string[] = [];
        const toolContext: ToolContext = {
          workingDirectory: context.workingDirectory,
        };

        for (const toolCall of toolCalls) {
          const tool = getToolByName(this.config.tools, toolCall.name);

          if (!tool) {
            const errorResult = formatToolResult(toolCall.name, {
              success: false,
              output: '',
              error: `Unknown tool: ${toolCall.name}`,
            });
            toolResults.push(errorResult);
            continue;
          }

          // Notify about tool call
          this.config.onToolCall?.(toolCall.name, toolCall.parameters);

          // Execute the tool with context
          const result = await tool.execute(toolCall.parameters, toolContext);

          // Notify about result
          this.config.onToolResult?.(toolCall.name, result.success, result.output || result.error || '');

          const formattedResult = formatToolResult(toolCall.name, result);
          toolResults.push(formattedResult);
        }

        // Add assistant message with tool calls
        addAssistantMessage(context, response.content);

        // Add tool results as user message
        const resultsMessage = toolResults.join('\n\n');
        addUserMessage(context, resultsMessage);

      } catch (error) {
        spinner.stop();
        throw error;
      }
    }

    // Max iterations reached
    return finalResponse || 'I was unable to complete the task within the maximum number of steps.';
  }

  private buildSystemPrompt(context: ConversationContext): string {
    const toolsPrompt = formatToolsForPrompt(this.config.tools);

    let prompt = `You are OpenCoder, an AI coding assistant running in a terminal.

Current working directory: ${context.workingDirectory}
Platform: macOS (use python3, not python)

${toolsPrompt}

CRITICAL RULES:
1. When asked to implement/create/write code, you MUST use write_file tool - do NOT just show code in text
2. NEVER show code in markdown blocks when you should be writing files
3. If user asks to "implement", "create", "make", or "write" something, USE THE TOOLS
4. If you encounter an error, REPORT it - do NOT try to auto-fix

HOW TO USE TOOLS - wrap tool calls in <tool_call> tags:
<tool_call>{"name": "write_file", "parameters": {"path": "example.py", "content": "print('hello')"}}</tool_call>

Guidelines:
- Use write_file to create files, read_file to read, bash to run commands
- Be concise in responses
- Always read a file before editing it`;

    if (context.planMode) {
      prompt += `

PLAN MODE ACTIVE: You are in read-only planning mode.
- Do NOT use write_file, edit_file, or bash commands that modify files
- Focus on exploring the codebase and designing an approach
- Use read_file and glob to understand the code structure`;
    }

    return prompt;
  }
}
