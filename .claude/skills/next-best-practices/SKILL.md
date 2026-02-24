---
name: next-best-practices
description: Next.js best practices - file conventions, RSC boundaries, data patterns, async APIs, metadata, error handling, route handlers, image/font optimization, bundling, caching, middleware, self-hosting, and deployment. Automatically applies when writing or reviewing Next.js code.
user-invocable: false
---

# Next.js Best Practices

Apply these rules when writing or reviewing Next.js code.

---

## File Conventions

Next.js App Router uses file-based routing with special file conventions.

### Project Structure

Reference: https://nextjs.org/docs/app/getting-started/project-structure

```
app/
├── layout.tsx          # Root layout (required)
├── page.tsx            # Home page (/)
├── loading.tsx         # Loading UI
├── error.tsx           # Error UI
├── not-found.tsx       # 404 UI
├── global-error.tsx    # Global error UI
├── route.ts            # API endpoint
├── template.tsx        # Re-rendered layout
├── default.tsx         # Parallel route fallback
├── blog/
│   ├── page.tsx        # /blog
│   └── [slug]/
│       └── page.tsx    # /blog/:slug
└── (group)/            # Route group (no URL impact)
    └── page.tsx
```

### Special Files

| File | Purpose |
|------|---------|
| `page.tsx` | UI for a route segment |
| `layout.tsx` | Shared UI for segment and children |
| `loading.tsx` | Loading UI (Suspense boundary) |
| `error.tsx` | Error UI (Error boundary) |
| `not-found.tsx` | 404 UI |
| `route.ts` | API endpoint |
| `template.tsx` | Like layout but re-renders on navigation |
| `default.tsx` | Fallback for parallel routes |

### Route Segments

```
app/
├── blog/               # Static segment: /blog
├── [slug]/             # Dynamic segment: /:slug
├── [...slug]/          # Catch-all: /a/b/c
├── [[...slug]]/        # Optional catch-all: / or /a/b/c
└── (marketing)/        # Route group (ignored in URL)
```

### Parallel Routes

```
app/
├── @analytics/
│   └── page.tsx
├── @sidebar/
│   └── page.tsx
└── layout.tsx          # Receives { analytics, sidebar } as props
```

### Intercepting Routes

```
app/
├── feed/
│   └── page.tsx
├── @modal/
│   └── (.)photo/[id]/  # Intercepts /photo/[id] from /feed
│       └── page.tsx
└── photo/[id]/
    └── page.tsx
```

Conventions:
- `(.)` - same level
- `(..)` - one level up
- `(..)(..)` - two levels up
- `(...)` - from root

### Private Folders

```
app/
├── _components/        # Private folder (not a route)
│   └── Button.tsx
└── page.tsx
```

Prefix with `_` to exclude from routing.

### Middleware / Proxy

#### Next.js 14-15: `middleware.ts`

```ts
// middleware.ts (root of project)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Auth, redirects, rewrites, etc.
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

#### Next.js 16+: `proxy.ts`

Renamed for clarity - same capabilities, different names:

```ts
// proxy.ts (root of project)
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  // Same logic as middleware
  return NextResponse.next();
}

export const proxyConfig = {
  matcher: ['/dashboard/:path*', '/api/:path*'],
};
```

| Version | File | Export | Config |
|---------|------|--------|--------|
| v14-15 | `middleware.ts` | `middleware()` | `config` |
| v16+ | `proxy.ts` | `proxy()` | `proxyConfig` |

**Migration**: Run `npx @next/codemod@latest upgrade` to auto-rename.

Reference: https://nextjs.org/docs/app/api-reference/file-conventions

---

## RSC Boundaries

Detect and prevent invalid patterns when crossing Server/Client component boundaries.

### 1. Async Client Components Are Invalid

Client components **cannot** be async functions. Only Server Components can be async.

**Detect:** File has `'use client'` AND component is `async function` or returns `Promise`

```tsx
// Bad: async client component
'use client'
export default async function UserProfile() {
  const user = await getUser() // Cannot await in client component
  return <div>{user.name}</div>
}

// Good: Remove async, fetch data in parent server component
// page.tsx (server component - no 'use client')
export default async function Page() {
  const user = await getUser()
  return <UserProfile user={user} />
}

// UserProfile.tsx (client component)
'use client'
export function UserProfile({ user }: { user: User }) {
  return <div>{user.name}</div>
}
```

### 2. Non-Serializable Props to Client Components

Props passed from Server to Client must be JSON-serializable.

**Detect:** Server component passes these to a client component:
- Functions (except Server Actions with `'use server'`)
- `Date` objects
- `Map`, `Set`, `WeakMap`, `WeakSet`
- Class instances
- `Symbol` (unless globally registered)
- Circular references

```tsx
// Bad: Function prop
// page.tsx (server)
export default function Page() {
  const handleClick = () => console.log('clicked')
  return <ClientButton onClick={handleClick} />
}

// Good: Define function inside client component
// ClientButton.tsx
'use client'
export function ClientButton() {
  const handleClick = () => console.log('clicked')
  return <button onClick={handleClick}>Click</button>
}
```

```tsx
// Bad: Date object (silently becomes string, then crashes)
// page.tsx (server)
export default async function Page() {
  const post = await getPost()
  return <PostCard createdAt={post.createdAt} /> // Date object
}

