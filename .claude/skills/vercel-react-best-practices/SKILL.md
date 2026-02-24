---
name: vercel-react-best-practices
description: React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.
license: MIT
metadata:
  author: vercel
  version: "1.0.0"
  source: https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices
---

# Vercel React Best Practices

Comprehensive performance optimization guide for React and Next.js applications, maintained by Vercel Engineering. Contains 57 rules across 8 categories, prioritized by impact to guide automated refactoring and code generation.

## When to Apply

Reference these guidelines when:
- Writing new React components or Next.js pages
- Implementing data fetching (client or server-side)
- Reviewing code for performance issues
- Refactoring existing React/Next.js code
- Optimizing bundle size or load times
- Deploying to Vercel or configuring Vercel-specific features
- Working with Server Components, Edge Functions, or ISR
- Setting up TypeScript with React/Next.js

## Rule Categories by Priority

| Priority | Category | Impact | Prefix |
|----------|----------|--------|--------|
| 1 | Eliminating Waterfalls | CRITICAL | `async-` |
| 2 | Bundle Size Optimization | CRITICAL | `bundle-` |
| 3 | Server-Side Performance | HIGH | `server-` |
| 4 | Client-Side Data Fetching | MEDIUM-HIGH | `client-` |
| 5 | Re-render Optimization | MEDIUM | `rerender-` |
| 6 | Rendering Performance | MEDIUM | `rendering-` |
| 7 | JavaScript Performance | LOW-MEDIUM | `js-` |
| 8 | Advanced Patterns | LOW | `advanced-` |

## Quick Reference

### 1. Eliminating Waterfalls (CRITICAL)

- `async-defer-await` - Move await into branches where actually used
- `async-parallel` - Use Promise.all() for independent operations
- `async-dependencies` - Use better-all for partial dependencies
- `async-api-routes` - Start promises early, await late in API routes
- `async-suspense-boundaries` - Use Suspense to stream content

### 2. Bundle Size Optimization (CRITICAL)

- `bundle-barrel-imports` - Import directly, avoid barrel files
- `bundle-dynamic-imports` - Use next/dynamic for heavy components
- `bundle-defer-third-party` - Load analytics/logging after hydration
- `bundle-conditional` - Load modules only when feature is activated
- `bundle-preload` - Preload on hover/focus for perceived speed

### 3. Server-Side Performance (HIGH)

- `server-auth-actions` - Authenticate server actions like API routes
- `server-cache-react` - Use React.cache() for per-request deduplication
- `server-cache-lru` - Use LRU cache for cross-request caching
- `server-dedup-props` - Avoid duplicate serialization in RSC props
- `server-serialization` - Minimize data passed to client components
- `server-parallel-fetching` - Restructure components to parallelize fetches
- `server-after-nonblocking` - Use after() for non-blocking operations

### 4. Client-Side Data Fetching (MEDIUM-HIGH)

- `client-swr-dedup` - Use SWR for automatic request deduplication
- `client-event-listeners` - Deduplicate global event listeners
- `client-passive-event-listeners` - Use passive listeners for scroll
- `client-localstorage-schema` - Version and minimize localStorage data

### 5. Re-render Optimization (MEDIUM)

- `rerender-defer-reads` - Don't subscribe to state only used in callbacks
- `rerender-memo` - Extract expensive work into memoized components
- `rerender-memo-with-default-value` - Hoist default non-primitive props
- `rerender-dependencies` - Use primitive dependencies in effects
- `rerender-derived-state` - Subscribe to derived booleans, not raw values
- `rerender-derived-state-no-effect` - Derive state during render, not effects
- `rerender-functional-setstate` - Use functional setState for stable callbacks
- `rerender-lazy-state-init` - Pass function to useState for expensive values
- `rerender-simple-expression-in-memo` - Avoid memo for simple primitives
- `rerender-move-effect-to-event` - Put interaction logic in event handlers
- `rerender-transitions` - Use startTransition for non-urgent updates
- `rerender-use-ref-transient-values` - Use refs for transient frequent values

### 6. Rendering Performance (MEDIUM)

- `rendering-animate-svg-wrapper` - Animate div wrapper, not SVG element
- `rendering-content-visibility` - Use content-visibility for long lists
- `rendering-hoist-jsx` - Extract static JSX outside components
- `rendering-svg-precision` - Reduce SVG coordinate precision
- `rendering-hydration-no-flicker` - Use inline script for client-only data
- `rendering-hydration-suppress-warning` - Suppress expected mismatches
- `rendering-activity` - Use Activity component for show/hide
- `rendering-conditional-render` - Use ternary, not && for conditionals
- `rendering-usetransition-loading` - Prefer useTransition for loading state

