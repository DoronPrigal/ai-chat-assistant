import { useRef, useState } from "react";
import type { ComponentProps } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { CheckIcon, CopyIcon } from "./Icons";

// בלוק קוד: תמיד משמאל לימין, עם כפתור העתקה
function CodeBlock({ children }: ComponentProps<"pre">) {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(preRef.current?.innerText ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // הדפדפן לא איפשר העתקה
    }
  }

  return (
    <div className="code-block">
      <button type="button" className="code-copy" onClick={handleCopy}>
        {copied ? <CheckIcon /> : <CopyIcon />}
        <span aria-live="polite">{copied ? "Copied" : "Copy code"}</span>
      </button>
      {/* tabIndex: קוד ארוך נגלל לרוחב, וכך אפשר לגלול אותו גם במקלדת */}
      <pre ref={preRef} dir="ltr" tabIndex={0} aria-label="Code">{children}</pre>
    </div>
  );
}

// התאמות לתגיות: dir="auto" לכל פסקה (עברית מימין לשמאל), וקישורים בלשונית חדשה.
// node הוא מידע פנימי של react-markdown. מוציאים אותו (_node) כדי שלא יגיע ל-HTML.
const components: Components = {
  pre: ({ node: _node, ...props }) => <CodeBlock {...props} />,
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
  p: ({ node: _node, ...props }) => <p dir="auto" {...props} />,
  li: ({ node: _node, ...props }) => <li dir="auto" {...props} />,
  h1: ({ node: _node, ...props }) => <h3 dir="auto" {...props} />,
  h2: ({ node: _node, ...props }) => <h3 dir="auto" {...props} />,
  h3: ({ node: _node, ...props }) => <h4 dir="auto" {...props} />,
  blockquote: ({ node: _node, ...props }) => <blockquote dir="auto" {...props} />,
  // טבלה רחבה נגללת בתוך המסגרת שלה, ולא מרחיבה את הדף
  table: ({ node: _node, ...props }) => (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Table">
      <table {...props} />
    </div>
  ),
};

// תשובת הסוכן כ-Markdown. react-markdown לא מריץ HTML מהטקסט, כך שאין סכנת XSS.
export default function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
