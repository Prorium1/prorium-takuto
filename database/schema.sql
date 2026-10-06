-- Proposed Supabase/PostgreSQL schema. NOT applied to a remote database.
-- Generate a real migration with Supabase CLI in an isolated dev project.
-- auth.users, auth.uid(), anon/authenticated/service_role are supplied by Supabase.
begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null
);
create table public.profiles (
  user_id uuid primary key references auth.users(id),
  display_name text not null,
  created_at timestamptz not null default now()
);
create table private.admin_memberships (
  user_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),
  created_at timestamptz not null default now(),
  primary key(user_id, company_id)
);
create table public.investor_grants (
  user_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  primary key(user_id, company_id)
);
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  period date not null check(extract(day from period) = 1),
  created_at timestamptz not null default now(),
  unique(company_id, period)
);
create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  period date not null check(extract(day from period) = 1),
  source text not null,
  is_synthetic boolean not null,
  status text not null check(status in ('received','validated','rejected')),
  validation_result jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.financial_snapshots (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  period date not null check(extract(day from period) = 1),
  import_job_id uuid references public.import_jobs(id),
  source text not null,
  is_synthetic boolean not null,
  data jsonb not null check(jsonb_typeof(data)='object' and jsonb_typeof(data->'currency')='string' and coalesce(data->>'currency','')='JPY' and jsonb_typeof(data->'period')='string' and coalesce(data->>'period','') ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
  checksum text not null default '',
  created_at timestamptz not null default now()
);
create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id),
  financial_snapshot_id uuid not null references public.financial_snapshots(id),
  version text not null check(version ~ '^v[1-9][0-9]*\.[0-9]+$'),
  state text not null default 'draft' check(state in ('draft','review','approved','published')),
  content jsonb not null check(jsonb_typeof(content)='object'),
  content_hash text not null default '',
  revision integer not null default 1,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  approved_hash text,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  unique(report_id, version),
  check ((state in ('approved','published') and approved_by is not null and approved_at is not null and approved_hash is not null) or (state in ('draft','review') and approved_by is null and approved_at is null and approved_hash is null)),
  check ((state='published') = (published_at is not null))
);
create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.report_versions(id),
  reviewer_id uuid not null references auth.users(id),
  approved_hash text not null,
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id),
  actor_id uuid references auth.users(id),
  action text not null,
  record_id uuid not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create table public.analysis_runs (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.report_versions(id),
  snapshot_id uuid not null references public.financial_snapshots(id),
  provider text not null,
  is_synthetic boolean not null,
  output jsonb not null check(jsonb_typeof(output)='object'),
  created_at timestamptz not null default now()
);

create index report_versions_published on public.report_versions(report_id, created_at desc) where state='published';
create index investor_grants_active on public.investor_grants(company_id,user_id) where revoked_at is null;
create index financial_snapshots_period on public.financial_snapshots(company_id,period);
create index audit_logs_company_time on public.audit_logs(company_id,created_at desc);

