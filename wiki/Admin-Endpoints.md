# Admin Endpoints

All admin endpoints live under `/api/admin/*` and require an `Authorization: Bearer {RESEND_ADMIN_SECRET}` header (401 otherwise). See [Guest Privacy & Security](Guest-Privacy-And-Security) for how that secret is stored and rotated.

## Calling them with curl

Two gotchas:

- Always send `-H "Content-Type: application/json"`, even with no body. Astro's built-in CSRF protection (`security.checkOrigin`) rejects any POST without a JSON content type as "Cross-site POST form submissions are forbidden" — and it runs before routing, so this happens even for endpoints that don't exist yet on the deployed site.
- Don't fetch the secret with `netlify env:get` — Netlify stores `RESEND_ADMIN_SECRET` as a write-only secret, and the CLI returns a placeholder the deployed endpoint will reject with a 401 (it also defaults to the dev context, which has no value at all). Use the mirror in `.env.local`, which matches the deployed runtime value. The secret is also scoped to the `deploy-preview` context so these endpoints can be exercised on PR previews.

## Endpoints

- **`POST /api/admin/refresh-calendars`** — regenerate every guest's stored ICS calendar (same job as the scheduled `ics-refresh-daily`/`-weekly` functions, which are **not** publicly routable) and invalidate the CDN-cached calendar URLs. Returns `{ total, succeeded, failed }`. Use after editing events or RSVP responses directly in Notion, or after deploying a change to ICS semantics — see [RSVP & Calendar](RSVP-And-Calendar).

  ```bash
  curl -X POST https://sargaux.com/api/admin/refresh-calendars \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $(grep '^RESEND_ADMIN_SECRET' .env.local | cut -d= -f2-)"
  ```

- **`POST /api/admin/send-stds`** — bulk-send save-the-date emails for one event. Body: `{ "event": "nyc" | "france" }`.
- **`POST /api/admin/send-email`** — send a single transactional email.

## Outbound email payload contract

Template functions in `src/lib/email-templates.ts` return an `EmailTemplate` (`{ subject, html, text }`) with **no recipient**. `sendToGuests` requires a full `EmailPayload`, which adds `to`. Always compose the two with `withRecipient(guest, template(...))` from `src/lib/email.ts` — it sets `to` last so a stray recipient already on a template object can't redirect the mail. Passing a bare template result is a silent failure: Resend rejects it, `sendToGuests` catches the throw, and the guest lands in the `failed` count with nothing logged per-guest — this is exactly how a missing-`to` bug shipped and went unnoticed for months.

**Both bulk senders are untestable through the HTTP endpoint.** `global.emailEnabled` defaults to `false`, so `/api/admin/send-stds` and `/api/admin/send-email` short-circuit to `{ skipped: true }` before building any payload — `tests/admin.spec.ts` only ever exercises auth and validation. Payload assembly is covered at the unit level instead, in `tests/email-unit.spec.ts` (see [Testing Guide](Testing-Guide)), where the feature flag is irrelevant. **Never flip `FEATURE_GLOBAL_EMAIL_ENABLED` on to verify a change by hand** — that sends real mail to real guests.

## Scheduled functions (`netlify/functions/`)

- `ics-refresh-weekly` — every Sunday 03:00 UTC.
- `ics-refresh-daily` — 03:00 UTC, but only inside the pre-wedding windows (Sep 27–Oct 13 2026, May 14–May 31 2027).

Neither is invokable over HTTP in production — use `POST /api/admin/refresh-calendars` for on-demand refreshes instead.
