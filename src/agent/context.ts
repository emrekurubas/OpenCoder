import type { Message } from '../providers/base.js';

export interface ConversationContext {
  messages: Message[];
  workingDirectory: string;
  planMode: boolean;
}

export function createContext(workingDirectory?: string): ConversationContext {
  return {
    messages: [],
    workingDirectory: workingDirectory || process.cwd(),
    planMode: false,
  };
}

export function addSystemMessage(context: ConversationContext, content: string): void {
  // Replace existing system message or add new one at the beginning
  const existingIndex = context.messages.findIndex((m) => m.role === 'system');
  const systemMessage: Message = { role: 'system', content };

  if (existingIndex >= 0) {
    context.messages[existingIndex] = systemMessage;
  } else {
    context.messages.unshift(systemMessage);
  }
}

export function addUserMessage(context: ConversationContext, content: string): void {
  context.messages.push({ role: 'user', content });
}

export function addAssistantMessage(context: ConversationContext, content: string): void {
  context.messages.push({ role: 'assistant', content });
}

export function addToolResult(
  context: ConversationContext,
  toolName: string,
  result: string
): void {
  // Add tool result as a user message (since many models don't have native tool role)
  context.messages.push({
    role: 'user',
    content: `Tool "${toolName}" returned:\n${result}`,
  });
}

export function clearContext(context: ConversationContext): void {
  const systemMessage = context.messages.find((m) => m.role === 'system');
  context.messages = systemMessage ? [systemMessage] : [];
}

export function getMessageCount(context: ConversationContext): number {
  return context.messages.filter((m) => m.role !== 'system').length;
}
