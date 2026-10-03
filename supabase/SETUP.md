# Activate KIMO OS cloud access

The code is ready, but no live Supabase project or public hosting has been connected in this workspace. Until configuration is provided, the app remains an explicitly labeled local sample workspace. The downloadable HTML preview is also local-only.

## 1. Create the database

Create a Supabase project in your own account. In **SQL Editor**, run the contents of [the migration](migrations/202610030001_workspace.sql) once. Alternatively, link the Supabase CLI to the project and run `supabase db push`.

The schema stores a typed workspace snapshot in a PostgreSQL JSONB row, owned by the authenticated user. Row-level security restricts reads to the owner. Saves go through an RPC that derives the owner from the authenticated session and checks a revision number. Browser clients cannot directly insert or update rows or overwrite another device's newer revision.

This is intentionally a small first persistence milestone. Normalized entity tables and incremental updates can be added when ingestion/search needs justify them. There is no service-role key in the app.

## 2. Enable owner-only email login

In **Authentication → Providers → Email**, enable email authentication and **disable “Allow new users to sign up”**. In **Authentication → Users**, create/invite Kimo's account using the email he will use to sign in.

The app uses `shouldCreateUser: false`; it never signs up new users. The dashboard setting also blocks account creation through direct API calls. Only add authorized accounts to this project.

The email-link flow uses PKCE: request a link and open it in the same browser/device. To log in on a second device, request another link there. If the project only sends email to limited recipients with its default mail provider, configure production SMTP or use an authorized test recipient before expecting delivery.

## 3. Configure and run the app

Copy `.env.example` to `.env.local` and set:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
```

Get both from Supabase **Project Settings → API / API Keys**. The key must be a publishable key (or the legacy public anon key), **never a service-role or secret key**. Email access is enforced by Auth and database RLS, not by hiding this public key.

```sh
npm ci
npm run dev
```

Supabase **Authentication → URL Configuration** must include `http://localhost:3000` in allowed redirect URLs for development. Partially set configuration produces a setup screen rather than quietly falling back to demo mode. Invalid configuration produces an error.

Public Next.js environment values are included at build time. After changing them on hosting, rebuild/redeploy the app.

## 4. Host the app

Deploy this Next.js repository to a Next.js-compatible host, such as Vercel. Add the same two public environment variables there. Set Supabase's **Site URL** to your stable HTTPS app URL and allow that exact URL in **Redirect URLs**. Use a separate development redirect for localhost; avoid broad redirect wildcards on a personal workspace.

A public deployment has not been performed here. No hosting account, Supabase project, or email provider has been configured through this session.

## 5. Acceptance check with real services

1. Open the hosted URL in browser A, request an email link, and open it in browser A.
2. Record a sample decision. Check that the UI confirms the save.
3. Sign in independently on browser/device B. The recorded decision should appear after loading.
4. In both browsers, load the same revision; make a change in A, then a different change in B. B must show a conflict and offer **Reload latest workspace**. It must not overwrite A's change.
5. Verify another authenticated account cannot read the owner's row and a signed-out client cannot call the save RPC.
6. In Settings, sign out on the current device. Opening/reloading should show the login screen.

The first signed-in view starts with the original sample business data, which is saved on the first successful edit. Existing local-browser changes are not silently uploaded into the cloud. Dates and brief content still refer to the fixed sample operating day. This milestone adds persistence and access, not real business ingestion or real-time live synchronization. Use **Settings → Reload latest workspace** to fetch changes from another device.

## Validation performed without your live project

- Lint, strict TypeScript, and production build.
- Service tests for persistence, invalid data, failed saves, and stale-device protection.
- Migration executed against embedded PostgreSQL (PGlite), including permissions, owner isolation, unauthenticated rejection, revision conflicts, and shape constraints.
- Browser tests with a simulated Supabase API for email-link requests, restored sessions, successful saves, cross-device conflicts, failed-save integrity, sign-out, and mobile login.

Real email delivery, provider configuration, live Supabase connectivity, and hosted redirects remain unverified until the configuration steps above are completed.
