import type { Components } from "react-markdown";
import { cn } from "@/lib/utils";

export const chatMarkdownComponents: Components = {
  img({ src, alt, ...props }) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt || "Generated image"}
        className="max-w-full h-auto rounded-xl my-2 border border-white/10"
        loading="lazy"
        style={{ maxHeight: '512px', objectFit: 'contain' }}
        {...props}
      />
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
