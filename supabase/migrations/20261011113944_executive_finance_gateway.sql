-- Internal credentials are hashes; plaintext keys exist only in Vercel Production.
create table private.executive_gateway (
  company_id uuid primary key references public.companies(id),
  token_hash text not null check(length(token_hash)=64),
  enabled boolean not null default true,
  lease_owner uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
create table private.executive_financials (
  company_id uuid not null references public.companies(id),
  period date not null check(extract(day from period)=1),
  payload jsonb not null check(jsonb_typeof(payload)='object' and payload->>'basis'='monthly-net-v2' and payload->>'period'=to_char(period,'YYYY-MM')),
  retrieved_at timestamptz not null default now(),
  primary key(company_id,period)
);
alter table private.executive_gateway enable row level security;
alter table private.executive_financials enable row level security;
revoke all on private.executive_gateway,private.executive_financials from public,anon,authenticated;

-- Only the separately authenticated production gateway can call this service RPC.
create function public.ir_executive_gateway(p_token_hash text,p_action text,p_owner uuid,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare g private.executive_gateway; c private.freee_connections; item jsonb;
begin
  -- EXECUTE is granted only to service_role. The stored token hash is a second check.
  select * into g from private.executive_gateway where token_hash=p_token_hash and enabled=true for update;
  if g.company_id is null then raise exception 'Gateway access denied'; end if;
  if p_action='acquire' then
    if g.lease_until>now() then raise exception 'Sync already running'; end if;
    select * into c from private.freee_connections where company_id=g.company_id;
    if c.company_id is null then raise exception 'Freee connection required'; end if;
    update private.executive_gateway set lease_owner=p_owner,lease_until=now()+interval '2 minutes' where company_id=g.company_id;
    return jsonb_build_object('companyId',g.company_id,'freeeCompanyId',c.freee_company_id,'ciphertext',c.token_ciphertext);
  end if;
  if g.lease_owner is distinct from p_owner or g.lease_until<=now() then raise exception 'Sync lease required'; end if;
  if p_action='rotate' then
    if length(p_payload->>'ciphertext') not between 40 and 16000 or (p_payload->>'expiresAt')::timestamptz<=now() then raise exception 'Invalid token rotation'; end if;
    update private.freee_connections set token_ciphertext=p_payload->>'ciphertext',expires_at=(p_payload->>'expiresAt')::timestamptz,updated_at=now() where company_id=g.company_id;
    return '{}'::jsonb;
  elsif p_action='store' then
    for item in select * from jsonb_array_elements(p_payload->'months') loop
      if item->>'basis'<>'monthly-net-v2' or octet_length(item::text)>100000 then raise exception 'Invalid monthly source'; end if;
      insert into private.executive_financials(company_id,period,payload) values(g.company_id,(item->>'period'||'-01')::date,item)
      on conflict(company_id,period) do update set payload=excluded.payload,retrieved_at=now();
    end loop;
    return '{}'::jsonb;
  elsif p_action='release' then
    update private.executive_gateway set lease_owner=null,lease_until=null,updated_at=now() where company_id=g.company_id;
    return '{}'::jsonb;
  end if;
  raise exception 'Invalid gateway action';
end $$;
revoke all on function public.ir_executive_gateway(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.ir_executive_gateway(text,text,uuid,jsonb) to service_role;

-- Legacy closing-balance imports must not be reviewed or published as monthly results.
create or replace function private.validate_content(c jsonb) returns void language plpgsql set search_path='' as $$
declare metric text; f jsonb; item jsonb; section text;
begin
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'Invalid report content'; end if;
 if octet_length(c::text)>200000 or exists(select 1 from jsonb_object_keys(c) k where k not in ('financial','summary','financialAnalysis','revenueDrivers','profitDrivers','highlights','briefing','eventSpotlight','ai','forward','risks','ceo','documents')) then raise exception 'Invalid report content'; end if;
 f:=c->'financial';
 if f ? 'plBasis' and f->>'plBasis' is distinct from 'monthly-net-v2' then raise exception 'Invalid P/L basis'; end if;
 if f->'isMock' is distinct from 'false'::jsonb or f->>'currency' is distinct from 'JPY' or coalesce(f->>'source','') not in ('management-entry','not-entered','freee') or jsonb_typeof(f->'available') is distinct from 'boolean' then raise exception 'Production requires validated financial provenance'; end if;
 if (f->>'source'='not-entered') is distinct from (f->'available'='false'::jsonb) then raise exception 'Invalid financial availability'; end if;
 foreach metric in array array['id','period','currency','source','updatedAt'] loop
  if jsonb_typeof(f->metric) is distinct from 'string' then raise exception 'Invalid financial metadata'; end if;
 end loop;
 perform (f->>'updatedAt')::timestamptz;
 perform private.validate_text_fields(f-array['id','period','currency','source','updatedAt','revenue','operatingProfit','ordinaryProfit','cash','trend','assets','liabilities','equity','monthlyFixedCosts','isMock','available','plBasis'],array[]::text[]);
 foreach metric in array array['revenue','operatingProfit','ordinaryProfit','cash'] loop
  perform private.validate_text_fields((f->metric)-array['current','previous'],array['status'],100);
  foreach section in array array['current','previous'] loop
   if jsonb_typeof(f->metric->section) is distinct from 'number' or coalesce(f->metric->>section,'') !~ '^-?[0-9]+$' then raise exception 'Invalid financial amount'; end if;
   if abs((f->metric->>section)::numeric)>100000000000000 or (metric in ('revenue','cash') and (f->metric->>section)::numeric<0) then raise exception 'Invalid financial amount bounds'; end if;
  end loop;
 end loop;
 foreach metric in array array['assets','liabilities','equity','monthlyFixedCosts'] loop
  if jsonb_typeof(f->metric) is distinct from 'number' or coalesce(f->>metric,'') !~ '^-?[0-9]+$' then raise exception 'Invalid financial position'; end if;
  if abs((f->>metric)::numeric)>100000000000000 or (metric<>'equity' and (f->>metric)::numeric<0) then raise exception 'Invalid financial position bounds'; end if;
 end loop;
 if (f->>'assets')::numeric<>(f->>'liabilities')::numeric+(f->>'equity')::numeric then raise exception 'Invalid financial position balance'; end if;
 if jsonb_typeof(f->'trend') is distinct from 'array' then raise exception 'Invalid financial trend'; end if;
 if jsonb_array_length(f->'trend')>24 then raise exception 'Invalid financial trend length'; end if;
 for item in select * from jsonb_array_elements(f->'trend') loop
  perform private.validate_text_fields(item-array['revenue','previousRevenue','profit','previousProfit'],array['month'],30);
  foreach metric in array array['revenue','previousRevenue','profit','previousProfit'] loop
   if jsonb_typeof(item->metric) is distinct from 'number' or coalesce(item->>metric,'') !~ '^-?[0-9]+$' then raise exception 'Invalid financial trend amount'; end if;
   if abs((item->>metric)::numeric)>100000000000000 then raise exception 'Invalid financial trend bounds'; end if;
  end loop;
 end loop;
 perform private.validate_text_fields((c->'summary')-'points',array['headline','text','outlook']);
 perform private.validate_text_fields(c->'ceo',array['quote','message','name','title']);
 perform private.validate_text_fields(jsonb_build_object('financialAnalysis',c->'financialAnalysis'),array['financialAnalysis']);
 if jsonb_typeof(c->'summary'->'points') is distinct from 'array' then raise exception 'Invalid summary points'; end if;
 if jsonb_array_length(c->'summary'->'points')>5 or exists(select 1 from jsonb_array_elements(c->'summary'->'points') p where jsonb_typeof(p)<>'string' or length(p#>>'{}')>300) then raise exception 'Invalid summary points'; end if;
 foreach section in array array['revenueDrivers','profitDrivers','highlights','forward','risks','documents'] loop
  if jsonb_typeof(c->section) is distinct from 'array' then raise exception 'Invalid content sections: %',section; end if;
  if jsonb_array_length(c->section)>100 then raise exception 'Invalid section length'; end if;
 end loop;
 foreach section in array array['revenueDrivers','profitDrivers'] loop
  for item in select * from jsonb_array_elements(c->section) loop
   perform private.validate_text_fields(item-'amount',array['label','description']);
   if jsonb_typeof(item->'amount') is distinct from 'number' or coalesce(item->>'amount','') !~ '^-?[0-9]+$' then raise exception 'Invalid driver amount'; end if;
   if abs((item->>'amount')::numeric)>200000000000000 then raise exception 'Invalid driver amount bounds'; end if;
  end loop;
 end loop;
 for item in select * from jsonb_array_elements(c->'highlights') loop
  perform private.validate_text_fields(item,array['id','title','business_unit','metric','metric_value','description','status','period']);
 end loop;
 if c ? 'briefing' then
  if jsonb_typeof(c->'briefing') is distinct from 'array' or jsonb_array_length(c->'briefing')>24 then raise exception 'Invalid briefing'; end if;
  for item in select * from jsonb_array_elements(c->'briefing') loop
   perform private.validate_text_fields(item,array['id','topic','kind','title','body']);
   if item->>'topic' not in ('development','people','funding','pr','other','asks','market','services','customers') or item->>'kind' not in ('Actual','Committed','Forecast','Pipeline') or length(item->>'title')>120 or length(item->>'body')>2000 then raise exception 'Invalid briefing item'; end if;
   perform (item->>'id')::uuid;
  end loop;
 end if;

 if c ? 'eventSpotlight' and c->'eventSpotlight' <> 'null'::jsonb then
  item:=c->'eventSpotlight';
  perform private.validate_text_fields(item-'outcomes',array['title','occurredOn','summary','nextAction','videoUrl','videoTitle']);
  if length(btrim(item->>'title'))=0 or length(item->>'title')>120 or length(btrim(item->>'summary'))=0 or length(item->>'summary')>2000 or length(item->>'nextAction')>500 or length(item->>'videoTitle')>120 or length(item->>'videoUrl')>500 then raise exception 'Invalid event text'; end if;
  if item->>'occurredOn' !~ '^20[0-9]{2}-(0[1-9]|1[0-2])-[0-9]{2}$' then raise exception 'Invalid event date'; end if;
  if (item->>'occurredOn')::date > ((f->>'period')||'-01')::date + interval '1 month' - interval '1 day' then raise exception 'Event must have occurred by report period'; end if;
  if jsonb_typeof(item->'outcomes') is distinct from 'array' then raise exception 'Invalid event outcomes'; end if;
  if jsonb_array_length(item->'outcomes')>4 or exists(select 1 from jsonb_array_elements(item->'outcomes') v where jsonb_typeof(v)<>'string' or length(btrim(v#>>'{}'))=0 or length(v#>>'{}')>300) then raise exception 'Invalid event outcomes'; end if;
  if item->>'videoUrl' <> '' and (length(btrim(item->>'videoTitle'))=0 or (item->>'videoUrl' !~ '^https://www[.]youtube[.]com/watch[?]v=[A-Za-z0-9_-]{11}$' and item->>'videoUrl' !~ '^https://vimeo[.]com/[0-9]{1,12}(/[A-Za-z0-9]{6,64})?$')) then raise exception 'Invalid event video'; end if;
 end if;
 for item in select * from jsonb_array_elements(c->'forward') loop
  perform private.validate_text_fields(item,array['id','kind','title','value','description','timing']);
  if item->>'kind' not in ('Actual','Committed','Forecast','Pipeline') then raise exception 'Future classification required'; end if;
 end loop;
 for item in select * from jsonb_array_elements(c->'risks') loop
  perform private.validate_text_fields(item,array['id','title','impact','description','action','owner','due']);
  if item->>'impact' not in ('高','中','低') then raise exception 'Invalid risk impact'; end if;
 end loop;
 perform private.validate_text_fields((c->'ai')-array['revenue','efficiency'],array['narrative','attributionNote']);
 foreach section in array array['revenue','efficiency'] loop
  if jsonb_typeof(c->'ai'->section) is distinct from 'array' then raise exception 'Invalid AI section'; end if;
  if jsonb_array_length(c->'ai'->section)>24 then raise exception 'Invalid AI section length'; end if;
  for item in select * from jsonb_array_elements(c->'ai'->section) loop
   perform private.validate_text_fields(item-array['value','unit'],array['key','label','description']);
   if coalesce(item->>'unit','') not in ('JPY','%','hours') or jsonb_typeof(item->'value') is distinct from 'number' then raise exception 'Invalid AI KPI'; end if;
   if abs((item->>'value')::numeric)>100000000000000 then raise exception 'Invalid AI KPI bounds'; end if;
  end loop;
 end loop;
end $$;
create function private.guard_monthly_finance_basis() returns trigger language plpgsql set search_path='' as $$
begin
  if (new.state<>'draft' or tg_op='INSERT') and new.content->'financial'->>'source'='freee' and new.content->'financial'->>'plBasis' is distinct from 'monthly-net-v2' then
    raise exception 'Monthly freee basis correction required';
  end if;
  return new;
end $$;
create trigger guard_monthly_finance_basis before insert or update on public.report_versions for each row execute function private.guard_monthly_finance_basis();

create function public.ir_correct_freee_month(p_id uuid,p_revision integer,p_confirm boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v public.report_versions; r public.reports; source private.executive_financials; f jsonb; c jsonb; snapshot uuid:=gen_random_uuid(); metric text;
begin
  v:=private.lock_version(p_id,p_revision);
  select * into r from public.reports where id=v.report_id;
  if p_confirm is distinct from true or v.state<>'draft' or v.content->'financial'->>'source' is distinct from 'freee' then raise exception 'Monthly correction confirmation required'; end if;
  select * into source from private.executive_financials where company_id=r.company_id and period=r.period;
  if source.period is null or source.payload->'previousYear'='null'::jsonb then raise exception 'Monthly sources required'; end if;
  f:=v.content->'financial';
  foreach metric in array array['revenue','operatingProfit','ordinaryProfit'] loop
    f:=jsonb_set(f,array[metric,'current'],source.payload->'monthly'->metric);
    f:=jsonb_set(f,array[metric,'previous'],source.payload->'previousYear'->metric);
    f:=jsonb_set(f,array[metric,'status'],to_jsonb('freee・単月確認済み'::text));
  end loop;
  f:=jsonb_set(f,'{plBasis}',to_jsonb('monthly-net-v2'::text));
  f:=jsonb_set(f,'{id}',to_jsonb(snapshot::text));
  f:=jsonb_set(f,'{updatedAt}',source.payload->'retrievedAt');
  f:=jsonb_set(f,'{trend}',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(s.period,'YY/MM'),'revenue',s.payload->'monthly'->'revenue','previousRevenue',s.payload->'previousYear'->'revenue','profit',s.payload->'monthly'->'operatingProfit','previousProfit',s.payload->'previousYear'->'operatingProfit') order by s.period) from private.executive_financials s where s.company_id=r.company_id and s.period<=r.period and s.period>=date_trunc('month',r.period)-interval '11 months' and s.payload->'previousYear' is not null and s.payload->'previousYear'<>'null'::jsonb),'[]'::jsonb));
  c:=jsonb_set(v.content,'{financial}',f);
  c:=jsonb_set(c,'{revenueDrivers}','[]'::jsonb); c:=jsonb_set(c,'{profitDrivers}','[]'::jsonb);
  perform private.validate_content(c);
  insert into public.financial_snapshots(id,company_id,period,source,is_synthetic,data) values(snapshot,r.company_id,r.period,'freee',false,f);
  update public.report_versions set content=c,financial_snapshot_id=snapshot,context_required=true where id=p_id;
  insert into public.audit_logs(company_id,actor_id,action,record_id,metadata) values(r.company_id,auth.uid(),'freee-monthly-basis-corrected',p_id,jsonb_build_object('snapshotId',snapshot,'basis','monthly-net-v2'));
end $$;
revoke all on function public.ir_correct_freee_month(uuid,integer,boolean),private.guard_monthly_finance_basis() from public,anon;
grant execute on function public.ir_correct_freee_month(uuid,integer,boolean) to authenticated;
