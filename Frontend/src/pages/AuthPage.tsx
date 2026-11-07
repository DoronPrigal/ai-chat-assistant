import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { login, register } from "../api";
import type { AuthResponse } from "../api";
import "./AuthPage.css";

interface Props {
  mode: "login" | "register";
  sessionExpired: boolean;
  onAuthenticated: (data: AuthResponse) => void;
}

// מסך אחד להתחברות ולהרשמה. ההבדל: כותרות, רמזים וה-Endpoint.
export default function AuthPage({ mode, sessionExpired, onAuthenticated }: Props) {
  const isLogin = mode === "login";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // בדיקה בדפדפן לפני השליחה (אותם כללים כמו בשרת), כדי לתת הודעה ברורה מיד
  function validate() {
    const name = username.trim();
    if (!name || !password) return "Please enter a username and a password.";
    if (isLogin) return "";
    if (name.length < 3 || name.length > 30) return "Username must be 3–30 characters.";
    if (!/^[\p{L}\p{N}_.-]+$/u.test(name)) return "Username can contain only letters, numbers, dots, dashes and underscores.";
    if (password.length < 6) return "Password must be at least 6 characters.";
    // bcrypt בשרת מוגבל ל-72 בתים (אות בעברית = 2 בתים)
    if (new TextEncoder().encode(password).length > 72) return "Password is too long.";
    return "";
  }

  // קישור בין שדה לרמז שלו ולהודעת השגיאה, כדי שקורא מסך יקריא אותם
  function describedBy(hintId: string) {
    const ids = [isLogin ? "" : hintId, error ? "auth-error" : ""].filter(Boolean);
    return ids.length ? ids.join(" ") : undefined;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      const data = isLogin ? await login(username.trim(), password) : await register(username.trim(), password);
      onAuthenticated(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="auth-subtitle">
          {isLogin ? "Log in to continue your conversations." : "Sign up to save your conversations."}
        </p>

        {sessionExpired && isLogin && !error && (
          <p className="auth-info" role="alert">Your session has expired. Please log in again.</p>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              dir="auto"
              required
              maxLength={30}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy("username-hint")}
            />
            {!isLogin && <p id="username-hint" className="field-hint">3–30 characters: letters, numbers, . - _</p>}
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy("password-hint")}
            />
            {!isLogin && <p id="password-hint" className="field-hint">At least 6 characters</p>}
          </div>

          {error && <div id="auth-error" className="error-box" role="alert">{error}</div>}

          <button type="submit" className="button-primary" disabled={isSubmitting}>
            {isSubmitting ? (isLogin ? "Logging in…" : "Creating account…") : (isLogin ? "Log in" : "Sign up")}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <Link to={isLogin ? "/register" : "/login"}>{isLogin ? "Sign up" : "Log in"}</Link>
        </p>
      </div>
    </div>
  );
}
