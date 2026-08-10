# FocusFlow cloud deployment

FocusFlow is prepared as three connected pieces:

- **Vercel**: serves `main_code/` (HTML/CSS/JS) and the small `/api/proxy` function.
- **Render**: runs the Node/Express API in `backend/`.
- **Neon**: stores users, password hashes, profiles, and synced FocusFlow state in Postgres.

## 1. Create the Neon database

1. Create a Neon project.
2. Click **Connect** and copy the Postgres connection string.
3. Keep the connection string private. It will be added to Render as `DATABASE_URL`.

The Render API creates the `users` table automatically on startup. `backend/sql/schema.sql` is also included if you want to inspect or run the schema manually.

## 2. Deploy the API to Render

Create a Render **Web Service** from the same GitHub repository.

- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health Check Path: `/api/health`

Add these Render environment variables:

- `DATABASE_URL` = your Neon connection string
- `JWT_SECRET` = a long random secret (Render can generate one when using `render.yaml`)
- `NODE_ENV` = `production`
- `FRONTEND_URL` = your Vercel production URL, for example `https://focusflow-example.vercel.app`

After deployment, copy the Render service URL, for example:

`https://focusflow-api.onrender.com`

Open `/api/health` on that service and confirm it reports `{"ok":true,"database":"connected"}`.

## 3. Deploy the frontend to Vercel

Import the same GitHub repository into Vercel.

Set **Root Directory** to:

`main_code`

No framework/build command is required for the static HTML frontend.

Add this Vercel environment variable:

- `RENDER_API_URL` = your Render service URL, e.g. `https://focusflow-api.onrender.com`

Deploy again after setting the variable.

## 4. Connect Render back to Vercel

Once Vercel gives you the final production domain, put that URL in Render's `FRONTEND_URL` environment variable and redeploy the Render service.

## 5. Test the complete flow

1. Open the Vercel URL.
2. Sign up with a new username/password.
3. Log out and log back in.
4. Add a task.
5. Refresh and confirm it remains.
6. Log in from another browser/device with the same account and confirm the saved cloud state loads.
7. Test Settings > Password and security.

## Local development

Opening the files locally continues to use the existing browser-local account/storage path. Cloud mode is automatically used when the frontend is hosted on HTTPS (such as Vercel).

## Important secrets

Never put `DATABASE_URL` or `JWT_SECRET` into frontend JavaScript, HTML, Git commits, or Vercel public files. They belong only in Render environment variables. Vercel only needs the non-secret Render service URL.
