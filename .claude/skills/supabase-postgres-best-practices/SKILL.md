---
name: supabase-postgres-best-practices
description: >
  Comprehensive Supabase and Postgres best practices for project setup, schema design, RLS policies,
  Auth integration, real-time subscriptions, Edge Functions, migrations, indexing, query optimization,
  client library usage, storage, environment variables, and type generation. Use this skill when writing,
  reviewing, or optimizing Supabase applications, Postgres queries, schema designs, database configurations,
  RLS policies, Edge Functions, or client-side data access code.
---

# Supabase & Postgres Best Practices

Comprehensive guide for building production-grade applications with Supabase and PostgreSQL. Contains rules across 13 domains, prioritized by impact, with detailed explanations, correct vs. incorrect examples, and Supabase-specific notes.

## When to Apply

Reference these guidelines when:

- Setting up a new Supabase project or configuring an existing one
- Designing or modifying PostgreSQL schemas
- Writing or reviewing SQL queries and database functions
- Implementing Row Level Security (RLS) policies
- Integrating Supabase Auth into an application
- Setting up real-time subscriptions
- Building Supabase Edge Functions
- Creating or managing database migrations
- Designing indexing strategies or optimizing queries
- Using the Supabase client library (JS/TS)
- Managing storage buckets and file uploads
- Handling environment variables and secrets
- Generating TypeScript types from the database schema

---

## 1. Supabase Project Setup and Configuration

### Initial Setup

```bash
# Install the Supabase CLI
npm install -g supabase

# Initialize a new Supabase project locally
supabase init

# Link to a remote Supabase project
supabase link --project-ref <project-id>

# Start local development environment
supabase start
```

### Project Structure

```
your-project/
├── supabase/
│   ├── config.toml            # Local dev configuration
│   ├── schemas/               # Declarative schema files (preferred)
│   │   ├── 001_auth.sql
│   │   ├── 002_tables.sql
│   │   └── 003_policies.sql
│   ├── migrations/            # Generated migration files
│   │   └── 20240906123045_create_profiles.sql
│   ├── functions/             # Edge Functions
│   │   ├── _shared/           # Shared utilities across functions
│   │   └── my-function/
│   │       └── index.ts
│   └── seed.sql               # Seed data for local dev
├── src/
│   └── lib/
│       ├── supabase.ts        # Client initialization
│       └── database.types.ts  # Generated types
└── .env.local                 # Local environment variables
```

### Pre-populated Environment Variables

These are automatically available in both local and hosted Supabase environments. Users do not need to set them manually:

- `SUPABASE_URL` -- Project API URL
- `SUPABASE_ANON_KEY` -- Public anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` -- Service role key (server-side only, never expose to client)
- `SUPABASE_DB_URL` -- Direct database connection string

### Configuration Best Practices

- Always enable email confirmation in production Auth settings.
- Set up custom SMTP for production email delivery.
- Configure rate limiting for Auth endpoints.
- Enable Point-in-Time Recovery (PITR) for production databases.
- Use connection pooling via the Supavisor pooler URL for application connections.

---

## 2. PostgreSQL Schema Design Best Practices

### Naming Conventions

- Use `snake_case` for all identifiers (tables, columns, functions, indexes).
- Prefer **plural** names for tables (`users`, `orders`, `products`).
- Prefer **singular** names for columns (`email`, `created_at`, `user_id`).
- Avoid SQL reserved words; keep names unique and under 63 characters.
- Do not prefix table names with `tbl_` or similar.

### Primary Keys

**For single-database systems** (most Supabase projects):

```sql
-- CORRECT: Use bigint identity (SQL-standard, optimal index performance)
create table public.orders (
  id bigint generated always as identity primary key,
  total numeric(10,2) not null
);
```

**For distributed systems:**

```sql
-- CORRECT: Use UUIDv7 for time-ordered, non-fragmented identifiers
create extension if not exists pg_uuidv7;

create table public.events (
  id uuid default uuid_generate_v7() primary key,
  payload jsonb not null
);
```

**Avoid:**

```sql
-- INCORRECT: serial is outdated
create table public.bad_example (
  id serial primary key  -- use bigint identity instead
);

