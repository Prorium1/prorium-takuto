-- Private, imported fiscal context. No investor access or application write grants.
create table private.fiscal_briefing_context (
 company_id uuid not null references public.companies(id),
 fiscal_end_year integer not null check(fiscal_end_year between 2020 and 2099),
 context jsonb not null check(jsonb_typeof(context)='object' and octet_length(context::text)<=30000),
 retrieved_at timestamptz not null default now(),
 primary key(company_id,fiscal_end_year)
);
alter table private.fiscal_briefing_context enable row level security;
revoke all on private.fiscal_briefing_context from public,anon,authenticated,service_role;
create function private.get_fiscal_briefing(p_company uuid,p_year integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; m jsonb;
begin
 if p_year is null or p_year not between 2020 and 2099 or not coalesce(private.is_admin(p_company),false) then raise exception 'Admin authorization required'; end if;
 select context into c from private.fiscal_briefing_context where company_id=p_company and fiscal_end_year=p_year;
 if c is null then return null; end if;
 select jsonb_agg(jsonb_build_object('period',to_char(f.period,'YYYY-MM'),'retrievedAt',f.payload->'retrievedAt','monthly',f.payload->'monthly','previousYear',f.payload->'previousYear','bsTotals',f.payload->'statements'->'bsTotals','nativeClosedThrough',f.payload->'nativeClosedThrough','temporaryClosedThrough',f.payload->'temporaryClosedThrough') order by f.period) into m
 from private.executive_financials f where f.company_id=p_company and f.payload->>'basis'='monthly-net-v2' and f.period between make_date(p_year-1,11,1) and make_date(p_year,10,1) and f.period<date_trunc('month',timezone('Asia/Tokyo',now()))::date;
 if m is null then return null; end if;
 return jsonb_build_object('fiscalEndYear',p_year,'asOf',to_char(timezone('Asia/Tokyo',now()),'YYYY-MM-DD'),'months',m,'previousFiscalYear',c->'previousFiscalYear','outlook',c->'outlook');
end $$;
create function public.ir_get_fiscal_briefing(p_company uuid,p_year integer) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_fiscal_briefing(p_company,p_year) $$;
revoke all on function private.get_fiscal_briefing(uuid,integer),public.ir_get_fiscal_briefing(uuid,integer) from public,anon,service_role;
grant execute on function private.get_fiscal_briefing(uuid,integer),public.ir_get_fiscal_briefing(uuid,integer) to authenticated;
