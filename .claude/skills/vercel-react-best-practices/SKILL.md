---
name: vercel-react-best-practices
description: Best practices for building and deploying React applications on Vercel. Use when developing React apps deployed to Vercel, optimizing builds, using Vercel-specific features (Edge Functions, ISR, Analytics), or following modern React patterns for performance, state management, and component architecture.
---

# Vercel + React Best Practices

## Component Architecture

### Composition Over Inheritance
- Build small, focused components that do one thing well
- Use composition patterns (children, render props, compound components)
- Prefer function components with hooks

### Component Organization
```
src/
├── components/
│   ├── ui/           # Reusable UI primitives (Button, Input, Card)
│   ├── features/     # Feature-specific components
│   └── layouts/      # Page layouts and shells
├── hooks/            # Custom hooks
├── lib/              # Utilities and helpers
└── types/            # TypeScript types
```

### TypeScript Patterns
- Define props interfaces explicitly, not inline
- Use `React.ComponentPropsWithoutRef<"element">` for extending native elements
- Prefer `interface` for props, `type` for unions and utility types
- Export types alongside components for consumer use

## React Hooks Best Practices

- **useState**: Keep state minimal and derived where possible
- **useEffect**: Minimize effects; prefer event handlers and server-side data fetching
- **useMemo/useCallback**: Only use when you have measured a performance problem
- **Custom hooks**: Extract reusable logic into custom hooks with clear names (`useDebounce`, `useMediaQuery`)

## State Management

- **Local state**: `useState` for component-specific state
- **Shared state**: React Context for theme, auth, locale (low-frequency updates)
- **Server state**: React Query / SWR for API data (caching, revalidation, optimistic updates)
- **Complex state**: Zustand or Jotai for global client state (avoid Redux unless already in use)

Avoid putting everything in global state. Lift state only as high as needed.

## Performance Optimization

### Code Splitting
- Use `React.lazy()` and `Suspense` for route-level splitting
- Dynamically import heavy libraries (`import("chart-library")`)
- Use `next/dynamic` in Next.js for component-level splitting

### Rendering Optimization
- Avoid creating objects/arrays in JSX props (causes unnecessary re-renders)
- Use `key` props correctly (stable, unique identifiers, not array indices)
- Virtualize long lists with `react-window` or `@tanstack/react-virtual`

### Image and Asset Optimization
- Use `next/image` or optimized image components
- Serve images in WebP/AVIF format
- Implement responsive images with `srcSet` and `sizes`
- Lazy load below-fold images

## Vercel-Specific Features

### Edge Functions
- Use for geolocation, A/B testing, auth checks, and personalization
- Keep Edge Functions lightweight (limited runtime APIs)
- Use Edge Config for low-latency key-value data

### Incremental Static Regeneration (ISR)
- Use `revalidate` for pages that change periodically
- Use on-demand revalidation for content updates
- Combine with static generation for the best of both worlds

### Vercel Analytics
- Enable Web Analytics for Core Web Vitals monitoring
- Use Speed Insights for real-user performance data
- Track custom events for business metrics

### Environment Variables
- Use Vercel dashboard to manage per-environment variables
- `NEXT_PUBLIC_*` for client-exposed values
- Use Vercel's built-in environment variable groups for shared config

### Deployment
- Use preview deployments for PR reviews
- Configure `vercel.json` for custom headers, redirects, and rewrites
- Use monorepo support for multi-package projects
- Set up branch-based environments (production, preview, development)

## Testing

- **Unit tests**: Vitest or Jest for utilities and hooks
- **Component tests**: React Testing Library (test behavior, not implementation)
- **E2E tests**: Playwright or Cypress for critical user flows
- Test user interactions, not internal state
- Mock external APIs at the network level (MSW)
