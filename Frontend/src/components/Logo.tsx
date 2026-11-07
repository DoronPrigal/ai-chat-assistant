// הלוגו (אפשרות C): קו מתאר של בועת צ'אט בצבע הטקסט, וניצוץ בצבע ההדגשה.
// הצבעים מגיעים ממשתני CSS, אז הלוגו משתנה לבד עם המצב הכהה/בהיר.
export default function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true" className="logo">
      <path
        d="M6 10.5a4.5 4.5 0 0 1 4.5-4.5h11a4.5 4.5 0 0 1 4.5 4.5v7a4.5 4.5 0 0 1-4.5 4.5h-5.6L10 27v-5.2a4.5 4.5 0 0 1-4-4.3z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <path d="M16 9.5l1.15 2.85L20 13.5l-2.85 1.15L16 17.5l-1.15-2.85L12 13.5l2.85-1.15z" fill="var(--logo-accent)" />
    </svg>
  );
}