// Good: Serialize to string on server
export default async function Page() {
  const post = await getPost()
  return <PostCard createdAt={post.createdAt.toISOString()} />
}
```

```tsx
// Bad: Map/Set
<ClientComponent items={new Map([['a', 1]])} />

// Good: Convert to array/object
<ClientComponent items={Object.fromEntries(map)} />
<ClientComponent items={Array.from(set)} />
```

### 3. Server Actions Are the Exception

Functions marked with `'use server'` CAN be passed to client components.

```tsx
// Valid: Server Action can be passed
// actions.ts
'use server'
export async function submitForm(formData: FormData) {
  // server-side logic
}

// ClientForm.tsx (client)
'use client'
export function ClientForm({ onSubmit }: { onSubmit: (data: FormData) => Promise<void> }) {
  return <form action={onSubmit}>...</form>
}
```

### Quick Reference

| Pattern | Valid? | Fix |
|---------|--------|-----|
| `'use client'` + `async function` | No | Fetch in server parent, pass data |
| Pass `() => {}` to client | No | Define in client or use server action |
| Pass `new Date()` to client | No | Use `.toISOString()` |
| Pass `new Map()` to client | No | Convert to object/array |
| Pass class instance to client | No | Pass plain object |
| Pass server action to client | Yes | - |
| Pass `string/number/boolean` | Yes | - |
| Pass plain object/array | Yes | - |

---

## Async Patterns

In Next.js 15+, `params`, `searchParams`, `cookies()`, and `headers()` are asynchronous.

### Async Params and SearchParams

Always type them as `Promise<...>` and await them.

#### Pages and Layouts

```tsx
type Props = { params: Promise<{ slug: string }> }

export default async function Page({ params }: Props) {
  const { slug } = await params
}
```

#### Route Handlers

```tsx
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
}
```

#### SearchParams

```tsx
type Props = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ query?: string }>
}

export default async function Page({ params, searchParams }: Props) {
  const { slug } = await params
  const { query } = await searchParams
}
```

#### Synchronous Components

Use `React.use()` for non-async components:

```tsx
import { use } from 'react'

type Props = { params: Promise<{ slug: string }> }

export default function Page({ params }: Props) {
  const { slug } = use(params)
}
```

#### generateMetadata

```tsx
type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return { title: slug }
}
```

### Async Cookies and Headers

```tsx
import { cookies, headers } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const headersList = await headers()

  const theme = cookieStore.get('theme')
  const userAgent = headersList.get('user-agent')
}
```

### Migration Codemod

```bash
npx @next/codemod@latest next-async-request-api .
```

---

## Runtime Selection

Use the default Node.js runtime for new routes and pages. Only use Edge runtime if the project already uses it or there is a specific requirement.

```tsx
// Good: Default - no runtime config needed (uses Node.js)
export default function Page() { ... }

// Caution: Only if already used in project or specifically required
export const runtime = 'edge'
```

### Node.js Runtime (Default)

- Full Node.js API support
- File system access (`fs`)
- Full `crypto` support
- Database connections
- Most npm packages work

### Edge Runtime

- Only for specific edge-location latency requirements
- Limited API (no `fs`, limited `crypto`)
- Smaller cold start
- Geographic distribution needs

**Before adding `runtime = 'edge'`**, check:
1. Does the project already use Edge runtime?
2. Is there a specific latency requirement?
3. Are all dependencies Edge-compatible?

If unsure, use Node.js runtime.

---

## Directives

### React Directives

#### `'use client'`

Marks a component as a Client Component. Required for:
- React hooks (`useState`, `useEffect`, etc.)
- Event handlers (`onClick`, `onChange`)
- Browser APIs (`window`, `localStorage`)

```tsx
'use client'

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

Reference: https://react.dev/reference/rsc/use-client

#### `'use server'`

Marks a function as a Server Action. Can be passed to Client Components.

```tsx
'use server'

export async function submitForm(formData: FormData) {
  // Runs on server
}
```

Or inline within a Server Component:

```tsx
export default function Page() {
  async function submit() {
    'use server'
    // Runs on server
  }
  return <form action={submit}>...</form>
}
```

Reference: https://react.dev/reference/rsc/use-server

### Next.js Directive

#### `'use cache'`

Marks a function or component for caching. Part of Next.js Cache Components.

```tsx
'use cache'

export async function getCachedData() {
  return await fetchData()
}
```

Requires `cacheComponents: true` in `next.config.ts`.

Reference: https://nextjs.org/docs/app/api-reference/directives/use-cache

---

## Functions

Next.js function APIs.

Reference: https://nextjs.org/docs/app/api-reference/functions

### Navigation Hooks (Client)

| Hook | Purpose |
|------|---------|
| `useRouter` | Programmatic navigation (`push`, `replace`, `back`, `refresh`) |
| `usePathname` | Get current pathname |
| `useSearchParams` | Read URL search parameters |
| `useParams` | Access dynamic route parameters |
| `useSelectedLayoutSegment` | Active child segment (one level) |
| `useSelectedLayoutSegments` | All active segments below layout |
| `useLinkStatus` | Check link prefetch status |
| `useReportWebVitals` | Report Core Web Vitals metrics |

