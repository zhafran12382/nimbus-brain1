export function sanitizeAssistantContent(content: string): string {
  let sanitized = content;

  sanitized = sanitized.replace(/<think>[\s\S]*?<\/think>/gi, "");
  sanitized = sanitized.replace(/<thinking>[\s\S]*?<\/thinking>/gi, "");
  sanitized = sanitized.replace(/^\s*<(think|thinking)>[\s\S]*$/gi, "");

  return sanitized.trim();
}

export function formatThinkingDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}