### 7. JavaScript Performance (LOW-MEDIUM)

- `js-batch-dom-css` - Group CSS changes via classes or cssText
- `js-index-maps` - Build Map for repeated lookups
- `js-cache-property-access` - Cache object properties in loops
- `js-cache-function-results` - Cache function results in module-level Map
- `js-cache-storage` - Cache localStorage/sessionStorage reads
- `js-combine-iterations` - Combine multiple filter/map into one loop
- `js-length-check-first` - Check array length before expensive comparison
- `js-early-exit` - Return early from functions
- `js-hoist-regexp` - Hoist RegExp creation outside loops
- `js-min-max-loop` - Use loop for min/max instead of sort
- `js-set-map-lookups` - Use Set/Map for O(1) lookups
- `js-tosorted-immutable` - Use toSorted() for immutability

### 8. Advanced Patterns (LOW)

- `advanced-event-handler-refs` - Store event handlers in refs
- `advanced-init-once` - Initialize app once per app load
- `advanced-use-latest` - useLatest for stable callback refs

---

## Detailed Performance Rules

For the complete guide with all 57 rules expanded (with incorrect/correct code examples, impact ratings, and explanations), see `AGENTS.md` in this skill directory.

---

## 1. Eliminating Waterfalls (CRITICAL)

Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### Defer Await Until Needed

Move `await` operations into the branches where they are actually used to avoid blocking code paths that don't need them.

```typescript
// Incorrect: blocks both branches
async function handleRequest(userId: string, skipProcessing: boolean) {
  const userData = await fetchUserData(userId)
  if (skipProcessing) {
    return { skipped: true }
  }
  return processUserData(userData)
}

// Correct: only blocks when needed
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) {
    return { skipped: true }
  }
  const userData = await fetchUserData(userId)
  return processUserData(userData)
}
```

### Promise.all() for Independent Operations

When async operations have no interdependencies, execute them concurrently.

```typescript
// Incorrect: sequential execution, 3 round trips
const user = await fetchUser()
const posts = await fetchPosts()
const comments = await fetchComments()

// Correct: parallel execution, 1 round trip
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])
```

### Start Promises Early in API Routes

```typescript
// Correct: auth and config start immediately
export async function GET(request: Request) {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([
    configPromise,
    fetchData(session.user.id)
  ])
  return Response.json({ data, config })
}
```

### Strategic Suspense Boundaries

Use Suspense to stream content and show wrapper UI faster while data loads.

```tsx
function Page() {
  return (
    <div>
      <div>Sidebar</div>
      <div>Header</div>
      <Suspense fallback={<Skeleton />}>
        <DataDisplay /> {/* Only this component waits for data */}
      </Suspense>
      <div>Footer</div>
    </div>
  )
}

async function DataDisplay() {
  const data = await fetchData()
  return <div>{data.content}</div>
}
```

---

## 2. Bundle Size Optimization (CRITICAL)

### Avoid Barrel File Imports

Import directly from source files instead of barrel files to avoid loading thousands of unused modules.

```tsx
// Incorrect: imports entire library
import { Check, X, Menu } from 'lucide-react'

// Correct: imports only what you need
import Check from 'lucide-react/dist/esm/icons/check'
import X from 'lucide-react/dist/esm/icons/x'
import Menu from 'lucide-react/dist/esm/icons/menu'

// Alternative: Next.js 13.5+ with optimizePackageImports
// next.config.js
module.exports = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@mui/material']
  }
}
```

### Dynamic Imports for Heavy Components

```tsx
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(
  () => import('./monaco-editor').then(m => m.MonacoEditor),
  { ssr: false }
)
```

### Defer Non-Critical Third-Party Libraries

```tsx
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)
```

### Preload Based on User Intent

```tsx
function EditorButton({ onClick }: { onClick: () => void }) {
  const preload = () => {
    if (typeof window !== 'undefined') {
      void import('./monaco-editor')
    }
  }

  return (
    <button onMouseEnter={preload} onFocus={preload} onClick={onClick}>
      Open Editor
    </button>
  )
}
```

---

## 3. Server-Side Performance (HIGH)

### Authenticate Server Actions Like API Routes

Server Actions are exposed as public endpoints. Always verify authentication inside each action.

