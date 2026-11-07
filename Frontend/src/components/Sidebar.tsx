import { useEffect, useRef } from "react";
import { Link, NavLink } from "react-router-dom";
import type { Conversation } from "../api";
import { CloseIcon, PlusIcon, TrashIcon } from "./Icons";

interface Props {
  open: boolean;
  isMobile: boolean;
  conversations: Conversation[];
  error: string;
  onRetry: () => void;
  onDelete: (conversation: Conversation) => void;
  onClose: () => void;
}

export default function Sidebar({ open, isMobile, conversations, error, onRetry, onDelete, onClose }: Props) {
  const newChatRef = useRef<HTMLAnchorElement>(null);
  const isDrawer = isMobile && open;

  // בנייד: פוקוס לתוך המגירה כשהיא נפתחת, Escape סוגר אותה,
  // ובסגירה הפוקוס חוזר לכפתור שפתח אותה
  useEffect(() => {
    if (!isDrawer) return;
    const opener = document.activeElement as HTMLElement | null;
    newChatRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      opener?.focus();
    };
  }, [isDrawer, onClose]);

  // בנייד המגירה נסגרת אחרי בחירה. במחשב הסרגל נשאר פתוח.
  const handleNavigate = isMobile ? onClose : undefined;

  return (
    <>
      {isDrawer && <div className="sidebar-backdrop" onClick={onClose} />}

      <aside id="sidebar" className={open ? "sidebar glass open" : "sidebar glass"} aria-label="Conversations" inert={!open}>
        <div className="sidebar-top">
          <Link to="/" className="new-chat-button" onClick={handleNavigate} ref={newChatRef}>
            <PlusIcon />
            New chat
          </Link>
          {isMobile && (
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close conversations">
              <CloseIcon />
            </button>
          )}
        </div>

        <h2 className="sidebar-heading">Recent</h2>

        {error && (
          <div className="error-box" role="alert">
            <span>{error}</span>
            <button type="button" className="button-secondary" onClick={onRetry}>Try again</button>
          </div>
        )}

        {!error && conversations.length === 0 && <p className="sidebar-empty">No conversations yet.</p>}

        <ul className="conversation-list">
          {conversations.map((conversation) => (
            <li key={conversation.id} className="conversation-item">
              <NavLink to={`/c/${conversation.id}`} className="conversation-link" onClick={handleNavigate} dir="auto">
                {conversation.title}
              </NavLink>
              <button
                type="button"
                className="icon-button delete-button"
                onClick={() => onDelete(conversation)}
                aria-label={`Delete conversation: ${conversation.title}`}
              >
                <TrashIcon />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </>
  );
}
