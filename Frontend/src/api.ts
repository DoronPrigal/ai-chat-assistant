// כל הפניות לשרת במקום אחד. ה-Frontend לא פונה ל-OpenAI ישירות, אלא רק ל-API שלנו.
const API_URL = "http://localhost:8000/api";

export type Role = "user" | "assistant";

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

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(API_URL + path, {
      ...options,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    throw new ApiError("Can't reach the server. Please check that it is running and try again.", 0);
  }

  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {
      // התשובה לא הייתה JSON, נשארים עם ההודעה הכללית
    }
    throw new ApiError(message, response.status);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

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