```typescript
'use server'
import { verifySession } from '@/lib/auth'

export async function deleteUser(userId: string) {
  const session = await verifySession()
  if (!session) throw new Error('Must be logged in')
  if (session.user.role !== 'admin' && session.user.id !== userId) {
    throw new Error('Cannot delete other users')
  }
  await db.user.delete({ where: { id: userId } })
  return { success: true }
}
```

### Per-Request Deduplication with React.cache()

```typescript
import { cache } from 'react'

export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  return await db.user.findUnique({ where: { id: session.user.id } })
})
```

### Cross-Request LRU Caching

```typescript
import { LRUCache } from 'lru-cache'

const cache = new LRUCache<string, any>({ max: 1000, ttl: 5 * 60 * 1000 })

export async function getUser(id: string) {
  const cached = cache.get(id)
  if (cached) return cached
  const user = await db.user.findUnique({ where: { id } })
  cache.set(id, user)
  return user
}
```

### Minimize Serialization at RSC Boundaries

Only pass fields that the client actually uses.

```tsx
// Incorrect: serializes all 50 fields
async function Page() {
  const user = await fetchUser()
  return <Profile user={user} />
}

// Correct: serializes only needed fields
async function Page() {
  const user = await fetchUser()
  return <Profile name={user.name} />
}
```

### Parallel Data Fetching with Component Composition

```tsx
async function Header() {
  const data = await fetchHeader()
  return <div>{data}</div>
}

async function Sidebar() {
  const items = await fetchSidebarItems()
  return <nav>{items.map(renderItem)}</nav>
}

// Both fetch simultaneously because they're siblings
export default function Page() {
  return (
    <div>
      <Header />
      <Sidebar />
    </div>
  )
}
```

### Use after() for Non-Blocking Operations

```tsx
import { after } from 'next/server'

export async function POST(request: Request) {
  await updateDatabase(request)

  after(async () => {
    const userAgent = (await headers()).get('user-agent') || 'unknown'
    logUserAction({ userAgent })
  })

  return Response.json({ status: 'success' })
}
```

---

## 4. Client-Side Data Fetching (MEDIUM-HIGH)

### Use SWR for Automatic Deduplication

```tsx
import useSWR from 'swr'

function UserList() {
  const { data: users } = useSWR('/api/users', fetcher)
}
```

### Use Passive Event Listeners for Scroll

```typescript
document.addEventListener('touchstart', handleTouch, { passive: true })
document.addEventListener('wheel', handleWheel, { passive: true })
```

### Version and Minimize localStorage Data

```typescript
const VERSION = 'v2'

function saveConfig(config: { theme: string; language: string }) {
  try {
    localStorage.setItem(`userConfig:${VERSION}`, JSON.stringify(config))
  } catch {}
}
```

---

## 5. Re-render Optimization (MEDIUM)

### Derive State During Render (Not Effects)

```tsx
// Incorrect
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(firstName + ' ' + lastName)
}, [firstName, lastName])

// Correct
const fullName = firstName + ' ' + lastName
```

### Use Functional setState Updates

```tsx
// Stable callback, no stale closures
const addItems = useCallback((newItems: Item[]) => {
  setItems(curr => [...curr, ...newItems])
}, [])
```

### Use Lazy State Initialization

```tsx
// Incorrect: runs on every render
const [settings, setSettings] = useState(
  JSON.parse(localStorage.getItem('settings') || '{}')
)

// Correct: runs only once
const [settings, setSettings] = useState(() => {
  const stored = localStorage.getItem('settings')
  return stored ? JSON.parse(stored) : {}
})
```

### Use useRef for Transient Values

For values that change frequently but don't need re-render (mouse positions, timers), use refs.

### Use startTransition for Non-Urgent Updates

```tsx
import { startTransition } from 'react'

const handler = () => {
  startTransition(() => setScrollY(window.scrollY))
}
```

---

## 6. Rendering Performance (MEDIUM)

### CSS content-visibility for Long Lists

```css
.message-item {
  content-visibility: auto;
  contain-intrinsic-size: 0 80px;
}
```

### Prevent Hydration Mismatch Without Flickering

Use inline scripts for client-only data (like theme from localStorage) to avoid flash of incorrect content.

### Use Explicit Conditional Rendering

```tsx
// Incorrect: renders "0" when count is 0
{count && <span>{count}</span>}

// Correct: renders nothing when count is 0
{count > 0 ? <span>{count}</span> : null}
```

---

## React Component Patterns and Architecture

### Component Organization