### Server Functions

| Function | Purpose |
|----------|---------|
| `cookies` | Read/write cookies |
| `headers` | Read request headers |
| `draftMode` | Enable preview of unpublished CMS content |
| `after` | Run code after response finishes streaming |
| `connection` | Wait for connection before dynamic rendering |
| `userAgent` | Parse User-Agent header |

### Generate Functions

| Function | Purpose |
|----------|---------|
| `generateStaticParams` | Pre-render dynamic routes at build time |
| `generateMetadata` | Dynamic metadata |
| `generateViewport` | Dynamic viewport config |
| `generateSitemaps` | Multiple sitemaps for large sites |
| `generateImageMetadata` | Multiple OG images per route |

### Request/Response

| Function | Purpose |
|----------|---------|
| `NextRequest` | Extended Request with helpers |
| `NextResponse` | Extended Response with helpers |
| `ImageResponse` | Generate OG images |

### Common Examples

#### Navigation

Use `next/link` for internal navigation instead of `<a>` tags.

```tsx
// Bad: Plain anchor tag
<a href="/about">About</a>

// Good: Next.js Link
import Link from 'next/link'
<Link href="/about">About</Link>
```

Active link styling:

```tsx
'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function NavLink({ href, children }) {
  const pathname = usePathname()
  return (
    <Link href={href} className={pathname === href ? 'active' : ''}>
      {children}
    </Link>
  )
}
```

#### Static Generation

```tsx
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await getPosts()
  return posts.map((post) => ({ slug: post.slug }))
}
```

#### After Response

```tsx
import { after } from 'next/server'

export async function POST(request: Request) {
  const data = await processRequest(request)

  after(async () => {
    await logAnalytics(data)
  })

  return Response.json({ success: true })
}
```

---

## Error Handling

### Error Boundaries

`error.tsx` catches errors in a route segment and its children. Must be a Client Component:

```tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div>
      <h2>Something went wrong!</h2>
      <button onClick={() => reset()}>Try again</button>
    </div>
  )
}
```

`global-error.tsx` catches errors in the root layout. Must include `<html>` and `<body>` tags:

```tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <h2>Something went wrong!</h2>
        <button onClick={() => reset()}>Try again</button>
      </body>
    </html>
  )
}
```

### Critical: Navigation API Gotcha

Do NOT wrap navigation APIs in try-catch. They throw special errors that Next.js handles internally.

Navigation APIs: `redirect()`, `permanentRedirect()`, `notFound()`, `forbidden()`, `unauthorized()`

Use `unstable_rethrow()` to properly handle these in catch blocks:

```tsx
import { unstable_rethrow } from 'next/navigation'

async function action() {
  try {
    redirect('/success')
  } catch (error) {
    unstable_rethrow(error)
    return { error: 'Something went wrong' }
  }
}
```

### Redirects

```tsx
redirect('/new-path')          // 307 Temporary
permanentRedirect('/new-url')  // 308 Permanent
```

### Auth Errors

```tsx
if (!session) {
  unauthorized() // Renders unauthorized.tsx (401)
}

if (!session.hasAccess) {
  forbidden() // Renders forbidden.tsx (403)
}
```

### Not Found

```tsx
export default function NotFound() {
  return (
    <div>
      <h2>Not Found</h2>
      <p>Could not find the requested resource</p>
    </div>
  )
}
```

Trigger with `notFound()`:

```tsx
if (!post) {
  notFound()
}
```

### Error Hierarchy

Errors bubble to the nearest error boundary. Placement determines scope of error handling across nested routes.

---

## Data Patterns

Choose the right data fetching pattern for each use case.

### Decision Tree

```
Need to fetch data?
├── From a Server Component?
│   └── Use: Fetch directly (no API needed)
│
├── From a Client Component?
│   ├── Is it a mutation (POST/PUT/DELETE)?
│   │   └── Use: Server Action
│   └── Is it a read (GET)?
│       └── Use: Route Handler OR pass from Server Component
│
├── Need external API access (webhooks, third parties)?
│   └── Use: Route Handler
│
└── Need REST API for mobile app / external clients?
    └── Use: Route Handler
```

### Pattern 1: Server Components (Preferred for Reads)

Fetch data directly in Server Components - no API layer needed.

```tsx
// app/users/page.tsx
async function UsersPage() {
  // Direct database access - no API round-trip
  const users = await db.user.findMany();

  // Or fetch from external API
  const posts = await fetch('https://api.example.com/posts').then(r => r.json());

  return (
    <ul>
      {users.map(user => <li key={user.id}>{user.name}</li>)}
    </ul>
  );
}
```

**Benefits**: No API to maintain, no client-server waterfall, secrets stay on server, direct database access.

### Pattern 2: Server Actions (Preferred for Mutations)

```tsx
// app/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createPost(formData: FormData) {
  const title = formData.get('title') as string;
  await db.post.create({ data: { title } });
  revalidatePath('/posts');
}

export async function deletePost(id: string) {
  await db.post.delete({ where: { id } });
  revalidateTag('posts');
}
```

