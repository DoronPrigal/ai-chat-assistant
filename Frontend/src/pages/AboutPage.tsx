import { aboutMe } from "../aboutMe";
import "./AboutPage.css";

const TECHNOLOGIES = ["React", "TypeScript", "Vite", "Python", "FastAPI", "Pydantic", "LangGraph", "OpenAI", "MySQL", "Docker"];

const FEATURES = [
  "Conversations that keep their context",
  "Multiple chats you can return to",
  "Answers in your language (English or Hebrew)",
  "Light and dark mode",
  "Keyboard and screen reader friendly",
  "Works on mobile and desktop",
];

export default function AboutPage() {
  return (
    <div className="about">
      <header className="about-hero">
        <h1>About this project</h1>
        <p>A ChatGPT-style assistant built from scratch as a Full Stack final project.</p>
      </header>

      {/* סדר הכרטיסים: שורה 1 - עליי (רחב) והמערכת. שורה 2 - יכולות, איך זה עובד, טכנולוגיות */}
      <div className="bento">
        <section className="card card-wide card-me">
          <h2>About me</h2>
          <p className="me-name">{aboutMe.name}</p>
          <p className="me-role">{aboutMe.role}</p>
          <p>{aboutMe.bio}</p>
          <div className="me-links">
            <a className="button-secondary" href={aboutMe.githubUrl} target="_blank" rel="noreferrer">GitHub</a>
            <a className="button-secondary" href={aboutMe.linkedinUrl} target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </section>

        <section className="card">
          <h2>The system</h2>
          <p>
            AI Chat lets you hold real, ongoing conversations with an AI assistant. Every message is saved, so you can
            start a new chat at any time, come back to an earlier one, and continue exactly where you stopped.
          </p>
        </section>

        <section className="card">
          <h2>Features</h2>
          <ul className="feature-list">
            {FEATURES.map((feature) => (
              <li key={feature}>{feature}</li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>How it works</h2>
          <ol className="flow">
            <li>React sends your message to the server</li>
            <li>FastAPI loads the conversation from MySQL</li>
            <li>A LangGraph agent asks OpenAI, using tools when needed</li>
            <li>The answer is saved and shown in the chat</li>
          </ol>
          <a href={aboutMe.repoUrl} target="_blank" rel="noreferrer">View the code on GitHub</a>
        </section>

        <section className="card">
          <h2>Technologies</h2>
          <ul className="chips">
            {TECHNOLOGIES.map((tech) => (
              <li key={tech}>{tech}</li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
