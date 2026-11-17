# 🚀 Deploying Soccer Pucks

| Piece | Where it runs | Cost |
|---|---|---|
| Game server (`server/`) | **Render** web service | Free (sleeps after 15 min idle) |
| Database | **Neon** Postgres | Free (0.5 GB) |
| App | **Expo EAS** builds an APK you can share | Free |

---

## 1. Create the database on Neon

1. Go to **https://neon.tech** and sign up (GitHub login is fine).
2. Click **New Project**:
   - Name: `soccer-pucks`
   - Region: the one closest to your players (for India: **AWS Asia Pacific – Singapore**)
3. On the project dashboard, click **Connect** and copy the **connection string**. It looks like:
   ```
   postgresql://neondb_owner:xxxxx@ep-something-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   Keep it secret, since it contains the password. You'll paste it into Render in step 3.

The server creates its tables (`users`, `sessions`) automatically the first time it starts.

---

## 2. Put the project on GitHub

Render deploys straight from a GitHub repository.

```bash
# in the HelloWorld folder
git init
git add .
git commit -m "Soccer Pucks"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<your-username>/soccer-pucks.git
git branch -M main
git push -u origin main
```

Make sure `node_modules` and `server/data` are **not** committed (`.gitignore` already handles this).

---

## 3. Deploy the server on Render

1. Go to **https://render.com** and sign in with GitHub.
2. Click **New +** → **Blueprint**, then pick your `soccer-pucks` repository.
   Render reads `render.yaml` and sets up the service for you.
3. When it asks for **DATABASE_URL**, paste the Neon connection string from step 1.
4. Click **Apply** and wait for the deploy (2–4 minutes). The logs should end with:
   ```
   Storage: Postgres
   ⚽ Soccer Pucks server running on port 10000
   ```
5. Copy your service URL, e.g. `https://soccer-pucks-server.onrender.com`.
   Open it in a browser: it should say **"Soccer Pucks server is running"**.

<details>
<summary>Without the Blueprint (manual setup)</summary>

**New +** → **Web Service** → pick the repo, then:
- Runtime: **Node**
- Build command: `cd server && npm install`
- Start command: `cd server && npm start`
- Environment variables: `DATABASE_URL` = your Neon string, `NODE_VERSION` = `22`
</details>

> **Free plan note:** Render puts the server to sleep after 15 minutes with no players.
> The next login wakes it up, which can take up to about a minute (the app shows a "Connecting…" message).
> For an always-on server, switch the service to the **Starter** plan.
>
> Keep it at **1 instance**: online rooms live in the server's memory.

---

## 4. Point the app at your server

1. In the project root, copy `.env.example` to `.env` and put in your Render URL:
   ```
   EXPO_PUBLIC_SERVER_URL=https://soccer-pucks-server.onrender.com
   ```
2. Put the same URL in **`eas.json`** (it appears twice: `preview` and `production`).
3. Restart Expo so it picks up the change:
   ```bash
   npx expo start -c
   ```
4. Register in the app. There's no server address to type any more.

---

## 5. Build an APK for other players (Android)

1. Create a free account at **https://expo.dev**, then:
   ```bash
   npm install -g eas-cli
   eas login
   ```
2. In `app.json`, add a package name under `"android"` (it must be unique and can't change later):
   ```json
   "android": {
     "package": "com.atharva.soccerpucks",
     ...
   }
   ```
3. Build:
   ```bash
   eas build --platform android --profile preview
   ```
4. After about 10–20 minutes you get a **download link and QR code** for the `.apk`.
   Send it to your friends. On their phone they open it and allow **"Install unknown apps"**.

**Later, for the Google Play Store:** `eas build --platform android --profile production` makes an `.aab` file to upload in the Play Console (one-time $25 developer fee).

---

## Running the server on your PC (optional, for testing)

```bash
cd server
npm install
npm start          # no DATABASE_URL -> saves to server/data/db.json
```
Then set `EXPO_PUBLIC_SERVER_URL=http://<your-PC-IP>:3001` in `.env` and restart Expo with `-c`.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| App says *"Can't reach the game server"* | Open your Render URL in a browser to wake it up, then try again. Check that `.env` / `eas.json` have the right URL (https, no trailing slash). |
| Render deploy fails with `DATABASE_URL` errors | Re-paste the Neon string in Render → your service → **Environment**. It must start with `postgresql://`. |
| Changed `.env` but the app still uses the old URL | Restart with `npx expo start -c` (the `-c` clears the cache). |
| Friends' APK can't connect | You must rebuild the APK after changing the URL in `eas.json`. |