```tsx
// app/posts/new/page.tsx
import { createPost } from '@/app/actions';

export default function NewPost() {
  return (
    <form action={createPost}>
      <input name="title" required />
      <button type="submit">Create</button>
    </form>
  );
}
```

**Benefits**: End-to-end type safety, progressive enhancement (works without JS), integrated with React transitions.

**Constraints**: POST only (no GET caching semantics), internal use only, cannot return non-serializable data.

### Pattern 3: Route Handlers (APIs)

```tsx
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const posts = await db.post.findMany();
  return NextResponse.json(posts);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const post = await db.post.create({ data: body });
  return NextResponse.json(post, { status: 201 });
}
```

**When to use**: External API access, webhooks, GET endpoints needing HTTP caching, OpenAPI docs needed.

**When NOT to use**: Internal data fetching (use Server Components), mutations from your UI (use Server Actions).

### Avoiding Data Waterfalls

#### Problem: Sequential Fetches

```tsx
// Bad: Sequential waterfalls
async function Dashboard() {
  const user = await getUser();       // Wait...
  const posts = await getPosts();     // Then wait...
  const comments = await getComments(); // Then wait...
  return <div>...</div>;
}
```

#### Solution 1: Parallel Fetching with Promise.all

```tsx
async function Dashboard() {
  const [user, posts, comments] = await Promise.all([
    getUser(),
    getPosts(),
    getComments(),
  ]);
  return <div>...</div>;
}
```

#### Solution 2: Streaming with Suspense

```tsx
import { Suspense } from 'react';

async function Dashboard() {
  return (
    <div>
      <Suspense fallback={<UserSkeleton />}>
        <UserSection />
      </Suspense>
      <Suspense fallback={<PostsSkeleton />}>
        <PostsSection />
      </Suspense>
    </div>
  );
}

async function UserSection() {
  const user = await getUser();
  return <div>{user.name}</div>;
}

async function PostsSection() {
  const posts = await getPosts();
  return <PostList posts={posts} />;
}
```

#### Solution 3: Preload Pattern

```tsx
import { cache } from 'react';

export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});

export const preloadUser = (id: string) => {
  void getUser(id); // Fire and forget
};
```

### Client Component Data Fetching

#### Option 1: Pass from Server Component (Preferred)

```tsx
// Server Component
async function Page() {
  const data = await fetchData();
  return <ClientComponent initialData={data} />;
}

// Client Component
'use client';
function ClientComponent({ initialData }) {
  const [data, setData] = useState(initialData);
}
```

#### Option 2: Fetch on Mount

```tsx
'use client';
import { useEffect, useState } from 'react';

function ClientComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch('/api/data')
      .then(r => r.json())
      .then(setData);
  }, []);

  if (!data) return <Loading />;
  return <div>{data.value}</div>;
}
```

### Quick Reference

| Pattern | Use Case | HTTP Method | Caching |
|---------|----------|-------------|---------|
| Server Component fetch | Internal reads | Any | Full Next.js caching |
| Server Action | Mutations, form submissions | POST only | No |
| Route Handler | External APIs, webhooks | Any | GET can be cached |
| Client fetch to API | Client-side reads | Any | HTTP cache headers |

---

## Route Handlers

Create API endpoints with `route.ts` files.

### Basic Usage

```tsx
// app/api/users/route.ts
export async function GET() {
  const users = await getUsers()
  return Response.json(users)
}

export async function POST(request: Request) {
  const body = await request.json()
  const user = await createUser(body)
  return Response.json(user, { status: 201 })
}
```

### Supported Methods

`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`

### GET Handler Conflicts with page.tsx

**A `route.ts` and `page.tsx` cannot coexist in the same folder.**

```
app/
├── users/
│   └── page.tsx        # /users (page)
└── api/
    └── users/
        └── route.ts    # /api/users (API)
```

### Environment Behavior

Route handlers run in a Server Component-like environment:
- Can use `async/await`, `cookies()`, `headers()`, Node.js APIs
- Cannot use React hooks, React DOM APIs, or browser APIs

### Dynamic Route Handlers

```tsx
// app/api/users/[id]/route.ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const user = await getUser(id)

  if (!user) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }

  return Response.json(user)
}
```

### Response Helpers

```tsx
// JSON response
return Response.json({ data })

// With status
return Response.json({ error: 'Not found' }, { status: 404 })

// With headers
return Response.json(data, {
  headers: { 'Cache-Control': 'max-age=3600' },
})

// Redirect
return Response.redirect(new URL('/login', request.url))

// Stream
return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream' },
})
```

### When to Use Route Handlers vs Server Actions

| Use Case | Route Handlers | Server Actions |
|----------|---|---|
| Form submissions | No | Yes |
| Data mutations from UI | No | Yes |
| Third-party webhooks | Yes | No |
| External API consumption | Yes | No |
| Public REST API | Yes | No |
| File uploads | Both work | Both work |

**Prefer Server Actions** for mutations triggered from your UI.
**Use Route Handlers** for external integrations and public APIs.

---

## Metadata and SEO

Add SEO metadata to Next.js pages using the Metadata API.

**Important**: The `metadata` object and `generateMetadata` function are only supported in Server Components.

### Static Metadata

```tsx
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description for search engines',
}
```

