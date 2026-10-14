-- Source imports are held in Production only. Investors read published reports,
-- never this staging table. Saving to a report still requires its admin workflow.
create table private.ownership_imports (
  company_id uuid primary key references public.companies(id),
  source text not null default 'smartround' check(source='smartround'),
  snapshot jsonb not null,
  retrieved_at timestamptz not null default now()
);
alter table private.ownership_imports enable row level security;
revoke all on private.ownership_imports from public,anon,authenticated,service_role;

create function private.validate_ownership_import() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform private.validate_ownership(new.snapshot);
  if new.retrieved_at > now() + interval '1 minute' then raise exception 'Invalid ownership import timestamp'; end if;
  return new;
end $$;
create trigger ownership_import_validation before insert or update on private.ownership_imports
for each row execute function private.validate_ownership_import();
revoke all on function private.validate_ownership_import() from public,anon,authenticated,service_role;

create function private.get_ownership_import(p_company uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
  if not coalesce(private.is_admin(p_company),false) then raise exception 'Admin authorization required'; end if;
  select jsonb_build_object('snapshot',s.snapshot,'retrievedAt',s.retrieved_at)
    into result from private.ownership_imports s where s.company_id=p_company;
  return result;
end $$;
create function public.ir_get_ownership_import(p_company uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_ownership_import(p_company) $$;
revoke all on function private.get_ownership_import(uuid),public.ir_get_ownership_import(uuid) from public,anon;
grant execute on function private.get_ownership_import(uuid),public.ir_get_ownership_import(uuid) to authenticated;
