export interface ParsedToolCall {
  name: string;
  parameters: Record<string, unknown>;
}

export interface ParseResult {
  text: string;
  toolCalls: ParsedToolCall[];
}

/**
 * Parse tool calls from AI response.
 * Supports multiple formats:
 * 1. <tool_call>{"name": "...", "parameters": {...}}</tool_call>
 * 2. ```json\n{"name": "...", "parameters": {...}}\n```
 * 3. ```\n{"name": "...", "parameters": {...}}\n```
 */
export function parseToolCalls(response: string): ParseResult {
  const toolCalls: ParsedToolCall[] = [];
  let text = response;

  // Pattern 1: <tool_call>...</tool_call> or <toolcall>...</toolcall> blocks
  const toolCallRegex = /<tool_?call>\s*([\s\S]*?)\s*<\/tool_?call>/g;
  let match: RegExpExecArray | null;

  while ((match = toolCallRegex.exec(response)) !== null) {
    const parsed = tryParseToolCall(match[1].trim());
    if (parsed) toolCalls.push(parsed);
  }
  text = text.replace(toolCallRegex, '').trim();

  // Pattern 2: ```json ... ``` code blocks with tool call JSON
  const jsonBlockRegex = /```(?:json)?\s*\n?\s*(\{[\s\S]*?"name"\s*:\s*"[^"]+[\s\S]*?\})\s*\n?```/g;

  while ((match = jsonBlockRegex.exec(response)) !== null) {
    const parsed = tryParseToolCall(match[1].trim());
    if (parsed) {
      toolCalls.push(parsed);
      text = text.replace(match[0], '').trim();
    }
  }

  // Pattern 3: Standalone JSON object with tool "name" field
  if (toolCalls.length === 0) {
    // Look for JSON that starts with {"name": "tool_name"
    // Include variations without underscores that models sometimes output
    const toolNames = [
      'read_file', 'readfile', 'read-file',
      'write_file', 'writefile', 'write-file',
      'edit_file', 'editfile', 'edit-file',
      'bash', 'glob'
    ];
    for (const toolName of toolNames) {
      const startPattern = `{"name": "${toolName}"`;
      const startIdx = response.indexOf(startPattern);
      if (startIdx !== -1) {
        // Find matching closing brace
        const jsonStart = startIdx;
        let braceCount = 0;
        let jsonEnd = -1;
        for (let i = jsonStart; i < response.length; i++) {
          if (response[i] === '{') braceCount++;
          else if (response[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
              jsonEnd = i + 1;
              break;
            }
          }
        }
        if (jsonEnd > jsonStart) {
          const jsonStr = response.substring(jsonStart, jsonEnd);
          const parsed = tryParseToolCall(jsonStr);
          if (parsed) {
            toolCalls.push(parsed);
            text = text.replace(jsonStr, '').trim();
          }
        }
      }
    }
  }

  return { text, toolCalls };
}

// Normalize tool names to canonical form (with underscores)
function normalizeToolName(name: string): string {
  const mapping: Record<string, string> = {
    'readfile': 'read_file',
    'read-file': 'read_file',
    'writefile': 'write_file',
    'write-file': 'write_file',
    'editfile': 'edit_file',
    'edit-file': 'edit_file',
  };
  return mapping[name.toLowerCase()] || name;
}

function tryParseToolCall(jsonStr: string): ParsedToolCall | null {
  // Try parsing directly
  try {
    const parsed = JSON.parse(jsonStr);
    if (parsed.name && typeof parsed.name === 'string') {
      return {
        name: normalizeToolName(parsed.name),
        parameters: parsed.parameters || {},
      };
    }
  } catch {
    // Try to fix common JSON issues
  }

  // Fix single quotes to double quotes (common model mistake)
  let fixed = jsonStr;

  // Replace single-quoted strings with double quotes (careful with apostrophes)
  // This handles cases like: 'hello' -> "hello" but not: don't
  fixed = fixed.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');

  // Try parsing the fixed JSON
  try {
    const parsed = JSON.parse(fixed);
    if (parsed.name && typeof parsed.name === 'string') {
      return {
        name: normalizeToolName(parsed.name),
        parameters: parsed.parameters || {},
      };
    }
  } catch {
    // Still invalid
  }

  // Try removing trailing content
  try {
    const trimmed = fixed.replace(/\}[\s\S]*$/, '}');
    const parsed = JSON.parse(trimmed);
    if (parsed.name && typeof parsed.name === 'string') {
      return {
        name: normalizeToolName(parsed.name),
        parameters: parsed.parameters || {},
      };
    }
  } catch {
    // Still invalid
  }

  return null;
}

/**
 * Format tool result for including in the conversation.
 */
export function formatToolResult(
  toolName: string,
  result: { success: boolean; output: string; error?: string }
): string {
  if (result.success) {
    return `<tool_result name="${toolName}">\n${result.output}\n</tool_result>`;
  } else {
    return `<tool_result name="${toolName}" error="true">\n${result.error || 'Unknown error'}\n</tool_result>`;
  }
}