### Dynamic Metadata

```tsx
import type { Metadata } from 'next'

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post.title, description: post.description }
}
```

### Avoid Duplicate Fetches

Use React `cache()` when the same data is needed for both metadata and page:

```tsx
import { cache } from 'react'

export const getPost = cache(async (slug: string) => {
  return await db.posts.findFirst({ where: { slug } })
})
```

### Viewport

Separate from metadata for streaming support:

```tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#000000',
}
```

### Title Templates

In root layout for consistent naming:

```tsx
export const metadata: Metadata = {
  title: { default: 'Site Name', template: '%s | Site Name' },
}
```

### Metadata File Conventions

| File | Purpose |
|------|---------|
| `favicon.ico` | Favicon |
| `icon.png` / `icon.svg` | App icon |
| `apple-icon.png` | Apple app icon |
| `opengraph-image.png` | OG image |
| `twitter-image.png` | Twitter card image |
| `sitemap.ts` / `sitemap.xml` | Sitemap |
| `robots.ts` / `robots.txt` | Robots directives |
| `manifest.ts` / `manifest.json` | Web app manifest |

### SEO Best Practice

For most sites, static metadata files provide excellent SEO coverage. A single `opengraph-image.png` covers both Open Graph and Twitter (Twitter falls back to OG). Only use dynamic `generateMetadata` when content varies per page.

### OG Image Generation

Use `next/og` (not `@vercel/og`) for dynamic Open Graph images. Use default Node.js runtime (not Edge).

```tsx
// app/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const alt = 'Site Name'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        Hello World
      </div>
    ),
    { ...size }
  )
}
```

#### Dynamic OG Image

```tsx
// app/blog/[slug]/opengraph-image.tsx
import { ImageResponse } from 'next/og'

export const alt = 'Blog Post'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

type Props = { params: Promise<{ slug: string }> }

export default async function Image({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 48,
          background: 'linear-gradient(to bottom, #1a1a1a, #333)',
          color: 'white',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48,
        }}
      >
        <div style={{ fontSize: 64, fontWeight: 'bold' }}>{post.title}</div>
        <div style={{ marginTop: 24, opacity: 0.8 }}>{post.description}</div>
      </div>
    ),
    { ...size }
  )
}
```

### Multiple Sitemaps

```tsx
// app/sitemap.ts
import type { MetadataRoute } from 'next'

export async function generateSitemaps() {
  return [{ id: 0 }, { id: 1 }, { id: 2 }]
}

export default async function sitemap({
  id,
}: {
  id: number
}): Promise<MetadataRoute.Sitemap> {
  const start = id * 50000
  const end = start + 50000
  const products = await getProducts(start, end)

  return products.map((product) => ({
    url: `https://example.com/product/${product.id}`,
    lastModified: product.updatedAt,
  }))
}
```

---

## Image Optimization

Use `next/image` for automatic image optimization.

### Always Use next/image

```tsx
// Bad: Avoid native img
<img src="/hero.png" alt="Hero" />

// Good: Use next/image
import Image from 'next/image'
<Image src="/hero.png" alt="Hero" width={800} height={400} />
```

### Required Props

```tsx
// Local images - dimensions inferred automatically
import heroImage from './hero.png'
<Image src={heroImage} alt="Hero" />

// Remote images - must specify width/height
<Image src="https://example.com/image.jpg" alt="Hero" width={800} height={400} />

// Or use fill for parent-relative sizing
<div style={{ position: 'relative', width: '100%', height: 400 }}>
  <Image src="/hero.png" alt="Hero" fill style={{ objectFit: 'cover' }} />
</div>
```

### Remote Images Configuration

```js
// next.config.js
module.exports = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'example.com',
        pathname: '/images/**',
      },
      {
        protocol: 'https',
        hostname: '*.cdn.com',
      },
    ],
  },
}
```

### Responsive Images

```tsx
// Full-width hero
<Image src="/hero.png" alt="Hero" fill sizes="100vw" />

// Responsive grid (3 columns on desktop, 1 on mobile)
<Image src="/card.png" alt="Card" fill sizes="(max-width: 768px) 100vw, 33vw" />

// Fixed sidebar image
<Image src="/avatar.png" alt="Avatar" width={200} height={200} sizes="200px" />
```

### Blur Placeholder

```tsx
// Local images - automatic blur hash
import heroImage from './hero.png'
<Image src={heroImage} alt="Hero" placeholder="blur" />

// Remote images - provide blurDataURL
<Image
  src="https://example.com/image.jpg"
  alt="Hero"
  width={800}
  height={400}
  placeholder="blur"
  blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRg..."
/>
```

### Priority Loading

Use `priority` for above-the-fold images (LCP):

```tsx
<Image src="/hero.png" alt="Hero" fill priority />
```

### Common Mistakes

```tsx
// Bad: Missing sizes with fill - downloads largest image
<Image src="/hero.png" alt="Hero" fill />

// Good: Add sizes
<Image src="/hero.png" alt="Hero" fill sizes="100vw" />

// Bad: Remote image without config
<Image src="https://untrusted.com/image.jpg" alt="Image" width={400} height={300} />
// Error: hostname not configured - add to next.config.js remotePatterns
```

### Static Export

```tsx
// Option 1: Disable optimization per-image
<Image src="/hero.png" alt="Hero" width={800} height={400} unoptimized />

