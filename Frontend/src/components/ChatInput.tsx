import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { SendIcon } from "./Icons";

interface Props {
  onSend: (content: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && text.trim() !== "";

  // שדה הטקסט גדל לפי התוכן (עד גובה מקסימלי ב-CSS)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [text]);

  // במחשב: הפוקוס חוזר לשדה כשאפשר לכתוב שוב (בנייד זה היה פותח את המקלדת)
  useEffect(() => {
    if (!disabled && window.matchMedia("(pointer: fine)").matches) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  function submit() {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  // Enter שולח, Shift+Enter יורד שורה
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <form className="chat-input glass" onSubmit={handleSubmit}>
      <label htmlFor="chat-message" className="visually-hidden">Message</label>
      <textarea
        id="chat-message"
        ref={textareaRef}
        rows={1}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask anything"
        dir="auto"
        maxLength={8000}
        aria-describedby="chat-hint"
      />
      <button type="submit" className="send-button" disabled={!canSend} aria-label="Send message">
        <SendIcon />
      </button>
      <span id="chat-hint" className="visually-hidden">Press Enter to send, Shift and Enter for a new line.</span>
    </form>
  );
}
