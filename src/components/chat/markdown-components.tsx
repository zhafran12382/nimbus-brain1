import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import type { PluggableList } from "unified";

export const chatRemarkPlugins: PluggableList = [remarkGfm, remarkMath];
export const chatRehypePlugins: PluggableList = [rehypeKatex];

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
