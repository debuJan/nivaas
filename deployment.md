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
| `SESSION_SECRET` | Signs the httpOnly session cookie. Optional in local dev (the app falls back to a clearly-marked dev-only constant so a fresh clone runs with zero setup); **must** be set in production (on Vercel, set once as a project environment variable).

No other environment variables are used. The OTP sender and the payment
gateway are mocked in this build (test mode, per the brief), so there
are no SMS or payment-provider keys to configure.

## Deployment (Vercel + Prisma Postgres)

**Live app: <https://nivaas-seven.vercel.app>**

The live deployment runs on **Vercel** (the Next.js app) with a hosted
**Prisma Postgres** database, connected through Vercel's Prisma Postgres
integration. Production uses Postgres rather than the local SQLite file
because serverless filesystems are ephemeral — a file database would not
survive between requests. The app code is identical in both worlds: the
repo carries a second Prisma schema, `prisma/schema.prod.prisma`, with
the same models and the provider switched to `postgresql`.

1. **Import the repo** into Vercel (framework preset: Next.js).
2. **Add the database:** on the import screen (or later, *Storage →
   Create Database*), add the **Prisma Postgres** integration (free
   plan) and connect it to the project. The integration provisions the
   database and sets `DATABASE_URL` on the project automatically. The
   build script uses a separate unpooled URL for schema pushes when one
   is provided (`DATABASE_URL_UNPOOLED`) and otherwise falls back to
   `DATABASE_URL`.
3. **Set `SESSION_SECRET`** to any long random string in *Project
   Settings → Environment Variables*.
4. **Deploy.** The build command (pinned in `vercel.json`) runs a small
   script (`scripts/deploy-build.sh`): generate the Prisma client from
   the production schema → `prisma db push` (create/update the tables)
   → `prisma db seed` → `next build`. The seed wipes and recreates the
   demo dataset, so every deploy starts from the same clean review
   state — deliberate for a demo build; the matching and complaint
   engines are what is under review, not data entry.
5. The project's Vercel URL is the live app.

(The repo also ships a `render.yaml` blueprint as an alternative
single-host deployment with the SQLite file on a persistent disk.)

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