-- INCORRECT: Random UUIDv4 causes index fragmentation on large tables
create table public.bad_example_2 (
  id uuid default gen_random_uuid() primary key  -- use UUIDv7 instead for large tables
);
```

### Data Types

| Use Case | Recommended Type | Avoid |
|----------|-----------------|-------|
| Identifiers | `bigint` | `int` (overflow at 2.1B) |
| Strings | `text` | `varchar(255)` (arbitrary limit) |
| Timestamps | `timestamptz` | `timestamp` (no timezone) |
| Booleans | `boolean` | `varchar(5)` |
| Currency | `numeric(10,2)` | `float` / `double precision` |
| JSON data | `jsonb` | `json` (no indexing) |

### Table Design Template

```sql
create table public.profiles (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete cascade not null,
  display_name text not null,
  avatar_url text,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.profiles is 'Public user profiles linked to auth.users.';

-- Always enable RLS on every public table
alter table public.profiles enable row level security;
```

### Foreign Key Conventions

- Use the singular of the referenced table name with `_id` suffix: `user_id`, `order_id`.
- Always add `on delete cascade` for references to `auth.users`.
- Index all foreign key columns (Postgres does NOT auto-index foreign keys).

```sql
-- CORRECT: Foreign key with index
create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid references auth.users (id) on delete cascade not null,
  title text not null,
  content text,
  created_at timestamptz default now() not null
);

create index posts_author_id_idx on public.posts (author_id);
```

### Constraints

```sql
-- Use check constraints for data validation
alter table public.products
  add constraint products_price_positive check (price > 0);

-- Use unique constraints where appropriate
alter table public.profiles
  add constraint profiles_user_id_unique unique (user_id);
```

---

## 3. Row Level Security (RLS) Policies

### Fundamental Rules

1. **Always enable RLS** on every table in the `public` schema.
2. **Always specify roles** with the `TO` clause (`authenticated`, `anon`).
3. **Never use `FOR ALL`** -- create separate policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`.
4. **Wrap auth functions in `(select ...)`** to enable query plan caching.
5. **Add indexes** on columns used in policy conditions.
6. **Prefer `PERMISSIVE` policies** over `RESTRICTIVE` (permissive policies combine with OR, restrictive with AND, making restrictive harder to reason about).

### Policy Structure Rules

| Operation | USING | WITH CHECK |
|-----------|-------|------------|
| SELECT | Required | Never |
| INSERT | Never | Required |
| UPDATE | Usually required | Required |
| DELETE | Required | Never |

### Standard Policy Templates

```sql
-- Enable RLS
alter table public.posts enable row level security;

-- SELECT: Users can read their own posts
create policy "Users can view own posts"
  on public.posts
  for select
  to authenticated
  using ( (select auth.uid()) = author_id );

-- INSERT: Users can create posts as themselves
create policy "Users can create own posts"
  on public.posts
  for insert
  to authenticated
  with check ( (select auth.uid()) = author_id );

-- UPDATE: Users can update their own posts
create policy "Users can update own posts"
  on public.posts
  for update
  to authenticated
  using ( (select auth.uid()) = author_id )
  with check ( (select auth.uid()) = author_id );

-- DELETE: Users can delete their own posts
create policy "Users can delete own posts"
  on public.posts
  for delete
  to authenticated
  using ( (select auth.uid()) = author_id );
```

### Public Access Policy

```sql
-- For tables that should be publicly readable
create policy "Anyone can view published posts"
  on public.posts
  for select
  to authenticated, anon
  using ( published = true );
```

### Team-Based Access with auth.jwt()

```sql
-- Access based on app_metadata (cannot be modified by users)
create policy "Users can access team data"
  on public.team_data
  for select
  to authenticated
  using (
    team_id in (
      select jsonb_array_elements_text(
        (select auth.jwt()) -> 'app_metadata' -> 'teams'
      )::uuid
    )
  );
```

### MFA-Restricted Policy

```sql
create policy "Require MFA for sensitive updates"
  on public.sensitive_data
  as restrictive
  for update
  to authenticated
  using (
    ((select auth.jwt()) ->> 'aal') = 'aal2'
  );
```

### RLS Performance Optimization

