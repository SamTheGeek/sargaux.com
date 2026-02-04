# M1 Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the foundation for the wedding website: homepage with login CTA, static password authentication, and Notion integration for event data.

**Architecture:** Astro hybrid SSR with Netlify adapter. Cookie-based auth with localStorage preferences. Notion SDK for build-time data fetching with server endpoints for future writes.

**Tech Stack:** Astro 5.x, @astrojs/netlify, @notionhq/client, TypeScript

---

## Task 1: Install Netlify Adapter

**Files:**
- Modify: `astro.config.mjs`
- Modify: `package.json` (via npm)

**Step 1: Install the Netlify adapter**

Run:
```bash
npm install @astrojs/netlify
```

**Step 2: Configure Astro for hybrid mode**

Modify `astro.config.mjs`:
```javascript
// @ts-check
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

// https://astro.build/config
export default defineConfig({
  output: 'hybrid',
  adapter: netlify(),
  server: {
    port: 1213
  }
});
```

**Step 3: Verify build works**

Run:
```bash
npm run build
```
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add astro.config.mjs package.json package-lock.json
git commit -m "feat: add Netlify adapter for hybrid SSR"
```

---

## Task 2: Create Base Layout Component

**Files:**
- Create: `src/layouts/BaseLayout.astro`
- Modify: `src/pages/index.astro`

**Step 1: Create the base layout**

Create `src/layouts/BaseLayout.astro`:
```astro
---
interface Props {
  title: string;
  description?: string;
}

const { title, description = 'Wedding website for Sam & Margaux' } = Astro.props;
---

<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content={description} />
    <meta name="robots" content="noindex, nofollow" />
    <meta name="generator" content={Astro.generator} />
    <title>{title} | Chez Sargaux</title>
  </head>
  <body>
    <slot />
  </body>
</html>

<style is:global>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html,
  body {
    height: 100%;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  }

  body {
    display: flex;
    flex-direction: column;
    background-color: #ffffff;
    color: #1a1a1a;
    line-height: 1.6;
  }
</style>
```

**Step 2: Update index.astro to use layout**

Replace `src/pages/index.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout title="Welcome">
  <main>
    <h1>Chez Sargaux</h1>
  </main>
  <footer>
    <p>&copy; 2026</p>
  </footer>
</BaseLayout>

<style>
  main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  h1 {
    font-size: 3rem;
    font-weight: 300;
    letter-spacing: 0.05em;
  }

  footer {
    padding: 2rem;
    text-align: center;
  }

  footer p {
    font-size: 0.875rem;
    color: #666;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 2rem;
    }
  }
</style>
```

**Step 3: Verify build and tests pass**

Run:
```bash
npm run build && npm run test:quick
```
Expected: Build succeeds, accessibility tests pass

**Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro src/pages/index.astro
git commit -m "refactor: extract BaseLayout component"
```

---

## Task 3: Create Environment Configuration

**Files:**
- Create: `src/env.d.ts` (update)
- Create: `.env.example`
- Modify: `.gitignore`

**Step 1: Create environment example file**

Create `.env.example`:
```bash
# Authentication passwords (static for MVP)
AUTH_PASSWORD_SAM=
AUTH_PASSWORD_MARGAUX=
AUTH_PASSWORD_GROSS=
AUTH_PASSWORD_ANCEL=

# Notion integration
NOTION_API_KEY=
NOTION_EVENTS_DATABASE_ID=
NOTION_GUESTS_DATABASE_ID=

# Session secret (generate with: openssl rand -base64 32)
SESSION_SECRET=
```

**Step 2: Update .gitignore**

Add to `.gitignore`:
```
# Environment variables
.env
.env.local
.env.*.local
```

**Step 3: Update env.d.ts for type safety**

Replace `src/env.d.ts`:
```typescript
/// <reference path="../.astro/types.d.ts" />

interface ImportMetaEnv {
  readonly AUTH_PASSWORD_SAM: string;
  readonly AUTH_PASSWORD_MARGAUX: string;
  readonly AUTH_PASSWORD_GROSS: string;
  readonly AUTH_PASSWORD_ANCEL: string;
  readonly NOTION_API_KEY: string;
  readonly NOTION_EVENTS_DATABASE_ID: string;
  readonly NOTION_GUESTS_DATABASE_ID: string;
  readonly SESSION_SECRET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

**Step 4: Commit**

```bash
git add .env.example .gitignore src/env.d.ts
git commit -m "feat: add environment configuration"
```

---

## Task 4: Create Auth Utilities

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/lib/cookies.ts`

