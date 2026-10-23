-- Extend the existing tenant-admin-only read projection; no report writes or new grants.
create or replace function private.get_fiscal_briefing(p_company uuid,p_year integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c jsonb; m jsonb;
begin
 if p_year is null or p_year not between 2020 and 2099 or not coalesce(private.is_admin(p_company),false) then raise exception 'Admin authorization required'; end if;
 select context into c from private.fiscal_briefing_context where company_id=p_company and fiscal_end_year=p_year;
 if c is null then return null; end if;
 select jsonb_agg(jsonb_build_object('period',to_char(f.period,'YYYY-MM'),'retrievedAt',f.payload->'retrievedAt','monthly',f.payload->'monthly','previousYear',f.payload->'previousYear','bsTotals',f.payload->'statements'->'bsTotals','nativeClosedThrough',f.payload->'nativeClosedThrough','temporaryClosedThrough',f.payload->'temporaryClosedThrough') order by f.period) into m
 from private.executive_financials f where f.company_id=p_company and f.payload->>'basis'='monthly-net-v2' and f.period between make_date(p_year-1,11,1) and make_date(p_year,10,1) and f.period<date_trunc('month',timezone('Asia/Tokyo',now()))::date;
 if m is null then return null; end if;
 return jsonb_build_object('fiscalEndYear',p_year,'asOf',to_char(timezone('Asia/Tokyo',now()),'YYYY-MM-DD'),'months',m,'previousFiscalYear',c->'previousFiscalYear','outlook',c->'outlook')
 || case when c ? 'managementSummary' then jsonb_build_object('managementSummary',c->'managementSummary') else '{}'::jsonb end;
end $$;
