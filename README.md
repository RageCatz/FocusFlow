# FocusFlow: Vercel + Render + Neon

## Neon
1. Create a Neon PostgreSQL project.
2. Run `backend/sql/schema.sql` in the Neon SQL Editor.
3. Copy the pooled `DATABASE_URL`.

## Render
Create a Web Service with root directory `backend`.
- Build command: `npm install`
- Start command: `npm start`
- Add the variables from `backend/.env.example`.
- Set `FRONTEND_URL` to the Vercel site address.

## Vercel
Create a project with root directory `FocusFlow` and Framework Preset **Other**.
Before the final deployment, replace the placeholder in `FocusFlow/js/config.js` with your Render URL.

## What changed
Accounts and all FocusFlow app data now go through the Render API and are stored in Neon. Passwords are hashed with bcrypt. No passwords, tasks, settings, progress, or profile data are stored in localStorage. The browser only keeps a JWT in sessionStorage for the current tab. MediaPipe camera frames remain on-device and are never uploaded.
