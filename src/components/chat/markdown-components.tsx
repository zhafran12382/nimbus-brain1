import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import type { PluggableList } from "unified";

// remarkMath MUST come before remarkGfm so that $...$ delimiters are parsed
// before GFM interprets _ * ~ inside math as emphasis/strikethrough.
export const chatRemarkPlugins: PluggableList = [
  [remarkMath, { singleDollarTextMath: false }],
  remarkGfm,
];
export const chatRehypePlugins: PluggableList = [
  [rehypeKatex, { throwOnError: false, output: 'htmlAndMathml', strict: false }],
  rehypeRaw,
];

export const chatMarkdownComponents: Components = {
  table({ children, ...props }) {
    return (
      <div className="chat-markdown-table-wrap">
        <table {...props}>{children}</table>
      </div>
    );
  },
  pre({ className, children, ...props }) {
    return (
      <pre className={cn("chat-markdown-pre", className)} {...props}>
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }) {
    // Skip custom styling for math nodes — remark-math sets className="language-math"
    if (className && /language-math/.test(className)) {
      return <code className={className} {...props}>{children}</code>;
    }
    const isInline = !className;
    return (
      <code
        className={
          isInline
            ? "chat-markdown-code-inline"
            : cn("chat-markdown-code-block", className)
        }
        {...props}
      >
        {children}
      </code>
    );
  },
  // Render citation superscripts as styled inline badges
  sup({ children, ...props }) {
    const text = String(children ?? '');
    // Only style if content is a citation number (1-3 digits)
    if (/^\d{1,3}$/.test(text.trim())) {
      return (
        <sup
          className="inline-flex items-center justify-center min-w-[1.1em] h-[1.1em] px-[0.25em] ml-[0.1em] rounded-sm bg-blue-500/15 text-blue-400 text-[0.65em] font-semibold leading-none align-super cursor-default select-none"
          title={`Source ${text.trim()}`}
          {...props}
        >
          {text.trim()}
        </sup>
      );
    }
    return <sup {...props}>{children}</sup>;
  },
  // Render citation links [N](url) as clickable superscript badges
  a({ href, children, ...props }) {
    const text = String(children ?? '');
    // Citation link: content is just a number, href is a URL
    if (/^\d{1,3}$/.test(text.trim()) && href) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center min-w-[1.1em] h-[1.1em] px-[0.25em] ml-[0.1em] rounded-sm bg-blue-500/15 text-blue-400 text-[0.65em] font-semibold leading-none align-super no-underline hover:bg-blue-500/25 transition-colors cursor-pointer select-none"
          title={`Source ${text.trim()}`}
          {...props}
        >
          {text.trim()}
        </a>
      );
    }
    // Regular link
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    );
  },
};
