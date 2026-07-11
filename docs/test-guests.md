# Synthetic test guests

Playwright, CI, and local authenticated testing use a **dedicated synthetic party** in the real Notion Guest List — never the couple's records or any real guest.

## Records

| Full Name   | Role              | Party        | Invitations   | Country |
|-------------|-------------------|--------------|---------------|---------|
| Alex Rivera | Primary test login (`TEST_GUEST_NAME`, `LOCAL_TESTING_USERNAME`) | With Jordan Chen | NYC + France | USA |
| Jordan Chen | Party member      | With Alex Rivera | NYC + France | USA |

Both pages use the robot icon (🤖) and should have the **Test Guest** checkbox enabled in Notion. That checkbox is the durable marker; the shared `isTestGuest()` helper in `src/lib/test-guests.ts` also recognizes the two canonical names as a fallback.

The same names exist in the hardcoded dev fallback list (`src/lib/auth.ts`) so login works when `FEATURE_GLOBAL_NOTION_BACKEND` is off.

## What tests do

- **RSVP API / security suites** log in as Alex Rivera, submit RSVPs, and **delete** that party's RSVP Responses rows on every run. Guest List `RSVP` status for the party is rewritten — that churn is expected and isolated.
- **Never** point tests at Samuel Gross, Margaux Ancel, or any real guest. A prior regression wiped the couple's real RSVP when tests used Sam's record.

## Exclusion from production operations

Synthetic guests must **never** be counted or emailed. `isTestGuest()` / `excludeTestGuests()` are applied in:

- `POST /api/admin/send-stds` and `POST /api/admin/send-email`
- `refreshAllICS()` reporting totals (calendars still refresh for test tokens)
- `scripts/sync-contacts.ts` (Resend audience sync)
- Invitation/reporting scripts: `count-*-invitations.mjs`, `generate-invitation-csv.mjs`, `find-missing-addresses.mjs`, `check-usps-imb-status.mjs`

## Rules

1. **Never delete** the synthetic Notion guest pages — page IDs are baked into calendar subscription tokens; deletion invalidates URLs permanently.
2. **Never** add real guest PII to the repo; extend the synthetic party or add new synthetic records with **Test Guest** checked.
3. When adding a new synthetic guest, update `TEST_GUEST_DISPLAY_NAMES` in `src/lib/test-guests.ts` and `TEST_GUEST_NORMALIZED_NAMES` in `scripts/lib/test-guests.mjs`.
