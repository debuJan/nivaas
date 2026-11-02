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

## Core engines (in `src/lib`, fully unit-tested)

- `matching.ts` — bank-statement payment matching. Tiered evidence rules:
  a payment is auto-posted only when a reference, a UPI id, or a flat code
  plus exact amount identifies one flat beyond doubt. **An amount alone
  never auto-posts** — unclear rows go to an accounts queue, never onto a
  flat by guesswork.
- `classify.ts` — complaint category/urgency classification with
  safety-first escalation (fire, gas, lift stuck, electric shock always go
  CRITICAL to the duty manager, whatever else the text says), plus TF-IDF
  duplicate linking: ten flats reporting the same lift are linked into one
  incident, never silently closed.

## Run it

```bash
npm install
npx prisma db push && npm run db:seed
npm run dev
```

Tests: `npm test` (Vitest — matching tiers and classifier behaviour).

## Demo logins

OTP is mocked in this build. Once auth lands, any seeded phone number
(e.g. a resident's `98200…` number, help desk `9000000001`, committee
`9000000002`) signs in with OTP **123456**. Auth itself is a later phase;
this foundation covers the data model, seed data and the two engines.
