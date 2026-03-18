export function sanitizeAssistantContent(content: string): string {
  let sanitized = content;

  // Remove any leaked reasoning blocks (including unclosed tags while streaming)
  sanitized = sanitized.replace(/<\s*(think|thinking)\b[^>]*>[\s\S]*?(<\/\s*(think|thinking)\s*>|$)/gi, "");
  sanitized = sanitized.replace(/&lt;\s*(think|thinking)\b[^&]*&gt;[\s\S]*?(&lt;\/\s*(think|thinking)\s*&gt;|$)/gi, "");

  return sanitized.trim();
}

export function formatThinkingDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}
