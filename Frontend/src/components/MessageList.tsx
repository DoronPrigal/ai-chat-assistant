import type { Message } from "../api";
import MessageItem from "./MessageItem";

interface Props {
  messages: Message[];
  isThinking: boolean;
  isLoading: boolean;
}

// הגלילה האוטומטית לסוף השיחה נמצאת ב-ChatPage, כי היא תלויה גם בגובה שורת ההקלדה
export default function MessageList({ messages, isThinking, isLoading }: Props) {
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
    </div>
  );
}
