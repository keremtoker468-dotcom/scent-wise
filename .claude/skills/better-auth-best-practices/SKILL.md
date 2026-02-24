---
name: better-auth-best-practices
description: Comprehensive guide for integrating Better Auth - the TypeScript-first authentication framework. Triggers when working on authentication, session management, OAuth, magic links, passkeys, 2FA, RBAC, or any auth-related feature using the better-auth library.
---

# Better Auth Integration Guide

**Always consult [better-auth.com/docs](https://better-auth.com/docs) for the latest API and code examples.**

Better Auth is a TypeScript-first, framework-agnostic authentication and authorization framework supporting email/password, OAuth, magic links, passkeys, and more via a rich plugin ecosystem.

---

## Quick Reference

### Environment Variables

- `BETTER_AUTH_SECRET` - Encryption secret (min 32 chars). Generate: `openssl rand -base64 32`
- `BETTER_AUTH_URL` - Base URL of your app (e.g., `https://example.com`)

Only define `baseURL`/`secret` in config if the corresponding env vars are NOT set.

### File Location

The CLI looks for `auth.ts` in: `./`, `./lib`, `./utils`, or under `./src`. Use `--config` for a custom path.

### CLI Commands

```bash
npx @better-auth/cli@latest migrate    # Apply schema (built-in Kysely adapter)
npx @better-auth/cli@latest generate   # Generate schema for Prisma/Drizzle
npx @better-auth/cli@latest mcp        # Add MCP to AI tools
```

**Re-run `generate` or `migrate` after adding or changing plugins.**

---

## Core Configuration

```ts
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  appName: "My App",                       // Optional display name
  // baseURL: "https://example.com",       // Only if BETTER_AUTH_URL not set
  // secret: "...",                         // Only if BETTER_AUTH_SECRET not set
  basePath: "/api/auth",                   // Default. Set "/" for root.
  database: /* see Database section */,
  emailAndPassword: { enabled: true },
  socialProviders: { /* see OAuth section */ },
  plugins: [ /* see Plugins section */ ],
  trustedOrigins: ["https://app.example.com"], // CSRF whitelist
});
```

| Option | Notes |
|--------|-------|
| `appName` | Optional display name |
| `baseURL` | Only if `BETTER_AUTH_URL` not set |
| `basePath` | Default `/api/auth`. Set `/` for root. |
| `secret` | Only if `BETTER_AUTH_SECRET` not set |
| `database` | Required. See Database Adapters below. |
| `secondaryStorage` | Redis/KV for sessions & rate limits |
| `emailAndPassword` | `{ enabled: true }` to activate |
| `socialProviders` | `{ google: { clientId, clientSecret }, ... }` |
| `plugins` | Array of server plugins |
| `trustedOrigins` | CSRF whitelist of allowed origins |

---

## Authentication Flows

### Email & Password

Enable in config:

```ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,       // Default: 8
    maxPasswordLength: 128,     // Default: 128
    autoSignIn: true,           // Auto sign-in after sign-up
  },
});
```

Client usage:

```ts
// Sign up
const { data, error } = await authClient.signUp.email({
  email: "user@example.com",
  password: "securepassword",
  name: "User Name",           // Required field
});

// Sign in
const { data, error } = await authClient.signIn.email({
  email: "user@example.com",
  password: "securepassword",
  callbackURL: "/dashboard",   // Optional redirect
});

// Sign out
await authClient.signOut();
```

**Required fields for registration:** `email` and `name`.

### Email Verification

```ts
export const auth = betterAuth({
  emailVerification: {
    sendVerificationEmail: async ({ user, url, token }) => {
      // Send verification email to user.email with the url or token
    },
    sendOnSignUp: true,        // Auto-send on sign-up
    sendOnSignIn: false,       // Auto-send on sign-in
  },
});
```

### Password Reset

```ts
export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url, token }) => {
      // Send password reset email
    },
  },
});
```

Client usage:

```ts
// Request password reset
await authClient.forgetPassword({
  email: "user@example.com",
  redirectTo: "/reset-password",
});

// Reset with token
await authClient.resetPassword({
  newPassword: "newSecurePassword",
  token: "reset-token-from-url",
});
```

### OAuth / Social Providers

Server configuration:

```ts
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
    // Additional: apple, discord, facebook, twitter, microsoft, spotify, etc.
  },
});
```

Client usage:

```ts
await authClient.signIn.social({
  provider: "google",
  callbackURL: "/dashboard",
  // errorCallbackURL: "/auth/error",
  // newUserCallbackURL: "/onboarding",
});
```

**Default callback URL:** `/api/auth/callback/{providerName}`

**Account linking** - Allow linking accounts from multiple providers:

```ts
export const auth = betterAuth({
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google", "github", "email-password"],
    },
  },
});
```

**Incremental authorization** - Request additional scopes later:

```ts
await authClient.linkSocial({
  provider: "google",
  scopes: ["https://www.googleapis.com/auth/drive.file"],
});
```

For custom OAuth providers, use the Generic OAuth Plugin (`genericOAuth`).

### Magic Links

Server setup:

```ts
import { magicLink } from "better-auth/plugins/magic-link";

export const auth = betterAuth({
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, token, url }, ctx) => {
        // Send magic link email to the user
      },
      expiresIn: 300,       // Seconds (default: 5 minutes)
      disableSignUp: false, // Set true to prevent new registrations via magic link
    }),
  ],
});
```

Client setup:

```ts
import { magicLinkClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [magicLinkClient()],
});

// Sign in
const { data, error } = await authClient.signIn.magicLink({
  email: "user@email.com",
  callbackURL: "/dashboard",
});

// Manual verification (if using custom URL)
const { data, error } = await authClient.magicLink.verify({
  query: { token: "token-from-url", callbackURL: "/dashboard" },
});
```

### Passkeys

Install: `npm install @better-auth/passkey`

Server setup:

```ts
import { passkey } from "@better-auth/passkey";

export const auth = betterAuth({
  plugins: [
    passkey({
      rpID: "example.com",     // Your domain (use "localhost" for dev)
      rpName: "My App",
      // origin: "https://example.com", // Do NOT include trailing slash
    }),
  ],
});
```

Client setup:

```ts
import { passkeyClient } from "@better-auth/passkey/client";

const authClient = createAuthClient({
  plugins: [passkeyClient()],
});

// Register passkey (user must be authenticated)
await authClient.passkey.addPasskey({ name: "my-device" });

// Sign in with passkey
await authClient.signIn.passkey();

// Delete passkey
await authClient.passkey.deletePasskey({ id: "passkey-id" });
```

Run migrations after adding the passkey plugin.

---

## Session Management

### Storage Priority

1. If `secondaryStorage` is defined, sessions are stored there (NOT in the database).
2. Set `session.storeSessionInDatabase: true` to also persist to DB.
3. No database + `cookieCache` = fully stateless mode (session lives in cookie only).

### Configuration

```ts
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days (default) in seconds
    updateAge: 60 * 60 * 24,       // Refresh interval (1 day)
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5,              // 5 minutes
      version: 1,                   // Change to invalidate all sessions
      strategy: "compact",         // "compact" | "jwt" | "jwe"
    },
    // storeSessionInDatabase: true, // Also persist when using secondaryStorage
  },
});
```

### Cookie Cache Strategies

| Strategy | Description |
|----------|-------------|
| `compact` (default) | Base64url + HMAC. Smallest size. |
| `jwt` | Standard JWT. Readable but signed. |
| `jwe` | Encrypted. Maximum security. |

### Client Session Access

```ts
// React hook (reactive)
const { data: session, isPending, error } = authClient.useSession();

// One-time fetch
const { data: session } = await authClient.getSession();

// Revoke specific session
await authClient.revokeSession({ id: "session-id" });

// Revoke all other sessions
await authClient.revokeSessions();
```

### Server-Side Session Access

```ts
// In API routes or server components
const session = await auth.api.getSession({
  headers: request.headers,
});
if (!session) {
  // Not authenticated
}
```

**Gotcha:** Custom session fields are NOT included in the cookie cache. They are always re-fetched from the database/storage.

---

## Database Adapter Configuration

### Direct Database Connections

Pass a `pg.Pool`, `mysql2` pool, `better-sqlite3`, or `bun:sqlite` instance directly:

```ts
import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("./sqlite.db"),
});
```

### Prisma Adapter

```ts
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql", // "sqlite" | "mysql" | "postgresql"
  }),
});
```

Generate schema: `npx @better-auth/cli@latest generate`
Then apply: `npx prisma db push` or `npx prisma migrate dev`

Enable joins for 2-3x performance improvement:

```ts
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  experimental: { joins: true },
});
```

### Drizzle Adapter

```ts
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./database";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg", // "sqlite" | "pg" | "mysql"
  }),
});
```

Generate schema: `npx @better-auth/cli@latest generate`
Then apply: `npx drizzle-kit push`

### MongoDB Adapter

```ts
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { client } from "./db"; // Your MongoDB client

export const auth = betterAuth({
  database: mongodbAdapter(client),
});
```

**Critical: Model Name vs Table Name** - Better Auth uses adapter model names, NOT underlying table names. If a Prisma model is `User` mapping to table `users`, use `modelName: "user"` (the Prisma model reference), not `"users"`.

### Core Schema Tables

Better Auth requires four core tables: `user`, `session`, `account`, and `verification`. Plugins may add additional tables. Always re-run `generate`/`migrate` after adding plugins.

---

## Middleware and Route Protection

### Next.js (v16+ Proxy) - Full Session Validation

```ts
// proxy.ts (Next.js 16+)
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default async function proxy(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
```

### Next.js (Pre-16 Middleware) - Cookie-Only Check (Faster, Less Secure)

```ts
// middleware.ts
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = { matcher: ["/dashboard/:path*"] };
```

**Warning:** `getSessionCookie` only checks for cookie existence, not validity. Always validate sessions server-side for protected actions.

### Recommended: Per-Page Auth Checks

**Server-side (Next.js App Router):**

```ts
// app/dashboard/page.tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) redirect("/sign-in");
  return <div>Welcome, {session.user.name}</div>;
}
```

**Client-side (React):**

```tsx
"use client";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export default function ProtectedPage() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) return <div>Loading...</div>;
  if (!session) { router.push("/sign-in"); return null; }

  return <div>Welcome, {session.user.name}</div>;
}
```

### Next.js API Route Handler

```ts
// app/api/auth/[...all]/route.ts
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

export const { GET, POST } = toNextJsHandler(auth);
```

### Next.js Cookie Handling (`nextCookies` Plugin)

Since React Server Components cannot set cookies, use this plugin:

```ts
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  plugins: [nextCookies()], // Add as the LAST plugin
});
```

### Route Protection Comparison

| Approach | Speed | Security | Recommendation |
|----------|-------|----------|----------------|
| `getSessionCookie` (cookie-only) | Fast | Low | Optimistic redirects only |
| `auth.api.getSession` in Proxy | Slower | High | Full validation (Next.js 16+) |
| Per-page auth checks | Varies | High | **Recommended by Better Auth** |

---

## Client-Side Integration

### Framework-Specific Imports

```ts
import { createAuthClient } from "better-auth/client";   // Vanilla JS
import { createAuthClient } from "better-auth/react";     // React
import { createAuthClient } from "better-auth/vue";       // Vue
import { createAuthClient } from "better-auth/svelte";    // Svelte
import { createAuthClient } from "better-auth/solid";     // Solid
```

### Client Setup

```ts
// lib/auth-client.ts
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL: "http://localhost:3000", // Optional if same domain
  plugins: [/* client plugins */],
});
```

### Key Client Methods

```ts
authClient.signUp.email({ email, password, name })
authClient.signIn.email({ email, password, callbackURL })
authClient.signIn.social({ provider: "google", callbackURL })
authClient.signIn.magicLink({ email, callbackURL })
authClient.signIn.passkey()
authClient.signOut()
authClient.useSession()     // Reactive hook (React/Vue/Svelte/Solid)
authClient.getSession()     // One-time fetch
authClient.revokeSession({ id })
authClient.revokeSessions()
```

### SvelteKit Integration

```ts
// src/hooks.server.ts
import { svelteKitHandler } from "better-auth/svelte-kit";
import { auth } from "$lib/auth";
import { building } from "$app/environment";

export const handle = async ({ event, resolve }) => {
  return svelteKitHandler({ event, resolve, auth, building });
};
```

Use the `sveltekitCookies` plugin for automatic cookie handling:

```ts
import { sveltekitCookies } from "better-auth/svelte-kit";

export const auth = betterAuth({
  plugins: [sveltekitCookies()],
});
```

### Nuxt Integration

```ts
// server/api/auth/[...all].ts
import { auth } from "~/lib/auth";

export default defineEventHandler((event) => {
  return auth.handler(toWebRequest(event));
});
```

For SSR session access, pass `useFetch` to `useSession`:

```ts
const { data: session } = authClient.useSession(useFetch);
```

### Remix Integration

```ts
// app/routes/api.auth.$.ts
import { auth } from "~/lib/auth";

export const loader = ({ request }) => auth.handler(request);
export const action = ({ request }) => auth.handler(request);
```

### Astro Integration

```ts
// src/pages/api/auth/[...all].ts
import { auth } from "../../../lib/auth";
import type { APIRoute } from "astro";

export const GET: APIRoute = async (ctx) => auth.handler(ctx.request);
export const POST: APIRoute = async (ctx) => auth.handler(ctx.request);
```

### Type Safety

```ts
// Infer session types from your auth instance
type Session = typeof auth.$Infer.Session;
type User = typeof auth.$Infer.Session.user;

// For separate client/server projects, pass the auth type
const authClient = createAuthClient<typeof auth>();
```

---

## Role-Based Access Control (RBAC)

### Admin Plugin

```ts
import { admin } from "better-auth/plugins/admin";

export const auth = betterAuth({
  plugins: [admin()],
});
```

Run migrations after adding. Provides: user management, role assignment, ban/unban, impersonation.

### Organization Plugin (Multi-Tenant RBAC)

```ts
import { organization } from "better-auth/plugins/organization";

export const auth = betterAuth({
  plugins: [
    organization({
      // Optional: custom roles and permissions
    }),
  ],
});
```

Built-in roles: `owner`, `admin`, `member`.

### Custom Access Control

```ts
import { createAccessControl } from "better-auth/plugins/access";

// Define permission statements
const statement = {
  project: ["create", "read", "update", "delete"],
  team: ["create", "read", "update", "delete"],
} as const;

const ac = createAccessControl(statement);

// Create roles with specific permissions
const member = ac.newRole({
  project: ["create", "read"],
  team: ["read"],
});

const adminRole = ac.newRole({
  project: ["create", "read", "update"],
  team: ["create", "read", "update"],
});

const owner = ac.newRole({
  project: ["create", "read", "update", "delete"],
  team: ["create", "read", "update", "delete"],
});
```

**Import from `better-auth/plugins/access`** (not `better-auth/plugins`) for tree-shaking.

### Dynamic Access Control

Enable runtime role creation per organization:

```ts
organization({
  dynamicAccessControl: { enabled: true },
})
```

### Permission Checking (Client)

```ts
const canEdit = authClient.organization.hasPermission({
  permission: { project: ["update"] },
});
```

---

## Two-Factor Authentication (2FA)

### Server Setup

```ts
import { twoFactor } from "better-auth/plugins/two-factor";

export const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: "My App",    // Shown in authenticator apps
      // otpOptions: { digits: 6, period: 30 },
    }),
  ],
});
```

### Client Setup

```ts
import { twoFactorClient } from "better-auth/client/plugins";

const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});

// Enable 2FA for current user
await authClient.twoFactor.enable({ password: "current-password" });

// Verify TOTP code during sign-in
await authClient.twoFactor.verifyTotp({ code: "123456" });

// Disable 2FA
await authClient.twoFactor.disable({ password: "current-password" });
```

Run migrations after adding the plugin.

---

## Security Best Practices

### Secret Management

- Generate a strong secret: `openssl rand -base64 32` (minimum 32 characters).
- Store `BETTER_AUTH_SECRET` in environment variables, never in source code.
- Rotate secrets periodically; changing the secret invalidates all existing sessions.

### Cookie Security

```ts
export const auth = betterAuth({
  advanced: {
    useSecureCookies: true,   // Force HTTPS-only cookies (always use in production)
    crossSubDomainCookies: {
      enabled: true,          // Share cookies across subdomains
      domain: ".example.com",
    },
  },
});
```

### CSRF and Origin Protection

- Never disable CSRF checks (`disableCSRFCheck`) or origin checks (`disableOriginCheck`) in production.
- Use `trustedOrigins` to whitelist allowed origins.

### Rate Limiting

```ts
export const auth = betterAuth({
  rateLimit: {
    enabled: true,
    window: 60,           // Window in seconds
    max: 10,              // Max requests per window
    storage: "memory",    // "memory" | "database" | "secondary-storage"
  },
});
```

### IP Address Configuration (Behind Proxies)

```ts
export const auth = betterAuth({
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },
});
```

### ID Generation

```ts
export const auth = betterAuth({
  advanced: {
    database: {
      generateId: "uuid",  // "uuid" | "serial" | false | custom function
    },
  },
});
```

### General Security Checklist

- Always use HTTPS in production.
- Enable email verification for sign-up.
- Implement rate limiting on all auth endpoints.
- Log authentication events for audit trails.
- Rotate session tokens after privilege changes.
- Never expose internal auth errors to clients.
- Validate redirect URLs to prevent open redirect attacks.
- Use the principle of least privilege for roles and permissions.
- Clean up expired sessions periodically.

---

## Token Management

### JWT Plugin

```ts
import { jwt } from "better-auth/plugins/jwt";

export const auth = betterAuth({
  plugins: [
    jwt({
      // Custom payload (default: entire user object)
      definePayload: (session) => ({
        sub: session.user.id,
        email: session.user.email,
        role: session.user.role,
      }),
      // Key rotation
      rotationInterval: 60 * 60 * 24 * 30, // 30 days
      gracePeriod: 60 * 60 * 24 * 30,       // Keep old key valid 30 days
    }),
  ],
});
```

- Public key available at `/api/auth/jwks` (cacheable; re-fetch on `kid` mismatch).
- Call `getSession` and read the JWT from the `set-auth-jwt` response header.
- Verify tokens in microservices using the JWKS endpoint without database calls.
- Use asymmetric keys (RS256+) and keep private keys encrypted.

### Bearer Token Plugin

```ts
import { bearer } from "better-auth/plugins/bearer";

export const auth = betterAuth({
  plugins: [bearer()],
});
```

Use only when cookies are not viable (e.g., mobile apps, third-party API access). After sign-in, read the session token from response headers and pass it as `Authorization: Bearer <token>`.

**Warning:** Improper Bearer token implementation can lead to security vulnerabilities. Prefer cookies when possible.

### API Key Plugin

```ts
import { apiKey } from "better-auth/plugins/api-key";

export const auth = betterAuth({
  plugins: [apiKey()],
});
```

Use API keys for machine-to-machine or programmatic access, not for user-facing authentication.

---

## Plugins Reference

**Import plugins from dedicated paths for tree-shaking:**

```ts
import { twoFactor } from "better-auth/plugins/two-factor";
// NOT: import { twoFactor } from "better-auth/plugins";
```

| Plugin | Description |
|--------|-------------|
| `twoFactor` | TOTP-based two-factor authentication |
| `organization` | Multi-tenant RBAC with member management |
| `passkey` | WebAuthn/FIDO2 passwordless auth (`@better-auth/passkey`) |
| `magicLink` | Email-based passwordless sign-in |
| `emailOtp` | Email one-time password |
| `username` | Username-based authentication |
| `phoneNumber` | Phone number authentication |
| `admin` | Admin dashboard, user management, impersonation |
| `apiKey` | API key management |
| `bearer` | Bearer token authentication |
| `jwt` | JWT token issuance with JWKS |
| `multiSession` | Multiple concurrent sessions |
| `sso` | Single sign-on |
| `oauthProvider` | Make your app an OAuth provider |
| `oidcProvider` | OpenID Connect provider |
| `openAPI` | Auto-generated OpenAPI spec |
| `genericOAuth` | Custom OAuth provider support |
| `nextCookies` | Next.js RSC cookie handling |

Client plugins go in `createAuthClient({ plugins: [...] })`.

---

## Hooks

### Endpoint Hooks (Before/After)

```ts
import { createAuthMiddleware } from "better-auth";

export const auth = betterAuth({
  hooks: {
    before: [
      {
        matcher: (ctx) => ctx.path === "/sign-in/email",
        handler: createAuthMiddleware(async (ctx) => {
          // Pre-processing logic
          // Access: ctx.path, ctx.body, ctx.headers
        }),
      },
    ],
    after: [
      {
        matcher: (ctx) => true, // All endpoints
        handler: createAuthMiddleware(async (ctx) => {
          // Post-processing logic
          // Access: ctx.context.returned, ctx.context.session
        }),
      },
    ],
  },
});
```

### Database Hooks

```ts
export const auth = betterAuth({
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          // Add default values, validate, transform
          return { data: { ...user, role: "member" } };
        },
        after: async (user) => {
          // Post-creation actions (send welcome email, etc.)
        },
      },
    },
    session: {
      create: { before: async (session) => { /* ... */ } },
    },
  },
});
```

### Hook Context Properties

Available via `ctx.context`: `session`, `secret`, `authCookies`, `password.hash()`, `password.verify()`, `adapter`, `internalAdapter`, `generateId()`, `tables`, `baseURL`.

---

## User & Account Configuration

```ts
export const auth = betterAuth({
  user: {
    modelName: "user",           // ORM model name (NOT table name)
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
        required: false,
      },
    },
    changeEmail: { enabled: true },  // Disabled by default
    deleteUser: { enabled: true },   // Disabled by default
  },
  account: {
    modelName: "account",
    accountLinking: { enabled: true },
    // storeAccountCookie: true,    // For stateless OAuth
  },
});
```

---

## Common Gotchas

1. **Model vs table name** - Config uses ORM model name, not DB table name. If Prisma model `User` maps to table `users`, use `modelName: "user"`.
2. **Plugin schema** - Always re-run CLI (`generate`/`migrate`) after adding or removing plugins.
3. **Secondary storage** - Sessions go there by default when configured, not to the DB (unless `storeSessionInDatabase: true`).
4. **Cookie cache** - Custom session fields are NOT cached; they are always re-fetched from storage.
5. **Stateless mode** - No DB + cookie cache = session lives in cookie only. Logout takes effect only when the cache expires.
6. **Change email flow** - Sends verification to current email first, then to the new email.
7. **Next.js caching** - App Router caches routes by default. Use `router.refresh()` in `onSessionChange` to clear the router cache.
8. **CommonJS** - Better Auth does NOT support CommonJS (`require`). Use ESM imports only.
9. **Plugin imports** - Import plugins from their dedicated paths (e.g., `better-auth/plugins/two-factor`) for tree-shaking, not from `better-auth/plugins`.
10. **Prisma 7+** - The `output` path field is required. Import Prisma client from your configured output path, not `@prisma/client`.

---

## Resources

- [Official Documentation](https://better-auth.com/docs)
- [Options Reference](https://better-auth.com/docs/reference/options)
- [GitHub Repository](https://github.com/better-auth/better-auth)
- [Example Projects](https://github.com/better-auth/examples)
- [Init Options Source](https://github.com/better-auth/better-auth/blob/main/packages/core/src/types/init-options.ts)
- [Discord Community](https://discord.gg/better-auth)
