import chalk from 'chalk';

/**
 * Simple markdown renderer for terminal output.
 * Handles basic formatting: headers, code blocks, bold, italic, lists.
 */
export function renderMarkdown(text: string): string {
  let result = text;

  // Code blocks (```language ... ```)
  result = result.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const header = lang ? chalk.gray(`─── ${lang} ───`) : chalk.gray('───');
    return `\n${header}\n${chalk.cyan(code.trim())}\n${chalk.gray('───')}\n`;
  });

  // Inline code (`code`)
  result = result.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

  // Headers (# Header)
  result = result.replace(/^### (.+)$/gm, (_, text) => chalk.bold.white(text));
  result = result.replace(/^## (.+)$/gm, (_, text) => chalk.bold.cyan(text));
  result = result.replace(/^# (.+)$/gm, (_, text) => chalk.bold.cyan.underline(text));

  // Bold (**text**)
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, text) => chalk.bold(text));

  // Italic (*text* or _text_)
  result = result.replace(/\*([^*]+)\*/g, (_, text) => chalk.italic(text));
  result = result.replace(/_([^_]+)_/g, (_, text) => chalk.italic(text));

  // Lists (- item)
  result = result.replace(/^- (.+)$/gm, (_, text) => `  ${chalk.gray('•')} ${text}`);
  result = result.replace(/^\* (.+)$/gm, (_, text) => `  ${chalk.gray('•')} ${text}`);

  // Numbered lists (1. item)
  result = result.replace(/^(\d+)\. (.+)$/gm, (_, num, text) => `  ${chalk.gray(num + '.')} ${text}`);

  return result;
}

/**
 * Format tool call output for display.
 */
export function formatToolCall(toolName: string, params: Record<string, unknown>): string {
  const paramStr = Object.entries(params)
    .map(([k, v]) => {
      const valueStr = typeof v === 'string' && v.length > 50 ? v.substring(0, 50) + '...' : String(v);
      return `${chalk.gray(k)}=${chalk.white(valueStr)}`;
    })
    .join(' ');

  return chalk.yellow(`▶ ${toolName}`) + (paramStr ? ` ${paramStr}` : '');
}

/**
 * Format tool result output for display.
 */
export function formatToolResult(toolName: string, success: boolean, output: string): string {
  const status = success ? chalk.green('✓') : chalk.red('✗');
  const preview = output.length > 200 ? output.substring(0, 200) + '...' : output;
  return `${status} ${chalk.gray(toolName)}\n${chalk.gray(preview)}`;
}

/**
 * Print a horizontal rule.
 */
export function printDivider(): void {
  console.log(chalk.gray('─'.repeat(50)));
}