// Option 2: Global config
// next.config.js
module.exports = { output: 'export', images: { unoptimized: true } }

// Option 3: Custom loader (Cloudinary, Imgix, etc.)
const cloudinaryLoader = ({ src, width, quality }) => {
  return `https://res.cloudinary.com/demo/image/upload/w_${width},q_${quality || 75}/${src}`
}
<Image loader={cloudinaryLoader} src="sample.jpg" alt="Sample" width={800} height={400} />
```

---

## Font Optimization

Use `next/font` for automatic font optimization with zero layout shift.

### Google Fonts

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.className}>
      <body>{children}</body>
    </html>
  )
}
```

### Multiple Fonts

```tsx
import { Inter, Roboto_Mono } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const robotoMono = Roboto_Mono({ subsets: ['latin'], variable: '--font-roboto-mono' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${robotoMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

### Local Fonts

```tsx
import localFont from 'next/font/local'

const myFont = localFont({ src: './fonts/MyFont.woff2' })

// Multiple files for different weights
const myFont = localFont({
  src: [
    { path: './fonts/MyFont-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/MyFont-Bold.woff2', weight: '700', style: 'normal' },
  ],
})
```

### Tailwind CSS Integration

```tsx
// app/layout.tsx
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

// In <html>:
<html lang="en" className={inter.variable}>
```

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
      },
    },
  },
}
```

### Common Mistakes

```tsx
// Bad: Importing font in every component (creates new instance each time)
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'] })

// Good: Import once in layout, use CSS variable

// Bad: Manual <link> tag (blocks rendering, no optimization)
<link href="https://fonts.googleapis.com/css2?family=Inter" rel="stylesheet" />

// Good: Use next/font (self-hosted, zero layout shift)
import { Inter } from 'next/font/google'

// Bad: Missing subset - loads all characters
const inter = Inter({})

// Good: Always specify subset
const inter = Inter({ subsets: ['latin'] })
```

### Font in Specific Components

```tsx
// lib/fonts.ts - export from shared file
import { Inter, Playfair_Display } from 'next/font/google'

export const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
export const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair' })

// components/Heading.tsx
import { playfair } from '@/lib/fonts'

export function Heading({ children }) {
  return <h1 className={playfair.className}>{children}</h1>
}
```

---

## Bundling

Fix common bundling issues with third-party packages.

### Server-Incompatible Packages

Some packages use browser APIs (`window`, `document`, `localStorage`) and fail in Server Components.

#### Solution 1: Dynamic Import with SSR Disabled

```tsx
// Bad: Fails - package uses window
import SomeChart from 'some-chart-library'

// Good: Use dynamic import with ssr: false
import dynamic from 'next/dynamic'

const SomeChart = dynamic(() => import('some-chart-library'), { ssr: false })
```

#### Solution 2: Externalize from Server Bundle

```js
// next.config.js
module.exports = {
  serverExternalPackages: ['problematic-package'],
}
```

Use for packages with native bindings (sharp, bcrypt), packages that do not bundle well, or packages with circular dependencies.

#### Solution 3: Client Component Wrapper

```tsx
// components/ChartWrapper.tsx
'use client'
import { Chart } from 'chart-library'

export function ChartWrapper(props) {
  return <Chart {...props} />
}
```

### CSS Imports

```tsx
// Bad: Manual link tag
<link rel="stylesheet" href="/styles.css" />

// Good: Import CSS
import './styles.css'

// Good: CSS Modules
import styles from './Button.module.css'
```

### Polyfills

Next.js includes common polyfills automatically (`Array.from`, `Object.assign`, `Promise`, `fetch`, `Map`, `Set`, etc.). Do not load redundant ones.

### ESM/CommonJS Issues

```js
// next.config.js
module.exports = {
  transpilePackages: ['some-esm-package', 'another-package'],
}
```

### Common Problematic Packages

| Package | Issue | Solution |
|---------|-------|----------|
| `sharp` | Native bindings | `serverExternalPackages: ['sharp']` |
| `bcrypt` | Native bindings | `serverExternalPackages: ['bcrypt']` or use `bcryptjs` |
| `canvas` | Native bindings | `serverExternalPackages: ['canvas']` |
| `recharts` | Uses window | `dynamic(() => import('recharts'), { ssr: false })` |
| `react-quill` | Uses document | `dynamic(() => import('react-quill'), { ssr: false })` |
| `mapbox-gl` | Uses window | `dynamic(() => import('mapbox-gl'), { ssr: false })` |
| `monaco-editor` | Uses window | `dynamic(() => import('@monaco-editor/react'), { ssr: false })` |

### Bundle Analysis

```bash
# Next.js 16.1+
next experimental-analyze
```

### Migrating from Webpack to Turbopack

Turbopack is the default bundler in Next.js 15+. Migrate away from custom webpack configs:

```js
// Good: Works with Turbopack
serverExternalPackages: ['package'],
transpilePackages: ['package'],

// Bad: Webpack-only - migrate away
webpack: (config) => { /* custom webpack config */ },
```

---

