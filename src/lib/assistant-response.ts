export function sanitizeAssistantContent(content: string): string {
  let sanitized = content;
  // Safety cap: we only expect a handful of think blocks, but guard against malformed loops.
  const MAX_STRIP_ITERATIONS = 100;

  const stripBlocks = (input: string, openTagRegex: RegExp, closeTagFactory: (tag: string) => RegExp, strayCloseRegex: RegExp): string => {
    let output = input;
    let iterations = 0;

    // Guard against malformed content that could otherwise keep matching repeatedly.
    while (iterations < MAX_STRIP_ITERATIONS) {
      iterations += 1;
      const openMatch = output.match(openTagRegex);
      if (!openMatch || openMatch.index === undefined) break;

      const openTag = openMatch[1];
      const start = openMatch.index;
      const contentStart = start + openMatch[0].length;
      const rest = output.slice(contentStart);
      const closeMatch = rest.match(closeTagFactory(openTag));
      const end = closeMatch && closeMatch.index !== undefined
        ? contentStart + closeMatch.index + closeMatch[0].length
        : output.length;

      output = output.slice(0, start) + output.slice(end);
    }

    return output.replace(strayCloseRegex, "");
  };

  // Remove any leaked reasoning blocks (including unclosed tags while streaming)
  sanitized = stripBlocks(
    sanitized,
    /<\s*(think|thinking)\b[^>]*>/i,
    (tag) => new RegExp(`<\\/\\s*${tag}\\s*>`, "i"),
    /<\/\s*(think|thinking)\s*>/gi,
  );
  sanitized = stripBlocks(
    sanitized,
    /&lt;\s*(think|thinking)\b[^>]*&gt;/i,
    (tag) => new RegExp(`&lt;\\/\\s*${tag}\\s*&gt;`, "i"),
    /&lt;\/\s*(think|thinking)\s*&gt;/gi,
  );

  return sanitized.trim();
}

export function formatThinkingDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}