- **Server Components by default**: In Next.js App Router, all components are Server Components by default. Only add `'use client'` when you need interactivity, browser APIs, or hooks with client-side state.
- **Colocation**: Keep components, styles, tests, and types in the same directory.
- **Single Responsibility**: Each component should do one thing well. Extract sub-components when a component exceeds ~150 lines.
- **Composition over inheritance**: Use children props, render props, and composition.

### Component Patterns

```tsx
// Compound components for related UI
function Tabs({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState(0)
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </TabsContext.Provider>
  )
}
Tabs.List = TabList
Tabs.Panel = TabPanel

// Generic list component
interface ListProps<T> {
  items: T[]
  renderItem: (item: T) => ReactNode
  keyExtractor: (item: T) => string
}

function List<T>({ items, renderItem, keyExtractor }: ListProps<T>) {
  return (
    <ul>
      {items.map(item => (
        <li key={keyExtractor(item)}>{renderItem(item)}</li>
      ))}
    </ul>
  )
}
```

### File Naming Conventions

- Components: `PascalCase.tsx` (e.g., `UserProfile.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useAuth.ts`)
- Utilities: `camelCase.ts` (e.g., `formatDate.ts`)
- Constants: `UPPER_SNAKE_CASE` in `constants.ts`

---

## Vercel Deployment Optimization

### Build Configuration

```js
// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      { protocol: 'https', hostname: '**.example.com' }
    ],
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react', '@mui/material', '@mui/icons-material',
      'lodash', 'date-fns',
    ],
  },
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
      ],
    }]
  },
}
module.exports = nextConfig
```

### Vercel-Specific Features

#### Edge Functions

```tsx
// app/api/geo/route.ts
import { NextRequest } from 'next/server'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const { geo } = request
  return Response.json({
    country: geo?.country,
    city: geo?.city,
    region: geo?.region,
  })
}
```

#### Incremental Static Regeneration (ISR)

```tsx
// Time-based revalidation
export const revalidate = 3600 // Revalidate every hour

// On-demand revalidation
import { revalidatePath, revalidateTag } from 'next/cache'

export async function updateProduct(id: string) {
  await db.product.update({ where: { id }, data: { ... } })
  revalidatePath(`/products/${id}`)
  // Or: revalidateTag('products')
}
```

#### Vercel Fluid Compute

LRU caching is especially effective with Fluid Compute because multiple concurrent requests share the same function instance and cache without external storage.

#### Vercel Analytics and Speed Insights

```tsx
import dynamic from 'next/dynamic'

const Analytics = dynamic(
  () => import('@vercel/analytics/react').then(m => m.Analytics),
  { ssr: false }
)
const SpeedInsights = dynamic(
  () => import('@vercel/speed-insights/next').then(m => m.SpeedInsights),
  { ssr: false }
)
```

#### Environment Variables

- Use Vercel dashboard to manage per-environment variables
- `NEXT_PUBLIC_*` for client-exposed values
- Use environment variable groups for shared config across projects

---

## Server-Side Rendering and Static Generation

### When to Use Each Strategy

| Strategy | Use When | Example |
|----------|----------|---------|
| **Static (SSG)** | Content rarely changes | Marketing pages, blog posts |
| **ISR** | Content changes periodically | Product pages, profiles |
| **SSR** | Content is per-request | Dashboards, search results |
| **Client-side** | Content is user-specific after load | Shopping cart, notifications |

### Streaming with Suspense

```tsx
import { Suspense } from 'react'

export default function DashboardPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<MetricsSkeleton />}>
        <Metrics />
      </Suspense>
      <Suspense fallback={<ChartSkeleton />}>
        <RevenueChart />
      </Suspense>
      <Suspense fallback={<TableSkeleton />}>
        <RecentOrders />
      </Suspense>
    </div>
  )
}
```

---

## State Management Patterns

### Server State (SWR)

```tsx
import useSWR from 'swr'

function useUser(id: string) {
  return useSWR(`/api/users/${id}`, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  })
}
```

### Client State

- **React Context** for low-frequency global state (theme, auth, locale)
- **useReducer** for complex local state
- **URL search params** for shareable/bookmarkable state

```tsx
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

function FilterPanel() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`${pathname}?${params.toString()}`)
  }
}
```

---

## React Hooks Best Practices

