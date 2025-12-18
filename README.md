# OpenCoder

A model-agnostic agentic coding CLI tool that works with local LLMs via Ollama. OpenCoder enables AI-assisted coding directly in your terminal with file operations, bash commands, and intelligent code analysis.

## Features

- **Agentic Workflow**: AI that can read, write, and edit files autonomously
- **Tool Calling**: Built-in tools for file operations, bash commands, and glob patterns
- **Model Agnostic**: Works with any Ollama-compatible model
- **Planning System**: Break down complex tasks into executable steps
- **Interactive REPL**: Conversational interface with slash commands

## Prerequisites

- **Node.js** >= 18.0.0
- **Ollama** running locally (or accessible server)

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/opencoder.git
cd opencoder

# Install dependencies
npm install

# Build the project
npm run build

# Link globally (optional)
npm link
```

## Quick Start

### 1. Install and Start Ollama

First, install Ollama from [ollama.ai](https://ollama.ai), then pull a model:

```bash
# Pull a recommended model
ollama pull deepseek-r1:8b

# Start Ollama (if not already running)
ollama serve
```

### 2. Run OpenCoder

```bash
# If installed globally
opencoder

# Or run directly
npm start

# Or with specific options
opencoder --model deepseek-r1:8b --url http://localhost:11434
```

### 3. Start Coding

Once in the REPL, you can ask the AI to help with coding tasks:

```
You: Read the main.py file and explain what it does
You: Create a new function that validates email addresses
You: Find all TODO comments in the src directory
```

## Model Recommendations

OpenCoder uses prompt-based tool calling since most local models don't have native function calling. Results vary by model:

| Model | Tool Use | Notes |
|-------|----------|-------|
| `deepseek-r1:8b` | Excellent | Fast, follows instructions well. Recommended for most use cases. |
| `deepseek-r1:32b` | Good | Better reasoning but slower, may timeout on complex tasks |
| `deepseek-coder:33b` | Mixed | Strong coding capabilities but may not follow agentic instructions consistently |
| `codellama:13b` | Mixed | Decent for simple tasks |
| `llama3:8b` | Mixed | General purpose, varying results with tools |

**Tip**: Start with `deepseek-r1:8b` for the best balance of speed and capability. Experiment with larger models for complex reasoning tasks.

## Configuration

Configuration is loaded in priority order (highest to lowest):

### 1. CLI Flags (Highest Priority)

```bash
opencoder --model deepseek-r1:32b --url http://192.168.1.100:11434
```

### 2. Environment Variables

```bash
export OPENCODER_MODEL=deepseek-r1:8b
export OPENCODER_BASE_URL=http://localhost:11434
export OPENCODER_PROVIDER=ollama
```

### 3. Config File

Create `~/.opencoder/config.json`:

```json
{
  "provider": "ollama",
  "model": "deepseek-r1:8b",
  "baseUrl": "http://localhost:11434",
  "timeout": 300000
}
```

### 4. Defaults

- Provider: `ollama`
- Model: `deepseek-r1:8b`
- URL: `http://localhost:11434`
- Timeout: 300000ms (5 minutes)

## CLI Options

```bash
opencoder [options]

Options:
  -m, --model <model>     Model to use (default: deepseek-r1:8b)
  -p, --provider <name>   AI provider (default: ollama)
  -u, --url <url>         Base URL for API (default: http://localhost:11434)
  -h, --help              Display help
```

## Slash Commands

Inside the REPL:

| Command | Description |
|---------|-------------|
| `/help` | Show available commands |
| `/init` | Analyze and summarize the current codebase |
| `/plan <goal>` | Create an execution plan for a complex task |
| `/clear` | Clear conversation history |
| `/readonly` | Toggle read-only mode (disables write operations) |
| `/exit` | Exit the application |

## Built-in Tools

The AI has access to these tools:

| Tool | Description |
|------|-------------|
| `read_file` | Read file contents with optional line range |
| `write_file` | Create or overwrite files |
| `edit_file` | Edit files (replace, insert, append modes) |
| `bash` | Execute bash commands (with safety checks) |
| `glob` | Find files matching patterns |

## Architecture

```
src/
├── index.ts          # CLI entry point
├── agent/            # Core agentic loop
│   ├── agent.ts      # Main agent with tool execution
│   ├── context.ts    # Conversation management
│   └── parser.ts     # Tool call extraction
├── providers/        # AI provider abstraction
│   ├── base.ts       # Provider interface
│   └── ollama.ts     # Ollama implementation
├── tools/            # Agent capabilities
│   ├── read.ts       # Read files
│   ├── write.ts      # Write files
│   ├── edit.ts       # Edit files
│   ├── bash.ts       # Execute commands
│   └── glob.ts       # File patterns
├── cli/              # REPL interface
└── planning/         # Task planning system
```

## Development

```bash
# Watch mode for development
npm run dev

# Build
npm run build

# Run
npm start
```

## Adding New Providers

Extend the `AIProvider` base class in `src/providers/`:

```typescript
import { AIProvider, Message, ChatResponse } from './base.js';

export class MyProvider extends AIProvider {
  async chat(messages: Message[]): Promise<ChatResponse> {
    // Implement your provider logic
  }

  async checkConnection(): Promise<boolean> {
    // Verify connection to the service
  }
}
```

## Troubleshooting

### "Connection refused" error

Make sure Ollama is running:
```bash
ollama serve
```

### Model not found

Pull the model first:
```bash
ollama pull deepseek-r1:8b
```

### Slow responses

- Try a smaller model (8b vs 32b)
- Increase timeout in config
- Check system resources

### Tool calls not working

Some models don't follow tool-calling instructions well. Try:
1. Using `deepseek-r1:8b` (best tool compliance)
2. Being more explicit in your prompts
3. Breaking complex tasks into smaller steps

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.
