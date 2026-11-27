# Deploying DoseKeep

This takes about 30 minutes, and everything used here is free. You need accounts on GitHub, Vercel (sign in with GitHub) and MongoDB Atlas.

## 1. Put the code on GitHub

Create an **empty** public repository called `dosekeep` on github.com (no README, no .gitignore). Then:

```bash
cd ~/Desktop/GMC-MSC/dosekeep
git init -b main
git add -A
git commit -m "DoseKeep: SMS medication reminders and adherence tracking for clinics"
git remote add origin https://github.com/ChimarokeAmadi/dosekeep.git
git push -u origin main
```

Open the **Actions** tab: the CI run (lint, tests on Node 20 and 22, build) should turn green in about 2 minutes.

## 2. Create the database (MongoDB Atlas)

1. On cloud.mongodb.com, **Create** a cluster: choose **M0 (Free)**, provider **AWS**, region **N. Virginia (us-east-1)**. That's the same AWS region as the Vercel functions (`iad1`), so each database round trip is short. If you already have a free cluster, reuse it: Atlas allows one free cluster per project, and DoseKeep keeps its data in its own `dosekeep` database. If your cluster is in another region, change `regions` in `vercel.json` to the Vercel region next to it.
2. **Database Access** → Add a database user, for example `dosekeep-app`, with a generated password. Role: *Read and write to any database* (or, better, `readWrite` on `dosekeep` only).
3. **Network Access** → Add IP address → `0.0.0.0/0`. Vercel's functions don't have fixed IP addresses, so the database is protected by its username and password, which are long and random, plus TLS.
4. **Connect** → Drivers → copy the connection string and put your user's password in it.

## 3. Make two secrets

```bash
openssl rand -base64 48   # SESSION_SECRET
openssl rand -base64 48   # CRON_SECRET
```

Keep them somewhere safe (a password manager). Never commit them.

## 4. Deploy on Vercel

1. vercel.com → **Add New… → Project** → import `dosekeep` from GitHub. Vercel detects Next.js; leave the build settings as they are.
2. Before clicking Deploy, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `MONGODB_URI` | the Atlas connection string |
   | `MONGODB_DB` | `dosekeep` |
   | `SESSION_SECRET` | the first secret |
   | `CRON_SECRET` | the second secret |
   | `SMS_PROVIDER` | `log` (messages are recorded but not sent; see step 8 for real SMS) |
   | `APP_URL` | leave for now |

3. **Deploy**. When it's done, copy the production address, for example `https://dosekeep.vercel.app`.
4. Settings → Environment Variables → add `APP_URL` = that address (no slash at the end). Then Deployments → ⋯ → **Redeploy**, so that patient links use the real address.
5. Check: open `https://<your-app>/api/health`. It should show `{"status":"ok","database":"up",...}`.

`vercel.json` already sets the region to `iad1` (Washington, D.C., next to Atlas's us-east-1) and a daily backup cron job. Vercel sends the `CRON_SECRET` with it automatically.

## 5. Load the sample clinic

From your Mac, using the Atlas connection string (the quotes matter):

```bash
cd ~/Desktop/GMC-MSC/dosekeep
MONGODB_URI='mongodb+srv://…' APP_URL='https://dosekeep.vercel.app' SEED_PASSWORD='choose-a-password' npm run seed
```

It prints the clinic logins (`ada.nnamdi@sunriseclinic.ng`, the admin, and `bisi.lawal@sunriseclinic.ng`, staff) and a portal link for each of the 8 sample patients. Keep the output: you'll use a portal link in the video. You can run it again at any time to reset the sample clinic.

## 6. Turn on the 15-minute reminders

Vercel's free plan only runs cron once a day, so GitHub Actions calls the reminder endpoint every 15 minutes instead.

GitHub → the repository → Settings → Secrets and variables → Actions → **New repository secret**:
- `APP_URL`: `https://dosekeep.vercel.app`
- `CRON_SECRET`: the same value as in Vercel

Then Actions → **Send reminders** → **Run workflow**. The log ends with something like `{"ok":true,"dose":{"sent":2,...}}`. GitHub pauses scheduled workflows after 60 days without commits: re-enable it in the Actions tab if that happens.

## 7. Protect main

Settings → Branches → **Add branch ruleset** for `main` → tick **Require status checks to pass**, and add `Lint (ESLint)`, `Tests (Node 20)`, `Tests (Node 22)` and `Build`. From now on, work in a branch and open a pull request: Vercel comments with a preview link, and you can only merge when CI is green. After the merge, the **Production smoke test** workflow checks the live site.

## 8. Optional: real SMS with Africa's Talking

1. Create an account on africastalking.com. The **sandbox** is free and shows messages in its simulator instead of sending them.
2. In Vercel set `SMS_PROVIDER=africastalking`, `AT_USERNAME=sandbox` and `AT_API_KEY` (from the sandbox settings), then redeploy.
3. For real phones you need a live (paid) account: use your app's username and live API key, plus `AT_SENDER_ID` if you register one.

## 9. Finish the report

Put the live URL and the GitHub URL at the top of `docs/REPORT.md` and in the README, then commit and push.

## Running it locally

```bash
npm install
npm run dev:local     # in-memory MongoDB + sample data + the app on http://localhost:3000
```

Sign in as `ada.nnamdi@sunriseclinic.ng` with the password `sunrise-local-2026`. The data is kept in `.data/`; delete that folder to start fresh. To run against Atlas instead, copy `.env.example` to `.env.local`, fill it in, and run `npm run dev`.
