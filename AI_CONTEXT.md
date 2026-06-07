# AI Project Context: Fanytel SMS Manager & CRM

## Project Overview
This project is a powerful SMS virtual number management CRM. It integrates with the Fanytel API to purchase USA virtual phone numbers and automatically routes incoming SMS messages to specific clients via a Telegram Bot. It features a highly responsive, modern React-based Web Admin Panel.

## Tech Stack
- **Backend:** Node.js, Express.js, node-telegram-bot-api, SQLite3, Axios.
- **Frontend:** React 19, Vite, Recharts, Lucide-React, React-Hot-Toast.
- **External API:** Fanytel API.
- **Security & Optimization:** Server-Sent Events (SSE) for real-time updates, Rate Limiting (anti-bruteforce), strict CORS policies, and automated SMS cleanup crons.

## Architecture & Core Files

### 1. `index.js` (Main Entry Point)
- Initializes the Telegram Bot (polling mode) and Express API (port 3000).
- **Security:** Implements `activeSessions` tracking, anti-bruteforce `rateLimitMiddleware`, strict `corsOptions`, and validates passwords to prevent `.env` injection.
- **Real-Time:** Uses `broadcastEvent` to push Server-Sent Events (SSE) to the React frontend on SMS updates or config changes.
- **Background Tasks:** 
  - `pollSms()`: Polls Fanytel API every 3s.
  - `checkExpirations()`: Unassigns expired numbers every 24h.
  - `cleanupOldSms()`: Deletes SMS older than 30 days every 12h.

### 2. `api.js` (Fanytel API Wrapper)
- Handles HTTP requests to `https://api.fanytel.com:4443/api`.
- Authenticates via `FIREBASE_AUTH_URL` and generates a SHA256 token.

### 3. `db.js` (Database Layer)
- **users**: `id`, `telegram_id`, `role`, `notes`, `tags` (JSON array).
- **numbers**: `id`, `number`, `telegram_id`, `username`, `token`, `active`.
- **sms_history**: `id`, `number`, `message_id`, `sender`, `message_text`, `received_at`.
- **audit_logs**: Tracks admin actions (IP, action, details, timestamp).
- **settings**: Caches `fanytel_username` and `fanytel_token`.

### 4. `frontend/src/` (Admin Panel)
- **`App.jsx`**: Main controller. Manages SSE connection, auth state, and global data fetching.
- **Components (`components/`)**:
  - `Dashboard.jsx`: Recharts stats with dynamic period selection (7/14/30 days).
  - `NumbersTable.jsx` & `UsersTable.jsx`: Include sorting, quick filters, bulk actions (multi-select), and PDF/CSV export.
  - `UserProfileModal.jsx`: Manage user tags and CRM notes.
  - `BroadcastModal.jsx`: Send Telegram blasts with Markdown support and live XSS-protected preview.
  - `SettingsPanel.jsx`: View active sessions, audit logs, and change password.

## Key Workflows & Logic
1. **Authentication:** The UI uses the `.env` `ADMIN_PASSWORD` as a Bearer token.
2. **SSE Flow:** When `pollSms()` receives a new message, `index.js` calls `broadcastEvent('new_sms')`. The `App.jsx` `useEffect` listens via `EventSource` and triggers a re-fetch, updating the UI instantly.
3. **Security:** Markdown inputs are sanitized against `javascript:` URIs. API endpoints use `db.logAction` to record changes to the `audit_logs` table.

## How to make changes (Instructions for AI)
- **DB Updates:** Use `ALTER TABLE` inside `db.js` for backwards compatibility. Never recreate tables destructively.
- **UI Aesthetic:** Maintain the dark "Glassmorphism" theme (`glass-panel` class). Avoid Tailwind unless requested; use the existing variables in `index.css`.
- **API Endpoints:** Always return `{ success: true, ... }` or `{ error: ... }` with proper HTTP status codes. Log critical actions using `db.logAction()`.
