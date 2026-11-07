import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError, getConversation, streamMessage, uploadImage } from "../api";
import type { Message } from "../api";
import MessageList from "../components/MessageList";
import type { LiveAnswer } from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import EmptyState from "../components/EmptyState";
import { useDocumentTitle } from "../useDocumentTitle";
import "./ChatPage.css";

// הצעות לשאלות שמופיעות בשיחה חדשה (לחיצה שולחת אותן)
const SUGGESTIONS = [
  "Tell me a one-liner programming joke",
  "Draw a cozy seaside café at sunset",
  "What day of the week is it today?",
  "כתוב לי שיר קצר על קפה של בוקר",
];

interface Props {
  onConversationsChanged: () => void;
}

export default function ChatPage({ onConversationsChanged }: Props) {
  const { id } = useParams();
  const conversationId = id ? Number(id) : null;
  const navigate = useNavigate();

  // אחרי יצירת שיחה חדשה, ההודעות הראשונות מגיעות עם הניווט כדי שיוצגו מיד
  const location = useLocation();
  const passedMessages = (location.state as { messages?: Message[] } | null)?.messages;

  const [messages, setMessages] = useState<Message[]>(passedMessages ?? []);
  const [isLoading, setIsLoading] = useState(conversationId !== null && !passedMessages);
  const [loadError, setLoadError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [title, setTitle] = useState(""); // כותרת השיחה (ללשונית הדפדפן ולקורא מסך)
  useDocumentTitle(conversationId === null ? "New chat" : title);
  const [isThinking, setIsThinking] = useState(false);
  // התשובה שנכתבת עכשיו (Streaming): הטקסט שהגיע עד כה, ושם הכלי שהסוכן מפעיל
  const [liveAnswer, setLiveAnswer] = useState<LiveAnswer | null>(null);
  const [sendError, setSendError] = useState<{ message: string; content: string; file: File | null } | null>(null);

  // האם המסך עדיין פתוח (כדי לא לעדכן מסך שהמשתמש כבר עזב)
  const isActive = useRef(true);
  useEffect(() => {
    isActive.current = true;
    return () => {
      isActive.current = false;
    };
  }, []);

  // ===== גלילה לסוף השיחה =====
  // שורת ההקלדה היא חלק מהדף ונמצאת אחרי ההודעות, אז כשגוללים עד סוף הדף ההודעה האחרונה גלויה מעליה
  const pageRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true); // האם המשתמש נמצא עכשיו בסוף השיחה

  function scrollToBottom() {
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" });
  }

  // הודעה חדשה, "חושב..." או כלי חדש: גוללים עד הסוף.
  // בזמן שהתשובה נכתבת, ה-ResizeObserver למטה שומר אותנו בסוף (אם המשתמש לא גלל למעלה).
  useEffect(() => {
    isAtBottom.current = true;
    scrollToBottom();
  }, [messages.length, isThinking]);

  // כשגובה הדף משתנה (שורת ההקלדה גדלה, תמונה צורפה או נטענה) ומי שהיה בסוף - נשאר בסוף
  useEffect(() => {
    function handleScroll() {
      const root = document.documentElement;
      isAtBottom.current = window.innerHeight + window.scrollY >= root.scrollHeight - 80;
    }
    const observer = new ResizeObserver(() => {
      if (isAtBottom.current) scrollToBottom();
    });
    if (pageRef.current) observer.observe(pageRef.current);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // טעינת השיחה מהשרת כשהמסך נפתח, ושוב בכל לחיצה על "נסה שוב"
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    if (conversationId === null) return;
    getConversation(conversationId)
      .then((data) => {
        if (!isActive.current) return;
        setMessages(data.messages);
        setTitle(data.title);
      })
      .catch((error) => {
        if (!isActive.current) return;
        if (error instanceof ApiError && error.status === 404) setNotFound(true);
        else setLoadError(error instanceof Error ? error.message : "Could not load the conversation.");
      })
      .finally(() => {
        if (isActive.current) setIsLoading(false);
      });
  }, [conversationId, reloadCount]);

  function retryLoad() {
    setLoadError("");
    setIsLoading(true);
    setReloadCount((count) => count + 1);
  }

  async function handleSend(content: string, file: File | null) {
    // אם ההודעה הקודמת נכשלה, מסירים אותה מהמסך (השרת לא שמר אותה)
    if (sendError) setMessages((prev) => prev.slice(0, -1));
    setSendError(null);
    // ההודעה של המשתמש מוצגת מיד, עוד לפני שהשרת ענה (התמונה מוצגת מהמחשב של המשתמש)
    const tempMessage: Message = {
      id: -Date.now(),
      conversation_id: conversationId ?? 0,
      role: "user",
      content,
      image_path: file ? URL.createObjectURL(file) : null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    setIsThinking(true);
    setLiveAnswer({ text: "", tool: "" });

    try {
      // קודם מעלים את התמונה (אם יש), ואז שולחים את ההודעה עם הנתיב שלה בשרת
      const imagePath = file ? (await uploadImage(file)).image_path : null;

      // התשובה מגיעה מילה אחר מילה. בשיחה חדשה, השיחה נוצרת בשרת רק בסוף התשובה.
      const data = await streamMessage(conversationId, content, imagePath, (event) => {
        if (!isActive.current) return;
        // הסוכן מפעיל כלי: מציגים חיווי, ומתחילים את הטקסט מחדש (התשובה הסופית תבוא אחרי הכלי)
        if (event.type === "tool") setLiveAnswer({ text: "", tool: event.name });
        if (event.type === "token") setLiveAnswer((prev) => ({ text: (prev?.text ?? "") + event.text, tool: "" }));
      });
      onConversationsChanged();
      if (!isActive.current) return;

      if (data.conversation) {
        navigate(`/c/${data.conversation.id}`, {
          replace: true,
          state: { messages: [data.user_message, data.assistant_message] },
        });
      } else {
        setMessages((prev) => [
          ...prev.filter((m) => m.id !== tempMessage.id),
          data.user_message,
          data.assistant_message,
        ]);
      }
    } catch (error) {
      if (!isActive.current) return;
      setSendError({
        message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        content,
        file,
      });
    } finally {
      if (isActive.current) {
        setIsThinking(false);
        setLiveAnswer(null);
      }
    }
  }

  // "נסה שוב": שולחים שוב את אותה הודעה (כולל התמונה)
  function handleRetry() {
    if (sendError) handleSend(sendError.content, sendError.file);
  }

  if (notFound) {
    return (
      <div className="chat-page is-empty">
        <div className="chat-notice">
          <h1>Conversation not found</h1>
          <p>It may have been deleted.</p>
          <Link to="/" className="button-secondary">Start a new chat</Link>
        </div>
      </div>
    );
  }

  const isEmpty = conversationId === null && messages.length === 0;

  return (
    <div ref={pageRef} className={isEmpty ? "chat-page is-empty" : "chat-page"}>
      <div className="chat-content">
        {/* כותרת ראשית לקורא מסך (במצב ריק יש כותרת גלויה) */}
        {!isEmpty && <h1 className="visually-hidden" dir="auto">{title || "Conversation"}</h1>}
        {isEmpty && <EmptyState />}

        {isLoading && <p className="chat-status" role="status">Loading conversation…</p>}

        {loadError && (
          <div className="error-box" role="alert">
            <span>{loadError}</span>
            <button type="button" className="button-secondary" onClick={retryLoad}>Try again</button>
          </div>
        )}

        <MessageList messages={messages} isThinking={isThinking} isLoading={isLoading} liveAnswer={liveAnswer} />

        {sendError && (
          <div className="error-box send-error" role="alert">
            <span>{sendError.message}</span>
            <button type="button" className="button-secondary" onClick={handleRetry}>Try again</button>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <ChatInput onSend={handleSend} disabled={isThinking || isLoading || loadError !== ""} />
        {isEmpty && (
          <ul className="suggestions" aria-label="Suggestions">
            {SUGGESTIONS.map((text) => (
              <li key={text}>
                <button type="button" className="suggestion" onClick={() => handleSend(text, null)} dir="auto">
                  {text}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
