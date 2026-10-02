# Node.js 22 → 24 Upgrade

**Date written:** 2026-10-01
**Status:** Planned. Do not start before **2026-10-15** (see Timing).
**Version bump:** patch (runtime/dependency change, per CLAUDE.md versioning)

## Context

The site runs on Node 22 (`.nvmrc` = `22`), which reaches **end of life on 2027-04-30**. That is four
weeks before the France weekend (May 28–30, 2027) and before its daily ICS refresh window
(May 14–31, 2027). Node 24 is Active LTS, with maintenance through April 2028, so it covers both
events and the time after them. Several dependencies already list `^24` in their `engines`
(`node-gyp`, `undici >=22.19`), and Node 24 bundles **npm 11**. npm 11 is the version that writes
`package-lock.json`, so the `libc` lockfile churn noted in CLAUDE.md goes away.

The goal is **zero guest-facing impact**: no change in rendering, login, RSVP, calendar feeds,
email, registry, or CDN caching. Any problem should be caught locally or on the deploy preview,
before production.

## Timing

- **Earliest start: 2026-10-15.** That date is after the NYC wedding (Oct 11), after the daily ICS refresh
  window ends (Oct 13), and on the first day of the dual-invite `/france` routing cutoff. Don't
  combine a runtime change with the routing flip on the same day. Starting Oct 16 or later is cleaner.
- **Must be in production by 2027-03-31.** That leaves a month of margin before Node 22 EOL and six
  weeks before the France ICS daily window. Netlify may also stop offering Node 22 for functions
  after EOL.
- Merge on a quiet weekday morning (ET), never right before a guest email send or a France
  RSVP deadline.

## Surface area (what Node actually touches here)

| Surface | Where Node version comes from | Notes |
|---|---|---|
| Local dev / scripts | `.nvmrc` via `nvm` | `scripts/setup.sh` reads `.nvmrc`; no edit needed |
| Netlify build | `.nvmrc` (**unless** a `NODE_VERSION` env var is set in the Netlify UI, which wins) | Must check the UI |
| Netlify Functions (SSR + `ics-refresh-*` scheduled) | Build Node version, **unless** `AWS_LAMBDA_JS_RUNTIME` is set | This is the production runtime, so it's the real risk |
| Netlify Edge (`login-geo-gate.ts`) | Deno | Unaffected |
| GitHub Actions | hard-coded `node-version: '22'` in 6 workflows | Must match `.nvmrc`. **Enforced** by `scripts/check-node-version.mjs` (see below) |

### The Node-version guard changes how this upgrade fails

`scripts/check-node-version.mjs` (added by the `chore/agents-use-nvmrc-node` PR) runs before `dev`,
`build`, `typecheck`, `test`, and `test:quick`. It exits non-zero when the running Node's major
version differs from `.nvmrc`. A SessionStart hook (`.claude/hooks/use-nvmrc-node.sh`) also puts the
`.nvmrc` Node on PATH for Claude sessions. Every environment that builds this site goes through
those npm scripts: the CI typecheck job (`npm run typecheck`), every Playwright CI job (the
`webServer` runs `npm run build`), the Dependabot auto-merge build, Netlify (`npm run build`), and
local dev. So once `.nvmrc` says `24`:

- **CI fails on any workflow still pinned to `node-version: '22'`.** The workflows and `.nvmrc` must
  change **in the same commit**. Switching to `node-version-file: '.nvmrc'` removes the problem for
  good, which is one more reason to prefer it.
- **A stale Netlify `NODE_VERSION` override fails the build loudly** instead of quietly keeping
  production on 22. The deploy fails at `prebuild` with the check's error, so Phase 0's env audit is
  backed by an automatic tripwire on the preview.
- **Locally, nothing runs until Node 24 is installed.** Once `.nvmrc` changes, the hook's `nvm use`
  finds no 24 and falls back to a warning, and every npm script refuses to run. Install 24 first.
- Never set `SKIP_NODE_VERSION_CHECK=1` to get past any of these. Each one is the guard catching a
  real mismatch.

