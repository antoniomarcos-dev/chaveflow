-- Application users authenticate in Next.js. Only the backend's secret key
-- may call these RPCs; no personal or document data is exposed to browser roles.
create schema if not exists chaveflow_private;
revoke all on schema chaveflow_private from public, anon, authenticated;
grant usage on schema chaveflow_private to service_role;

create table if not exists chaveflow_private.state (
  id integer primary key check (id = 1),
  data jsonb not null,
  revision bigint not null default 1
);
create table if not exists chaveflow_private.files (
  storage_key text primary key,
  content bytea not null check (octet_length(content) between 1 and 4194304),
  created_at timestamptz not null default now()
);
create table if not exists chaveflow_private.rate_limits (
  key_hash text primary key,
  attempts integer not null default 1,
  expires_at timestamptz not null
);
alter table chaveflow_private.state enable row level security;
alter table chaveflow_private.files enable row level security;
alter table chaveflow_private.rate_limits enable row level security;
revoke all on all tables in schema chaveflow_private from public, anon, authenticated;
grant select, insert, update on chaveflow_private.state to service_role;
grant select, insert on chaveflow_private.files to service_role;
grant select, insert, update, delete on chaveflow_private.rate_limits to service_role;

create or replace function public.chaveflow_read_state()
returns jsonb language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object('state', data, 'revision', revision::text)
  from chaveflow_private.state where id = 1;
$$;

create or replace function public.chaveflow_initialize(p_state jsonb)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare affected integer;
begin
  if jsonb_typeof(p_state) is distinct from 'object' then
    raise exception 'Invalid initial state';
  end if;
  insert into chaveflow_private.state(id, data) values (1, p_state)
    on conflict (id) do nothing;
  get diagnostics affected = row_count;
  return affected = 1;
end;
$$;

create or replace function public.chaveflow_commit_state(
  p_expected_revision text, p_state jsonb, p_files jsonb default '[]'::jsonb
)
returns boolean language plpgsql security invoker set search_path = ''
as $$
declare affected integer; file_record jsonb;
begin
  if jsonb_typeof(p_state) is distinct from 'object' or jsonb_typeof(p_files) is distinct from 'array' then
    raise exception 'Invalid transaction';
  end if;
  update chaveflow_private.state set data = p_state, revision = revision + 1
    where id = 1 and revision = p_expected_revision::bigint;
  get diagnostics affected = row_count;
  if affected = 0 then return false; end if;
  for file_record in select value from jsonb_array_elements(p_files) loop
    insert into chaveflow_private.files(storage_key, content)
      values (file_record->>'storage_key', decode(file_record->>'content_base64', 'base64'));
  end loop;
  return true;
end;
$$;

create or replace function public.chaveflow_read_file(p_storage_key text)
returns text language sql stable security invoker set search_path = ''
as $$
  select encode(content, 'base64') from chaveflow_private.files where storage_key = p_storage_key;
$$;

create or replace function public.chaveflow_rate_limit(p_key_hash text)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare attempt_count integer;
begin
  delete from chaveflow_private.rate_limits where expires_at < now();
  insert into chaveflow_private.rate_limits(key_hash, attempts, expires_at)
    values (p_key_hash, 1, now() + interval '15 minutes')
    on conflict (key_hash) do update set attempts = chaveflow_private.rate_limits.attempts + 1
    returning attempts into attempt_count;
  return attempt_count;
end;
$$;

revoke execute on function public.chaveflow_read_state() from public, anon, authenticated;
revoke execute on function public.chaveflow_initialize(jsonb) from public, anon, authenticated;
revoke execute on function public.chaveflow_commit_state(text,jsonb,jsonb) from public, anon, authenticated;
revoke execute on function public.chaveflow_read_file(text) from public, anon, authenticated;
revoke execute on function public.chaveflow_rate_limit(text) from public, anon, authenticated;
grant execute on function public.chaveflow_read_state() to service_role;
grant execute on function public.chaveflow_initialize(jsonb) to service_role;
grant execute on function public.chaveflow_commit_state(text,jsonb,jsonb) to service_role;
grant execute on function public.chaveflow_read_file(text) to service_role;
grant execute on function public.chaveflow_rate_limit(text) to service_role;
