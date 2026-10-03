-- Run after the existing workspace migration. Safe to rerun.
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
-- A custom GPT gets read access and proposal creation only, never direct writes.
create table if not exists public.gpt_bridge_keys (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 secret_hash text not null unique,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now() + interval '90 days'
);
create table if not exists public.gpt_proposals (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete cascade,
 title text not null,
 payload jsonb not null,
 status text not null default 'Review' check(status in ('Review','Applied','Rejected')),
 created_at timestamptz not null default now()
);
alter table public.gpt_bridge_keys enable row level security;
alter table public.gpt_proposals enable row level security;
drop policy if exists "Read own GPT key metadata" on public.gpt_bridge_keys;
create policy "Read own GPT key metadata" on public.gpt_bridge_keys for select to authenticated using(owner_id=(select auth.uid()));
drop policy if exists "Read own GPT proposals" on public.gpt_proposals;
create policy "Read own GPT proposals" on public.gpt_proposals for select to authenticated using(owner_id=(select auth.uid()));
revoke all on public.gpt_bridge_keys,public.gpt_proposals from anon,authenticated;
grant select(owner_id,created_at,expires_at) on public.gpt_bridge_keys to authenticated;
grant select on public.gpt_proposals to authenticated;
grant all on public.gpt_bridge_keys,public.gpt_proposals to service_role;
create or replace function public.apply_gpt_proposal(proposal_id uuid, expected_revision bigint) returns bigint language plpgsql security definer set search_path='' as $$
declare proposal jsonb; revision bigint;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501';end if;
 select payload into proposal from public.gpt_proposals where id=proposal_id and owner_id=auth.uid() and status='Review' for update;
 if proposal is null then raise exception 'Proposal unavailable' using errcode='42501';end if;
 revision:=public.save_workspace(proposal,expected_revision);
 update public.gpt_proposals set status='Applied' where id=proposal_id and owner_id=auth.uid();
 return revision;
end;
$$;
revoke all on function public.apply_gpt_proposal(uuid,bigint) from public,anon;
grant execute on function public.apply_gpt_proposal(uuid,bigint) to authenticated;