## Scripts

Loading third-party scripts in Next.js.

### Use next/script

```tsx
// Bad: Native script tag
<script src="https://example.com/script.js"></script>

// Good: Next.js Script component
import Script from 'next/script'
<Script src="https://example.com/script.js" />
```

### Inline Scripts Need ID

```tsx
// Bad: Missing id
<Script dangerouslySetInnerHTML={{ __html: 'console.log("hi")' }} />

// Good: Has id
<Script id="my-script" dangerouslySetInnerHTML={{ __html: 'console.log("hi")' }} />
```

### Do Not Put Script in Head

`next/script` handles its own positioning. Do not place inside `next/head`.

### Loading Strategies

```tsx
// afterInteractive (default) - Load after page is interactive
<Script src="/analytics.js" strategy="afterInteractive" />

// lazyOnload - Load during idle time
<Script src="/widget.js" strategy="lazyOnload" />

// beforeInteractive - Load before interactive (root layout only)
<Script src="/critical.js" strategy="beforeInteractive" />

// worker - Load in web worker (experimental)
<Script src="/heavy.js" strategy="worker" />
```

### Google Analytics

```tsx
// Bad: Inline GA script
<Script src="https://www.googletagmanager.com/gtag/js?id=G-XXXXX" />

// Good: Next.js component
import { GoogleAnalytics } from '@next/third-parties/google'

export default function Layout({ children }) {
  return (
    <html>
      <body>{children}</body>
      <GoogleAnalytics gaId="G-XXXXX" />
    </html>
  )
}
```

### Google Tag Manager

```tsx
import { GoogleTagManager } from '@next/third-parties/google'

export default function Layout({ children }) {
  return (
    <html>
      <GoogleTagManager gtmId="GTM-XXXXX" />
      <body>{children}</body>
    </html>
  )
}
```

---

## Hydration Errors

Diagnose and fix React hydration mismatch errors.

### Error Signs

- "Hydration failed because the initial UI does not match"
- "Text content does not match server-rendered HTML"

### Common Causes and Fixes

#### Browser-only APIs

```tsx
// Bad: window does not exist on server
<div>{window.innerWidth}</div>

// Good: Client component with mounted check
'use client'
import { useState, useEffect } from 'react'

export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted ? children : null
}
```

#### Date/Time Rendering

```tsx
// Bad: Server and client may be in different timezones
<span>{new Date().toLocaleString()}</span>

// Good: Render on client only
'use client'
const [time, setTime] = useState<string>()
useEffect(() => setTime(new Date().toLocaleString()), [])
```

#### Random Values or IDs

```tsx
// Bad: Random values differ between server and client
<div id={Math.random().toString()}>

// Good: Use useId hook
import { useId } from 'react'

function Input() {
  const id = useId()
  return <input id={id} />
}
```

#### Invalid HTML Nesting

```tsx
// Bad: div inside p
<p><div>Content</div></p>

// Good: Valid nesting
<div><p>Content</p></div>
```

#### Third-party Scripts

```tsx
// Good: Use next/script with afterInteractive
import Script from 'next/script'

<Script src="https://example.com/script.js" strategy="afterInteractive" />
```

---

## Suspense Boundaries

Client hooks that cause CSR bailout without Suspense boundaries.

### useSearchParams

Always requires Suspense boundary in static routes. Without it, the entire page becomes client-side rendered.

```tsx
// Bad: Entire page becomes CSR
'use client'
import { useSearchParams } from 'next/navigation'

export default function SearchBar() {
  const searchParams = useSearchParams()
  return <div>Query: {searchParams.get('q')}</div>
}
```

```tsx
// Good: Wrap in Suspense
import { Suspense } from 'react'
import SearchBar from './search-bar'

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SearchBar />
    </Suspense>
  )
}
```

### usePathname

Requires Suspense boundary when route has dynamic parameters. If you use `generateStaticParams`, Suspense is optional.

### Quick Reference

| Hook | Suspense Required |
|------|-------------------|
| `useSearchParams()` | Yes |
| `usePathname()` | Yes (dynamic routes) |
| `useParams()` | No |
| `useRouter()` | No |

---

## Parallel and Intercepting Routes

Parallel routes render multiple pages in the same layout. Intercepting routes show a different UI when navigating from within your app vs direct URL access. Together they enable modal patterns.

### File Structure

```
app/
├── @modal/
│   ├── default.tsx          # Required! Returns null
│   ├── (.)photos/
│   │   └── [id]/
│   │       └── page.tsx     # Modal content
│   └── [...]catchall/
│       └── page.tsx
├── photos/
│   └── [id]/
│       └── page.tsx         # Full page (direct access)
├── layout.tsx               # Renders both children and @modal
└── page.tsx
```

### Root Layout with Slot

```tsx
export default function RootLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        {modal}
      </body>
    </html>
  );
}
```

### Default File (Critical!)

**Every parallel route slot MUST have a `default.tsx`** to prevent 404s on hard navigation.

```tsx
// app/@modal/default.tsx
export default function Default() {
  return null;
}
```

### Closing Modals Correctly

**Critical: Use `router.back()` to close modals, NOT `router.push()` or `<Link>`.**

