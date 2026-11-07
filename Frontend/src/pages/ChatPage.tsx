import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";

import { ApiError, createConversation, getConversation, sendMessage } from "../api";
import type { Message } from "../api";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import EmptyState from "../components/EmptyState";
import "./ChatPage.css";

// הצעות לשאלות שמופיעות בשיחה חדשה (לחיצה שולחת אותן)
const SUGGESTIONS = [
  "Tell me a one-liner programming joke",
  "Explain React hooks in simple words",
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
  const [isThinking, setIsThinking] = useState(false);
  const [sendError, setSendError] = useState<{ message: string; content: string } | null>(null);

  // האם המסך עדיין פתוח (כדי לא לעדכן מסך שהמשתמש כבר עזב)
  const isActive = useRef(true);
  useEffect(() => {
    isActive.current = true;
    return () => {
      isActive.current = false;
    };
  }, []);

  // טעינת השיחה מהשרת כשהמסך נפתח, ושוב בכל לחיצה על "נסה שוב"
  const [reloadCount, setReloadCount] = useState(0);
  useEffect(() => {
    if (conversationId === null) return;
    getConversation(conversationId)
      .then((data) => {
        if (isActive.current) setMessages(data.messages);
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

  async function handleSend(content: string) {
    // אם ההודעה הקודמת נכשלה, מסירים אותה מהמסך (השרת לא שמר אותה)
    if (sendError) setMessages((prev) => prev.slice(0, -1));
    setSendError(null);
    // ההודעה של המשתמש מוצגת מיד, עוד לפני שהשרת ענה
    const tempMessage: Message = {
      id: -Date.now(),
      conversation_id: conversationId ?? 0,
      role: "user",
      content,
      image_path: null,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);
    setIsThinking(true);

    try {
      if (conversationId === null) {
        // שיחה חדשה נוצרת בשרת רק עכשיו, יחד עם ההודעה הראשונה
        const data = await createConversation(content);
        onConversationsChanged();
        if (!isActive.current) return;
        navigate(`/c/${data.conversation.id}`, {
          replace: true,
          state: { messages: [data.user_message, data.assistant_message] },
        });
      } else {
        const data = await sendMessage(conversationId, content);
        onConversationsChanged();
        if (!isActive.current) return;
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
      });
    } finally {
      if (isActive.current) setIsThinking(false);
    }
  }

  // "נסה שוב": שולחים שוב את אותה הודעה
  function handleRetry() {
    if (sendError) handleSend(sendError.content);
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
    <div className={isEmpty ? "chat-page is-empty" : "chat-page"}>
      <div className="chat-content">
        {isEmpty && <EmptyState />}

        {isLoading && <p className="chat-status" role="status">Loading conversation…</p>}

        {loadError && (
          <div className="error-box" role="alert">
            <span>{loadError}</span>
            <button type="button" className="button-secondary" onClick={retryLoad}>Try again</button>
          </div>
        )}

        <MessageList messages={messages} isThinking={isThinking} isLoading={isLoading} />

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
                <button type="button" className="suggestion" onClick={() => handleSend(text)} dir="auto">
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
