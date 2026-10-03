-- Apply once in Supabase SQL Editor or with supabase db push.
-- Auth users are invited/created by the owner; the app never enables signups.
create table public.workspaces (
 owner_id uuid primary key references auth.users(id) on delete cascade,
 data jsonb not null,
 revision bigint not null default 1 check (revision > 0),
 updated_at timestamptz not null default now(),
 constraint workspace_shape check (
 jsonb_typeof(data) = 'object' and
 jsonb_typeof(data->'companies') = 'array' and
 jsonb_typeof(data->'projects') = 'array' and
 jsonb_typeof(data->'people') = 'array' and
 jsonb_typeof(data->'commitments') = 'array' and
 jsonb_typeof(data->'decisions') = 'array' and
 jsonb_typeof(data->'meetings') = 'array' and
 jsonb_typeof(data->'actions') = 'array' and
 jsonb_typeof(data->'risks') = 'array' and
 jsonb_typeof(data->'inbox') = 'array' and
 data ?& array['companies','projects','people','commitments','decisions','meetings','actions','risks','inbox']
 )
);
alter table public.workspaces enable row level security;
create policy "Read own workspace" on public.workspaces for select to authenticated using (owner_id = (select auth.uid()));
create policy "Insert own workspace" on public.workspaces for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Update own workspace" on public.workspaces for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on public.workspaces from anon, authenticated;
grant select on public.workspaces to authenticated;
-- Writes use the constrained RPC, so clients cannot bypass revision checks.
create function public.save_workspace(workspace_data jsonb, expected_revision bigint)
returns bigint language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); new_revision bigint;
begin
 if actor is null then raise exception 'Authentication required' using errcode = '42501'; end if;
 if expected_revision is null or expected_revision < 0 then raise exception 'Invalid revision' using errcode = '22023'; end if;
 if workspace_data is null or octet_length(workspace_data::text) > 5242880 then raise exception 'Invalid workspace size' using errcode = '22023'; end if;
 if expected_revision = 0 then
   insert into public.workspaces(owner_id, data, revision) values(actor, workspace_data, 1)
   on conflict (owner_id) do nothing returning revision into new_revision;
 else
   update public.workspaces set data = workspace_data, revision = revision + 1, updated_at = now()
   where owner_id = actor and revision = expected_revision returning revision into new_revision;
 end if;
 if new_revision is null then raise exception 'Workspace changed on another device' using errcode = '40001'; end if;
 return new_revision;
end;
$$;
revoke all on function public.save_workspace(jsonb, bigint) from public, anon;
grant execute on function public.save_workspace(jsonb, bigint) to authenticated;