```sql
-- INCORRECT: Function called per row (slow)
create policy "bad_policy" on public.posts
  for select to authenticated
  using ( auth.uid() = author_id );

-- CORRECT: Function result cached per statement (fast)
create policy "good_policy" on public.posts
  for select to authenticated
  using ( (select auth.uid()) = author_id );

-- CORRECT: Add index on policy-checked columns
create index posts_author_id_idx on public.posts using btree (author_id);

-- CORRECT: Avoid joins in policies; use subqueries with IN instead
create policy "Team members can view records"
  on public.team_records
  for select to authenticated
  using (
    team_id in (
      select team_id from public.team_members
      where user_id = (select auth.uid())
    )
  );
```

---

## 4. Supabase Auth Integration

### Client-Side Auth Setup

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Sign up
const { data, error } = await supabase.auth.signUp({
  email: 'user@example.com',
  password: 'secure-password',
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'secure-password',
});

// Sign in with OAuth
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: 'https://yourapp.com/auth/callback' },
});

// Sign out
await supabase.auth.signOut();

// Get current user (server-side, validates with Supabase)
const { data: { user } } = await supabase.auth.getUser();

// Get session (client-side, reads local JWT, faster but not verified)
const { data: { session } } = await supabase.auth.getSession();

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  console.log(event, session);
});
```

### Auth Tables Reference

| Table | Key Columns |
|-------|------------|
| `auth.users` | `id`, `email`, `phone`, `created_at`, `last_sign_in_at`, `raw_user_meta_data`, `raw_app_meta_data` |
| `auth.sessions` | `id`, `user_id`, `created_at`, `updated_at` |
| `auth.identities` | `id`, `user_id`, `provider`, `identity_data` |

### User Profile Pattern

```sql
-- Create a public profiles table that mirrors auth.users
create table public.profiles (
  id uuid references auth.users (id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### Auth Helper Functions in RLS

- `auth.uid()` -- Returns the UUID of the currently authenticated user.
- `auth.jwt()` -- Returns the full JWT payload. Use `-> 'app_metadata'` for authorization data (not user-editable) and `-> 'user_metadata'` for user-editable data.
- Always wrap these in `(select ...)` for performance in RLS policies.

### Important Auth Security Rules

- Never expose `auth.users` directly via the API. Use a `public.profiles` table instead.
- Store authorization data in `raw_app_meta_data` (not editable by users).
- Store user preferences in `raw_user_meta_data` (editable via `supabase.auth.update()`).
- Use `SUPABASE_SERVICE_ROLE_KEY` only on the server side; never expose it to the client.
- Use `supabase.auth.getUser()` on the server (validates JWT with Supabase).
- Use `supabase.auth.getSession()` on the client only (reads local JWT, not verified).

---

## 5. Real-Time Subscriptions

### Enabling Real-Time

```sql
-- Enable real-time on a table (via Supabase Dashboard or SQL)
alter publication supabase_realtime add table public.messages;
```

### Client-Side Subscription

```typescript
// Subscribe to all changes on a table
const channel = supabase
  .channel('messages-channel')
  .on(
    'postgres_changes',
    {
      event: '*',        // 'INSERT' | 'UPDATE' | 'DELETE' | '*'
      schema: 'public',
      table: 'messages',
    },
    (payload) => {
      console.log('Change received:', payload);
    }
  )
  .subscribe();

// Subscribe with filters
const filteredChannel = supabase
  .channel('user-messages')
  .on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`,
    },
    (payload) => {
      console.log('New message:', payload.new);
    }
  )
  .subscribe();

// Unsubscribe when done
supabase.removeChannel(channel);
```

### Real-Time Best Practices

- **RLS applies to real-time.** Users only receive events for rows they have SELECT access to.
- **Use filters** to reduce the volume of events sent to each client.
- **Unsubscribe** from channels when components unmount or are no longer needed.
- **Avoid subscribing to large tables** without filters -- this generates excessive traffic.
- **Use Broadcast** for ephemeral events (cursor positions, typing indicators) that do not need database persistence.
- **Use Presence** for tracking online users and shared state.

### Broadcast and Presence

```typescript
// Broadcast: Send ephemeral messages (not persisted)
const channel = supabase.channel('room-1');
channel.on('broadcast', { event: 'cursor-pos' }, (payload) => {
  console.log('Cursor:', payload);
});
await channel.subscribe();
channel.send({ type: 'broadcast', event: 'cursor-pos', payload: { x: 100, y: 200 } });

