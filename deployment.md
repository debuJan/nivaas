# Nivaas — deployment guide

How to run Nivaas locally, how it is deployed, and the demo logins a
reviewer needs. This file lists environment variable **names only** —
there are no secrets in this repository.

## Run it locally

**Prerequisites:** Node.js 20 or newer (npm included), git.

```bash
git clone <repo-url> nivaas
cd nivaas
npm install
cp .env.example .env       # the defaults in .env.example work as-is
npx prisma db push         # create the SQLite database from the schema
npm run db:seed            # load demo data: flats, bills, complaints, notices
npm run dev                # development server
```

Open <http://localhost:3000> and sign in with any demo login below.

For a production-style local run, replace the last step with:

```bash
npm run build
npm start
```

To verify the code at any time: `npm test` (41 automated tests) and
`npm run build`.

## Environment variables

| Name | Purpose |
| --- | --- |
| `DATABASE_URL` | Where the database lives. Locally this is a SQLite file (`file:./dev.db`, already the default in `.env.example`); in production it points at the file on the persistent disk. Switching to Postgres later means changing this value and the Prisma provider — nothing else. |
| `SESSION_SECRET` | Signs the httpOnly session cookie. Optional in local dev (the app falls back to a clearly-marked dev-only constant so a fresh clone runs with zero setup); **must** be set in production. On Render it is generated automatically by the blueprint. |

No other environment variables are used. The OTP sender and the payment
gateway are mocked in this build (test mode, per the brief), so there
are no SMS or payment-provider keys to configure.

## Deployment (Render)

The repo ships a Render blueprint (`render.yaml`): one Node web service
on the free plan, with a 1 GB persistent disk mounted at `/var/data`
holding the SQLite file, so the ledger survives deploys and restarts.

1. In Render: **New → Blueprint**, connect this repository, **Apply**.
   The build runs `npm install && npx prisma db push && npm run build`;
   `DATABASE_URL` and a generated `SESSION_SECRET` come from the
   blueprint.
2. After the first deploy finishes, open the service **Shell** once and
   run `npm run db:seed` to load the demo data. (Only once — seeding is
   deliberately *not* part of the build, so redeploys never reset the
   data.)
3. The service URL Render assigns is the live app.

**Honest note on the free plan:** the service sleeps after ~15 minutes
without traffic, so the first request after a quiet period takes
30–60 seconds to wake. It is fine for review; a paid instance removes
the sleep.

## Demo logins

OTP is mocked in this build: request a code for any number below, then
enter **`123456`** (a real generated code is also printed to the server
console as a mock SMS). Codes are stored hashed, expire in 5 minutes,
and allow 5 attempts.

| Role | Name | Phone | What to look at |
| --- | --- | --- | --- |
| Resident (owner) | Neeraj Kulkarni | `9820011100` | T07-1203 — bills fully paid, “all clear” home |
| Resident (tenant) | Swati Joshi | `9820011104` | T12-0408 — two open bills, one with a late fee, one open complaint |
| Help Desk | Priya Nair | `9000000001` | Complaints board + bank matching & accounts queue |
| Committee | R. Menon | `9000000002` | Collection %, dues ageing, complaint health |

### A 5-minute reviewer walkthrough

1. **Pay a bill** — sign in as Swati (`9820011104`), open *Bills & payments*, pay the November bill with the test-mode sheet, and see the receipt with its `MOCKPAY-…` reference. Try paying it again — it is refused.
2. **Watch a complaint escalate** — as any resident, raise a complaint whose text mentions a *lift stuck* (or fire / gas leak / electric shock). It files as **CRITICAL** and is flagged as escalated to the duty manager, whatever category it otherwise sounds like. Raise a vague one too — low AI confidence lands it as OTHER for the help desk to confirm.
3. **Run the bank matching** — sign in as Help Desk (`9000000001`), open *Bank matching & queue*, click **Use sample CSV**, then **Run matching**. The bundled statement is crafted against the seed data: **3 rows post, 3 rows queue** — including an ambiguous ₹7,150 that two flats owe (queued, never guessed) and a unique amount-only ₹8,125 (also queued: an amount alone never auto-posts).
4. **Resolve the queue like an accountant** — pick the flat for one queued payment and **Post to flat**; reject another. Both disappear from the queue and the posted one appears in that flat's payment history.
5. **Check the committee view** — sign in as Committee (`9000000002`) and see the same ledger from the top: November collection %, total outstanding, dues ageing buckets and open complaints by category.