1. **Lazy state initialization**: Pass a function to `useState` for expensive initial values
2. **Functional updates**: Use `setCount(prev => prev + 1)` when new state depends on old
3. **Narrow effect dependencies**: Use `user.id` not `user` in dependency arrays
4. **Derive state during render**: Compute values directly, not via useEffect
5. **Use refs for transient values**: Mouse positions, timers, frequently-changing values
6. **Put interaction logic in event handlers**: Don't model user actions as state + effect
7. **Custom hooks**: Extract reusable logic with clear names (`useDebounce`, `useMediaQuery`)

---

## Testing Patterns

### Component Testing

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('UserProfile', () => {
  it('renders user name', () => {
    render(<UserProfile name="Alice" email="alice@example.com" />)
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it('handles edit mode', async () => {
    const user = userEvent.setup()
    render(<UserProfile name="Alice" email="alice@example.com" />)
    await user.click(screen.getByRole('button', { name: /edit/i }))
    const input = screen.getByRole('textbox', { name: /name/i })
    await user.clear(input)
    await user.type(input, 'Bob')
    expect(input).toHaveValue('Bob')
  })
})
```

### Hook Testing

```tsx
import { renderHook, act } from '@testing-library/react'

describe('useDebounce', () => {
  beforeEach(() => { jest.useFakeTimers() })
  afterEach(() => { jest.useRealTimers() })

  it('debounces value changes', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'hello' } }
    )
    expect(result.current).toBe('hello')
    rerender({ value: 'world' })
    expect(result.current).toBe('hello')
    act(() => { jest.advanceTimersByTime(500) })
    expect(result.current).toBe('world')
  })
})
```

### API Route Testing

```tsx
import { GET } from '@/app/api/users/route'
import { NextRequest } from 'next/server'

describe('GET /api/users', () => {
  it('returns users list', async () => {
    const request = new NextRequest('http://localhost:3000/api/users')
    const response = await GET(request)
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(Array.isArray(data.users)).toBe(true)
  })
})
```

- **Unit tests**: Vitest or Jest for utilities and hooks
- **Component tests**: React Testing Library (test behavior, not implementation)
- **E2E tests**: Playwright or Cypress for critical user flows
- Mock external APIs at the network level (MSW)

---

## TypeScript with React

### Component Props

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

function Button({ variant, size = 'md', isLoading, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }))}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? <Spinner /> : children}
    </button>
  )
}
```

### Type-Safe Server Actions

```typescript
'use server'
import { z } from 'zod'

const updateProfileSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1).max(100),
  email: z.string().email()
})

export async function updateProfile(data: unknown) {
  const validated = updateProfileSchema.parse(data)
  const session = await verifySession()
  if (!session) throw new Error('Unauthorized')
  if (session.user.id !== validated.userId) {
    throw new Error('Can only update own profile')
  }
  await db.user.update({
    where: { id: validated.userId },
    data: { name: validated.name, email: validated.email }
  })
  return { success: true }
}
```

### Strict TypeScript Configuration

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

---

## JavaScript Performance (LOW-MEDIUM)

### Build Index Maps for Repeated Lookups

```typescript
// O(1) per lookup instead of O(n)
const userById = new Map(users.map(u => [u.id, u]))
orders.map(order => ({ ...order, user: userById.get(order.userId) }))
```

### Combine Multiple Array Iterations

```typescript
// 1 iteration instead of 3
const admins: User[] = []
const testers: User[] = []
const inactive: User[] = []

for (const user of users) {
  if (user.isAdmin) admins.push(user)
  if (user.isTester) testers.push(user)
  if (!user.isActive) inactive.push(user)
}
```

### Use toSorted() for Immutability

```typescript
// Creates new sorted array, original unchanged
const sorted = users.toSorted((a, b) => a.name.localeCompare(b.name))
```

### Use Set/Map for O(1) Lookups

```typescript
const allowedIds = new Set(['a', 'b', 'c'])
items.filter(item => allowedIds.has(item.id))
```

---

## References

1. [React Documentation](https://react.dev)
2. [Next.js Documentation](https://nextjs.org)
3. [SWR - React Hooks for Data Fetching](https://swr.vercel.app)
4. [better-all - Dependency-Based Parallelization](https://github.com/shuding/better-all)
5. [node-lru-cache](https://github.com/isaacs/node-lru-cache)
6. [How We Optimized Package Imports in Next.js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
7. [How We Made the Vercel Dashboard Twice as Fast](https://vercel.com/blog/how-we-made-the-vercel-dashboard-twice-as-fast)
8. [Vercel Agent Skills Repository](https://github.com/vercel-labs/agent-skills)