// Presence: Track online users
const channel = supabase.channel('online-users');
channel.on('presence', { event: 'sync' }, () => {
  const state = channel.presenceState();
  console.log('Online users:', state);
});
await channel.subscribe(async (status) => {
  if (status === 'SUBSCRIBED') {
    await channel.track({ user_id: currentUser.id, online_at: new Date().toISOString() });
  }
});
```

---

## 6. Edge Functions

### Guidelines

1. Use Web APIs and Deno core APIs instead of external dependencies (e.g., `fetch` instead of Axios).
2. Place shared utilities in `supabase/functions/_shared/` and import via relative paths. Do NOT create cross-dependencies between Edge Functions.
3. Never use bare specifiers. Prefix external imports with `npm:`, `jsr:`, or `node:`.
4. Always pin dependency versions: `npm:express@4.18.2`, not `npm:express`.
5. Use `Deno.serve()` instead of the deprecated `serve` from `deno.land/std`.
6. File writes are only permitted in the `/tmp` directory.
7. Use `EdgeRuntime.waitUntil(promise)` for background tasks that should not block the response.
8. Minimize use of `deno.land/x`, `esm.sh`, and `unpkg.com` CDNs. Prefer `npm:` specifiers.

### Edge Function Template

```typescript
import { createClient } from 'npm:@supabase/supabase-js@2';

interface RequestPayload {
  name: string;
}

