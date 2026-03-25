import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

export const chatMarkdownComponents: Components = {
  a({ children, href, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{ overflowWrap: "break-word", wordBreak: "break-all" }}
        {...props}
      >
        {children}
      </a>
    );
  },
  p({ children, ...props }) {
    return (
      <p style={{ overflowWrap: "break-word", wordBreak: "break-word" }} {...props}>
        {children}
      </p>
    );
  },
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
