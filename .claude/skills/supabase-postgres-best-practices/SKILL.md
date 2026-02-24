---
name: supabase-postgres-best-practices
description: Best practices for building with Supabase and PostgreSQL. Use when working with Supabase projects, designing database schemas, implementing Row Level Security (RLS), using Supabase Auth, real-time subscriptions, Edge Functions, database migrations, or the Supabase client library.
---

# Supabase & PostgreSQL Best Practices

## Schema Design

- Use `uuid` primary keys with `gen_random_uuid()` default
- Always add `created_at` and `updated_at` timestamp columns
- Use foreign key constraints for referential integrity
- Prefer `text` over `varchar` unless length constraints are needed
- Use `check` constraints for data validation at the database level
- Use enums or lookup tables for fixed sets of values

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

## Row Level Security (RLS)

**Always enable RLS on every table in `public` schema.**

```sql
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);
```

- Enable RLS before inserting any data
- Test policies by querying as different users
- Use `auth.uid()` to reference the current user
- Use `auth.jwt()` for claims-based policies
- Create a service role client for admin operations that bypass RLS

## Supabase Auth

- Use `supabase.auth.getUser()` server-side (validates with Supabase, secure)
- Use `supabase.auth.getSession()` client-side only (reads local JWT, faster but not verified)
- Handle auth state changes with `onAuthStateChange`
- Store user metadata in a separate `profiles` table, not in auth metadata
- Use database triggers to create profile rows on user signup

## Client Usage

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
```

- Generate types with `supabase gen types typescript`
- Use the typed client for full autocomplete and type safety
- Create separate clients for server (service role) and client (anon key)

## Indexing

- Add indexes on columns used in `where`, `join`, and `order by` clauses
- Use partial indexes for filtered queries
- Add composite indexes for multi-column queries (order matters)
- Monitor slow queries in the Supabase dashboard

```sql
create index idx_posts_user_id on public.posts(user_id);
create index idx_posts_created_at on public.posts(created_at desc);
```

## Migrations

- Use `supabase migration new <name>` to create migrations
- Write both up and down migrations
- Test migrations locally with `supabase db reset`
- Never modify production data in migrations without backups
- Keep migrations small and focused

## Real-time

- Subscribe only to the specific tables and events needed
- Use filters to reduce payload: `.on('postgres_changes', { filter: 'user_id=eq.123' })`
- Unsubscribe when components unmount
- RLS policies apply to real-time subscriptions

## Edge Functions

- Use for server-side logic that needs to run close to users
- Access Supabase with the service role key in Edge Functions
- Use `Deno.env.get()` for environment variables
- Keep functions focused and small

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - safe to expose
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - safe to expose (RLS protects data)
- `SUPABASE_SERVICE_ROLE_KEY` - server-only, never expose to client
