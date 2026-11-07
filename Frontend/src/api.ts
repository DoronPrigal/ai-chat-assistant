// כל הפניות לשרת במקום אחד. ה-Frontend לא פונה ל-OpenAI ישירות, אלא רק ל-API שלנו.
const API_URL = "http://localhost:8000/api";
const TOKEN_KEY = "token";

export type Role = "user" | "assistant";

export interface User {
  id: number;
  username: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface Message {
  id: number;
  conversation_id: number;
  role: Role;
  content: string;
  image_path: string | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
}

export interface SendMessageResponse {
  user_message: Message;
  assistant_message: Message;
}

export interface NewConversationResponse extends SendMessageResponse {
  conversation: Conversation;
}

// שגיאה עם קוד ה-HTTP, כדי שהמסך יוכל להגיב אחרת ל-404 למשל
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ===== הטוקן (JWT) נשמר בדפדפן ונשלח בכל בקשה =====
export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // אם הדפדפן חוסם שמירה, המשתמש יצטרך להתחבר שוב אחרי רענון
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // אין מה לנקות
  }
}

// מה עושים כשהשרת מחזיר 401 (טוקן שפג תוקפו). App קובע את זה.
let handleUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  handleUnauthorized = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(API_URL + path, { ...options, headers });
  } catch {
    throw new ApiError("Can't reach the server. Please check that it is running and try again.", 0);
  }

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
      // שגיאת ולידציה של Pydantic (422) מגיעה כרשימה
      else if (Array.isArray(data.detail) && data.detail[0]?.msg) message = data.detail[0].msg;
    } catch {
      // התשובה לא הייתה JSON, נשארים עם ההודעה הכללית
    }
    // 401 בהתחברות או בהרשמה הוא סיסמה שגויה, לא טוקן שפג תוקפו
    const isLoginOrRegister = path === "/auth/login" || path === "/auth/register";
    if (response.status === 401 && token && !isLoginOrRegister && handleUnauthorized) handleUnauthorized();
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// ===== משתמשים =====
export function register(username: string, password: string) {
  return request<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function login(username: string, password: string) {
  return request<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function getMe() {
  return request<User>("/auth/me");
}

// ===== שיחות =====
export function getConversations() {
  return request<Conversation[]>("/conversations");
}

export function getConversation(id: number) {
  return request<ConversationDetail>(`/conversations/${id}`);
}

// שיחה חדשה נוצרת בשרת רק יחד עם ההודעה הראשונה
export function createConversation(content: string) {
  return request<NewConversationResponse>("/conversations", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function sendMessage(conversationId: number, content: string) {
  return request<SendMessageResponse>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export function deleteConversation(id: number) {
  return request<void>(`/conversations/${id}`, { method: "DELETE" });
}
