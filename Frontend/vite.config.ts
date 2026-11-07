import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  // פורט קבוע: ה-Backend מאפשר CORS רק לכתובת הזו. אם הפורט תפוס, Vite יציג שגיאה במקום לעבור לפורט אחר.
  server: { port: 5173, strictPort: true },
})
