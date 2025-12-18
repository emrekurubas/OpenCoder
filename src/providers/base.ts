export interface Message {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  finishReason?: 'stop' | 'tool_calls' | 'length';
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

export abstract class AIProvider {
  abstract readonly name: string;

  abstract chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse>;

  abstract stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterable<StreamChunk>;
}
