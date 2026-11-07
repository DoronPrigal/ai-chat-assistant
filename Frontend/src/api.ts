// כל הפניות לשרת במקום אחד. ה-Frontend לא פונה ל-OpenAI ישירות, אלא רק ל-API שלנו.
const SERVER_URL = "http://localhost:8000";
const API_URL = SERVER_URL + "/api";
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

// שולח בקשה לשרת ומחזיר את התשובה. שגיאה (או שרת שלא זמין) הופכת ל-ApiError עם הודעה ברורה.
async function send(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {};
  // בקובץ (FormData) הדפדפן קובע את ה-Content-Type בעצמו
  if (!(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
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
  return response;
}

// בקשה רגילה: התשובה היא JSON
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await send(path, options);
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

// ===== Streaming: התשובה מגיעה מילה אחר מילה =====
// השרת שולח שורת JSON לכל אירוע (NDJSON):
//   tool  - הסוכן מפעיל כלי (למשל get_weather)
//   token - עוד חלק מהתשובה
//   done  - התשובה נשמרה: ההודעות השמורות (ובשיחה חדשה גם השיחה)
//   error - הסוכן נכשל באמצע
export type StreamEvent =
  | { type: "tool"; name: string }
  | { type: "token"; text: string }
  | ({ type: "done"; conversation?: Conversation } & SendMessageResponse)
  | { type: "error"; message: string };

export type StreamDone = Extract<StreamEvent, { type: "done" }>;

// שולח הודעה ומעביר כל אירוע ל-onEvent. מחזיר את אירוע הסיום (ההודעות השמורות).
// בלי conversationId: שיחה חדשה, שנשמרת רק בסוף התשובה.
export async function streamMessage(
  conversationId: number | null,
  content: string,
  imagePath: string | null,
  onEvent: (event: StreamEvent) => void,
): Promise<StreamDone> {
  const path = conversationId === null ? "/conversations/stream" : `/conversations/${conversationId}/messages/stream`;
  const response = await send(path, { method: "POST", body: JSON.stringify({ content, image_path: imagePath }) });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = ""; // חלק של שורה שעוד לא הגיעה עד הסוף
  let done: StreamDone | null = null;

  try {
    while (true) {
      const { value, done: finished } = await reader.read();
      if (finished) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event: StreamEvent = JSON.parse(line);
        if (event.type === "error") throw new ApiError(event.message, 502);
        if (event.type === "done") done = event;
        onEvent(event);
      }
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("The connection was interrupted. Please try again.", 0);
  }

  if (!done) throw new ApiError("The answer was interrupted. Please try again.", 0);
  return done;
}

// ===== תמונות =====
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB, כמו בשרת

// מעלה תמונה ומחזיר את הנתיב שלה בשרת, לצירוף להודעה
export function uploadImage(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<{ image_path: string }>("/uploads", { method: "POST", body: form });
}

// כתובת מלאה לתמונה: נתיב מהשרת (/uploads/...), או תצוגה מקדימה מקומית (blob:)
export function imageUrl(path: string) {
  return path.startsWith("/uploads/") ? SERVER_URL + path : path;
}

export function deleteConversation(id: number) {
  return request<void>(`/conversations/${id}`, { method: "DELETE" });
}
