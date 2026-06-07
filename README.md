# Fanytel SMS Manager & CRM

A powerful system for purchasing virtual USA phone numbers via Fanytel API and automatically routing incoming SMS to specific clients using a Telegram Bot. It includes a modern, responsive React-based Web Admin Panel for comprehensive CRM management.

## ✨ Features
- **Telegram Bot Integration:** Clients receive SMS from their virtual numbers directly in Telegram.
- **Modern Web Admin Panel:** Built with React 19, featuring a sleek "Glassmorphism" dark mode UI.
- **Server-Sent Events (SSE):** Real-time dashboard and table updates without page reloads.
- **Client CRM:** User profiles, dynamic tags, and internal notes.
- **Markdown Broadcasting:** Send mass notifications to all bot users with Markdown support and live preview.
- **Security:** Built-in rate limiting, strict CORS restrictions, XSS protection, and active session tracking.
- **Audit Logs:** Tracks all admin actions (e.g., number assignment, password changes) with IPs.
- **Auto Cleanup:** Automatically archives/deletes old SMS history to keep the database light and fast.
- **Exporting:** Export tables to CSV or print beautifully formatted PDF reports.

## 🚀 Prerequisites
- Node.js (v18+)
- Telegram Bot Token (from [@BotFather](https://t.me/BotFather))
- Telegram User ID (your ID to become the admin)
- Fanytel Firebase Auth URL (Extract from Fanytel App or Web Dialer network requests)

## 🛠 Setup & Installation

1. **Clone the repository**

2. **Backend Setup**
   ```bash
   npm install
   ```
   Create a `.env` file in the root directory:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   ADMIN_TELEGRAM_ID=your_telegram_id_here
   FIREBASE_AUTH_URL=your_fanytel_firebase_auth_url_here
   ADMIN_PASSWORD=admin123
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   ```

## 💻 Running the Application

1. **Start the Backend (Bot & API)**
   ```bash
   node index.js
   ```
   The Telegram bot will start polling, and the backend API will run on `http://localhost:3000`.

2. **Start the Frontend (Dev Server)**
   Open a new terminal and run:
   ```bash
   cd frontend
   npm run dev
   ```
   The Admin Panel will be available at `http://localhost:5173`. Open this URL in your browser and log in with the `ADMIN_PASSWORD` you set in the `.env` file.
