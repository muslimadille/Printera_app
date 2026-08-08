import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { installInternalErrorLogger } from "./lib/errorLogger";
import { purgeDevServiceWorker } from "./lib/purgeDevServiceWorker";

// Silent internal logging for 404 / proxy / network errors (no UI to user).
installInternalErrorLogger();

// Swallow tagged "silent" errors (e.g. expired-session 401s from Edge Functions)
// so they don't surface as runtime error overlays. The session-expired event is
// dispatched separately and handled by Index for a clean force-logout.
window.addEventListener('unhandledrejection', (e) => {
  const reason: any = e.reason;
  if (reason && (reason.silent || reason.session_expired)) {
    e.preventDefault();
  }
});

void purgeDevServiceWorker().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