Node APIs used directly by the app are minimal: `node:dns` `resolveMx` in `src/pages/api/rsvp.ts`
(it **returns false on any error**, so a runtime DNS regression would silently reject every RSVP
email, which makes it the single most important behavior to verify), plus `node:fs`/`node:path`/`node:crypto`
in tests and scripts. Notion (`@notionhq/client`), Resend, and Joy all use Node's built-in `fetch`
(undici 7 in Node 24), and Node 24 ships OpenSSL 3.5. Those two outbound-HTTP changes are the main
indirect risk.

## Phase 0 — Pre-flight (read-only, ~15 min)

1. **Netlify env audit:** `netlify env:list` (and the UI, all contexts). Confirm there is **no**
   `NODE_VERSION` or `AWS_LAMBDA_JS_RUNTIME` pinning 22. If one exists, plan to delete it as part of this upgrade,
   or set it to `24`. A leftover UI value would silently keep production on 22.
2. **Record the current runtime baseline** from the latest production deploy: the deploy log line
   `Now using node vX` and the Functions tab runtime. Save it for comparison.
3. **Check `main` is green** and `npm outdated` shows nothing pending that would pile onto this PR.
   Merge outstanding Dependabot PRs first so this PR changes **only** the runtime.
4. Re-check `engines` in `package-lock.json` for anything that *excludes* 24:
   `node -e 'const l=require("./package-lock.json");for(const[k,v]of Object.entries(l.packages))if(v.engines?.node)console.log(k,v.engines.node)' | grep -v ">=\|\*"`
   and review any range with an upper bound.
5. **Confirm the Node-version guard is on `main`** (`scripts/check-node-version.mjs` exists and
   `package.json` has the `pre*` hooks). If that PR never merged, this plan still works, but the
   tripwires described above don't exist. Do the Netlify env audit (step 1) with extra care.
6. **Re-check the TypeScript 7 pin** (`.github/dependabot.yml` ignores `typescript` `7.0.x`; CLAUDE.md
   "TypeScript must stay on 6.x"). It was still required on 2026-10-02: `latest` was 7.0.2 with
   `main` = `./lib/version.cjs` (no compiler API), `@astrojs/check@0.9.10` peered on `^5 || ^6`,
   `@typescript-eslint/typescript-estree@8.71.0` (Netlify bundler chain) peered on `<6.1.0`, and 7.1
   existed only as `7.1.0-dev` nightlies. Run:
   `npm view typescript dist-tags --json; npm view typescript@latest exports --json; npm view @astrojs/check peerDependencies; npm view @typescript-eslint/typescript-estree peerDependencies`
   The pin can be lifted **only if all of these hold**: a stable 7.1+ exists, it exports a compiler API
   again, `@astrojs/check` accepts it, and `typescript-estree` accepts it. Even then, lift it in a
   **separate PR after** this one lands, never in the same PR. Verify with `npm run build` +
   `npm run typecheck` (not `tsc`), then remove the dependabot ignore and update the CLAUDE.md section.
   If any condition fails, leave the pin alone and note the date checked in the PR description.

## Phase 1 — The change (one branch: `chore/node-24`)

Edits. Keep them to exactly these:

- `.nvmrc`: `22` → `24`
- `.github/workflows/{accessibility-tests,performance-tests,security-tests,typecheck,sync-contacts,dependabot-automerge}.yml`:
  `node-version: '22'` → `'24'`. A better change is `node-version-file: '.nvmrc'`, so `.nvmrc` really
  is the single source of truth and this edit never has to be repeated. Recommended.
  - **This must land in the same commit as `.nvmrc`.** Otherwise the Node-version guard fails every
    CI job that still runs on 22. Before pushing, `grep -rn "node-version" .github/workflows` should
    show no `'22'`.
  - Note: `dependabot-automerge.yml` runs on `pull_request_target`, so it uses `main`'s copy. It
    only switches over after merge, which is fine.
- `CLAUDE.md`:
  - Line ~59: drop the "npm bundled with Node 22 (v10) rewrites it" caveat (Node 24 bundles npm 11).
  - Line ~89: "pins Node.js to the LTS v22.x line" → v24.x.
  - The "CI workflows' `node-version` must match it" sentence: update it if switching to `node-version-file`.
