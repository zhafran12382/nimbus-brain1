export interface ParsedAssistantContent {
  text: string;
  thinking: string | null;
  thinkingDurationMs: number | null;
  sources: { title: string; url: string; domain: string }[];
}

// ── LaTeX commands that signal "complex" math — promote to block $$...$$ ──
const COMPLEX_COMMANDS = /\\(?:partial|nabla|mathbf|mathbb|mathcal|mathrm|mathit|mathsf|boldsymbol|hat|bar|vec|dot|ddot|tilde|widetilde|widehat|overline|underline|overbrace|underbrace|begin|end|left|right|bigg?|Bigg?|iint|iiint|oint|idotsint|sum|prod|coprod|bigcup|bigcap|lim|limsup|liminf|max|min|sup|inf)\b/;
const NESTED_FRAC = /\\frac\s*\{[^}]*\\frac/;

/**
 * Check if a math expression is "complex" and should be rendered as block math.
 * Complex = contains multiline, nested fracs, or advanced commands.
 */
function isComplexMath(expr: string): boolean {
  if (expr.includes('\n')) return true;
  if (NESTED_FRAC.test(expr)) return true;
  if (COMPLEX_COMMANDS.test(expr)) return true;
  // Multiple high-level operators
  const opCount = (expr.match(/\\(?:frac|int|iint|iiint|oint|sum|prod|lim)\b/g) || []).length;
  if (opCount >= 2) return true;
  return false;
}

/**
 * Fix double-escaped backslashes that arrive from LLM JSON serialization.
 * Scans the ENTIRE text (not just inside $ delimiters) for patterns like
 * \\frac, \\partial, \\nabla etc. and collapses the double backslash.
 *
 * Also handles \\( \\) and \\[ \\] alternate delimiters that got double-escaped.
 */
export function normalizeLatex(text: string): string {
  let result = text;

  // Protect code blocks
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `%%CB_${codeBlocks.length - 1}%%`;
  });
  const inlineCodes: string[] = [];
  result = result.replace(/`[^`\n]+`/g, (m) => {
    inlineCodes.push(m);
    return `%%IC_${inlineCodes.length - 1}%%`;
  });

  // Fix double-escaped LaTeX commands everywhere (\\frac → \frac, \\partial → \partial, etc.)
  // This handles the most common LLM issue: JSON double-serialization producing \\command
  result = result.replace(
    /\\\\(frac|sum|prod|int|iint|iiint|oint|lim|limsup|liminf|sqrt|binom|partial|nabla|mathbf|mathbb|mathcal|mathrm|mathit|mathsf|boldsymbol|hat|bar|vec|dot|ddot|tilde|widetilde|widehat|overline|underline|overbrace|underbrace|begin|end|left|right|bigg?|Bigg?|infty|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Gamma|Delta|Theta|Lambda|Xi|Pi|Sigma|Upsilon|Phi|Psi|Omega|cdot|cdots|ldots|ddots|vdots|times|div|pm|mp|leq|geq|neq|approx|equiv|sim|simeq|cong|propto|subset|supset|subseteq|supseteq|in|notin|cup|cap|setminus|emptyset|forall|exists|nexists|neg|land|lor|implies|iff|to|rightarrow|leftarrow|Rightarrow|Leftarrow|mapsto|text|operatorname|displaystyle|textstyle|scriptstyle|quad|qquad|hspace|vspace|kern|,|;|!|:)\b/g,
    '\\$1',
  );

  // Fix double-escaped delimiters: \\( → \(, \\) → \), \\[ → \[, \\] → \]
  result = result.replace(/\\\\(\(|\)|\[|\])/g, '\\$1');

  // Fix remaining double-backslashes inside existing $ and $$ delimiters
  // (catches edge cases not covered by the command list above)
  result = result.replace(
    /(\$\$[\s\S]*?\$\$|\$(?!\$)(?:[^$\\]|\\.)*\$)/g,
    (match) => match.replace(/\\\\/g, '\\'),
  );

  // Restore code blocks
  result = result.replace(/%%IC_(\d+)%%/g, (_, i) => inlineCodes[Number(i)]);
  result = result.replace(/%%CB_(\d+)%%/g, (_, i) => codeBlocks[Number(i)]);

  return result;
}

/**
 * Normalize math delimiters and wrap bare LaTeX commands.
 * Also promotes complex inline $...$ to block $$...$$ for better rendering.
 */
export function normalizeMathContent(text: string): string {
  let result = text;

  // ── 1. Protect code blocks ──
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `%%CODEBLOCK_${codeBlocks.length - 1}%%`;
  });
  const inlineCodeBlocks: string[] = [];
  result = result.replace(/`[^`\n]+`/g, (m) => {
    inlineCodeBlocks.push(m);
    return `%%INLINECODE_${inlineCodeBlocks.length - 1}%%`;
  });

  // ── 2. Normalize alternate delimiters ──
  result = result.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_, math) => `$${math.trim()}$`);
  result = result.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (_, math) => `$$\n${math.trim()}\n$$`);

  // ── 3. Promote complex inline math $...$ to block $$...$$ ──
  // We need a proper scanner to handle nested braces correctly
  result = promoteComplexInlineMath(result);

  // ── 4. Wrap bare LaTeX commands not inside any $ delimiter ──
  result = wrapBareLaTeX(result);

  // ── 5. Restore code blocks ──
  result = result.replace(/%%INLINECODE_(\d+)%%/g, (_, i) => inlineCodeBlocks[Number(i)]);
  result = result.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => codeBlocks[Number(i)]);

  return result;
}

