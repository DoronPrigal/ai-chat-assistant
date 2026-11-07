import { Link, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import { PlusIcon, SidebarIcon } from "./Icons";

interface Props {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}

export default function Header({ sidebarOpen, onToggleSidebar }: Props) {
  const { pathname } = useLocation();
  const isChat = pathname === "/" || pathname.startsWith("/c/");

  return (
    <header className="header glass">
      <button
        type="button"
        className="icon-button"
        onClick={onToggleSidebar}
        aria-label={sidebarOpen ? "Hide conversations" : "Show conversations"}
        aria-expanded={sidebarOpen}
        aria-controls="sidebar"
      >
        <SidebarIcon />
      </button>

      {/* "שיחה חדשה" זמין תמיד, גם כשסרגל השיחות מוסתר */}
      <Link to="/" className="icon-button" aria-label="New chat" title="New chat">
        <PlusIcon />
      </Link>

      <Link to="/" className="brand" aria-label="AI Chat – home">
        <img src="/favicon.svg" alt="" width={28} height={28} />
        <span className="brand-name">AI Chat</span>
      </Link>

      <nav className="main-nav" aria-label="Main">
        <Link to="/" className="nav-link" aria-current={isChat ? "page" : undefined}>Chat</Link>
        <Link to="/about" className="nav-link" aria-current={pathname === "/about" ? "page" : undefined}>About</Link>
      </nav>

      <ThemeToggle />
    </header>
  );
}
