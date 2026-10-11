-- An MFA admin attests to the accounting close, category mapping and cash accounts.
-- Promotion creates a new immutable source snapshot and an unpublished report in one transaction.
create function private.promote_freee_stage(p_stage uuid,p_content jsonb,p_confirm_close boolean,p_confirm_category boolean,p_confirm_cash boolean) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare s private.freee_staged_financials; c jsonb; f jsonb; metric text; section text; job uuid; snapshot uuid; report uuid; version public.report_versions;
begin
 select * into s from private.freee_staged_financials where id=p_stage;
 if s.id is null or not private.is_admin(s.company_id) then raise exception 'Admin MFA required'; end if;
 if p_confirm_close is distinct from true or p_confirm_category is distinct from true or p_confirm_cash is distinct from true then raise exception 'Management source confirmation required'; end if;
 c:=s.candidate; f:=p_content->'financial';
 if c->>'completeness'='month-to-date' then raise exception 'Incomplete month cannot become a monthly report'; end if;
 perform private.validate_content(p_content);
 if f->>'source' is distinct from 'freee' or f->'available' is distinct from 'true'::jsonb or f->>'period' is distinct from to_char(s.period,'YYYY-MM') or jsonb_array_length(p_content->'documents')<>0 then raise exception 'Invalid freee report source'; end if;
 foreach metric in array array['revenue','operatingProfit','ordinaryProfit','cash'] loop
  foreach section in array array['current','previous'] loop
   if (f->metric->>section)::numeric is distinct from (c->metric->>section)::numeric then raise exception 'Staged KPI mismatch: %',metric; end if;
  end loop;
 end loop;
 foreach metric in array array['assets','liabilities','equity'] loop
  if (f->>metric)::numeric is distinct from (c->>metric)::numeric then raise exception 'Staged position mismatch: %',metric; end if;
 end loop;
 if jsonb_array_length(p_content->'revenueDrivers')<>1 or jsonb_array_length(p_content->'profitDrivers')<>1 then raise exception 'Management change reasons required'; end if;
 if length(trim(p_content->'revenueDrivers'->0->>'description'))<10 or length(trim(p_content->'profitDrivers'->0->>'description'))<10 then raise exception 'Management change reasons required'; end if;
 if (p_content->'revenueDrivers'->0->>'amount')::numeric<>(c->'revenue'->>'current')::numeric-(c->'revenue'->>'previous')::numeric or (p_content->'profitDrivers'->0->>'amount')::numeric<>(c->'operatingProfit'->>'current')::numeric-(c->'operatingProfit'->>'previous')::numeric then raise exception 'Financial drivers must reconcile'; end if;
 insert into public.reports(company_id,period) values(s.company_id,s.period) returning id into report;
 insert into public.import_jobs(company_id,period,source,is_synthetic,status,validation_result)
 values(s.company_id,s.period,'freee',false,'validated',jsonb_build_object('stageId',s.id,'sourceChecksum',s.checksum,'closeConfirmed',true,'categoryConfirmed',true,'cashConfirmed',true,'confirmedBy',auth.uid(),'confirmedAt',now())) returning id into job;
 snapshot:=(f->>'id')::uuid;
 insert into public.financial_snapshots(id,company_id,period,import_job_id,source,is_synthetic,data) values(snapshot,s.company_id,s.period,job,'freee',false,f);
 insert into public.report_versions(report_id,financial_snapshot_id,version,content,analysis) values(report,snapshot,'v1.0',p_content,'human-authored') returning * into version;
 insert into public.audit_logs(company_id,actor_id,action,record_id,metadata) values(s.company_id,auth.uid(),'freee-stage-promoted',version.id,jsonb_build_object('stageId',s.id,'sourceChecksum',s.checksum,'importJobId',job,'snapshotId',snapshot));
 return version;
end $$;
create function public.ir_promote_freee_stage(p_stage uuid,p_content jsonb,p_confirm_close boolean,p_confirm_category boolean,p_confirm_cash boolean) returns public.report_versions language sql security invoker set search_path='' as $$ select private.promote_freee_stage(p_stage,p_content,p_confirm_close,p_confirm_category,p_confirm_cash) $$;
revoke all on function private.promote_freee_stage(uuid,jsonb,boolean,boolean,boolean),public.ir_promote_freee_stage(uuid,jsonb,boolean,boolean,boolean) from public,anon;
grant execute on function private.promote_freee_stage(uuid,jsonb,boolean,boolean,boolean),public.ir_promote_freee_stage(uuid,jsonb,boolean,boolean,boolean) to authenticated;
