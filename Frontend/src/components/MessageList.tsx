import { useEffect, useRef } from "react";
import type { Message } from "../api";
import MessageItem from "./MessageItem";

interface Props {
  messages: Message[];
  isThinking: boolean;
  isLoading: boolean;
}

export default function MessageList({ messages, isThinking, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // גלילה אוטומטית להודעה האחרונה
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, isThinking]);

  return (
    // role="log": קורא מסך מקריא הודעות חדשות שנוספות לרשימה
    <div className="message-list" role="log" aria-live="polite" aria-busy={isLoading} aria-label="Conversation">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {isThinking && (
        <div className="thinking" role="status">
          <span className="thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          Thinking…
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
