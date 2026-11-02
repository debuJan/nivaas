# Nivaas

**One calm app for a gated township: residents pay maintenance, raise complaints and always see where things stand — while payments match themselves.**

Built for a Pune facility-management client running a township of 2,400
flats in 28 towers: Excel bills, hand-matched payments and phone/WhatsApp
complaints today; one installable web app, a bank-statement matching
engine and complaint intelligence in this build.

## Stack

- **Next.js 15** (App Router, TypeScript) — one codebase for resident,
  help-desk and committee views
- **Tailwind CSS v4** — restrained, minimal UI per the client's design brief
- **Prisma + SQLite** — file database for the demo; the schema is the
  single source of truth for flats, bills, payments and complaints
- **jose** — signed JWT session cookies (httpOnly)

## What is built

**Login (mock OTP, realistic flow)** — enter a seeded phone number, get a
6-digit code (printed to the server log as a mock SMS). Codes are stored
hashed (SHA-256) in an `OtpCode` table with a 5-minute expiry and a
5-attempt verify limit. Sessions are signed tokens; every page and API
route checks the role.

> **Reviewer shortcut: the demo OTP `123456` works for every seeded
> phone.** A real generated code works too — read it from the server
> console where the mock SMS is printed.

| Role | Phone | Who / what you see |
| --- | --- | --- |
| Resident (owner) | `9820011100` | Neeraj Kulkarni, T07-1203 — bills paid |
| Resident (tenant) | `9820011104` | Swati Joshi, T12-0408 — two open bills, one with a late fee |
| Help Desk | `9000000001` | Priya Nair — complaints board + bank matching |
| Committee | `9000000002` | R. Menon — collection & ageing dashboard |

**Resident** — Home shows the total due with a per-bill breakdown, open
complaints and notices. Bills page: per-flat bill cards (base + late
fee), a mock payment sheet (UPI/Card) that returns a receipt with a
`MOCKPAY-…` reference, and the payment ledger; paying a paid bill or
another flat's bill is refused. Complaints: raise one with an optional
photo and immediately see the AI verdict — category, urgency,
confidence, duplicate link, safety escalation.

**Help Desk** — Complaints board with CRITICAL rows highlighted,
duplicate badges, complaint age, one-tap category correction, team and
status dropdowns. Bank matching: upload/paste the statement CSV (or one
click for the bundled sample), get a per-row verdict with tier and
plain-English reason; unclear rows wait in the **accounts queue** for a
human to post-to-flat or reject.

**Committee** — November collection %, total outstanding, open
complaints, average resolution time, dues ageing buckets (0–30 / 31–60 /
61–90 / 90+ days by each flat's oldest unpaid bill) and open complaints
by category — all read from the same ledger the other roles write to.

## Core engines (in `src/lib`, fully unit-tested)

- `matching.ts` — bank-statement payment matching. Tiered evidence rules:
  a payment is auto-posted only when a reference, a UPI id, or a flat code
  plus exact amount identifies one flat beyond doubt. **An amount alone
  never auto-posts** — unclear rows go to an accounts queue, never onto a
  flat by guesswork. Overpayments are queued whole, never truncated.
- `classify.ts` — complaint category/urgency classification with
  safety-first escalation (fire, gas, lift stuck, electric shock always go
  CRITICAL to the duty manager, whatever else the text says), plus TF-IDF
  duplicate linking: ten flats reporting the same lift are linked into one
  incident, never silently closed.
- `csv.ts` — tolerant bank-statement parser (header aliases, quoted
  cells, `6,466.00`-style amounts; unparseable rows are reported, not
  dropped). `otp.ts` — the OTP issue/verify rules, unit-tested at the
  helper level.

## Sample bank statement

`public/sample-bank-statement.csv` is crafted against the seed data;
load it from the Help Desk → Bank matching tab with one click. Expected
result — **3 posted, 3 queued**: Swati's October bill by UPI + amount
(tier 2), a narration flat-code match for T07-1404 (tier 4), a part
payment from Aamir's UPI (tier 3); an ambiguous ₹7,150 that two flats
owe (tier 6), a unique amount-only ₹8,125 (tier 5) and an unknown
₹4,321 cheque (tier 6) wait in the queue.
`src/lib/matching.integration.test.ts` asserts exactly this mix.

## Run it

```bash
npm install
cp .env.example .env        # DATABASE_URL; SESSION_SECRET optional in dev
npx prisma db push
npm run db:seed
npm run dev                 # http://localhost:3000
```

Tests: `npm test` (Vitest — matching tiers, classifier + safety rules,
duplicate detection, CSV parser, OTP verify, sample-CSV integration).

## Design decisions worth knowing

- **Money is whole rupees in `Int` columns** — no float rounding in a
  ledger.
- **Engines are pure functions** with unit tests; API routes stay thin
  (auth → validate → engine → one transaction).
- **Late fee** is 1.5% of the base amount per full month overdue,
  charged in the seed so the numbers match the brief's sample rows
  (rate ₹6.50/sqft).
- **Escalation is derived from urgency CRITICAL**, not a stored flag —
  the safety rule can never be silently un-flagged.
- The session secret falls back to a clearly-marked dev-only constant
  only when `SESSION_SECRET` is unset; production must set it.
