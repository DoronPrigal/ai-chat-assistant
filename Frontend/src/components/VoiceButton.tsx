import { useEffect, useRef, useState } from "react";
import { MicIcon } from "./Icons";

// ===== Web Speech API של הדפדפן (חינמי, בלי ספרייה) =====
// TypeScript לא מכיר את ה-API הזה, אז מגדירים רק את מה שאנחנו משתמשים בו
interface SpeechResultList {
  length: number;
  [index: number]: { 0: { transcript: string } };
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

// Chrome ו-Edge מספקים webkitSpeechRecognition. בדפדפן בלי תמיכה (למשל Firefox) הכפתור לא מוצג.
const RecognitionClass = (window as unknown as {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
}).SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => Recognition }).webkitSpeechRecognition;

const LANGUAGES = { "he-IL": "Hebrew", "en-US": "English" } as const;
type Language = keyof typeof LANGUAGES;

const ERRORS: Record<string, string> = {
  "not-allowed": "Microphone access is blocked. Allow it in the browser settings.",
  "service-not-allowed": "Microphone access is blocked. Allow it in the browser settings.",
  "no-speech": "No speech was detected. Please try again.",
  "audio-capture": "No microphone was found.",
  network: "Voice input needs an internet connection.",
};

// שפת ההקלטה נשמרת בדפדפן. ברירת מחדל: לפי שפת הדפדפן.
function readLanguage(): Language {
  try {
    const saved = localStorage.getItem("speechLang");
    if (saved === "he-IL" || saved === "en-US") return saved;
  } catch {
    // אין גישה לשמירה
  }
  return navigator.language.startsWith("he") ? "he-IL" : "en-US";
}

interface Props {
  onStart: () => void; // ההקלטה התחילה (שומרים את הטקסט שכבר נכתב)
  onTranscript: (spoken: string) => void; // הטקסט שזוהה עד עכשיו
  onError: (message: string) => void;
}

export default function VoiceButton({ onStart, onTranscript, onError }: Props) {
  const [listening, setListening] = useState(false);
  const [language, setLanguage] = useState<Language>(readLanguage);
  const recognitionRef = useRef<Recognition | null>(null);

  // כשהרכיב יורד מהמסך (למשל אחרי שליחת הודעה) - מפסיקים להקשיב
  useEffect(() => () => recognitionRef.current?.abort(), []);

  if (!RecognitionClass) return null;
  const SpeechRecognition = RecognitionClass;

  function start() {
    const recognition = new SpeechRecognition();
    recognition.lang = language;
    recognition.interimResults = true; // הטקסט מופיע תוך כדי דיבור
    recognition.continuous = true; // ממשיך עד שלוחצים שוב (או עד שקט ארוך)
    recognition.onresult = (event) => {
      let spoken = "";
      for (let i = 0; i < event.results.length; i++) spoken += event.results[i][0].transcript;
      onTranscript(spoken);
    };
    recognition.onerror = (event) => {
      if (event.error !== "aborted") onError(ERRORS[event.error] ?? "Voice input failed. Please try again.");
    };
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    onError("");
    onStart();
    recognition.start();
    setListening(true);
  }

  function toggleLanguage() {
    const next: Language = language === "he-IL" ? "en-US" : "he-IL";
    setLanguage(next);
    try {
      localStorage.setItem("speechLang", next);
    } catch {
      // אין גישה לשמירה
    }
  }

  const otherLanguage = language === "he-IL" ? "English" : "Hebrew";
  const code = language === "he-IL" ? "HE" : "EN"; // הטקסט שמוצג על הכפתור

  return (
    <>
      <button
        type="button"
        className="voice-language"
        onClick={toggleLanguage}
        disabled={listening}
        // השם הנגיש כולל את הטקסט הגלוי (HE/EN), כדי שגם שליטה קולית ("click HE") תמצא אותו
        aria-label={`Voice input language ${code} (${LANGUAGES[language]}). Switch to ${otherLanguage}`}
        title={`Voice input language: ${LANGUAGES[language]}`}
      >
        {code}
      </button>
      <button
        type="button"
        className={listening ? "icon-button voice-button listening" : "icon-button voice-button"}
        onClick={() => (listening ? recognitionRef.current?.stop() : start())}
        aria-pressed={listening}
        aria-label="Voice input"
        title={listening ? "Stop voice input" : `Voice input (${LANGUAGES[language]})`}
      >
        <MicIcon />
      </button>
      <span className="visually-hidden" role="status">{listening ? "Listening…" : ""}</span>
    </>
  );
}