Using `push` or `Link` adds a new history entry (back button shows modal again) and does not properly clear the intercepted route.

```tsx
'use client';
import { useRouter } from 'next/navigation';

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <div onClick={() => router.back()}>
      {children}
    </div>
  );
}
```

### Route Matcher Reference

| Matcher | Matches |
|---------|---------|
| `(.)` | Same level |
| `(..)` | One level up |
| `(..)(..)` | Two levels up |
| `(...)` | From root |

**Common mistake**: Thinking `(..)` means "parent folder" - it means "parent route segment".

### Common Gotchas

1. **Missing `default.tsx`** causes 404 on refresh
2. **Modal persists** after navigation means you are using `router.push()` instead of `router.back()`
3. **Nested parallel routes** need `default.tsx` at every level
4. In Next.js 15+, `params` is a Promise and must be awaited

---

## Self-Hosting

### Standalone Output

For Docker or any containerized deployment:

```js
// next.config.js
module.exports = {
  output: 'standalone',
};
```

### Docker Deployment

```dockerfile
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
```

### ISR and Cache Handlers

ISR uses filesystem caching by default. This **breaks with multiple instances**:
- Instance A regenerates page and saves to its local disk
- Instance B serves stale page and does not see Instance A's cache

#### Solution: Custom Cache Handler

```js
// next.config.js
module.exports = {
  cacheHandler: require.resolve('./cache-handler.js'),
  cacheMaxMemorySize: 0,
};
```

#### Redis Cache Handler Example

```js
// cache-handler.js
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
const CACHE_PREFIX = 'nextjs:';

module.exports = class CacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    const data = await redis.get(CACHE_PREFIX + key);
    if (!data) return null;
    const parsed = JSON.parse(data);
    return { value: parsed.value, lastModified: parsed.lastModified };
  }

  async set(key, data, ctx) {
    const cacheData = { value: data, lastModified: Date.now() };
    if (ctx?.revalidate) {
      await redis.setex(CACHE_PREFIX + key, ctx.revalidate, JSON.stringify(cacheData));
    } else {
      await redis.set(CACHE_PREFIX + key, JSON.stringify(cacheData));
    }
  }

  async revalidateTag(tags) {
    // Implement tag-based invalidation
  }
};
```

### What Works vs What Needs Setup

| Feature | Single Instance | Multi-Instance | Notes |
|---------|-----------------|----------------|-------|
| SSR | Yes | Yes | No special setup |
| SSG | Yes | Yes | Built at deploy time |
| ISR | Yes | Needs cache handler | Filesystem cache breaks |
| Image Optimization | Yes | Yes | CPU-intensive, consider CDN |
| Middleware | Yes | Yes | Runs on Node.js |
| `revalidatePath/Tag` | Yes | Needs cache handler | Must share cache |
| `next/font` | Yes | Yes | Fonts bundled at build |
| Draft Mode | Yes | Yes | Cookie-based |

### Environment Variables

```bash
# Build-time only (baked into bundle)
NEXT_PUBLIC_API_URL=https://api.example.com

# Runtime (server-side only)
DATABASE_URL=postgresql://...
API_SECRET=...
```

### Health Check Endpoint

```tsx
// app/api/health/route.ts
export async function GET() {
  try {
    return Response.json({ status: 'healthy' }, { status: 200 });
  } catch (error) {
    return Response.json({ status: 'unhealthy' }, { status: 503 });
  }
}
```

### Pre-Deployment Checklist

1. Build locally first: `npm run build`
2. Test standalone output: Run `.next/standalone/server.js` locally
3. Set environment variables
4. Configure cache handler for ISR with multiple instances
5. Setup health endpoint for load balancer checks
6. Test image optimization performance
7. Configure logging
8. Security review for hardcoded secrets
9. Run database migrations before deploying
10. Load test with simulated production traffic

---

## Debug Tricks

### MCP Endpoint (Dev Server)

Next.js exposes a `/_next/mcp` endpoint in development for AI-assisted debugging via MCP.

- **Next.js 16+**: Enabled by default
- **Next.js < 16**: Requires `experimental.mcpServer: true` in next.config.js

**Important**: Find the actual port from terminal output. Do not assume port 3000.

#### Available Tools

| Tool | Purpose |
|------|---------|
| `get_errors` | Current build and runtime errors with source-mapped stacks |
| `get_routes` | Discover all routes by scanning filesystem |
| `get_project_metadata` | Project path and dev server URL |
| `get_page_metadata` | Runtime metadata about current page render |
| `get_logs` | Path to Next.js development log file |
| `get_server_action_by_id` | Locate a Server Action by ID |

#### Example: Get Errors

```bash
curl -X POST http://localhost:<port>/_next/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":"1","method":"tools/call","params":{"name":"get_errors","arguments":{}}}'
```

### Rebuild Specific Routes (Next.js 16+)

Use `--debug-build-paths` to rebuild only specific routes:

```bash
# Rebuild a specific route
next build --debug-build-paths "/dashboard"

# Rebuild routes matching a glob
next build --debug-build-paths "/api/*"

# Dynamic routes
next build --debug-build-paths "/blog/[slug]"
```

Use this to quickly verify build fixes, debug static generation issues, or iterate faster on build errors.