/**
 * Scanner-based promotion: finds inline $...$ and promotes complex ones to $$...$$
 */
function promoteComplexInlineMath(text: string): string {
  const parts: string[] = [];
  let i = 0;
  const len = text.length;

  while (i < len) {
    // Check for $$ (block math) — skip as-is
    if (text[i] === '$' && text[i + 1] === '$') {
      const end = text.indexOf('$$', i + 2);
      if (end !== -1) {
        parts.push(text.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }
    // Check for single $ (inline math)
    if (text[i] === '$' && text[i + 1] !== '$') {
      // Find the closing $, handling \$ escapes
      let j = i + 1;
      let found = false;
      while (j < len) {
        if (text[j] === '\\') { j += 2; continue; }
        if (text[j] === '$') { found = true; break; }
        j++;
      }
      if (found) {
        const inner = text.slice(i + 1, j);
        if (isComplexMath(inner)) {
          parts.push(`$$\n${inner.trim()}\n$$`);
        } else {
          parts.push(`$${inner}$`);
        }
        i = j + 1;
        continue;
      }
    }
    parts.push(text[i]);
    i++;
  }
  return parts.join('');
}

/**
 * Find bare LaTeX commands (outside any $ delimiter) and wrap them.
 */
function wrapBareLaTeX(text: string): string {
  // Split text into math regions and non-math regions
  const segments: { text: string; isMath: boolean }[] = [];
  let cursor = 0;
  const mathRegex = /\$\$[\s\S]*?\$\$|\$(?!\$)(?:[^$\\]|\\.)*\$/g;
  let m: RegExpExecArray | null;
  while ((m = mathRegex.exec(text)) !== null) {
    if (m.index > cursor) {
      segments.push({ text: text.slice(cursor, m.index), isMath: false });
    }
    segments.push({ text: m[0], isMath: true });
    cursor = m.index + m[0].length;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isMath: false });
  }

  // In non-math segments, wrap bare LaTeX commands
  const bareCmdRegex = /(\\(?:frac|sum|prod|int|iint|iiint|oint|lim|sqrt|binom|partial|nabla|mathbf|mathbb|mathcal|mathrm|vec|hat|bar|dot|tilde|overline|underline|left|right|begin|end)\s*(?:\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}(?:\s*\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})?(?:\s*[_^]\s*(?:\{(?:[^{}]|\{[^{}]*\})*\}|[a-zA-Z0-9]))*))/g;

  return segments.map(seg => {
    if (seg.isMath) return seg.text;
    return seg.text.replace(bareCmdRegex, (bareMatch) => {
      if (isComplexMath(bareMatch)) {
        return `$$\n${bareMatch}\n$$`;
      }
      return `$${bareMatch}$`;
    });
  }).join('');
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

  // ── Citation sanitization ──
  // Remove raw citation placeholders that leak into final output.
  // Handles: [1 source], [2 sources], [N sources], (1 source), (2 sources),
  // truncated tokens like [1tsource], [1t source], [source], [sources],
  // and other malformed citation artifacts.
  sanitized = sanitizeCitations(sanitized);

  return sanitized.trim();
}

