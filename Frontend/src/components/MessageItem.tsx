import { useState } from "react";
import type { Message } from "../api";
import { CheckIcon, CopyIcon } from "./Icons";

export default function MessageItem({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // הדפדפן לא איפשר העתקה
    }
  }

  return (
    <article className={isUser ? "message message-user" : "message message-assistant"}>
      <span className="visually-hidden">{isUser ? "You said:" : "Assistant said:"}</span>
      {/* dir="auto": הודעה בעברית מוצגת מימין לשמאל */}
      <div className="message-content" dir="auto">
        {message.content}
      </div>

      {!isUser && (
        <button type="button" className="copy-button" onClick={handleCopy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      )}
    </article>
  );
}
