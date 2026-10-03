-- Google tokens are encrypted by the server before persistence.
-- Browser roles cannot select credentials or mutate this table.
create table if not exists public.google_connections (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 scopes text[] not null default '{}',
 credentials text not null,
 snapshot jsonb,
 connected_at timestamptz not null default now(),
 last_synced_at timestamptz
);
alter table public.google_connections enable row level security;
drop policy if exists "Read own Google status" on public.google_connections;
create policy "Read own Google status" on public.google_connections for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.google_connections from anon, authenticated;
grant select(owner_id,email,scopes,connected_at,last_synced_at) on public.google_connections to authenticated;
grant all on public.google_connections to service_role;
