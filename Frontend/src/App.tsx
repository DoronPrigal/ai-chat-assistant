import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { deleteConversation, getConversations } from "./api";
import type { Conversation } from "./api";
import { useIsMobile } from "./useIsMobile";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import AboutPage from "./pages/AboutPage";
import "./App.css";

// הבחירה של המשתמש להציג או להסתיר את הסרגל במחשב נשמרת בדפדפן
function readSidebarChoice() {
  try {
    return localStorage.getItem("sidebarOpen") === "true";
  } catch {
    return false;
  }
}

function saveSidebarChoice(open: boolean) {
  try {
    localStorage.setItem("sidebarOpen", String(open));
  } catch {
    // אם הדפדפן חוסם שמירה, פשוט לא זוכרים את הבחירה
  }
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listError, setListError] = useState("");

  // במחשב: מוסתר כברירת מחדל ונשמר. בנייד: מגירה שנפתחת ונסגרת.
  const [desktopOpen, setDesktopOpen] = useState(readSidebarChoice);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarOpen = isMobile ? mobileOpen : desktopOpen;
  // useCallback: אותה פונקציה בכל רינדור, כי היא תלות של useEffect בסרגל
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);

  function loadConversations() {
    getConversations()
      .then((list) => {
        setConversations(list);
        setListError("");
      })
      .catch((error) => setListError(error instanceof Error ? error.message : "Could not load conversations."));
  }

  // טעינת רשימת השיחות פעם אחת, כשהאתר נפתח
  useEffect(() => {
    loadConversations();
  }, []);

  function toggleSidebar() {
    if (isMobile) {
      setMobileOpen(!mobileOpen);
    } else {
      setDesktopOpen(!desktopOpen);
      saveSidebarChoice(!desktopOpen);
    }
  }

  async function handleDelete(conversation: Conversation) {
    if (!window.confirm(`Delete "${conversation.title}"? This can't be undone.`)) return;
    try {
      await deleteConversation(conversation.id);
      setConversations((list) => list.filter((c) => c.id !== conversation.id));
      // אם מחקנו את השיחה הפתוחה, עוברים לשיחה חדשה
      if (location.pathname === `/c/${conversation.id}`) navigate("/");
    } catch (error) {
      setListError(error instanceof Error ? error.message : "Could not delete the conversation.");
    }
  }

  // key={location.key}: כל ניווט (שיחה אחרת או "שיחה חדשה") פותח את מסך הצ'אט מחדש ונקי
  const chatPage = <ChatPage key={location.key} onConversationsChanged={loadConversations} />;

  return (
    <div className={sidebarOpen ? "app sidebar-open" : "app"}>
      <a href="#main" className="skip-link">Skip to content</a>

      <Header sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} />

      <Sidebar
        open={sidebarOpen}
        isMobile={isMobile}
        conversations={conversations}
        error={listError}
        onRetry={loadConversations}
        onDelete={handleDelete}
        onClose={closeMobileSidebar}
      />

      <main id="main" className="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={chatPage} />
          <Route path="/c/:id" element={chatPage} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
