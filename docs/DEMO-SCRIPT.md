# 10-minute presentation: script and timing

Record with Loom (screen + camera). Before recording:
- Run `npm run seed` against the live database, so the data is fresh and some doses are due.
- Open the live site, the GitHub repository, the latest Actions run and a patient portal link on your phone (or in a phone-sized browser window).

| Time | What to show | What to say (in your own words) |
|---|---|---|
| **0:00–1:30** Problem | The landing page | About half of people on long-term treatment don't take their medicines as prescribed (WHO). In Nigeria, about 3 in 10 adults have high blood pressure, and the clinic only finds out at the next visit. Text reminders roughly double the odds of adherence in trials (Thakkar 2016; Pop-Eleches 2011 in Kenya). Small clinics have no simple tool for it, so I built DoseKeep. |
| **1:30–3:30** Architecture | The diagram in `docs/REPORT.md` (section 4) | One Next.js app on Vercel, MongoDB Atlas in the same region (US East), an SMS gateway, and GitHub Actions for CI and the 15-minute reminder schedule. The code layers: pages → server glue → services → pure logic. The key decision: I calculate the schedule from each prescription and only store doses that were taken, so "missed" is always correct and never needs a background job. |
| **3:30–6:30** Demo, staff | Sign in as the demo admin → dashboard | KPI tiles, the 14-day chart (hover a bar), the "patients to call" list under 80%, due now, appointments. Open an at-risk patient: the 30-day chart, today's doses, recently missed doses, "Record as taken". Add a medicine with a mistake (`9pm`), show the error, fix it (`21:00`). Book an appointment. Add a new patient and show the private link (shown once, only a hash is stored). |
| **6:30–7:45** Demo, patient | The portal on the phone | No app, no password: the link from the SMS. Today's medicines, tap "I took it" on a due dose. Back on the dashboard, the dose shows as taken. Then the Reminders page: "Run reminders now", and the texts it recorded (sent once, never repeated). |
| **7:45–9:00** Quality and deployment | GitHub: Actions tab, `ci.yml`, a pull request with the Vercel preview, branch protection | Lint, tests on Node 20 and 22 against a real in-memory MongoDB, coverage gate, build. Preview deploy per PR, production on merge, smoke test after. Security: bcrypt, login lockout, signed session cookie, per-clinic isolation, hashed patient links, security headers. |
| **9:00–10:00** Results and next steps | Report section 10 | All requirements work. 25 tests, 94.7% coverage of the logic. Next: reply-by-SMS for patients without smartphones, nightly adherence roll-ups for big clinics, consent and audit logs for compliance with Nigeria's Data Protection Act. |

Tips: keep the browser zoomed to about 110% so the text is readable in the video; close other tabs; do one dry run with a timer.