-- Narrow lookup helpers bypass RLS only to prevent policy recursion. No role comes
-- from user_metadata. Each helper is bound to the current authenticated identity.
create function private.is_admin(company uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from private.admin_memberships m where m.user_id=auth.uid() and m.company_id=company)
$$;
create function private.has_investor_grant(company uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.investor_grants g where g.user_id=auth.uid() and g.company_id=company and g.revoked_at is null)
$$;
create function private.can_manage_report(report uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.reports r where r.id=report and private.is_admin(r.company_id))
$$;
create function private.can_read_report(report uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(select 1 from public.reports r where r.id=report and private.has_investor_grant(r.company_id) and exists(select 1 from public.report_versions v where v.report_id=r.id and v.state='published'))
$$;
revoke all on function private.is_admin(uuid), private.has_investor_grant(uuid), private.can_manage_report(uuid), private.can_read_report(uuid) from public, anon;
grant execute on function private.is_admin(uuid), private.has_investor_grant(uuid), private.can_manage_report(uuid), private.can_read_report(uuid) to authenticated, service_role;

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table private.admin_memberships enable row level security;
alter table public.investor_grants enable row level security;
alter table public.reports enable row level security;
alter table public.import_jobs enable row level security;
alter table public.financial_snapshots enable row level security;
alter table public.report_versions enable row level security;
alter table public.approval_events enable row level security;
alter table public.audit_logs enable row level security;
alter table public.analysis_runs enable row level security;

create policy company_read on public.companies for select to authenticated using(private.is_admin(id) or private.has_investor_grant(id));
create policy profile_self on public.profiles for select to authenticated using(user_id=(select auth.uid()));
create policy grant_self on public.investor_grants for select to authenticated using(user_id=(select auth.uid()));
create policy report_read on public.reports for select to authenticated using(private.is_admin(company_id) or private.can_read_report(id));
create policy report_insert on public.reports for insert to authenticated with check(private.is_admin(company_id));
create policy report_update on public.reports for update to authenticated using(private.is_admin(company_id)) with check(private.is_admin(company_id));
create policy report_delete on public.reports for delete to authenticated using(private.is_admin(company_id));
create policy version_read on public.report_versions for select to authenticated using(private.can_manage_report(report_id) or (state='published' and private.can_read_report(report_id)));
create policy version_insert on public.report_versions for insert to authenticated with check(private.can_manage_report(report_id) and state='draft');
create policy version_edit on public.report_versions for update to authenticated using(private.can_manage_report(report_id) and state<>'published') with check(private.can_manage_report(report_id) and state<>'published');
create policy snapshot_admin on public.financial_snapshots for select to authenticated using(private.is_admin(company_id));
create policy imports_admin on public.import_jobs for select to authenticated using(private.is_admin(company_id));
create policy approvals_admin on public.approval_events for select to authenticated using(exists(select 1 from public.report_versions v where v.id=version_id and private.can_manage_report(v.report_id)));
create policy audit_admin on public.audit_logs for select to authenticated using(private.is_admin(company_id));
create policy analysis_admin on public.analysis_runs for select to authenticated using(exists(select 1 from public.report_versions v where v.id=version_id and private.can_manage_report(v.report_id)));

revoke all on all tables in schema public from anon, authenticated;
revoke all on all tables in schema private from public, anon, authenticated;
grant select on public.companies,public.profiles,public.investor_grants,public.reports,public.report_versions,public.financial_snapshots,public.import_jobs,public.approval_events,public.audit_logs,public.analysis_runs to authenticated;
grant insert,update,delete on public.reports to authenticated;
grant insert(report_id,financial_snapshot_id,version,content) on public.report_versions to authenticated;
grant update(content,financial_snapshot_id) on public.report_versions to authenticated;
-- State, approval fields and publication are server-only. The worker must set a
-- verified acting user context; trigger checks are still mandatory for BYPASSRLS.
grant select,insert,update,delete on all tables in schema public to service_role;
grant select,insert,update,delete on private.admin_memberships to service_role;

create function private.validate_snapshot() returns trigger
language plpgsql set search_path='' as $$
begin
  if new.data->>'period'<>to_char(new.period,'YYYY-MM') then raise exception 'Snapshot data period mismatch'; end if;
  if new.import_job_id is not null and not exists(select 1 from public.import_jobs j where j.id=new.import_job_id and j.company_id=new.company_id and j.period=new.period and j.status='validated') then raise exception 'Validated import required'; end if;
  new.checksum:=encode(sha256(convert_to(new.data::text,'UTF8')),'hex');
  return new;
end $$;
create trigger snapshot_validation before insert on public.financial_snapshots for each row execute function private.validate_snapshot();
create function private.reject_snapshot_mutation() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Financial snapshot is immutable'; end $$;
create trigger snapshot_immutable before update or delete on public.financial_snapshots for each row execute function private.reject_snapshot_mutation();

create function private.reject_log_mutation() returns trigger
language plpgsql set search_path='' as $$
begin raise exception 'Audit and approval events are append-only'; end $$;
create trigger audit_append_only before update or delete on public.audit_logs for each row execute function private.reject_log_mutation();
create trigger approval_append_only before update or delete on public.approval_events for each row execute function private.reject_log_mutation();
create trigger analysis_append_only before update or delete on public.analysis_runs for each row execute function private.reject_log_mutation();

create function private.guard_report_metadata() returns trigger
language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.report_versions v where v.report_id=old.id and v.state='published') then
    raise exception 'Published report metadata is immutable';
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger report_metadata_immutable before update or delete on public.reports for each row execute function private.guard_report_metadata();

create function private.guard_report_version() returns trigger
language plpgsql set search_path='' as $$
declare
  company uuid; reporting_period date; snapshot public.financial_snapshots; changed boolean; requested_state text;
