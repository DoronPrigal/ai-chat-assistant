import type { Message } from "../api";
import MessageItem from "./MessageItem";
import Markdown from "./Markdown";

// התשובה שנכתבת עכשיו (Streaming)
export interface LiveAnswer {
  text: string; // הטקסט שהגיע עד כה
  tool: string; // הכלי שהסוכן מפעיל עכשיו (או ריק)
}

// חיווי לכל כלי של הסוכן
const TOOL_LABELS: Record<string, string> = {
  get_weather: "Checking the weather…",
  get_current_datetime: "Checking the date…",
  generate_image: "Creating an image…",
};

interface Props {
  messages: Message[];
  isThinking: boolean;
  isLoading: boolean;
  liveAnswer: LiveAnswer | null;
}

// הגלילה האוטומטית לסוף השיחה נמצאת ב-ChatPage, כי היא תלויה גם בגובה שורת ההקלדה
export default function MessageList({ messages, isThinking, isLoading, liveAnswer }: Props) {
  const liveText = liveAnswer?.text ?? "";
  const status = liveText ? "Writing the answer…" : TOOL_LABELS[liveAnswer?.tool ?? ""] ?? "Thinking…";

  return (
    <>
      {/* role="log": קורא מסך מקריא הודעות חדשות שנוספות לרשימה (התשובה נוספת רק כשהיא מלאה) */}
      <div className="message-list" role="log" aria-live="polite" aria-busy={isLoading} aria-label="Conversation">
        {messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>

      {isThinking && (
        <div className="live-answer">
          {/* הטקסט שנכתב מילה אחר מילה: רק למראה. aria-hidden כדי שקורא מסך לא יקריא כל מילה בנפרד. */}
          {liveText && (
            <article className="message message-assistant message-new" aria-hidden="true">
              <div className="message-content">
                <Markdown text={liveText} />
              </div>
            </article>
          )}

          {/* חיווי אחד שמשתנה רק כמה פעמים: "Thinking…", "Checking the weather…", "Writing the answer…" */}
          <div className={liveText ? "visually-hidden" : "thinking"} role="status">
            {!liveText && (
              <span className="thinking-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            )}
            {status}
          </div>
        </div>
      )}
    </>
  );
}
