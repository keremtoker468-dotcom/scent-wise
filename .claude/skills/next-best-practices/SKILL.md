---
name: next-best-practices
description: Best practices for building Next.js applications. Use when developing with Next.js, working with the App Router or Pages Router, implementing server/client components, data fetching, routing, middleware, or deploying Next.js apps. Covers Next.js 13+ App Router patterns and conventions.
---

# Next.js Best Practices

## App Router (Recommended)

### Server vs Client Components

- **Default to Server Components** - they run on the server, reduce bundle size, and can directly access data
- **Use `"use client"` only when needed** - for interactivity (event handlers, state, effects, browser APIs)
- Push client boundaries down - wrap only the interactive parts in client components

```tsx
// Server Component (default) - can fetch data directly
async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProduct(params.id)
  return <ProductDetails product={product} />
}

// Client Component - only for interactivity
"use client"
function AddToCartButton({ productId }: { productId: string }) {
  const [loading, setLoading] = useState(false)
  return <button onClick={() => addToCart(productId)}>Add to Cart</button>
}
```

### Data Fetching

- **Server Components**: Use `async/await` directly in components
- **Server Actions**: Use `"use server"` for mutations (form submissions, data updates)
- **Route Handlers**: Use `app/api/` routes for external API endpoints
- **Avoid `useEffect` for data fetching** in most cases - prefer server-side patterns

### Layouts and Templates

- Use `layout.tsx` for shared UI that persists across navigations
- Use `template.tsx` when you need fresh state on each navigation
- Place `loading.tsx` for automatic Suspense boundaries
- Place `error.tsx` for error boundaries
- Use `not-found.tsx` for 404 handling

### Routing Conventions

```
app/
├── layout.tsx          # Root layout
├── page.tsx            # Home page (/)
├── loading.tsx         # Loading UI
├── error.tsx           # Error UI
├── (marketing)/        # Route group (no URL impact)
│   ├── about/page.tsx  # /about
│   └── blog/page.tsx   # /blog
├── dashboard/
│   ├── layout.tsx      # Dashboard layout
│   └── page.tsx        # /dashboard
└── api/
    └── webhooks/route.ts  # API route
```

## Metadata and SEO

- Export `metadata` or `generateMetadata` from page/layout files
- Use the `Metadata` type for type safety
- Include Open Graph and Twitter card metadata
- Use `sitemap.ts` and `robots.ts` for SEO files

## Performance

- Use `next/image` for automatic image optimization
- Use `next/font` for font optimization with zero layout shift
- Use `next/link` for client-side navigation with prefetching
- Implement `loading.tsx` for streaming and progressive rendering
- Use `dynamic` imports for code splitting heavy components
- Configure `staleTimes` for client-side router cache when needed

## Middleware

- Use `middleware.ts` at the project root for request-level logic
- Keep middleware fast - it runs on every matched request
- Use for auth checks, redirects, headers, and geolocation
- Use `matcher` config to limit which routes trigger middleware

## Environment Variables

- `NEXT_PUBLIC_*` - exposed to browser (public values only)
- Other env vars - server-only (secrets, API keys)
- Use `.env.local` for local development, never commit it
- Validate env vars at build time with `@t3-oss/env-nextjs` or similar

## Error Handling

- Use `error.tsx` boundaries at appropriate route segments
- Implement `global-error.tsx` for root layout errors
- Use `notFound()` function to trigger 404 pages
- Log errors server-side, show user-friendly messages client-side
