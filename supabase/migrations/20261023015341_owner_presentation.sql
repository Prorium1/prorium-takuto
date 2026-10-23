-- Read-only facts for a private owner presentation. No report mutation or publication.
create function private.get_presentation_source(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.reports; s private.executive_financials;
begin
  select reports.* into r from public.reports reports join public.report_versions v on v.report_id=reports.id where v.id=p_id;
  if r.id is null or not coalesce(private.is_admin(r.company_id),false) then raise exception 'Admin authorization required'; end if;
  select * into s from private.executive_financials where company_id=r.company_id and period=r.period;
  if s.company_id is null then return null; end if;
  return jsonb_build_object(
    'period',to_char(r.period,'YYYY-MM'),'basis',s.payload->'basis','retrievedAt',s.payload->'retrievedAt',
    'monthly',s.payload->'monthly','previousYear',s.payload->'previousYear','bsTotals',s.payload->'statements'->'bsTotals',
    'trend',(select coalesce(jsonb_agg(jsonb_build_object('period',to_char(f.period,'YYYY-MM'),'retrievedAt',f.payload->'retrievedAt','revenue',f.payload->'monthly'->'revenue','profit',f.payload->'monthly'->'operatingProfit','previousRevenue',f.payload->'previousYear'->'revenue','previousProfit',f.payload->'previousYear'->'operatingProfit') order by f.period),'[]'::jsonb)
      from private.executive_financials f where f.company_id=r.company_id and f.period between r.period-interval '11 months' and r.period and f.payload->'previousYear' is not null and f.payload->'previousYear'<>'null'::jsonb));
end $$;
create function public.ir_get_presentation_source(p_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select private.get_presentation_source(p_id) $$;
revoke all on function private.get_presentation_source(uuid),public.ir_get_presentation_source(uuid) from public,anon;
grant execute on function private.get_presentation_source(uuid),public.ir_get_presentation_source(uuid) to authenticated;
