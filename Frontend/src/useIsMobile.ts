import { useEffect, useState } from "react";

const MOBILE_QUERY = "(max-width: 899px)";

// מחזיר true כשהמסך צר (נייד). מתעדכן כשמשנים את גודל החלון.
export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => setIsMobile(media.matches);
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  return isMobile;
}
