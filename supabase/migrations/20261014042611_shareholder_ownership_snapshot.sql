-- Optional ownership shares the report's existing human approval, content hash,
-- immutable publication and tenant RLS. No new data, grants or tables.
create function private.validate_ownership(o jsonb) returns void
language plpgsql security invoker set search_path='' as $$
declare row jsonb; total numeric:=0; value numeric; key text;
begin
  perform private.validate_text_fields(o-array['issuedShares','rows'],array['asOf','basis','display','sourceLabel','notes']);
  if o->>'basis' is distinct from 'issued-shares' or o->>'display' not in ('grouped','named') then raise exception 'Invalid ownership basis or display'; end if;
  if o->>'asOf' !~ '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' then raise exception 'Invalid ownership date'; end if;
  if (o->>'asOf')::date > (now() at time zone 'Asia/Tokyo')::date then raise exception 'Ownership date must not be future'; end if;
  if length(btrim(o->>'sourceLabel')) not between 2 and 120 or length(o->>'notes')>600 then raise exception 'Invalid ownership source or notes'; end if;
  if jsonb_typeof(o->'issuedShares') is distinct from 'number' or coalesce(o->>'issuedShares','') !~ '^[0-9]+$' then raise exception 'Invalid ownership issued shares'; end if;
  if (o->>'issuedShares')::numeric not between 1 and 1000000000000 then raise exception 'Invalid ownership issued shares'; end if;
  if jsonb_typeof(o->'rows') is distinct from 'array' then raise exception 'Invalid ownership rows'; end if;
  if jsonb_array_length(o->'rows') not between 1 and 40 then raise exception 'Invalid ownership rows length'; end if;
  for row in select * from jsonb_array_elements(o->'rows') loop
    perform private.validate_text_fields(row-'shares',array['group','name','shareClass']);
    if row->>'group' not in ('founder','team','fund','corporate','individual','other','treasury') then raise exception 'Invalid ownership group'; end if;
    if length(row->>'name')>100 or length(btrim(row->>'shareClass')) not between 1 and 80 then raise exception 'Invalid ownership row text'; end if;
    if o->>'display'='named' and length(btrim(row->>'name'))=0 then raise exception 'Ownership name required'; end if;
    if o->>'display'='grouped' and row->>'name'<>'' then raise exception 'Grouped ownership must omit names'; end if;
    if jsonb_typeof(row->'shares') is distinct from 'number' or coalesce(row->>'shares','') !~ '^[0-9]+$' then raise exception 'Invalid ownership shares'; end if;
    value:=(row->>'shares')::numeric;
    if value not between 1 and 1000000000000 then raise exception 'Invalid ownership shares'; end if;
    total:=total+value;
  end loop;
  if total<>(o->>'issuedShares')::numeric then raise exception 'Ownership shares total mismatch'; end if;
end $$;
revoke all on function private.validate_ownership(jsonb) from public,anon,authenticated;

-- Preserve the current monthly financial, narrative and attachment validators.
create or replace function private.validate_content(c jsonb) returns void language plpgsql set search_path='' as $$
declare metric text; f jsonb; item jsonb; section text;
begin
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'Invalid report content'; end if;
 if octet_length(c::text)>200000 or exists(select 1 from jsonb_object_keys(c) k where k not in ('financial','summary','financialAnalysis','revenueDrivers','profitDrivers','highlights','briefing','eventSpotlight','ai','forward','risks','ceo','documents','ownership')) then raise exception 'Invalid report content'; end if;
 if c ? 'ownership' and c->'ownership' <> 'null'::jsonb then perform private.validate_ownership(c->'ownership'); end if;
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