**Step 1: Create cookie utilities**

Create `src/lib/cookies.ts`:
```typescript
import type { AstroCookies } from 'astro';

const COOKIE_NAME = 'sargaux_session';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

export interface SessionData {
  user: string;
  authenticatedAt: number;
}

export function setSessionCookie(cookies: AstroCookies, user: string): void {
  const session: SessionData = {
    user,
    authenticatedAt: Date.now(),
  };

  cookies.set(COOKIE_NAME, JSON.stringify(session), {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
  });
}

export function getSession(cookies: AstroCookies): SessionData | null {
  const cookie = cookies.get(COOKIE_NAME);
  if (!cookie?.value) return null;

  try {
    return JSON.parse(cookie.value) as SessionData;
  } catch {
    return null;
  }
}

export function clearSession(cookies: AstroCookies): void {
  cookies.delete(COOKIE_NAME, { path: '/' });
}
```

**Step 2: Create auth utilities**

Create `src/lib/auth.ts`:
```typescript
type ValidUser = 'sam' | 'margaux' | 'gross' | 'ancel';

const PASSWORDS: Record<ValidUser, string | undefined> = {
  sam: import.meta.env.AUTH_PASSWORD_SAM,
  margaux: import.meta.env.AUTH_PASSWORD_MARGAUX,
  gross: import.meta.env.AUTH_PASSWORD_GROSS,
  ancel: import.meta.env.AUTH_PASSWORD_ANCEL,
};

export interface AuthResult {
  success: boolean;
  user?: ValidUser;
  error?: string;
}

export function validatePassword(password: string): AuthResult {
  if (!password || password.trim() === '') {
    return { success: false, error: 'Password is required' };
  }

  const normalizedPassword = password.trim().toLowerCase();

  for (const [user, validPassword] of Object.entries(PASSWORDS)) {
    if (validPassword && normalizedPassword === validPassword.toLowerCase()) {
      return { success: true, user: user as ValidUser };
    }
  }

  return { success: false, error: 'Invalid password' };
}
```

**Step 3: Verify TypeScript compiles**

Run:
```bash
npm run build
```
Expected: Build completes without TypeScript errors

**Step 4: Commit**

```bash
git add src/lib/auth.ts src/lib/cookies.ts
git commit -m "feat: add authentication utilities"
```

---

## Task 5: Create Login Page

**Files:**
- Create: `src/pages/login.astro`

**Step 1: Create login page with form**

Create `src/pages/login.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { validatePassword } from '../lib/auth';
import { setSessionCookie, getSession } from '../lib/cookies';

// Check if already logged in
const session = getSession(Astro.cookies);
if (session) {
  return Astro.redirect('/nyc');
}

let error = '';

// Handle form submission
if (Astro.request.method === 'POST') {
  const formData = await Astro.request.formData();
  const password = formData.get('password')?.toString() ?? '';

  const result = validatePassword(password);

  if (result.success && result.user) {
    setSessionCookie(Astro.cookies, result.user);
    return Astro.redirect('/nyc');
  } else {
    error = result.error ?? 'Invalid password';
  }
}

export const prerender = false;
---

<BaseLayout title="Login">
  <main>
    <div class="login-container">
      <h1>Welcome</h1>
      <p class="subtitle">Please enter your password to continue</p>

      {error && <p class="error" role="alert">{error}</p>}

      <form method="POST">
        <label for="password" class="visually-hidden">Password</label>
        <input
          type="password"
          id="password"
          name="password"
          placeholder="Enter password"
          required
          autocomplete="current-password"
        />
        <button type="submit">Continue</button>
      </form>
    </div>
  </main>
</BaseLayout>

<style>
  main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .login-container {
    max-width: 400px;
    width: 100%;
    text-align: center;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 300;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .subtitle {
    color: #666;
    margin-bottom: 2rem;
  }

  .error {
    color: #dc2626;
    background: #fef2f2;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  input {
    padding: 0.875rem 1rem;
    font-size: 1rem;
    border: 1px solid #e5e5e5;
    border-radius: 0.5rem;
    text-align: center;
  }

  input:focus {
    outline: none;
    border-color: #1a1a1a;
  }

  button {
    padding: 0.875rem 1rem;
    font-size: 1rem;
    background: #1a1a1a;
    color: white;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  button:hover {
    background: #333;
  }

  button:focus {
    outline: 2px solid #1a1a1a;
    outline-offset: 2px;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
```

