export interface ParsedAssistantContent {
  text: string;
  thinking: string | null;
  thinkingDurationMs: number | null;
  sources: { title: string; url: string; domain: string }[];
}

/**
 * Normalize LaTeX math expressions in model output so that remark-math can parse them.
 * Handles common model quirks: unwrapped \frac, stray braces, mid-paragraph $$, etc.
 */
export function normalizeMathContent(text: string): string {
  let result = text;

  // 1. Protect existing fenced code blocks from being modified
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, (match) => {
    codeBlocks.push(match);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });
  const inlineCodeBlocks: string[] = [];
  result = result.replace(/`[^`\n]+`/g, (match) => {
    inlineCodeBlocks.push(match);
    return `%%INLINECODE_${inlineCodeBlocks.length - 1}%%`;
  });

  // 2. Normalize \( ... \) to $...$ and \[ ... \] to $$...$$
  result = result.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, math) => `$${math.trim()}$`);
  result = result.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, math) => `$$\n${math.trim()}\n$$`);

  // 3. Wrap bare LaTeX commands (outside of $) in inline math delimiters
  //    Matches things like \frac{...}{...}, \sum_{...}^{...}, \sqrt{...} etc when not inside $

  // Simple approach: find bare latex commands not inside $ delimiters
  result = result.replace(/((?:^|[^$]))(\\(?:frac|sum|prod|int|lim|sqrt|binom)\{[\s\S]*?\}(?:\{[\s\S]*?\})?(?:[_^]\{[^}]*\})*)/g, (match, prefix, latex) => {
    // Check if we're inside a math context by counting $ before this position
    const beforeMatch = result.substring(0, result.indexOf(match));
    const singleDollars = (beforeMatch.match(/(?<!\$)\$(?!\$)/g) || []).length;
    if (singleDollars % 2 === 1) return match; // inside inline math
    return `${prefix}$${latex}$`;
  });

  // 4. Restore code blocks
  result = result.replace(/%%INLINECODE_(\d+)%%/g, (_, i) => inlineCodeBlocks[Number(i)]);
  result = result.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => codeBlocks[Number(i)]);

  return result;
}

export function parseAssistantContent(content: string): ParsedAssistantContent {
  let text = typeof content === "string" ? content : "";
  let thinking: string | null = null;
  let thinkingDurationMs: number | null = null;
  let sources: { title: string; url: string; domain: string }[] = [];

  const thinkingDurationRegex = /---thinking-duration-ms---\s*(\d+)\s*---end-thinking-duration-ms---/i;
  const thinkingDurationMatch = text.match(thinkingDurationRegex);

  if (thinkingDurationMatch) {
    const parsedMs = Number(thinkingDurationMatch[1]);
    thinkingDurationMs = Number.isFinite(parsedMs) ? parsedMs : null;
    text = text.replace(thinkingDurationMatch[0], "");
  }

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

  text = sanitizeAssistantContent(text);
  text = normalizeLatex(text);
  text = normalizeMathContent(text);

  return {
    text: text.trim(),
    thinking,
    thinkingDurationMs,
    sources
  };
}

export function normalizeLatex(text: string): string {
  // Fix double-escaped backslashes inside LaTeX delimiters.
  // LLM output often arrives with \\frac instead of \frac because of JSON serialization layers.
  // We scan for $...$ and $$...$$ spans and collapse \\\\ → \\ only inside them.
  return text.replace(
    /(\$\$[\s\S]*?\$\$|\$(?!\$)(?:[^$\\]|\\.)*\$)/g,
    (match) => match.replace(/\\\\/g, '\\')
  );
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
  sanitized = sanitized.replace(
    /---thinking-duration-ms---\s*\d+\s*---end-thinking-duration-ms---/gi,
    "",
  );

  return sanitized.trim();
}

export function formatThinkingDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}
