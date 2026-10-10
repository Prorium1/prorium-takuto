-- A closed accounting month may enter a private draft before management writes
-- its fixed-cost and variance commentary. No review or publication is possible
-- until that context is completed through the authenticated RPC below.
alter table public.report_versions
  add column context_required boolean not null default false,
  add constraint report_context_required_draft_only check (not context_required or state = 'draft');

create function private.promote_freee_stage_pending(
  p_stage uuid, p_content jsonb,
  p_confirm_close boolean, p_confirm_category boolean, p_confirm_cash boolean
) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare v public.report_versions;
begin
  v := private.promote_freee_stage(p_stage,p_content,p_confirm_close,p_confirm_category,p_confirm_cash);
  update public.report_versions set context_required=true where id=v.id returning * into v;
  insert into public.audit_logs(company_id,actor_id,action,record_id,metadata)
    select r.company_id,auth.uid(),'freee-context-pending',v.id,jsonb_build_object('stageId',p_stage)
    from public.reports r where r.id=v.report_id;
  return v;
end $$;

create function private.complete_freee_context(
  p_id uuid,p_revision integer,p_fixed_costs bigint,p_revenue_reason text,p_profit_reason text
) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare v public.report_versions; c jsonb; f jsonb; new_snapshot uuid:=gen_random_uuid(); company uuid; report_period date; revenue_delta numeric; profit_delta numeric;
begin
  v:=private.lock_version(p_id,p_revision);
  if not v.context_required or v.content->'financial'->>'source' <> 'freee' then raise exception 'No pending freee context'; end if;
  if p_fixed_costs is null or p_fixed_costs<0 or p_fixed_costs>100000000000000 then raise exception 'Valid fixed costs required'; end if;
  if length(btrim(coalesce(p_revenue_reason,'')))<10 or length(btrim(coalesce(p_profit_reason,'')))<10 or length(p_revenue_reason)>900 or length(p_profit_reason)>900 then raise exception 'Management change reasons required'; end if;
  c:=v.content; f:=c->'financial';
  revenue_delta:=(f->'revenue'->>'current')::numeric-(f->'revenue'->>'previous')::numeric;
  profit_delta:=(f->'operatingProfit'->>'current')::numeric-(f->'operatingProfit'->>'previous')::numeric;
  f:=jsonb_set(jsonb_set(f,'{id}',to_jsonb(new_snapshot::text)),'{monthlyFixedCosts}',to_jsonb(p_fixed_costs));
  c:=jsonb_set(c,'{financial}',f);
  c:=jsonb_set(c,'{revenueDrivers}',jsonb_build_array(jsonb_build_object('label','経営者の確認','amount',revenue_delta,'description',btrim(p_revenue_reason))));
  c:=jsonb_set(c,'{profitDrivers}',jsonb_build_array(jsonb_build_object('label','経営者の確認','amount',profit_delta,'description',btrim(p_profit_reason))));
  c:=jsonb_set(c,'{financialAnalysis}',to_jsonb('売上の変化: '||btrim(p_revenue_reason)||E'\n'||'営業利益の変化: '||btrim(p_profit_reason)));
  perform private.validate_content(c);
  select r.company_id,r.period into company,report_period from public.reports r where r.id=v.report_id;
  insert into public.financial_snapshots(id,company_id,period,source,is_synthetic,data)
    values(new_snapshot,company,report_period,'freee',false,f);
  update public.report_versions
    set content=c,financial_snapshot_id=new_snapshot,context_required=false,analysis='human-authored'
    where id=p_id returning * into v;
  insert into public.audit_logs(company_id,actor_id,action,record_id,metadata)
    values(company,auth.uid(),'freee-context-completed',p_id,jsonb_build_object('snapshotId',new_snapshot));
  return v;
end $$;

create function public.ir_promote_freee_stage_pending(
  p_stage uuid,p_content jsonb,p_confirm_close boolean,p_confirm_category boolean,p_confirm_cash boolean
) returns public.report_versions language sql security invoker set search_path='' as $$
  select private.promote_freee_stage_pending(p_stage,p_content,p_confirm_close,p_confirm_category,p_confirm_cash)
$$;
create function public.ir_complete_freee_context(
  p_id uuid,p_revision integer,p_fixed_costs bigint,p_revenue_reason text,p_profit_reason text
) returns public.report_versions language sql security invoker set search_path='' as $$
  select private.complete_freee_context(p_id,p_revision,p_fixed_costs,p_revenue_reason,p_profit_reason)
$$;
revoke all on function private.promote_freee_stage_pending(uuid,jsonb,boolean,boolean,boolean),private.complete_freee_context(uuid,integer,bigint,text,text),public.ir_promote_freee_stage_pending(uuid,jsonb,boolean,boolean,boolean),public.ir_complete_freee_context(uuid,integer,bigint,text,text) from public,anon;
grant execute on function private.promote_freee_stage_pending(uuid,jsonb,boolean,boolean,boolean),private.complete_freee_context(uuid,integer,bigint,text,text),public.ir_promote_freee_stage_pending(uuid,jsonb,boolean,boolean,boolean),public.ir_complete_freee_context(uuid,integer,bigint,text,text) to authenticated;