**Step 2: Verify build**

Run:
```bash
npm run build
```
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/pages/login.astro
git commit -m "feat: add login page with password authentication"
```

---

## Task 6: Create Auth Middleware

**Files:**
- Create: `src/middleware.ts`

**Step 1: Create middleware for protected routes**

Create `src/middleware.ts`:
```typescript
import { defineMiddleware } from 'astro:middleware';
import { getSession } from './lib/cookies';

const PUBLIC_PATHS = ['/', '/login'];

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;

  // Allow public paths
  if (PUBLIC_PATHS.includes(pathname)) {
    return next();
  }

  // Allow static assets
  if (pathname.startsWith('/_') || pathname.includes('.')) {
    return next();
  }

  // Check authentication for all other routes
  const session = getSession(context.cookies);

  if (!session) {
    return context.redirect('/login');
  }

  // Add session to locals for use in pages
  context.locals.session = session;

  return next();
});
```

**Step 2: Update env.d.ts with locals type**

Add to `src/env.d.ts` at the end:
```typescript
declare namespace App {
  interface Locals {
    session?: import('./lib/cookies').SessionData;
  }
}
```

**Step 3: Verify build**

Run:
```bash
npm run build
```
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add src/middleware.ts src/env.d.ts
git commit -m "feat: add auth middleware for protected routes"
```

---

## Task 7: Update Homepage with Login CTA

**Files:**
- Modify: `src/pages/index.astro`

**Step 1: Update homepage with proper content**

Replace `src/pages/index.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import { getSession } from '../lib/cookies';

const session = getSession(Astro.cookies);
---

<BaseLayout title="Welcome">
  <main>
    <div class="hero">
      <h1>Chez Sargaux</h1>
      <p class="tagline">Sam & Margaux</p>

      {session ? (
        <a href="/nyc" class="cta">Enter Site</a>
      ) : (
        <a href="/login" class="cta">Login to Continue</a>
      )}
    </div>
  </main>
  <footer>
    <p>&copy; 2026 Sam Gross</p>
  </footer>
</BaseLayout>

<style>
  main {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
  }

  .hero {
    text-align: center;
  }

  h1 {
    font-size: 3.5rem;
    font-weight: 300;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
  }

  .tagline {
    font-size: 1.25rem;
    color: #666;
    margin-bottom: 2.5rem;
  }

  .cta {
    display: inline-block;
    padding: 1rem 2.5rem;
    font-size: 1rem;
    text-decoration: none;
    color: white;
    background: #1a1a1a;
    border-radius: 0.5rem;
    transition: background 0.2s;
  }

  .cta:hover {
    background: #333;
  }

  .cta:focus {
    outline: 2px solid #1a1a1a;
    outline-offset: 2px;
  }

  footer {
    padding: 2rem;
    text-align: center;
  }

  footer p {
    font-size: 0.875rem;
    color: #666;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 2.5rem;
    }

    .tagline {
      font-size: 1rem;
    }
  }
</style>
```

**Step 2: Run tests**

Run:
```bash
npm run build && npm run test:quick
```
Expected: Build and accessibility tests pass

**Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: update homepage with login CTA"
```

---

## Task 8: Create NYC Landing Page Structure

**Files:**
- Create: `src/pages/nyc/index.astro`

**Step 1: Create NYC landing page**

Create directory and file `src/pages/nyc/index.astro`:
```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';

const { session } = Astro.locals;

export const prerender = false;
---

