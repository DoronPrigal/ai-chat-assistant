import { useEffect } from "react";

// כותרת הלשונית בדפדפן לפי הדף (קורא מסך מקריא אותה במעבר בין דפים)
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · AI Chat` : "AI Chat Assistant";
  }, [title]);
}
