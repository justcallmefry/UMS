# How to deploy the UMS middleware

This guide walks you through deploying the middleware so you get a public URL (e.g. `https://your-app.onrender.com`) for the vehicle funnel, Find My Vehicle, and Shop Vehicles pages.

---

## What you need first

1. **The UMS code on GitHub**  
   If it’s only on your machine, push it to a GitHub repo (create one at [github.com/new](https://github.com/new), then push your local project). The deploy service will clone from GitHub.

2. **A free account** on the host you choose (Render is a good first option).

3. **About 10 minutes.**

---

## Option A: Deploy with Render (recommended first)

Render has a free tier. The app may “spin down” after ~15 minutes of no traffic and take a few seconds to wake up on the next visit.

### Step 1: Push your code to GitHub

- Create a new repo on GitHub (e.g. `ums` or `ums-powersports`).
- In your project folder (UMS), run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
git push -u origin main
```

(If you already use Git and have a repo, just make sure the latest code is pushed.)

**Important:** The `middleware/.env` file is in `.gitignore`, so it will **not** be uploaded. You’ll type your config into Render’s dashboard instead (Step 4).

### Step 2: Sign up and create a Web Service

1. Go to [render.com](https://render.com) and sign up (or log in).
2. Click **New +** → **Web Service**.
3. Connect your GitHub account if asked, then select the **UMS repository**.
4. Click **Connect**.

### Step 3: Configure the service

Use these settings:

| Field | Value |
|-------|--------|
| **Name** | `ums-middleware` (or any name you like) |
| **Region** | Pick one close to you or your users |
| **Branch** | `main` |
| **Root Directory** | Leave **blank** (so Render uses the whole repo) |
| **Runtime** | `Node` |
| **Build Command** | `cd middleware && npm install` |
| **Start Command** | `npm start` |

**Why:** The app lives in the `middleware` folder but needs the rest of the repo (e.g. `config/`, `data/`, `storefront-scripts/`). The root `package.json` runs the server with `npm start`; the build installs dependencies inside `middleware`.

### Step 4: Add environment variables

Scroll to **Environment Variables** and click **Add Environment Variable**. Add the same things you have in `middleware/.env`, one by one. You can leave optional ones blank.

**Required for the app to run:**

| Key | Value | Notes |
|-----|--------|--------|
| `PORT` | (leave blank) | Render sets this automatically. |
| `NODE_ENV` | `production` | Optional but good to set. |

**Vehicle funnel (demo values are fine at first):**

| Key | Value |
|-----|--------|
| `VEHICLE_INVENTORY_EMBED_URL` | `https://YOUR-RENDER-URL.onrender.com/demo/inventory-placeholder` |
| `LEAD_WEBHOOK_URL` | `https://YOUR-RENDER-URL.onrender.com/demo/lead-echo` |
| `CREDIT_APP_URL` | `https://YOUR-RENDER-URL.onrender.com/demo/credit-placeholder` |

**Tip:** After the first deploy, Render will show your URL (e.g. `https://ums-middleware-xxxx.onrender.com`). Then go back to **Environment** and set the three URLs above using that base URL, and **Save Changes** (Render will redeploy).

**Optional (if you use them locally):**

- `STORE_ID`
- `ECWID_PUBLIC_TOKEN`, `ECWID_SECRET_TOKEN`
- `LIGHTSPEED_ACCOUNT_ID`, `LIGHTSPEED_API_KEY`, `LIGHTSPEED_API_SECRET`
- `STORE_CART_URL`

You can add these later when you connect the real store.

### Step 5: Deploy

1. Click **Create Web Service**.
2. Render will clone the repo, run `cd middleware && npm install`, then `npm start`. Wait until the log shows something like **Your service is live at …**.
3. Copy the URL (e.g. `https://ums-middleware-xxxx.onrender.com`).

### Step 6: Test your deployment

Open in the browser:

- **Showcase:** `https://YOUR-URL/showcase`
- **Shop Vehicles:** `https://YOUR-URL/shop-vehicles`
- **Find My Vehicle:** `https://YOUR-URL/find-my-vehicle`
- **Health check:** `https://YOUR-URL/health` (should return `{"status":"ok",...}`)

If the vehicle funnel URLs were left blank, go back to **Environment**, set the three demo URLs using your Render URL as above, save, wait for redeploy, then test again.

---

## Option B: Deploy with Railway

Railway is simple and usually costs around $5/month for a small app (free trial available).

1. Go to [railway.app](https://railway.app) and sign in (e.g. with GitHub).
2. **New Project** → **Deploy from GitHub repo** → select your UMS repo.
3. After the repo is added, click the service and open **Settings** (or **Variables**).
4. Set **Root Directory** to `middleware` **or** leave it blank and set:
   - **Build Command:** `cd middleware && npm install`
   - **Start Command:** `npm start`
5. In **Variables**, add the same env vars as in Option A (no need to set `PORT`; Railway sets it).
6. Deploy; Railway will assign a URL. Use it the same way as the Render URL (e.g. `https://your-app.up.railway.app/showcase`).

---

## Option C: Deploy with Fly.io

Fly.io has a free allowance that can be enough for a small API.

1. Install the Fly CLI: [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl/).
2. In a terminal, log in: `fly auth login`.
3. From your **UMS project root** (the folder that contains `middleware/` and `package.json`), run:

   ```bash
   fly launch
   ```

   When asked, don’t add a database; choose a region; you can skip setting secrets for now.
4. Fly will create a `fly.toml`. You need the app to run from the repo root and start the Node server. Open `fly.toml` and set or add:

   ```toml
   [build]
     [build.environment]
       NODE_VERSION = "18"

   [env]
     PORT = "8080"

   [[services]]
   internal_port = 8080
   protocol = "tcp"
   ...
   ```

   And make sure the start command runs the app. If Fly generated a Dockerfile, it may need to run `npm start` from the repo root (after `cd middleware && npm install` in the build). Alternatively, create a simple Dockerfile in the repo root that installs in `middleware` and runs `npm start`. (If you want a ready-made Dockerfile, say so and we can add one.)
5. Set secrets (env vars): `fly secrets set VEHICLE_INVENTORY_EMBED_URL=...` etc., or use the same demo URLs as in Option A with your Fly app URL.
6. Deploy: `fly deploy`. Your URL will be like `https://your-app-name.fly.dev`.

---

## After deployment

1. **Use your new URL** in the Lightspeed integration doc: [lightspeed-storefront-integration.md](lightspeed-storefront-integration.md). Replace `YOUR-MIDDLEWARE-URL` with your real URL (e.g. `https://ums-middleware-xxxx.onrender.com`).
2. **Replace demo URLs** with real inventory, lead, and credit app URLs when you have them (same env vars in the host’s dashboard or in `fly secrets`).
3. **Optional:** Add a custom domain in the host’s dashboard (e.g. `api.yourdomain.com`) and point your DNS there.

If something doesn’t work, check the host’s **Logs** tab for errors (e.g. missing env var or path). The most common issue is forgetting to set the **Build** and **Start** commands so the app runs from the repo root with `middleware` dependencies installed.