begin
  if tg_op in ('UPDATE','DELETE') and old.state='published' then raise exception 'Published version is immutable'; end if;
  if tg_op='DELETE' then return old; end if;
  select r.company_id,r.period into company,reporting_period from public.reports r where r.id=new.report_id;
  if not private.is_admin(company) then raise exception 'Admin authorization required'; end if;
  select * into snapshot from public.financial_snapshots s where s.id=new.financial_snapshot_id;
  if snapshot.id is null or snapshot.company_id<>company or snapshot.period<>reporting_period then raise exception 'Snapshot company/period mismatch'; end if;
  if new.content->'financial' is distinct from snapshot.data then raise exception 'Financial content must equal immutable snapshot'; end if;
  if snapshot.data->>'period' <> to_char(reporting_period,'YYYY-MM') then raise exception 'Snapshot data period mismatch'; end if;
  new.content_hash:=encode(sha256(convert_to(new.content::text || new.financial_snapshot_id::text,'UTF8')),'hex');
  if tg_op='INSERT' then
    if new.state<>'draft' then raise exception 'New versions must start in draft'; end if;
    new.approved_hash:=null; new.approved_by:=null; new.approved_at:=null; new.published_at:=null;
    return new;
  end if;
  if new.report_id<>old.report_id or new.version<>old.version or new.id<>old.id then raise exception 'Version identity is immutable'; end if;
  requested_state:=new.state;
  changed:=new.content is distinct from old.content or new.financial_snapshot_id is distinct from old.financial_snapshot_id;
  if changed then
    if requested_state='published' then raise exception 'Changed content requires a new approval'; end if;
    new.state:='draft'; new.approved_hash:=null; new.approved_by:=null; new.approved_at:=null; new.reviewed_by:=null; new.reviewed_at:=null;
  elsif new.state<>old.state then
    if old.state='draft' and new.state='review' then
      new.reviewed_by:=auth.uid(); new.reviewed_at:=now();
    elsif old.state='review' and new.state='approved' then
      if old.reviewed_by is null then raise exception 'Human review required'; end if;
      new.approved_by:=auth.uid(); new.approved_at:=now(); new.approved_hash:=new.content_hash;
    elsif old.state='approved' and new.state='published' then
      if old.approved_by is null or old.approved_hash<>new.content_hash then raise exception 'Exact content approval required'; end if;
      new.published_at:=now();
    elsif old.state in ('review','approved') and new.state='draft' then
      new.approved_hash:=null; new.approved_by:=null; new.approved_at:=null; new.reviewed_by:=null; new.reviewed_at:=null;
    else raise exception 'Invalid workflow transition; review and approval required'; end if;
  elsif new.approved_hash is distinct from old.approved_hash or new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at or new.reviewed_by is distinct from old.reviewed_by or new.reviewed_at is distinct from old.reviewed_at or new.published_at is distinct from old.published_at then
    raise exception 'Workflow metadata requires a verified transition';
  end if;
  new.revision:=old.revision+1;
  return new;
end $$;
create trigger report_version_guard before insert or update or delete on public.report_versions for each row execute function private.guard_report_version();

-- Trigger-only privileged writes. No public executable RPC or client log insert.
create function private.audit_report_version() returns trigger
language plpgsql security definer set search_path='' as $$
declare company uuid;
begin
  select r.company_id into company from public.reports r where r.id=new.report_id;
  if auth.uid() is null or not private.is_admin(company) then raise exception 'Verified actor required for audit'; end if;
  insert into public.audit_logs(company_id,actor_id,action,record_id,metadata)
  values(company,auth.uid(),case when tg_op='INSERT' then 'create' else new.state end,new.id,jsonb_build_object('version',new.version,'checksum',new.content_hash,'revision',new.revision));
  if new.state='approved' and (tg_op='INSERT' or old.state<>'approved') then
    insert into public.approval_events(version_id,reviewer_id,approved_hash) values(new.id,auth.uid(),new.content_hash);
  end if;
  return new;
end $$;
create trigger report_version_audit after insert or update on public.report_versions for each row execute function private.audit_report_version();
revoke all on function private.validate_snapshot(),private.reject_snapshot_mutation(),private.reject_log_mutation(),private.guard_report_metadata(),private.guard_report_version(),private.audit_report_version() from public,anon,authenticated;
commit;
