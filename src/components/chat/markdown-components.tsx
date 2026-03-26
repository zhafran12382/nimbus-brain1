import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { PluggableList } from "unified";

// remarkMath MUST come before remarkGfm so that $...$ delimiters are parsed
// before GFM interprets _ * ~ inside math as emphasis/strikethrough.
export const chatRemarkPlugins: PluggableList = [
  [remarkMath, { singleDollarTextMath: true }],
  remarkGfm,
];
export const chatRehypePlugins: PluggableList = [
  [rehypeKatex, { throwOnError: false, output: 'htmlAndMathml', strict: false }],
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
};
