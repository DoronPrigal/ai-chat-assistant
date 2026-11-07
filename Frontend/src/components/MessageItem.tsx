import { useState } from "react";
import { imageUrl } from "../api";
import type { Message } from "../api";
import { CheckIcon, CopyIcon } from "./Icons";
import Markdown from "./Markdown";

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

      {/* תמונה שהמשתמש צירף או שהסוכן יצר. לחיצה פותחת אותה בגודל מלא. */}
      {message.image_path && (
        <a href={imageUrl(message.image_path)} target="_blank" rel="noreferrer" className="message-image-link">
          <img
            src={imageUrl(message.image_path)}
            alt={isUser ? "Image you attached (opens full size)" : "Image created by the assistant (opens full size)"}
            className={isUser ? "message-image" : "message-image message-image-generated"}
            loading="lazy"
          />
        </a>
      )}

      {/* הודעת המשתמש כטקסט רגיל, ותשובת הסוכן כ-Markdown (רשימות, הדגשה, קוד וטבלאות).
          dir="auto": הודעה בעברית מוצגת מימין לשמאל */}
      {message.content && isUser && (
        <div className="message-content" dir="auto">
          {message.content}
        </div>
      )}
      {message.content && !isUser && (
        <div className="message-content">
          <Markdown text={message.content} />
        </div>
      )}

      {!isUser && message.content && (
        <button type="button" className="copy-button" onClick={handleCopy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
        </button>
      )}
    </article>
  );
}
