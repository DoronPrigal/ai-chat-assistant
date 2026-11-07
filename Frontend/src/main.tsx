import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// העיצוב הכללי נטען ראשון, כדי שהעיצוב של כל רכיב יוכל לדרוס אותו
import "./index.css";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* אם רכיב כלשהו קורס, מוצגת הודעה ידידותית עם כפתור Reload במקום מסך ריק */}
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
