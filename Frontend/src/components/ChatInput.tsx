import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent, FormEvent, KeyboardEvent } from "react";
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "../api";
import { CloseIcon, PaperclipIcon, SendIcon } from "./Icons";
import VoiceButton from "./VoiceButton";

// מחבר את מה שנאמר בקול לטקסט שכבר היה כתוב בשדה
function joinSpoken(before: string, spoken: string) {
  const text = spoken.trim();
  if (!before.trim()) return text;
  return before.endsWith(" ") ? before + text : `${before} ${text}`;
}

interface Props {
  onSend: (content: string, file: File | null) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(""); // כתובת זמנית להצגת התמונה לפני השליחה
  const [inputError, setInputError] = useState(""); // שגיאה בצירוף תמונה או בהקלטה קולית
  const textBeforeVoice = useRef(""); // הטקסט שהיה בשדה כשההקלטה התחילה
  const [sendCount, setSendCount] = useState(0); // משמש כ-key: אחרי שליחה כפתור ההקלטה מתאפס ומפסיק להקשיב
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canSend = !disabled && (text.trim() !== "" || file !== null);

  // שדה הטקסט גדל לפי התוכן (עד גובה מקסימלי ב-CSS)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [text]);

  // במחשב: הפוקוס חוזר לשדה כשאפשר לכתוב שוב (בנייד זה היה פותח את המקלדת)
  useEffect(() => {
    if (!disabled && window.matchMedia("(pointer: fine)").matches) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  // בחירת תמונה: בדיקת סוג וגודל כבר בדפדפן (השרת בודק שוב)
  function chooseFile(chosen: File) {
    if (!ALLOWED_IMAGE_TYPES.includes(chosen.type)) {
      setInputError("Only PNG, JPEG, WebP or GIF images are allowed.");
      return;
    }
    if (chosen.size > MAX_IMAGE_SIZE) {
      setInputError("The image is too large. The maximum size is 5 MB.");
      return;
    }
    removeFile();
    setFile(chosen);
    setPreview(URL.createObjectURL(chosen));
  }

  function removeFile() {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview("");
    setInputError("");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const chosen = event.target.files?.[0];
    if (chosen) chooseFile(chosen);
    event.target.value = ""; // כדי שאפשר יהיה לבחור שוב את אותו קובץ
  }

  // הדבקת תמונה (Ctrl+V) ישר לשדה ההודעה
  function handlePaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = Array.from(event.clipboardData.files).find((f) => f.type.startsWith("image/"));
    if (pasted) {
      event.preventDefault();
      chooseFile(pasted);
    }
  }

  function submit() {
    if (!canSend) return;
    onSend(text.trim(), file);
    setText("");
    removeFile();
    setSendCount((count) => count + 1);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
  }

  // Enter שולח, Shift+Enter יורד שורה
  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <>
      <form className="chat-input glass" onSubmit={handleSubmit}>
        {preview && (
          <div className="attachment">
            <img src={preview} alt="Attached image preview" />
            <button type="button" className="attachment-remove" onClick={removeFile} aria-label="Remove attached image">
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="chat-input-row">
          <button
            type="button"
            className="icon-button"
            onClick={() => fileInputRef.current?.click()}
            aria-label="Attach image"
            title="Attach image"
          >
            <PaperclipIcon />
          </button>
          <input ref={fileInputRef} type="file" accept={ALLOWED_IMAGE_TYPES.join(",")} onChange={handleFileChange} hidden />

          <label htmlFor="chat-message" className="visually-hidden">Message</label>
          <textarea
            id="chat-message"
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Ask anything"
            dir="auto"
            maxLength={8000}
            aria-describedby="chat-hint"
          />
          {/* הקלטה קולית: הטקסט נכנס לשדה ולא נשלח, כדי שאפשר יהיה לערוך לפני שליחה */}
          <VoiceButton
            key={sendCount}
            onStart={() => {
              textBeforeVoice.current = text;
            }}
            onTranscript={(spoken) => setText(joinSpoken(textBeforeVoice.current, spoken))}
            onError={setInputError}
          />
          <button type="submit" className="send-button" disabled={!canSend} aria-label="Send message">
            <SendIcon />
          </button>
        </div>
        <span id="chat-hint" className="visually-hidden">
          Press Enter to send, Shift and Enter for a new line. You can attach or paste an image.
        </span>
      </form>

      {inputError && <p className="input-error" role="alert">{inputError}</p>}
    </>
  );
}