/**
 * Clean up raw citation placeholders that should not appear in the final UI.
 * Preserves valid markdown citation links like [1](url) and [text](url).
 */
export function sanitizeCitations(text: string): string {
  let result = text;

  // Protect code blocks from citation sanitization
  const codeBlocks: string[] = [];
  result = result.replace(/```[\s\S]*?```/g, (m) => {
    codeBlocks.push(m);
    return `%%CITE_CB_${codeBlocks.length - 1}%%`;
  });
  const inlineCodes: string[] = [];
  result = result.replace(/`[^`\n]+`/g, (m) => {
    inlineCodes.push(m);
    return `%%CITE_IC_${inlineCodes.length - 1}%%`;
  });

  // Protect valid markdown links [text](url) — these have a real URL in parens
  const validLinks: string[] = [];
  result = result.replace(/\[[^\]]*\]\(https?:\/\/[^)]+\)/g, (m) => {
    validLinks.push(m);
    return `%%CITE_VL_${validLinks.length - 1}%%`;
  });

  // Remove [N source], [N sources], [Ntsource], [Nt source] patterns
  result = result.replace(/\[\s*\d+\s*t?\s*sources?\s*\]/gi, '');

  // Remove (N source), (N sources) patterns
  result = result.replace(/\(\s*\d+\s*sources?\s*\)/gi, '');

  // Remove bare [source], [sources] without numbers
  result = result.replace(/\[\s*sources?\s*\]/gi, '');

  // Remove [citation needed] or [citation] placeholders
  result = result.replace(/\[\s*citation(?:\s+needed)?\s*\]/gi, '');

  // Remove [ref], [reference], [refs] placeholders
  result = result.replace(/\[\s*refs?\s*\]/gi, '');
  result = result.replace(/\[\s*references?\s*\]/gi, '');

  // Clean up bare number-only citation brackets that don't link anywhere [1], [2], etc.
  // Only remove if NOT followed by ( which would make it a markdown link
  result = result.replace(/\[(\d+)\](?!\()/g, (match, num) => {
    // Keep it as a superscript number instead of removing entirely
    return `<sup>${num}</sup>`;
  });

  // Clean up duplicate superscripts (e.g., <sup>1</sup><sup>1</sup>)
  result = result.replace(/(<sup>\d+<\/sup>)\1+/g, '$1');

  // Clean up excessive whitespace left by removed citations
  result = result.replace(/ {2,}/g, ' ');
  result = result.replace(/\n{3,}/g, '\n\n');

  // Restore protected content
  result = result.replace(/%%CITE_VL_(\d+)%%/g, (_, i) => validLinks[Number(i)]);
  result = result.replace(/%%CITE_IC_(\d+)%%/g, (_, i) => inlineCodes[Number(i)]);
  result = result.replace(/%%CITE_CB_(\d+)%%/g, (_, i) => codeBlocks[Number(i)]);

  return result;
}

export function formatThinkingDuration(ms?: number): string {
  if (!ms || ms <= 0) return "0.0s";
  return `${(ms / 1000).toFixed(1)}s`;
}
