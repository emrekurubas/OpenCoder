import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface OpenCoderConfig {
  provider: 'ollama' | 'openai';
  model: string;
  baseUrl: string;
  timeout: number;
}

interface CliOptions {
  model?: string;
  provider?: string;
  url?: string;
}

const DEFAULT_CONFIG: OpenCoderConfig = {
  provider: 'ollama',
  model: 'deepseek-r1:8b',
  baseUrl: 'http://localhost:11434',
  timeout: 300000, // 5 minutes
};

export async function loadConfig(cliOptions: CliOptions = {}): Promise<OpenCoderConfig> {
  let fileConfig: Partial<OpenCoderConfig> = {};

  // Try to load config from ~/.opencoder/config.json
  const configPath = join(homedir(), '.opencoder', 'config.json');
  try {
    const content = await readFile(configPath, 'utf-8');
    fileConfig = JSON.parse(content);
  } catch {
    // Config file doesn't exist, use defaults
  }

  // Environment variables
  const envConfig: Partial<OpenCoderConfig> = {};
  if (process.env.OPENCODER_PROVIDER) {
    envConfig.provider = process.env.OPENCODER_PROVIDER as 'ollama' | 'openai';
  }
  if (process.env.OPENCODER_MODEL) {
    envConfig.model = process.env.OPENCODER_MODEL;
  }
  if (process.env.OPENCODER_BASE_URL) {
    envConfig.baseUrl = process.env.OPENCODER_BASE_URL;
  }

  // CLI options take highest priority
  const cliConfig: Partial<OpenCoderConfig> = {};
  if (cliOptions.provider) {
    cliConfig.provider = cliOptions.provider as 'ollama' | 'openai';
  }
  if (cliOptions.model) {
    cliConfig.model = cliOptions.model;
  }
  if (cliOptions.url) {
    cliConfig.baseUrl = cliOptions.url;
  }

  // Merge configs: defaults < file < env < cli
  return {
    ...DEFAULT_CONFIG,
    ...fileConfig,
    ...envConfig,
    ...cliConfig,
  };
}
