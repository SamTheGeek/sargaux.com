# Calendar Subscriptions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the existing calendar to pre-render .ics files and serve them continuously on a url, rather than dynamically generating them each time a guest's calendar tries to refresh them.

**The Problem:** Existing architecture does not respond quickly or reliably enough and calendar applications (particularly iOS) drop the calendar, showing no calendar subscription at all. If the calendar endpoint responds quickly again, they show it once again.

**Architecture (High-Level):** Generate a .ics file per guest, using the same URL (HMAC-based) as we currently do for continuity. (If this is not possible, explain why and suggest an alternative). Make sure those files are stored somewhere that will always be served properly.

---

## Context Notes

- `nyc.calendarSubscribe` and `france.calendarSubscribe` feature flags **already exist** in `features.ts`, `env.d.ts`, and `netlify.toml` — no new flag work needed.
- Both `/nyc/index.astro` and `/france/index.astro` already have a `<section class="calendar-subscribe">` with a disabled `<button>` and note text. We're replacing those with active links when the flag + guestId are available.
- Dates live in the **Wedding Timeline** database (related via `Day` property on each event). The Notion property name is `"Date"` (type: date). Raw REST API returns it at `page.properties['Date'].date.start` → `"2026-10-11"`.
- Timezones: NYC events → `America/New_York`; France events → `Europe/Paris`.
- `getGuestEvents(guestId)` already exists in `src/lib/notion.ts` and returns `EventRecord[]` including `dayId`.
- This is a refactor of an existing feature that has already been implemented.

---

## Rule 1: Pre-generate the ics file

Each guest's ICS file should get generated and stored permanently. We need to make sure the ics is generated on RSVP if it doesn't already exist, and also is updated appropriately. The ICS file should always have a consistent URL it is stored at. The events where an ICS file should be updated include — but might not be limited to — updating an RSVP, a guest record being modified to update their RSVP on the database, or the events database being updated.

## Rule 2: Database-side updates

We might update events or guest records server-side, and that requires a job to update all the existing ics files on a scheduled basis. This should run weekly until two weeks before either wedding, and then daily for the two weeks before and during the wedding — remember that there are two separate 'wedding' events to do this for. When this job runs, it should check for updates in the events and update them for everyone, then check for individual updates and handle that as well.

## Rule 3: Static URL

The URL for the ics files must remain unique per guest and must never change once this is deployed.

## Rule 4: Persist across deployments

The storage for these files must be perisistent across deployments, and must not be able to be removed by any external party. The storage mechanism should be highly available, fast, and allow for any user to check across multiple devices. We should pick a method that can be easily set up and used repeatedly.

## Rule 5: No 500s

It has been suggested to me that one of the causes of the calendars disappearing is 500s being returned from the server on occasion. Make sure that we don't return 500s at any point (unless strictly necessary).

## Rule 6: No authentication

The data in the ICS files is not very sensitive and shouldn't depend on the user being authenticated. The obscurity of the URLs is enough for our purposes. Make sure that the ICS files are always accessible to the internet, but make sure no private data (names, emails) of the guests are included in the ics files themselves.

## Rule 6: Only the site/jobs can write

No matter what storage we end up using, only the jobs to update ICS files and the site API itself should write to them. Under no circumstances should third parties be able to write to the ICS files.
