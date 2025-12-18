import { AIProvider } from './base.js';
import { OllamaProvider } from './ollama.js';
import type { OpenCoderConfig } from '../config/config.js';

export { AIProvider, Message, ChatOptions, ChatResponse, StreamChunk } from './base.js';
export { OllamaProvider } from './ollama.js';

export function createProvider(config: OpenCoderConfig): AIProvider {
  switch (config.provider) {
    case 'ollama':
      return new OllamaProvider({
        baseUrl: config.baseUrl,
        model: config.model,
        timeout: config.timeout,
      });
    case 'openai':
      throw new Error('OpenAI provider not yet implemented');
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
