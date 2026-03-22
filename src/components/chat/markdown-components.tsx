import type { Components } from "react-markdown";

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
      <pre className={["chat-markdown-pre", className].filter(Boolean).join(" ")} {...props}>
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
            : ["chat-markdown-code-block", className].filter(Boolean).join(" ")
        }
        {...props}
      >
        {children}
      </code>
    );
  },
};