- `package.json`: patch version bump. **Do not** add an `engines` field; `.nvmrc` stays the
  single source.
- `package-lock.json`: run `nvm use && npm ci` (not `npm install`). The lockfile should be **unchanged**.
  If npm 11 under Node 24 rewrites it, inspect the diff, and commit it only if it's limited to metadata.

Local toolchain (Sam's machine, not committed). Do this **before** editing `.nvmrc`, because the
Node-version guard blocks every npm script on a 22/24 mismatch:
`nvm install 24 && nvm use && nvm alias default 24`, then reinstall global CLIs, since nvm keeps them per version:
`npm install -g netlify-cli`. Also `rm -rf node_modules && npm ci`, because `sharp` and the Astro
compiler bindings are native/platform packages and must be installed fresh.

## Phase 2 — Local verification (all on Node 24; confirm `node -v` first)

Run in this order and stop at the first failure:

1. `npm run typecheck`: 0 errors **and** 0 warnings.
2. `npm run build` (the Netlify adapter path). Then `grep -r "astro:transitions/client" dist/` must be empty.
   Diff `dist/` against a Node 22 build of `main` (`git stash`/worktree, `nvm use 22`, build to
   a temp dir): the client bundles and static HTML should be **byte-identical**, or differ only in
   hashes. Any other client-side diff could be guest-visible and needs explaining before going further.
3. `npm test` (full suite, **via a subagent**, per CLAUDE.md). This covers accessibility,
   best-practices, performance, auth (incl. envelope/alias login against real Notion with 🤖 guests),
   RSVP API + Notion write-back, calendar/ICS, email payload units, security headers, couple
   randomization, and the `mutating` project last. Compare the pass/skip counts against a Node 22 run of `main`.
   The **skip count must match** too, because a newly skipped Notion-backed suite would hide a regression.
4. `npm run test:security` explicitly (the CI job that gates security).
5. Watch server output during the test run for new **runtime deprecation warnings**
   (`DEP0169 url.parse`, `punycode`, etc.). Node 24 turns several into runtime warnings. Note any
   that come from dependencies, and fix any that come from our own code.
6. **Scripts under Node 24 (no writes):**
   - `npx tsx scripts/list-event-attendees.ts --event "<any event>"` (read-only Notion + `writeFileSync`)
   - `npx tsx scripts/record-manual-rsvp.ts apply <a 🤖 entry file>` (dry run, no `--write`)
   - `npm run icons` (`sharp` native binding)
   - one RSVP follow-up export: `node scripts/generate-rsvp-followup-france.mjs` (`exceljs`)
   - `./scripts/setup.sh` on Sam's machine is idempotent. Re-run it to confirm the `.nvmrc` path still works.

## Phase 3 — Deploy preview validation

Push, open a **draft** PR, and wait for the Netlify preview. Sam marks it Ready for review so CI runs on
Node 24 (`.nvmrc` isn't in the docs-only skip list, so every suite runs).

**Caveat:** the preview shares production **Notion** and **site-wide Netlify Blobs** (`getStore` in
`src/lib/notion.ts` and `src/lib/ics-store.ts` is not deploy-scoped). Anything that writes on the
preview writes to production data. The 🤖 bots also **cannot log in** on previews
(`global.testGuestLogin` is deliberately absent from `netlify.toml`).

1. **Runtime confirmed:** the deploy log shows `Now using node v24.x`, and the Functions tab shows a Node 24
   runtime for the SSR function and both `ics-refresh-*` functions. If the functions still show 22,
   stop and fix the env override from Phase 0. (If the **build** ran on 22 because of a `NODE_VERSION`
   override, you won't get this far: the Node-version guard fails the deploy at `prebuild`. A
   failed preview with the check's "pins Node 24" error means the override is still there.)
2. **Unauthenticated, read-only:**
   - `curl -sI <preview>/`: 200, security headers present (compare the header set with production).
   - `curl <preview>/api/calendar/health` → `{"ok":true}`
   - `curl -X POST <preview>/api/login -d name=nobody -H "Origin: <preview>"` → 401, same shape as production.
   - `/?next=/nyc/travel` renders, and the language switcher hrefs carry `next`.
3. **Authenticated, by Sam, as himself (read-only browsing):** log in with the plain name, then with an
   envelope-style name (exercises the envelope path and the identity picker). Walk through `/nyc`, `/nyc/details`,
   `/nyc/travel`, `/france`, its sub-pages, `/couple` (reload twice; photos should change), `/registry`
   (**native Joy items must render, not the link-out fallback card**, because the fallback hides fetch
   failures), FAQ, both RSVP forms (pre-filled with his existing answers), both languages, and the
   NYC↔France view transitions. Then log out.
4. **Calendar feed:** fetch Sam's own `webcal`/`.ics` URL from the preview and diff it against production.
   It should be identical apart from `DTSTAMP`.
5. **Warm path:** `GET <preview>/api/warm` with the admin bearer (from `.env.local`). It's idempotent
   and rewrites the shared guest-cache blob with the same data. Confirm 200 and timings comparable
   to production.
6. **The RSVP email MX path (optional, Sam's call):** Sam re-submits **his own existing RSVP
   unchanged** on the preview. This is the only end-to-end check of `resolveMx` on the Lambda Node 24
   runtime, plus Notion write-back and the Resend confirmation email. It writes to production Notion
   (identical values, plus a new `Last RSVP` date) and sends Sam a confirmation. **Do not** run
   `refresh-calendars`, `send-email`, or `send-stds` on the preview.
7. **Function logs** (Netlify UI → Functions → SSR function) during steps 2–6: no new errors or
   deprecation warnings compared with a production log sample.

## Phase 4 — Production rollout

1. Merge (squash) during a quiet window. Watch the production deploy log for `node v24`.
2. Within 10 minutes, repeat Phase 3 steps 1–4 and 7 against `https://sargaux.com`.
3. Manually dispatch `calendar-health.yml` and `cache-warmup.yml` (`gh workflow run …`). Both should pass.
4. `POST /api/admin/refresh-calendars` once (per CLAUDE.md), so the stored ICS for every guest is
   regenerated on Node 24 now, rather than at the next Sunday 03:00 UTC run. Expect
   `failed: 0` and `total` equal to the pre-upgrade count.
5. **Watch period, 7 days:** check the first scheduled `ics-refresh-weekly` run's logs (Sunday 03:00 UTC),
   check function error rates in Netlify, and check Notion for RSVPs arriving at the normal rate. A sudden
   absence of RSVPs with email addresses is the signature of an MX-lookup regression.

## Rollback

- **Immediate:** Netlify UI → Deploys → the last Node 22 production deploy → *Publish deploy*. That
  deploy's functions keep their original runtime. There's no data migration, so rollback is instant and lossless.
- **Then:** revert the PR (`.nvmrc`, workflows) so the next build doesn't move production back to 24.
- Rollback triggers: any 5xx increase, a broken login or RSVP, `refresh-calendars` failures, a registry
  falling back to the link-out card, or any visible rendering difference.

## Explicitly out of scope

- No dependency bumps beyond what `npm ci` resolves. No TypeScript 7 in this PR: the pin still
  stands as of 2026-10-02, and lifting it, if Phase 0 step 6 shows it's safe, is a follow-up PR.
- No Node 24-only API adoption (e.g. `URLPattern`, native TS stripping) in this PR. That can come
  later, separately.
- Edge function (Deno) and Notion schema: untouched.

## Files that change

`.nvmrc`, the six workflow files in `.github/workflows/`, `CLAUDE.md`, `package.json` (version),
possibly `package-lock.json` (only if Phase 1 shows a legitimate npm 11 rewrite).

## Follow-up

Once this upgrade has finished its 7-day watch, adopt the Node 24 features worth taking:
[Node 24 Feature Adoption](2026-10-02-node-24-feature-adoption.md). That plan stays blocked until then.
