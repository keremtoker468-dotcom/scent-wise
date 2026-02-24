---
name: better-auth-best-practices
description: Best practices for implementing authentication with the Better Auth library. Use when working with Better Auth (better-auth npm package), setting up authentication flows, configuring OAuth providers, managing sessions, implementing role-based access control, or integrating Better Auth with Next.js, React, or other frameworks.
---

# Better Auth Best Practices

## Setup and Configuration

```typescript
// auth.ts - server-side configuration
import { betterAuth } from "better-auth"

export const auth = betterAuth({
  database: {
    provider: "pg", // or "mysql", "sqlite"
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
})
```

```typescript
// auth-client.ts - client-side
import { createAuthClient } from "better-auth/client"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,
})
```

## Authentication Flows

### Email/Password
- Always enable email verification in production
- Use strong password requirements
- Implement rate limiting on auth endpoints
- Hash passwords with bcrypt or argon2 (Better Auth handles this)

### OAuth Providers
- Configure callback URLs correctly for each provider
- Store client secrets in environment variables, never in code
- Handle account linking when users sign in with multiple providers
- Request minimal OAuth scopes

### Magic Links
- Set appropriate expiration times (15 minutes recommended)
- Invalidate magic links after use
- Rate limit magic link requests to prevent abuse

## Session Management

- Use HTTP-only, secure, SameSite cookies for session tokens
- Set appropriate session expiration (7-30 days typical)
- Implement session refresh for long-lived sessions
- Clear sessions on password change
- Support multiple concurrent sessions when appropriate

## Framework Integration

### Next.js App Router
```typescript
// app/api/[...all]/route.ts
import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
```

### Middleware Protection
```typescript
// middleware.ts
import { betterAuth } from "better-auth"

export async function middleware(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url))
  }
}
```

## Role-Based Access Control

- Define roles in the auth configuration
- Check roles server-side, never trust client-side role checks alone
- Use the principle of least privilege
- Implement role hierarchy if needed (admin > editor > viewer)

## Security Best Practices

- Always use HTTPS in production
- Enable CSRF protection
- Set secure cookie attributes (`httpOnly`, `secure`, `sameSite`)
- Implement rate limiting on all auth endpoints
- Log authentication events for audit trails
- Rotate session tokens after privilege changes
- Never expose internal auth errors to clients
- Validate redirect URLs to prevent open redirect attacks

## Database Considerations

- Run Better Auth migrations to create required tables
- Add indexes on session lookup columns
- Clean up expired sessions periodically
- Back up auth tables regularly

## Environment Variables

Keep these server-side only (never prefix with `NEXT_PUBLIC_`):
- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_SECRET`, `GITHUB_CLIENT_SECRET`, etc.

Safe for client:
- `NEXT_PUBLIC_APP_URL`