Deno.serve(async (req: Request) => {
  try {
    // Create Supabase client with auth context from the request
    const authHeader = req.headers.get('Authorization')!;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify the user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { name }: RequestPayload = await req.json();

    return new Response(
      JSON.stringify({ message: `Hello ${name}!`, user_id: user.id }),
      { headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
```

### Multi-Route Edge Function with Hono

```typescript
import { Hono } from 'npm:hono@3';

const app = new Hono().basePath('/my-function');

app.get('/health', (c) => c.json({ status: 'ok' }));

app.post('/process', async (c) => {
  const body = await c.req.json();
  return c.json({ received: body });
});

Deno.serve(app.fetch);
```

### Setting Secrets

```bash
# Set secrets from an env file
supabase secrets set --env-file .env.production

# Set individual secrets
supabase secrets set MY_API_KEY=sk-xxxxx
```

---

## 7. Database Migrations

### Migration File Naming

Files MUST follow the format `YYYYMMDDHHmmss_short_description.sql` in UTC:

```
20240906123045_create_profiles.sql
20240906130000_add_rls_policies.sql
```

### Declarative Schema Workflow (Preferred)

```bash
# 1. Define or modify schema files in supabase/schemas/
# 2. Stop local environment before diffing
supabase stop

# 3. Generate migration by diffing
supabase db diff -f create_profiles

# 4. Review the generated migration file carefully
# 5. Restart and apply
supabase start
supabase db reset  # applies all migrations from scratch locally
```

### Migration SQL Guidelines

```sql
-- Migration: Create user profiles table
-- Affected tables: public.profiles
-- Purpose: Store public user profile data linked to auth.users

-- Create the profiles table
create table public.profiles (
  id uuid references auth.users (id) on delete cascade primary key,
  display_name text not null,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

comment on table public.profiles is 'Public user profiles linked to auth.users.';

-- Enable RLS (mandatory for all public tables)
alter table public.profiles enable row level security;

-- RLS policies (one per operation per role)
create policy "Profiles are viewable by everyone"
  on public.profiles for select
  to authenticated, anon
  using (true);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

-- Index for commonly filtered columns
create index profiles_display_name_idx on public.profiles (display_name);
```

### Migration Best Practices

- Include a header comment with the migration purpose, affected tables, and special considerations.
- Write all SQL in lowercase.
- Always enable RLS when creating a new table, even for public tables (policy returns `true`).
- Create granular RLS policies: one per operation (`select`, `insert`, `update`, `delete`) per role (`anon`, `authenticated`).
- Add copious comments for any destructive SQL (truncate, drop, column alterations).
- Keep migrations small and focused on a single logical change.
- Test migrations locally with `supabase db reset`.
- Never modify production data in migrations without backups.

### Declarative Schema Caveats

The following are NOT captured by `supabase db diff` and must be added as manual migration files:

- DML statements (`INSERT`, `UPDATE`, `DELETE`)
- View ownership, security invoker on views, materialized views
- `ALTER POLICY` statements and column privileges
- Schema-level privileges, comments, partitions
- `ALTER PUBLICATION ... ADD TABLE`
- `CREATE DOMAIN` statements
- Grant statement deduplication from default privileges

---

## 8. Indexing Strategies

### When to Add Indexes

- On columns used in `WHERE` clauses (especially with high cardinality).
- On foreign key columns (Postgres does NOT auto-index these).
- On columns used in `JOIN` conditions.
- On columns used in `ORDER BY` with `LIMIT`.
- On columns referenced in RLS policies.

### Index Types

| Type | Use Case | Example |
|------|----------|---------|
| B-tree (default) | Equality and range queries | `create index idx on orders (customer_id)` |
| Hash | Equality-only queries | `create index idx on users using hash (email)` |
| GIN | JSONB, arrays, full-text search | `create index idx on posts using gin (tags)` |
| GiST | Geometric, full-text, range types | `create index idx on locations using gist (geom)` |
| BRIN | Large, naturally ordered tables | `create index idx on logs using brin (created_at)` |

### Composite Indexes

Place equality columns before range columns. Respect the leftmost prefix rule.

```sql
-- CORRECT: equality column first, then range column
create index orders_status_created_idx
  on public.orders (status, created_at);

-- This index supports:
--   WHERE status = 'pending'
--   WHERE status = 'pending' AND created_at > '2024-01-01'
-- But NOT:
--   WHERE created_at > '2024-01-01'  (skips leading column)
```

### Partial Indexes

Index only the rows you actually query. Produces 5-20x smaller indexes and faster writes.

```sql
-- Only index active users (most queries filter on active users)
create index users_active_email_idx
  on public.users (email)
  where deleted_at is null;

-- Only index pending orders
create index orders_pending_idx
  on public.orders (created_at)
  where status = 'pending';
```

### Covering Indexes (INCLUDE)

```sql
-- Include columns needed by SELECT to enable index-only scans
create index orders_customer_covering_idx
  on public.orders (customer_id)
  include (order_date, total);
```

### JSONB Indexing

```sql
-- GIN index for containment queries (@>, ?, ?|, ?&)
create index products_metadata_idx
  on public.products using gin (metadata);

-- Expression index for a specific JSONB key
create index products_category_idx
  on public.products ((metadata ->> 'category'));
```

### Full-Text Search Indexes

```sql
-- Add a tsvector column and GIN index
alter table public.articles add column fts tsvector
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(body, ''))) stored;

create index articles_fts_idx on public.articles using gin (fts);

-- Query using the index
select * from public.articles where fts @@ to_tsquery('english', 'postgres & optimization');
```

---

## 9. Query Optimization

### Use EXPLAIN ANALYZE

```sql
-- Always analyze actual execution, not just estimates
explain (analyze, buffers, format text)
select * from public.orders where customer_id = 123;

-- Look for:
--   Seq Scan -> add an index
--   Nested Loop with high row counts -> consider JOIN restructuring
--   High actual vs. estimated rows -> run ANALYZE to update statistics
```

### Eliminate N+1 Queries

```sql
-- INCORRECT: Fetching orders one user at a time in a loop
-- Application runs: SELECT * FROM orders WHERE user_id = $1 (100 times)

-- CORRECT: Batch with array parameter
select * from public.orders
where user_id = any($1::uuid[]);

-- CORRECT: Use a JOIN
select u.id, u.email, o.id as order_id, o.total
from public.users u
left join public.orders o on o.user_id = u.id
where u.id = any($1::uuid[]);
```

### Cursor-Based Pagination (Not OFFSET)

```sql
-- INCORRECT: OFFSET scans and discards rows (O(n) on page depth)
select * from public.posts
order by created_at desc
limit 20 offset 10000;  -- scans 10,020 rows

-- CORRECT: Cursor-based pagination (O(1) regardless of depth)
select * from public.posts
where created_at < $1  -- cursor: last row's created_at from previous page
order by created_at desc
limit 20;
```

### Batch Inserts

```sql
-- INCORRECT: Individual inserts in a loop
insert into public.events (name, data) values ('a', '{}');
insert into public.events (name, data) values ('b', '{}');

-- CORRECT: Batch insert
insert into public.events (name, data) values
  ('a', '{}'),
  ('b', '{}'),
  ('c', '{}');
```

### Use Upsert for Idempotent Operations

```sql
-- Insert or update on conflict
insert into public.user_settings (user_id, theme, language)
values ($1, $2, $3)
on conflict (user_id)
do update set
  theme = excluded.theme,
  language = excluded.language;
```

### Monitor with pg_stat_statements

```sql
-- Find the slowest queries
select
  query,
  calls,
  mean_exec_time,
  total_exec_time
from pg_stat_statements
order by mean_exec_time desc
limit 20;
```

### Vacuum and Analyze

```sql
-- Update table statistics for the query planner
analyze public.orders;

-- Check vacuum status
select
  relname,
  last_vacuum,
  last_autovacuum,
  n_dead_tup
from pg_stat_user_tables
where schemaname = 'public'
order by n_dead_tup desc;
```

### SQL Style Guide

- Use lowercase for SQL reserved words.
- Use `snake_case` for identifiers.
- Add white space and indentation for readability.
- Use CTEs for complex queries (prefer readability over micro-optimization).
- Use full table names in JOINs for clarity.
- Use meaningful aliases with the `as` keyword.
- Add comments to each CTE block explaining its purpose.

---

## 10. Supabase Client Library Usage (JS/TS)

### Client Initialization

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';  // Generated types

// Browser / client-side (uses anon key)
export const supabase = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Server-side (uses service role key -- never expose to client)
export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);
```

### CRUD Operations

```typescript
// SELECT with type safety
const { data: posts, error } = await supabase
  .from('posts')
  .select('id, title, author:profiles(display_name)')
  .eq('published', true)
  .order('created_at', { ascending: false })
  .limit(20);

// INSERT
const { data, error } = await supabase
  .from('posts')
  .insert({ title: 'New Post', content: 'Hello world', author_id: user.id })
  .select()
  .single();

// UPDATE
const { data, error } = await supabase
  .from('posts')
  .update({ title: 'Updated Title' })
  .eq('id', postId)
  .select()
  .single();

// DELETE
const { error } = await supabase
  .from('posts')
  .delete()
  .eq('id', postId);

// UPSERT
const { data, error } = await supabase
  .from('user_settings')
  .upsert({ user_id: user.id, theme: 'dark' })
  .select()
  .single();
```

### Common Filters Reference

| Filter | Usage |
|--------|-------|
| Equals | `.eq('col', value)` |
| Not equals | `.neq('col', value)` |
| Greater than | `.gt('col', value)` |
| Greater or equal | `.gte('col', value)` |
| Less than | `.lt('col', value)` |
| Less or equal | `.lte('col', value)` |
| Pattern match | `.ilike('col', '%search%')` |
| In list | `.in('col', [a, b, c])` |
| Is null | `.is('col', null)` |
| Contains (JSONB) | `.contains('metadata', { key: 'value' })` |
| Contained by | `.containedBy('tags', ['a', 'b'])` |
| OR conditions | `.or('status.eq.active,status.eq.pending')` |

### Select Only Needed Columns

```typescript
// INCORRECT: Fetching all columns
const { data } = await supabase.from('users').select('*');

// CORRECT: Fetch only what you need
const { data } = await supabase.from('users').select('id, email, display_name');
```

### Nested Queries (Joins)

```typescript
// Fetch posts with their author profiles and comment counts
const { data } = await supabase
  .from('posts')
  .select(`
    id,
    title,
    created_at,
    author:profiles!author_id (
      display_name,
      avatar_url
    ),
    comments (
      count
    )
  `)
  .eq('published', true)
  .order('created_at', { ascending: false });
```

### RPC (Calling Database Functions)

```typescript
const { data, error } = await supabase.rpc('search_posts', {
  search_term: 'postgres',
  result_limit: 10,
});
```

---

## 11. Storage Bucket Management

### Creating Buckets

```sql
-- Via SQL (in a migration)
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  5242880,  -- 5MB
  array['application/pdf', 'image/png', 'image/jpeg']
);
```

### Storage RLS Policies

```sql
-- Allow authenticated users to upload to their own folder
create policy "Users can upload own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Allow public read access
create policy "Public avatar access"
  on storage.objects for select
  to authenticated, anon
  using ( bucket_id = 'avatars' );

-- Allow users to update their own files
create policy "Users can update own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Allow users to delete their own files
create policy "Users can delete own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (select auth.uid())::text = (storage.foldername(name))[1]
  );
```

### Client-Side Storage Operations

```typescript
// Upload a file
const { data, error } = await supabase.storage
  .from('avatars')
  .upload(`${user.id}/avatar.png`, file, {
    cacheControl: '3600',
    upsert: true,
  });

// Get a public URL
const { data: { publicUrl } } = supabase.storage
  .from('avatars')
  .getPublicUrl(`${user.id}/avatar.png`);

// Get a signed (temporary) URL for private buckets
const { data: { signedUrl }, error } = await supabase.storage
  .from('documents')
  .createSignedUrl(`${user.id}/report.pdf`, 3600); // 1 hour

// Delete a file
const { error } = await supabase.storage
  .from('avatars')
  .remove([`${user.id}/avatar.png`]);

// List files in a folder
const { data: files, error } = await supabase.storage
  .from('avatars')
  .list(user.id, { limit: 100, offset: 0 });
```

---

## 12. Environment Variable Handling

### Variable Categories

| Variable | Scope | Exposure |
|----------|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Safe to expose |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Safe to expose (RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | NEVER expose to client |
| `SUPABASE_DB_URL` | Server only | NEVER expose to client |
| `SUPABASE_JWT_SECRET` | Server only | NEVER expose to client |

### Environment File Structure

```bash
# .env.local (for local development -- add to .gitignore)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres

# .env.production (set via hosting provider, not committed)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

### Edge Function Secrets

```bash
# Pre-populated (no action needed):
#   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL

# Custom secrets
supabase secrets set --env-file .env.production
supabase secrets set STRIPE_SECRET_KEY=sk_live_xxxxx

# Access in Edge Functions
const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!;
```

### Security Rules

- Never commit `.env` files containing real keys to version control.
- Add `.env`, `.env.local`, `.env.production` to `.gitignore`.
- Use `NEXT_PUBLIC_` prefix only for variables safe to expose to the browser.
- The `anon` key is safe to expose because RLS enforces access control.
- The `service_role` key bypasses RLS entirely -- use only in trusted server contexts.
- Rotate keys immediately if they are accidentally committed.

---

## 13. Type Generation from Database Schema

### Generating Types

```bash
# Generate TypeScript types from your remote Supabase project
supabase gen types typescript --project-id <project-ref> > src/lib/database.types.ts

# Generate from local database
supabase gen types typescript --local > src/lib/database.types.ts
```

### Using Generated Types

```typescript
import type { Database } from './database.types';

// Typed client
const supabase = createClient<Database>(url, key);

// Extract specific table types
type Post = Database['public']['Tables']['posts']['Row'];
type PostInsert = Database['public']['Tables']['posts']['Insert'];
type PostUpdate = Database['public']['Tables']['posts']['Update'];

// Use in function signatures
async function createPost(post: PostInsert): Promise<Post> {
  const { data, error } = await supabase
    .from('posts')
    .insert(post)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Type-safe RPC calls
type SearchResult = Database['public']['Functions']['search_posts']['Returns'];
```

### Automation

```json
// package.json script
{
  "scripts": {
    "db:types": "supabase gen types typescript --local > src/lib/database.types.ts",
    "db:types:remote": "supabase gen types typescript --project-id $PROJECT_REF > src/lib/database.types.ts"
  }
}
```

### Best Practices for Types

- Regenerate types after every migration or schema change.
- Commit the generated types file to version control so the team stays in sync.
- Add type generation to your CI pipeline to catch schema drift.
- Use the `Row`, `Insert`, and `Update` variants appropriately (`Insert`/`Update` have optional fields for columns with defaults).

---

## Connection Management

### Connection Pooling

Postgres connections are expensive (1-3MB RAM each). Without pooling, applications exhaust connections under load.

**Use the Supavisor pooler URL** (provided in Supabase Dashboard) for all application connections:

```
# Direct connection (for migrations and CLI only)
postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres

# Pooled connection (for applications -- use this)
postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
```

### Pool Size Formula

Optimal pool size: `(CPU cores x 2) + number of disks`

For a 4-core system: pool_size = 10.

### Pool Modes

| Mode | Behavior | Use When |
|------|----------|----------|
| Transaction | Returns connection after each transaction | Default for most apps |
| Session | Maintains connection for session lifetime | Need prepared statements or temp tables |

### Connection Best Practices

- Use transaction mode pooling for serverless and edge deployments.
- Set idle connection timeouts to prevent connection leaks.
- Monitor connection counts via the Supabase Dashboard.
- Use `supabaseAdmin` (service role) connections sparingly on the server side.

---

## Database Functions Best Practices

### Standard Function Template

```sql
create or replace function public.my_function(param_name bigint)
returns table (id bigint, name text)
language plpgsql
security invoker            -- run as the calling user (default to this)
set search_path = ''        -- prevent schema injection
stable                      -- or immutable, if no side effects
as $$
begin
  return query
  select t.id, t.name
  from public.my_table t
  where t.category_id = my_function.param_name;
end;
$$;
```

### Function Rules

1. **Default to `SECURITY INVOKER`** -- runs with the caller's permissions and respects RLS.
2. **Always set `search_path = ''`** -- use fully qualified names (`public.table_name`) to prevent schema injection.
3. **Declare `IMMUTABLE` or `STABLE`** when possible for better query planner optimization. Use `VOLATILE` only when the function modifies data.
4. **Use explicit parameter and return types** -- avoid ambiguous typing.
5. **Use `SECURITY DEFINER` only when necessary** (e.g., the function needs to bypass RLS) and document why.

### Trigger Function Example

```sql
create or replace function public.update_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger update_updated_at_trigger
  before update on public.my_table
  for each row
  execute function public.update_updated_at();
```

---

## Quick Reference: Do's and Don'ts

### DO

- Enable RLS on all public tables, even if they are intended for public access (policy returns `true`).
- Use `(select auth.uid())` in RLS policies (not bare `auth.uid()`).
- Add indexes on foreign keys and columns used in WHERE, JOIN, and RLS policies.
- Specify roles with `TO authenticated` or `TO anon` in every policy.
- Use `on delete cascade` for foreign keys referencing `auth.users`.
- Use cursor-based pagination for large datasets.
- Select only the columns you need: `.select('id, name')`, not `.select('*')`.
- Use `bigint generated always as identity` for primary keys.
- Use `timestamptz` for all timestamp columns.
- Use `text` instead of `varchar(n)` unless you have a specific constraint.
- Regenerate types after every schema change.
- Use connection pooling for all application database connections.
- Use `supabase.auth.getUser()` on the server for verified authentication.
- Set `search_path = ''` and use fully qualified names in database functions.

### DON'T

- Store sensitive data without RLS.
- Use `auth.uid()` directly in policies without wrapping in `(select ...)`.
- Create policies without specifying roles.
- Forget indexes on frequently filtered columns or foreign keys.
- Use OFFSET pagination for deep pages (>1000 rows).
- Expose `auth.users` directly via the API.
- Expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- Use `serial` for primary keys (outdated; use `identity`).
- Use `FOR ALL` in RLS policies (create separate policies per operation).
- Use `float` for currency (use `numeric`).
- Skip `search_path = ''` in database functions.
- Commit `.env` files with real credentials to version control.

---

## References

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase Auth Guide](https://supabase.com/docs/guides/auth)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Edge Functions Guide](https://supabase.com/docs/guides/functions)
- [Supabase Storage Guide](https://supabase.com/docs/guides/storage)
- [Supabase Realtime Guide](https://supabase.com/docs/guides/realtime)
- [Supabase CLI Reference](https://supabase.com/docs/guides/cli)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/current/)
- [PostgreSQL Performance Wiki](https://wiki.postgresql.org/wiki/Performance_Optimization)
- [supabase/agent-skills Repository](https://github.com/supabase/agent-skills)
