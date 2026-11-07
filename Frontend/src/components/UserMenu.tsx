import { useEffect, useRef, useState } from "react";
import type { FocusEvent } from "react";
import { LogoutIcon } from "./Icons";

interface Props {
  username: string;
  onLogout: () => void;
}

// עיגול עם האות הראשונה של שם המשתמש. לחיצה פותחת תפריט קטן עם שם המשתמש והתנתקות.
export default function UserMenu({ username, onLogout }: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const logoutRef = useRef<HTMLButtonElement>(null);

  // כשהתפריט פתוח: הפוקוס עובר אליו, Escape סוגר, ולחיצה מחוץ לתפריט סוגרת
  useEffect(() => {
    if (!open) return;
    logoutRef.current?.focus();

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // מעבר ב-Tab אל מחוץ לתפריט סוגר אותו
  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (!containerRef.current?.contains(event.relatedTarget as Node)) setOpen(false);
  }

  return (
    <div className="user-menu" ref={containerRef} onBlur={handleBlur}>
      <button
        ref={buttonRef}
        type="button"
        className="avatar avatar-button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="user-menu-panel"
        aria-label={`Account menu (${username})`}
        title={username}
      >
        {username.charAt(0).toUpperCase()}
      </button>

      {open && (
        <div id="user-menu-panel" className="user-menu-panel">
          <p className="user-menu-name">
            Signed in as <strong dir="auto">{username}</strong>
          </p>
          <button ref={logoutRef} type="button" className="user-menu-item" onClick={onLogout}>
            <LogoutIcon />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
