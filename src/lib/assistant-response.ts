export interface ParsedAssistantContent {
  text: string;
  thinking: string | null;
  sources: { title: string; url: string; domain: string }[];
}

export function parseAssistantContent(content: string): ParsedAssistantContent {
  let text = sanitizeAssistantContent(content);
  let thinking: string | null = null;
  let sources: { title: string; url: string; domain: string }[] = [];

  // Extract ---thinking--- blocks (handles newlines or spaces after tag)
  const thinkingRegex = /---thinking---\s*([\s\S]*?)(?:\s*---end-thinking---|\s*(?=---sources---)|$)/i;
  const thinkingMatch = text.match(thinkingRegex);
  
  if (thinkingMatch) {
    thinking = thinkingMatch[1].trim();
    text = text.replace(thinkingMatch[0], "");
  }

  // Extract ---sources--- blocks
  const sourcesRegex = /---sources---\s*([\s\S]*?)(?:\s*---end-sources---|$)/i;
  const sourcesMatch = text.match(sourcesRegex);
  
  if (sourcesMatch) {
    const sourcesText = sourcesMatch[1].trim();
    text = text.replace(sourcesMatch[0], "");

    // Robustly extract all URLs from the sources text block
    const urlRegex = /https?:\/\/[^\s|—>\]]+/g;
    const extractedUrls = sourcesText.match(urlRegex) || [];
    
    // Deduplicate and process URLs
    const seenUrls = new Set<string>();
    
    sources = extractedUrls
      .map(url => {
        if (seenUrls.has(url)) return null;
        seenUrls.add(url);
        
        let domain = "";
        try {
          domain = new URL(url).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
        return { title: domain, url, domain };
      })
      .filter((s): s is { title: string; url: string; domain: string } => s !== null);
  }

  return {
    text: text.trim(),
    thinking,
    sources
  };
}

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
  sanitized = sanitized.replace(
    /---thinking---\s*[\s\S]*?(?:\s*---end-thinking---|$)/gi,
    "",
  );

  return sanitized.trim();
}

export function formatThinkingDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}
