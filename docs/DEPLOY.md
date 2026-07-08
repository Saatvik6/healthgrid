# Deploying HealthGrid AI to Firebase App Hosting

App Hosting is Google Cloud's managed Next.js host: it builds from GitHub, runs on
Cloud Run, keeps secrets in Secret Manager, and lives in the same project as our
Firestore (`healthgrid-22146`). Config lives in [`apphosting.yaml`](../apphosting.yaml).

Run every command below from `C:\bwa\healthgrid` in PowerShell.

## 0. Merge the config to `main` (once)

App Hosting deploys from `main`, so merge the config PR first:
https://github.com/nishantr14/healthgrid/compare/main...deploy?expand=1
→ **Create pull request** → **Merge**.

## 1. Install the Firebase CLI

```powershell
npm install -g firebase-tools
firebase --version   # expect 13.x+
```

## 2. Log in (opens your browser — the one interactive step)

```powershell
firebase login
firebase use healthgrid-22146
```

## 3. Store the two secrets in Secret Manager

The public Firebase/Maps keys are already in `apphosting.yaml`. Only these two are
secret. Copy each value out of your local `.env.local`.

```powershell
# Gemini API key (short). When prompted, paste the GEMINI_API_KEY value.
firebase apphosting:secrets:set GEMINI_API_KEY

# Service-account JSON, base64 (long, 3184 chars). Easiest via a temp file:
$env = Get-Content .env.local | Where-Object { $_ -like 'FIREBASE_SERVICE_ACCOUNT_B64=*' }
($env -replace '^FIREBASE_SERVICE_ACCOUNT_B64=','') | Out-File -NoNewline -Encoding ascii $env:TEMP\sa.txt
firebase apphosting:secrets:set FIREBASE_SERVICE_ACCOUNT_B64 --data-file $env:TEMP\sa.txt
Remove-Item $env:TEMP\sa.txt
```

Each command asks whether to grant the App Hosting backend access — answer **yes**.

> Tip: production quota lives on whichever `GEMINI_API_KEY` you store here. If you
> have a billing-enabled key on `healthgrid-22146`, use that one — it removes the
> free-tier quota risk during judging. The app also rotates through a model pool.

## 4. Create the backend (connects GitHub, picks the region)

```powershell
firebase apphosting:backends:create --project healthgrid-22146
```

Answer the prompts:
- **Region:** `asia-south1` (Mumbai — next to Firestore)
- **GitHub repo:** authorize, then pick `nishantr14/healthgrid`
- **Live branch:** `main`
- **Root directory:** `/`
- **Backend id:** `healthgrid`

It kicks off the first build automatically (~5–10 min) and prints your public URL,
e.g. `https://healthgrid--healthgrid-22146.asia-south1.hosted.app`.

Future deploys: just push to `main` — App Hosting rebuilds on its own.

## 5. Post-deploy (5 minutes, important)

1. **Restrict the Maps key to the live domain** so the map renders in production:
   Cloud console → APIs & Services → Credentials → the Maps JS key →
   *Website restrictions* → add `https://*.hosted.app/*` (and your custom domain
   if any) → Save.
2. **Smoke test the public URL:** map renders, click Seloo, approve a transfer,
   ask the Copilot (English + Hindi), open `/field`, do a voice update, flip the
   Flood Alert scenario.
3. **Reseed to demo-perfect state** right before recording/judging:
   ```powershell
   npm run seed -- --demo-date <recording day>
   npx tsx --env-file=.env.local scripts/seed-ai-state.ts
   ```

## Fallback: Cloud Run source deploy

If the App Hosting GitHub connection gives trouble, Cloud Run works too — but you
MUST pass the public keys as **build** env vars or the browser bundle ships blank:

```powershell
gcloud run deploy healthgrid --source . --region asia-south1 --allow-unauthenticated `
  --set-build-env-vars NEXT_PUBLIC_FIREBASE_API_KEY=...,NEXT_PUBLIC_FIREBASE_PROJECT_ID=healthgrid-22146,NEXT_PUBLIC_FIREBASE_APP_ID=...,NEXT_PUBLIC_MAPS_API_KEY=... `
  --set-env-vars GEMINI_MODEL=gemini-3.5-flash,GEMINI_FALLBACK_MODEL=gemini-3-flash-preview,GEMINI_API_KEY=...,FIREBASE_SERVICE_ACCOUNT_B64=...
```

(Needs the gcloud CLI installed and `gcloud auth login`. App Hosting avoids the
build-env-var footgun, which is why it's the recommended path.)