<BaseLayout title="New York" description="NYC Wedding - October 2026">
  <header>
    <nav>
      <a href="/" class="logo">Chez Sargaux</a>
      <span class="user">Welcome, {session?.user}</span>
    </nav>
  </header>

  <main>
    <div class="hero">
      <h1>New York</h1>
      <p class="date">October 11, 2026</p>
      <p class="subtitle">Dinner & Dancing</p>
    </div>

    <nav class="event-nav" aria-label="Event sections">
      <a href="/nyc/schedule">Schedule</a>
      <a href="/nyc/details">Details</a>
      <a href="/nyc/travel">Travel</a>
      <a href="/nyc/rsvp">RSVP</a>
    </nav>
  </main>

  <footer>
    <p>&copy; 2026 Sam Gross</p>
  </footer>
</BaseLayout>

<style>
  header {
    padding: 1rem 2rem;
    border-bottom: 1px solid #f0f0f0;
  }

  nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 300;
    letter-spacing: 0.05em;
    text-decoration: none;
    color: #1a1a1a;
  }

  .user {
    font-size: 0.875rem;
    color: #666;
    text-transform: capitalize;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 3rem;
  }

  .hero {
    text-align: center;
  }

  h1 {
    font-size: 3rem;
    font-weight: 300;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
  }

  .date {
    font-size: 1.5rem;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 1rem;
    color: #666;
  }

  .event-nav {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .event-nav a {
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    color: #1a1a1a;
    border: 1px solid #e5e5e5;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .event-nav a:hover {
    background: #f5f5f5;
    border-color: #1a1a1a;
  }

  .event-nav a:focus {
    outline: 2px solid #1a1a1a;
    outline-offset: 2px;
  }

  footer {
    padding: 2rem;
    text-align: center;
    border-top: 1px solid #f0f0f0;
  }

  footer p {
    font-size: 0.875rem;
    color: #666;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 2rem;
    }

    .date {
      font-size: 1.25rem;
    }
  }
</style>
```

**Step 2: Verify build**

Run:
```bash
npm run build
```
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/pages/nyc/index.astro
git commit -m "feat: add NYC event landing page"
```

---

## Task 9: Create France Landing Page Structure

**Files:**
- Create: `src/pages/france/index.astro`

**Step 1: Create France landing page**

Create directory and file `src/pages/france/index.astro`:
```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';

const { session } = Astro.locals;

export const prerender = false;
---

<BaseLayout title="France" description="France Wedding - May 2027">
  <header>
    <nav>
      <a href="/" class="logo">Chez Sargaux</a>
      <span class="user">Welcome, {session?.user}</span>
    </nav>
  </header>

  <main>
    <div class="hero">
      <h1>France</h1>
      <p class="date">May 28–30, 2027</p>
      <p class="subtitle">Village De Sully Weekend</p>
    </div>

    <nav class="event-nav" aria-label="Event sections">
      <a href="/france/schedule">Schedule</a>
      <a href="/france/details">Details</a>
      <a href="/france/travel">Travel</a>
      <a href="/france/rsvp">RSVP</a>
    </nav>
  </main>

  <footer>
    <p>&copy; 2026 Sam Gross</p>
  </footer>
</BaseLayout>

<style>
  header {
    padding: 1rem 2rem;
    border-bottom: 1px solid #f0f0f0;
  }

  nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .logo {
    font-size: 1.25rem;
    font-weight: 300;
    letter-spacing: 0.05em;
    text-decoration: none;
    color: #1a1a1a;
  }

  .user {
    font-size: 0.875rem;
    color: #666;
    text-transform: capitalize;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    gap: 3rem;
  }

  .hero {
    text-align: center;
  }

  h1 {
    font-size: 3rem;
    font-weight: 300;
    letter-spacing: 0.1em;
    margin-bottom: 0.5rem;
  }

  .date {
    font-size: 1.5rem;
    color: #1a1a1a;
    margin-bottom: 0.25rem;
  }

  .subtitle {
    font-size: 1rem;
    color: #666;
  }

  .event-nav {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .event-nav a {
    padding: 0.75rem 1.5rem;
    text-decoration: none;
    color: #1a1a1a;
    border: 1px solid #e5e5e5;
    border-radius: 0.5rem;
    transition: all 0.2s;
  }

  .event-nav a:hover {
    background: #f5f5f5;
    border-color: #1a1a1a;
  }

  .event-nav a:focus {
    outline: 2px solid #1a1a1a;
    outline-offset: 2px;
  }

  footer {
    padding: 2rem;
    text-align: center;
    border-top: 1px solid #f0f0f0;
  }

  footer p {
    font-size: 0.875rem;
    color: #666;
  }

  @media (max-width: 768px) {
    h1 {
      font-size: 2rem;
    }

    .date {
      font-size: 1.25rem;
    }
  }
</style>
```

