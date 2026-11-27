# DoseKeep

[![CI](https://github.com/ChimarokeAmadi/dosekeep/actions/workflows/ci.yml/badge.svg)](https://github.com/ChimarokeAmadi/dosekeep/actions/workflows/ci.yml)

**Live:** [dosekeep.vercel.app](https://dosekeep.vercel.app) · **Report:** [docs/REPORT.md](docs/REPORT.md)

**Demo video** (3 parts, because of Loom's 5-minute limit): [Part 1](https://www.loom.com/share/ee7355f42ede478e9d7c69ffb9a773a5) · [Part 2](https://www.loom.com/share/9f02002ae5324541a2617af9a84cc123) · [Part 3](https://www.loom.com/share/01511346efda4bdd849476d39b01f2c7)

DoseKeep helps small clinics keep patients on their treatment. It texts patients when a dose is due and the day before an appointment. Each patient gets a private link where they tick off their doses, with no app and no password. The clinic gets a dashboard that shows who is falling behind, so a nurse can call them before a missed week turns into a hospital visit.

I built it as my GoMyCode capstone. About half of people on long-term treatment don't take their medicines as prescribed, and text reminders are one of the best-studied ways to improve that. The research, the architecture and the design decisions are in the [report](docs/REPORT.md).

## What it does

- Clinics register, and the admin adds nurses and other staff.
- Staff add patients, prescribe medicines with times of day, and book appointments.
- Every 15 minutes, reminders go out by SMS for doses that are due and not yet taken, and the day before each appointment. A reminder is never sent twice.
- Patients confirm doses on their private link, from 1 hour before to 3 hours after the dose time.
- The dashboard shows the clinic's adherence over 14 days, the patients under 80% this week with their phone numbers, the doses due now, and upcoming appointments.

## How it's built

It's a Next.js 16 app (JavaScript, React Server Components and Server Actions) on Vercel, with MongoDB Atlas as the database and Africa's Talking for SMS. GitHub Actions runs the tests on every push and calls the reminder job every 15 minutes, because Vercel's free plan only allows a daily cron job.

```
src/app         pages, the patient portal and the API routes
src/server      session cookie, login check, server actions
src/services    the use cases: patients, medicines, doses, dashboard, reminders
src/lib         pure logic: time zones, dose schedule, adherence, validation, SMS client
test/           26 tests, against a real in-memory MongoDB
docs/           report, deployment guide, demo script
```

## Run it on your computer

You need Node.js 20.19 or newer. Nothing else: the local script starts its own database.

```bash
npm install
npm run dev:local
```

Then open http://localhost:3000 and sign in as `ada.nnamdi@sunriseclinic.ng` with the password `sunrise-local-2026`. The script prints a private portal link for each sample patient.

```bash
npm run lint            # ESLint
npm test                # unit and integration tests
npm run test:coverage   # with coverage (Node 22+, fails under 85%)
npm run check           # lint + tests + production build
```

## Deploying

The step-by-step guide (Atlas, Vercel, secrets, the reminder schedule and branch protection) is in [docs/DEPLOY.md](docs/DEPLOY.md). All settings are environment variables, listed in [.env.example](.env.example).

DoseKeep is a student project and not a medical device.
