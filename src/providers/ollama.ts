import { AIProvider, Message, ChatOptions, ChatResponse, StreamChunk } from './base.js';

interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeout: number;
}

interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatResponse {
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

export class OllamaProvider extends AIProvider {
  readonly name = 'ollama';
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    super();
    this.config = config;
  }

  async checkConnection(): Promise<{ connected: boolean; models?: string[]; error?: string }> {
    try {
      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        return { connected: false, error: `Server returned ${response.status}` };
      }
      const data = await response.json() as { models: Array<{ name: string }> };
      return {
        connected: true,
        models: data.models?.map(m => m.name) || [],
      };
    } catch (error) {
      return {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async chat(messages: Message[], options?: ChatOptions): Promise<ChatResponse> {
    const ollamaMessages = this.convertMessages(messages);

    let response: Response;
    try {
      response = await fetch(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: ollamaMessages,
          stream: true,
          options: {
            temperature: options?.temperature ?? 0.7,
            num_predict: options?.maxTokens ?? 4096,
          },
        }),
        signal: AbortSignal.timeout(this.config.timeout),
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'TimeoutError') {
          throw new Error(`Request timed out after ${this.config.timeout / 1000}s. The model may be slow or the server unresponsive.`);
        }
        if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
          throw new Error(`Cannot connect to server at ${this.config.baseUrl}. Is the server running?`);
        }
      }
      throw error;
    }

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 404) {
        throw new Error(`Model "${this.config.model}" not found. Check available models with: curl ${this.config.baseUrl}/api/tags`);
      }
      if (response.status === 504) {
        throw new Error(`Gateway timeout. The model is taking too long. Try a smaller model or increase server timeout.`);
      }
      throw new Error(`Server error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body from server');
    }

    // Accumulate streamed response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line) as OllamaChatResponse;
            fullContent += data.message.content;
            if (data.done) break;
          } catch {
            // Skip invalid JSON lines
          }
        }
      }
    } catch (error) {
      if (fullContent) {
        // If we got partial content, return it
        console.warn('Stream interrupted, returning partial response');
      } else {
        throw new Error(`Stream error: ${error instanceof Error ? error.message : error}`);
      }
    }

    const content = this.cleanResponse(fullContent);

    return {
      content,
      finishReason: 'stop',
    };
  }

  async *stream(
    messages: Message[],
    options?: ChatOptions
  ): AsyncIterable<StreamChunk> {
    const ollamaMessages = this.convertMessages(messages);

    const response = await fetch(`${this.config.baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: ollamaMessages,
        stream: true,
        options: {
          temperature: options?.temperature ?? 0.7,
          num_predict: options?.maxTokens ?? 4096,
        },
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama API error (${response.status}): ${errorText}`);
    }

    if (!response.body) {
      throw new Error('No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const data = JSON.parse(line) as OllamaChatResponse;
          yield {
            content: data.message.content,
            done: data.done,
          };
        } catch {
          // Skip invalid JSON lines
        }
      }
    }
  }

  private convertMessages(messages: Message[]): OllamaMessage[] {
    return messages
      .filter((m) => m.role !== 'tool')
      .map((m) => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      }));
  }

  private cleanResponse(text: string): string {
    if (!text) return '';

    // Remove thinking tags that DeepSeek R1 might include
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');

    // Remove incomplete thinking tags
    const thinkStart = cleaned.indexOf('<think>');
    if (thinkStart !== -1) {
      cleaned = cleaned.substring(0, thinkStart);
    }

    return cleaned.trim();
  }
}
