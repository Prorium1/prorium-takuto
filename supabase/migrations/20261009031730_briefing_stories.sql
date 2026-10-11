-- Investor briefing stories extend the immutable report content schema.
create or replace function private.validate_content(c jsonb) returns void language plpgsql set search_path='' as $$
declare metric text; f jsonb; item jsonb; section text;
begin
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'Invalid report content'; end if;
 if octet_length(c::text)>200000 or exists(select 1 from jsonb_object_keys(c) k where k not in ('financial','summary','financialAnalysis','revenueDrivers','profitDrivers','highlights','briefing','ai','forward','risks','ceo','documents')) then raise exception 'Invalid report content'; end if;
 f:=c->'financial';
 if f->'isMock' is distinct from 'false'::jsonb or f->>'currency' is distinct from 'JPY' or coalesce(f->>'source','') not in ('management-entry','not-entered','freee') or jsonb_typeof(f->'available') is distinct from 'boolean' then raise exception 'Production requires validated financial provenance'; end if;
 if (f->>'source'='not-entered') is distinct from (f->'available'='false'::jsonb) then raise exception 'Invalid financial availability'; end if;
 foreach metric in array array['id','period','currency','source','updatedAt'] loop
  if jsonb_typeof(f->metric) is distinct from 'string' then raise exception 'Invalid financial metadata'; end if;
 end loop;
 perform (f->>'updatedAt')::timestamptz;
 perform private.validate_text_fields(f-array['id','period','currency','source','updatedAt','revenue','operatingProfit','ordinaryProfit','cash','trend','assets','liabilities','equity','monthlyFixedCosts','isMock','available'],array[]::text[]);
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