**Step 2: Verify build**

Run:
```bash
npm run build
```
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/pages/france/index.astro
git commit -m "feat: add France event landing page"
```

---

## Task 10: Install and Configure Notion SDK

**Files:**
- Modify: `package.json` (via npm)
- Create: `src/lib/notion.ts`

**Step 1: Install Notion SDK**

Run:
```bash
npm install @notionhq/client
```

**Step 2: Create Notion client wrapper**

Create `src/lib/notion.ts`:
```typescript
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: import.meta.env.NOTION_API_KEY,
});

export interface NotionEvent {
  id: string;
  title: string;
  date: string;
  location?: string;
  description?: string;
  wedding: 'nyc' | 'france';
}

export async function getEvents(wedding: 'nyc' | 'france'): Promise<NotionEvent[]> {
  const databaseId = import.meta.env.NOTION_EVENTS_DATABASE_ID;

  if (!databaseId) {
    console.warn('NOTION_EVENTS_DATABASE_ID not set');
    return [];
  }

  try {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: 'Wedding',
        select: {
          equals: wedding === 'nyc' ? 'NYC' : 'France',
        },
      },
      sorts: [
        {
          property: 'Date',
          direction: 'ascending',
        },
      ],
    });

    return response.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Name?.title?.[0]?.plain_text ?? 'Untitled',
      date: page.properties.Date?.date?.start ?? '',
      location: page.properties.Location?.rich_text?.[0]?.plain_text,
      description: page.properties.Description?.rich_text?.[0]?.plain_text,
      wedding,
    }));
  } catch (error) {
    console.error('Error fetching events from Notion:', error);
    return [];
  }
}

export { notion };
```

**Step 3: Verify build**

Run:
```bash
npm run build
```
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/notion.ts
git commit -m "feat: add Notion SDK and events fetching"
```

---

## Task 11: Create Logout Endpoint

**Files:**
- Create: `src/pages/api/logout.ts`

**Step 1: Create logout API endpoint**

Create `src/pages/api/logout.ts`:
```typescript
import type { APIRoute } from 'astro';
import { clearSession } from '../../lib/cookies';

export const prerender = false;

export const POST: APIRoute = async ({ cookies, redirect }) => {
  clearSession(cookies);
  return redirect('/');
};

export const GET: APIRoute = async ({ cookies, redirect }) => {
  clearSession(cookies);
  return redirect('/');
};
```

**Step 2: Verify build**

Run:
```bash
npm run build
```
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add src/pages/api/logout.ts
git commit -m "feat: add logout endpoint"
```

---

## Task 12: Final Verification

**Step 1: Run full test suite**

Run:
```bash
npm run verify
```
Expected: Build and all tests pass

**Step 2: Test locally with dev server**

Run:
```bash
npm run dev
```

Manual verification checklist:
- [ ] Homepage loads at http://localhost:1213
- [ ] Login CTA visible on homepage
- [ ] Clicking login goes to /login
- [ ] Cannot access /nyc or /france without logging in (redirects to /login)

**Step 3: Create final commit if any cleanup needed**

If all tests pass and verification complete, no additional commit needed.

---

## Summary

After completing all tasks, the M1 foundation will include:

- **BaseLayout component** for consistent page structure
- **Cookie-based authentication** with static passwords
- **Auth middleware** protecting all non-public routes
- **Homepage** with login CTA
- **Login page** with password form
- **NYC and France landing pages** (structure only)
- **Notion integration** ready for event data
- **Logout endpoint**

**Next milestone (M2)** will build on this with:
- Email infrastructure (Resend)
- Calendar subscriptions (ICS generation)
- Save-the-date content
