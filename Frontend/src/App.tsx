import { useCallback, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import {
  ApiError, clearToken, deleteConversation, getConversations, getMe, getToken, saveToken, setUnauthorizedHandler,
} from "./api";
import type { AuthResponse, Conversation, User } from "./api";
import { useIsMobile } from "./useIsMobile";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import ChatPage from "./pages/ChatPage";
import AboutPage from "./pages/AboutPage";
import AuthPage from "./pages/AuthPage";
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

  // המשתמש המחובר. אם יש טוקן שמור, מחכים לבדיקה מול השרת לפני שמציגים מסך.
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(() => getToken() === null);
  const [startupError, setStartupError] = useState("");
  // האם המשתמש נותק כי הטוקן פג (כדי להציג הודעה במסך ההתחברות)
  const [sessionExpired, setSessionExpired] = useState(false);

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [listError, setListError] = useState("");

  // במחשב: מוסתר כברירת מחדל ונשמר. בנייד: מגירה שנפתחת ונסגרת.
  const [desktopOpen, setDesktopOpen] = useState(readSidebarChoice);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarOpen = user !== null && (isMobile ? mobileOpen : desktopOpen);
  // useCallback: אותה פונקציה בכל רינדור, כי היא תלות של useEffect בסרגל
  const closeMobileSidebar = useCallback(() => setMobileOpen(false), []);

  // בכניסה לאתר: בודקים מול השרת שהטוקן השמור עדיין תקף
  useEffect(() => {
    if (getToken() === null) return;
    getMe()
      .then(setUser)
      .catch((error) => {
        // 401 מטופל ב-setUnauthorizedHandler. כשהשרת לא זמין מציגים הודעה, ולא מנתקים בשקט.
        if (error instanceof ApiError && error.status === 0) setStartupError(error.message);
      })
      .finally(() => setAuthChecked(true));
  }, []);

  // טוקן שפג תוקפו באמצע העבודה: מתנתקים ועוברים למסך ההתחברות
  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearToken();
      setUser(null);
      setConversations([]);
      setSessionExpired(true);
      // שומרים את הדף הנוכחי, כדי לחזור אליו אחרי ההתחברות
      navigate("/login", { state: { from: window.location.pathname } });
    });
  }, [navigate]);

  function loadConversations() {
    getConversations()
      .then((list) => {
        setConversations(list);
        setListError("");
      })
      .catch((error) => setListError(error instanceof Error ? error.message : "Could not load conversations."));
  }

  // טעינת השיחות של המשתמש אחרי שהוא התחבר
  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  function handleAuthenticated(data: AuthResponse) {
    saveToken(data.access_token);
    setUser(data.user);
    setSessionExpired(false);
  }

  function handleLogout() {
    clearToken();
    setSessionExpired(false);
    setUser(null);
    setConversations([]);
    setMobileOpen(false);
    navigate("/login");
  }

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

  // עד שהבדיקה של הטוקן מסתיימת לא מציגים כלום (לוקח רגע), כדי שלא יהבהב מסך ההתחברות
  if (!authChecked) return null;

  // השרת לא זמין בכניסה לאתר: הודעה ברורה עם אפשרות לנסות שוב
  if (startupError) {
    return (
      <main className="startup-error">
        <div className="error-box" role="alert">
          <span>{startupError}</span>
          <button type="button" className="button-secondary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </main>
    );
  }

  // מסך הצ'אט מוגן: בלי משתמש מחובר עוברים להתחברות, וזוכרים לאן רצו להגיע.
  // key={location.key}: כל ניווט (שיחה אחרת או "שיחה חדשה") פותח את מסך הצ'אט מחדש ונקי
  const chatPage = user ? (
    <ChatPage key={location.key} onConversationsChanged={loadConversations} />
  ) : (
    <Navigate to="/login" replace state={{ from: location.pathname }} />
  );

  // אחרי התחברות חוזרים לדף שהמשתמש רצה להגיע אליו (אבל לא שוב לדפי ההתחברות)
  const from = (location.state as { from?: string } | null)?.from;
  const afterLogin = from && from !== "/login" && from !== "/register" ? from : "/";

  return (
    <div className={sidebarOpen ? "app sidebar-open" : "app"}>
      <a href="#main" className="skip-link">Skip to content</a>

      <Header user={user} sidebarOpen={sidebarOpen} onToggleSidebar={toggleSidebar} onLogout={handleLogout} />

      {user && (
        <Sidebar
          open={sidebarOpen}
          isMobile={isMobile}
          username={user.username}
          conversations={conversations}
          error={listError}
          onRetry={loadConversations}
          onDelete={handleDelete}
          onClose={closeMobileSidebar}
        />
      )}

      <main id="main" className="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={chatPage} />
          <Route path="/c/:id" element={chatPage} />
          <Route path="/about" element={<AboutPage />} />
          <Route
            path="/login"
            element={user ? <Navigate to={afterLogin} replace /> : <AuthPage key="login" mode="login" sessionExpired={sessionExpired} onAuthenticated={handleAuthenticated} />}
          />
          <Route
            path="/register"
            element={user ? <Navigate to="/" replace /> : <AuthPage key="register" mode="register" sessionExpired={false} onAuthenticated={handleAuthenticated} />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
