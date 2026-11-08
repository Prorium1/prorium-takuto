-- Investor-facing annual snapshots. Raw owner sources remain private.
create table public.fiscal_publications (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 fiscal_end_year integer not null check(fiscal_end_year between 2020 and 2099),
 version integer not null check(version>0), revision integer not null default 1,
 state text not null default 'draft' check(state in ('draft','review','approved','published')),
 content jsonb not null check(jsonb_typeof(content)='object' and octet_length(content::text)<=200000),
 content_hash text not null default '', review_hash text, approved_hash text,
 approved_by uuid references auth.users(id), approved_at timestamptz, published_at timestamptz,
 created_at timestamptz not null default now(),
 unique(company_id,fiscal_end_year,version)
);
create unique index fiscal_publication_one_draft on public.fiscal_publications(company_id,fiscal_end_year) where state<>'published';
alter table public.fiscal_publications enable row level security;
revoke all on public.fiscal_publications from public,anon,authenticated,service_role;
grant select on public.fiscal_publications to authenticated;
create policy fiscal_publication_read on public.fiscal_publications for select to authenticated
 using(private.is_admin(company_id) or (state='published' and private.has_investor_grant(company_id)));

-- ECMAScript String.trim whitespace; Zod 4.6 uses Unicode code-point lengths.
create function private.fiscal_trim(t text) returns text language sql immutable set search_path='' as $$
 select btrim(t,U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')
$$;

create function private.valid_fiscal_editor(e jsonb) returns boolean
language plpgsql immutable set search_path='' as $$
declare o jsonb; k text; v jsonb;
begin
 if e is null or jsonb_typeof(e)<>'object' or (e-array['organization','notes'])<>'{}'::jsonb then return false;end if;
 o:=e->'organization';
 if o is null or jsonb_typeof(o)<>'object' or (o-array['asOf','employees','onLeave','partTime','directors','contractors','confirmed','sourceLabel','note','areas'])<>'{}'::jsonb then return false;end if;
 if coalesce(o->>'asOf','')!~'^20[0-9]{2}-[0-9]{2}-[0-9]{2}$' or jsonb_typeof(o->'confirmed') is distinct from 'boolean' or coalesce(length(o->>'sourceLabel'),0) not between 2 and 160 or coalesce(length(o->>'note'),1201)>1200 or jsonb_typeof(o->'areas') is distinct from 'array' then return false;end if;
 perform (o->>'asOf')::date;
 foreach k in array array['employees','onLeave','partTime','directors','contractors'] loop
  if not(o?k) or (o->k<>'null'::jsonb and (jsonb_typeof(o->k)<>'number' or (o->>k)!~'^[0-9]+$' or (o->>k)::numeric>100000)) then return false;end if;
 end loop;
 if (o->>'onLeave')::integer>(o->>'employees')::integer then return false;end if;
 if jsonb_array_length(o->'areas')>15 then return false;end if;
 for v in select value from jsonb_array_elements(o->'areas') loop
  if jsonb_typeof(v)<>'string' or length(v#>>'{}') not between 1 and 80 then return false;end if;
 end loop;
 if jsonb_typeof(e->'notes') is distinct from 'object' or ((e->'notes')-array['development','hiring','requests','risks'])<>'{}'::jsonb then return false;end if;
 foreach k in array array['development','hiring','requests','risks'] loop
  if jsonb_typeof(e->'notes'->k) is distinct from 'string' or length(e->'notes'->>k)>3000 then return false;end if;
 end loop;
 return true;
exception when others then return false;
end $$;

create function private.redact_fiscal_source(s jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
begin
 if jsonb_typeof(s->'outlook')='object' then s:=jsonb_set(s,'{outlook,sourceUrl}','null');end if;
 if jsonb_typeof(s->'managementSummary')='object' then
  s:=jsonb_set(s,'{managementSummary,schoolLaunches,sourceUrl}','null');
  s:=jsonb_set(s,'{managementSummary,schoolLaunches,confirmed}',(select coalesce(jsonb_agg(jsonb_set(value,'{sourceUrl}','null') order by ord),'[]') from jsonb_array_elements(s#>'{managementSummary,schoolLaunches,confirmed}') with ordinality as x(value,ord)));
 end if;
 return s;
end $$;

-- Private recursive validator for the fixed, generated contract below. This
-- supports only the JSON Schema keywords emitted by this contract, not arbitrary
-- caller-supplied schemas. Unknown fields are rejected at every object level.
create function private.fiscal_json_shape(v jsonb, s jsonb, depth integer default 0) returns boolean
language plpgsql immutable set search_path='' as $$
declare item jsonb; k text; t text; n numeric;
begin
 if v is null or s is null or depth>24 then return false;end if;
 if s?'anyOf' then
  for item in select value from jsonb_array_elements(s->'anyOf') loop
   if private.fiscal_json_shape(v,item,depth+1) then return true;end if;
  end loop;return false;
 end if;
 t:=s->>'type';
 if t='integer' then
  if jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric) then return false;end if;
 elsif t is not null and jsonb_typeof(v)<>t then return false;end if;
 if s?'const' and v is distinct from s->'const' then return false;end if;
 if s?'enum' and not exists(select 1 from jsonb_array_elements(s->'enum') x where x=v) then return false;end if;
 if t='object' then
  if s->'additionalProperties'='false'::jsonb and exists(select 1 from jsonb_object_keys(v) x where not((s->'properties')?x)) then return false;end if;
  for k in select jsonb_array_elements_text(coalesce(s->'required','[]')) loop if not(v?k) then return false;end if;end loop;
  for k,item in select key,value from jsonb_each(v) loop
   if not private.fiscal_json_shape(item,s->'properties'->k,depth+1) then return false;end if;
  end loop;
 elsif t='array' then
  if jsonb_array_length(v)<coalesce((s->>'minItems')::integer,0) or jsonb_array_length(v)>coalesce((s->>'maxItems')::integer,100000) then return false;end if;
  for item in select value from jsonb_array_elements(v) loop if not private.fiscal_json_shape(item,s->'items',depth+1) then return false;end if;end loop;
 elsif t='string' then
  k:=v#>>'{}';
  if length(private.fiscal_trim(k))<coalesce((s->>'minLength')::integer,0) or length(k)>coalesce((s->>'maxLength')::integer,200000) then return false;end if;
  if s?'pattern' and k !~ (s->>'pattern') then return false;end if;
  if s->>'format'='date' then perform k::date;end if;
  if s->>'format'='date-time' then perform k::timestamptz;end if;
  if s->>'format'='uri' and k !~ '^https://[^[:space:]]+$' then return false;end if;
 elsif t in ('integer','number') then
  n:=(v#>>'{}')::numeric;
  if (s?'minimum' and n<(s->>'minimum')::numeric) or(s?'maximum' and n>(s->>'maximum')::numeric) or(s?'exclusiveMinimum' and n<=(s->>'exclusiveMinimum')::numeric) then return false;end if;
 end if;
 return true;
exception when others then return false;
end $$;

-- Generated from scripts/fiscal-contract.ts; regression tests require parity.
create function private.fiscal_content_contract() returns jsonb language sql immutable set search_path='' as $contract$select $schema${"$schema":"https://json-schema.org/draft/2020-12/schema","type":"object","properties":{"organization":{"type":"object","properties":{"asOf":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"employees":{"anyOf":[{"type":"integer","minimum":0,"maximum":100000},{"type":"null"}]},"onLeave":{"anyOf":[{"type":"integer","minimum":0,"maximum":100000},{"type":"null"}]},"partTime":{"anyOf":[{"type":"integer","minimum":0,"maximum":100000},{"type":"null"}]},"directors":{"anyOf":[{"type":"integer","minimum":0,"maximum":100000},{"type":"null"}]},"contractors":{"anyOf":[{"type":"integer","minimum":0,"maximum":100000},{"type":"null"}]},"confirmed":{"type":"boolean"},"sourceLabel":{"type":"string","minLength":2,"maxLength":160},"note":{"type":"string","maxLength":1200},"areas":{"maxItems":15,"type":"array","items":{"type":"string","minLength":1,"maxLength":80}}},"required":["asOf","employees","onLeave","partTime","directors","contractors","confirmed","sourceLabel","note","areas"],"additionalProperties":false},"notes":{"type":"object","properties":{"development":{"type":"string","maxLength":3000},"hiring":{"type":"string","maxLength":3000},"requests":{"type":"string","maxLength":3000},"risks":{"type":"string","maxLength":3000}},"required":["development","hiring","requests","risks"],"additionalProperties":false},"source":{"type":"object","properties":{"fiscalEndYear":{"type":"integer","minimum":2020,"maximum":2099},"asOf":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"months":{"minItems":1,"maxItems":12,"type":"array","items":{"type":"object","properties":{"period":{"type":"string","pattern":"^20\\d{2}-(0[1-9]|1[0-2])$"},"retrievedAt":{"type":"string","format":"date-time","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d:[0-5]\\d(?:\\.\\d+)?(?:Z|([+-](?:[01]\\d|2[0-3]):[0-5]\\d)))$"},"monthly":{"type":"object","properties":{"revenue":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"costOfSales":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"grossProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"sga":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"operatingProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"ordinaryProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991}},"required":["revenue","costOfSales","grossProfit","sga","operatingProfit","ordinaryProfit"],"additionalProperties":false},"previousYear":{"type":"object","properties":{"revenue":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"costOfSales":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"grossProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"sga":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"operatingProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"ordinaryProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991}},"required":["revenue","costOfSales","grossProfit","sga","operatingProfit","ordinaryProfit"],"additionalProperties":false},"bsTotals":{"type":"object","properties":{"assets":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"liabilities":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"equity":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"cash":{"anyOf":[{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},{"type":"null"}]},"currentAssets":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"currentLiabilities":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991}},"required":["assets","liabilities","equity","cash","currentAssets","currentLiabilities"],"additionalProperties":false},"nativeClosedThrough":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]},"temporaryClosedThrough":{"anyOf":[{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},{"type":"null"}]}},"required":["period","retrievedAt","monthly","previousYear","bsTotals","nativeClosedThrough","temporaryClosedThrough"],"additionalProperties":false}},"previousFiscalYear":{"minItems":12,"maxItems":12,"type":"array","items":{"type":"object","properties":{"period":{"type":"string","pattern":"^20\\d{2}-(0[1-9]|1[0-2])$"},"metrics":{"type":"object","properties":{"revenue":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"costOfSales":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"grossProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"sga":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"operatingProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},"ordinaryProfit":{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991}},"required":["revenue","costOfSales","grossProfit","sga","operatingProfit","ordinaryProfit"],"additionalProperties":false}},"required":["period","metrics"],"additionalProperties":false}},"outlook":{"anyOf":[{"type":"object","properties":{"targetRevenue":{"anyOf":[{"type":"integer","minimum":0,"maximum":9007199254740991},{"type":"null"}]},"targetOperatingProfit":{"anyOf":[{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},{"type":"null"}]},"forecastRevenue":{"anyOf":[{"type":"integer","minimum":0,"maximum":9007199254740991},{"type":"null"}]},"forecastOperatingProfit":{"anyOf":[{"type":"integer","minimum":-9007199254740991,"maximum":9007199254740991},{"type":"null"}]},"sourceLabel":{"type":"string","minLength":2,"maxLength":160},"sourceUrl":{"anyOf":[{"type":"string","format":"uri"},{"type":"null"}]},"asOf":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"}},"required":["targetRevenue","targetOperatingProfit","forecastRevenue","forecastOperatingProfit","sourceLabel","sourceUrl","asOf"],"additionalProperties":false},{"type":"null"}]},"managementSummary":{"default":null,"anyOf":[{"type":"object","properties":{"asOf":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"sourceLabel":{"type":"string","minLength":2,"maxLength":160},"headline":{"type":"string","minLength":2,"maxLength":180},"overview":{"type":"string","minLength":2,"maxLength":1200},"funding":{"minItems":1,"maxItems":12,"type":"array","items":{"type":"object","properties":{"period":{"type":"string","minLength":1,"maxLength":60},"text":{"type":"string","minLength":2,"maxLength":600}},"required":["period","text"],"additionalProperties":false}},"business":{"minItems":1,"maxItems":8,"type":"array","items":{"type":"string","minLength":2,"maxLength":600}},"efficiency":{"minItems":1,"maxItems":8,"type":"array","items":{"type":"string","minLength":2,"maxLength":600}},"outlook":{"minItems":1,"maxItems":8,"type":"array","items":{"type":"string","minLength":2,"maxLength":600}},"schoolLaunches":{"type":"object","properties":{"confirmed":{"maxItems":100,"type":"array","items":{"type":"object","properties":{"name":{"type":"string","minLength":2,"maxLength":160},"period":{"type":"string","pattern":"^20\\d{2}-(0[1-9]|1[0-2])$"},"sourceUrl":{"anyOf":[{"type":"string","format":"uri"},{"type":"null"}]}},"required":["name","period","sourceUrl"],"additionalProperties":false}},"totalAdded":{"anyOf":[{"type":"integer","minimum":-1000,"maximum":1000},{"type":"null"}]},"note":{"type":"string","minLength":2,"maxLength":1200},"sourceUrl":{"anyOf":[{"type":"string","format":"uri"},{"type":"null"}]}},"required":["confirmed","totalAdded","note","sourceUrl"],"additionalProperties":false}},"required":["asOf","sourceLabel","headline","overview","funding","business","efficiency","outlook","schoolLaunches"],"additionalProperties":false},{"type":"null"}]}},"required":["fiscalEndYear","asOf","months","previousFiscalYear","outlook","managementSummary"],"additionalProperties":false},"ownership":{"anyOf":[{"type":"object","properties":{"asOf":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"basis":{"type":"string","const":"issued-shares"},"display":{"type":"string","enum":["grouped","named"]},"issuedShares":{"type":"integer","exclusiveMinimum":0,"maximum":1000000000000},"sourceLabel":{"type":"string","minLength":2,"maxLength":120},"notes":{"type":"string","maxLength":600},"rows":{"minItems":1,"maxItems":40,"type":"array","items":{"type":"object","properties":{"group":{"type":"string","enum":["founder","team","fund","corporate","individual","other","treasury"]},"name":{"default":"","type":"string","maxLength":100},"shareClass":{"type":"string","minLength":1,"maxLength":80},"shares":{"type":"integer","exclusiveMinimum":0,"maximum":1000000000000}},"required":["group","name","shareClass","shares"],"additionalProperties":false}}},"required":["asOf","basis","display","issuedShares","sourceLabel","notes","rows"],"additionalProperties":false},{"type":"null"}]},"video":{"anyOf":[{"type":"object","properties":{"occurredOn":{"type":"string","format":"date","pattern":"^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))$"},"videoUrl":{"type":"string","format":"uri"}},"required":["occurredOn","videoUrl"],"additionalProperties":false},{"type":"null"}]}},"required":["organization","notes","source","ownership","video"],"additionalProperties":false}$schema$::jsonb$contract$;

create function private.valid_fiscal_publication_content(c jsonb) returns boolean
language plpgsql stable set search_path='' as $$
declare s jsonb; m jsonb; prior jsonb; school jsonb; metrics jsonb; idx integer:=0; y integer; expected text;
begin
 if not private.fiscal_json_shape(c,private.fiscal_content_contract()) then return false;end if;
 s:=c->'source';y:=(s->>'fiscalEndYear')::integer;
 if s is distinct from private.redact_fiscal_source(s) or (c#>>'{organization,asOf}')::date>(s->>'asOf')::date then return false;end if;
 if (c#>>'{organization,onLeave}')::integer>(c#>>'{organization,employees}')::integer then return false;end if;
 for m in select value from jsonb_array_elements(s->'months') loop
  expected:=to_char(make_date(y-1,11,1)+make_interval(months=>idx),'YYYY-MM');
  if m->>'period'<>expected or m->>'period'>=left(s->>'asOf',7) then return false;end if;
  prior:=s->'previousFiscalYear'->idx;
  if m->'previousYear' is distinct from prior->'metrics' then return false;end if;
  foreach metrics in array array[m->'monthly',m->'previousYear'] loop
   if (metrics->>'revenue')::numeric-(metrics->>'costOfSales')::numeric<>(metrics->>'grossProfit')::numeric or (metrics->>'grossProfit')::numeric-(metrics->>'sga')::numeric<>(metrics->>'operatingProfit')::numeric then return false;end if;
  end loop;
  if (m#>>'{bsTotals,assets}')::numeric<>(m#>>'{bsTotals,liabilities}')::numeric+(m#>>'{bsTotals,equity}')::numeric then return false;end if;
  idx:=idx+1;
 end loop;
 idx:=0;
 for m in select value from jsonb_array_elements(s->'previousFiscalYear') loop
  if m->>'period'<>to_char(make_date(y-2,11,1)+make_interval(months=>idx),'YYYY-MM') then return false;end if;
  metrics:=m->'metrics';
  if (metrics->>'revenue')::numeric-(metrics->>'costOfSales')::numeric<>(metrics->>'grossProfit')::numeric or (metrics->>'grossProfit')::numeric-(metrics->>'sga')::numeric<>(metrics->>'operatingProfit')::numeric then return false;end if;
  idx:=idx+1;
 end loop;
 if s#>>'{outlook,asOf}'>s->>'asOf' or s#>>'{managementSummary,asOf}'>s->>'asOf' then return false;end if;
 if jsonb_typeof(s->'managementSummary')='object' then
  for school in select value from jsonb_array_elements(s#>'{managementSummary,schoolLaunches,confirmed}') loop
   if school->>'period'<(y-1)::text||'-11' or school->>'period'>y::text||'-10' or school->>'period'>left(s#>>'{managementSummary,asOf}',7) then return false;end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(s#>'{managementSummary,schoolLaunches,confirmed}') x group by x->>'name',x->>'period' having count(*)>1) then return false;end if;
 end if;
 if c->'ownership'<>'null'::jsonb then perform private.validate_ownership(c->'ownership');end if;
 if c->'video'<>'null'::jsonb then
  if c#>>'{video,videoUrl}' !~ '^https://(www[.])?(youtube[.]com|youtu[.]be|vimeo[.]com)/' or c#>>'{video,occurredOn}'>(s->>'asOf') then return false;end if;
 end if;
 return true;
exception when others then return false;
end $$;

create function private.fiscal_publication_sources(p_company uuid,p_year integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; o jsonb; v jsonb;
begin
 if not coalesce(private.is_admin(p_company),false) then raise exception 'Admin authorization required';end if;
 s:=private.redact_fiscal_source(private.get_fiscal_briefing(p_company,p_year));
 if s is null then raise exception 'Fiscal source unavailable';end if;
 select snapshot into o from private.ownership_imports where company_id=p_company;
 select jsonb_build_object('occurredOn',rv.content#>>'{eventSpotlight,occurredOn}','videoUrl',rv.content#>>'{eventSpotlight,videoUrl}') into v
 from (select distinct on (report_id) * from public.report_versions order by report_id,created_at desc,id desc) rv join public.reports r on r.id=rv.report_id
 where r.company_id=p_company and r.period between make_date(p_year-1,11,1) and make_date(p_year,10,1)
 and nullif(rv.content#>>'{eventSpotlight,videoUrl}','') is not null
 order by r.period desc,rv.created_at desc limit 1;
 return jsonb_build_object('source',s,'ownership',o,'video',v);
end $$;

create function private.guard_fiscal_publication() returns trigger
language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Fiscal snapshots are immutable; create a revision';end if;
 if tg_op='UPDATE' then
  if old.state='published' then raise exception 'Published fiscal snapshot is immutable';end if;
  if row(new.id,new.company_id,new.fiscal_end_year,new.version,new.created_at) is distinct from row(old.id,old.company_id,old.fiscal_end_year,old.version,old.created_at) then raise exception 'Immutable identity';end if;
  new.revision:=old.revision+1;
 end if;
 if not private.valid_fiscal_publication_content(new.content) then raise exception 'Invalid fiscal source or publication content';end if;
 if not private.valid_fiscal_editor(jsonb_build_object('organization',new.content->'organization','notes',new.content->'notes')) then raise exception 'Invalid fiscal editor';end if;
 if (new.content-array['source','organization','notes','ownership','video'])<>'{}'::jsonb or new.content->'source' is distinct from private.redact_fiscal_source(new.content->'source') or (new.content#>>'{source,fiscalEndYear}')::integer is distinct from new.fiscal_end_year or (new.content#>>'{organization,asOf}')::date>(new.content#>>'{source,asOf}')::date then raise exception 'Invalid fiscal source';end if;
 new.content_hash:=encode(sha256(convert_to(new.content::text,'UTF8')),'hex');
 if tg_op='INSERT' then
  if new.state<>'draft' then raise exception 'Draft required';end if;
  new.review_hash:=null;new.approved_hash:=null;new.approved_by:=null;new.approved_at:=null;new.published_at:=null;
 elsif new.content is distinct from old.content then
  if new.state<>'draft' then raise exception 'Edit requires renewed review';end if;
  new.review_hash:=null;new.approved_hash:=null;new.approved_by:=null;new.approved_at:=null;
 end if;
 if new.state='draft' then new.review_hash:=null;new.approved_hash:=null;new.approved_by:=null;new.approved_at:=null;end if;
 if new.state='review' then
  if old.state<>'draft' or not coalesce((new.content#>>'{organization,confirmed}')::boolean,false) or new.content#>>'{organization,employees}' is null or coalesce(length(private.fiscal_trim(new.content#>>'{notes,risks}')),0)=0 or jsonb_typeof(new.content#>'{source,managementSummary}') is distinct from 'object' then raise exception 'Complete and confirm the report before review';end if;
  new.review_hash:=new.content_hash;
 elsif new.state='approved' then
  if old.state<>'review' or old.review_hash is distinct from new.content_hash then raise exception 'Exact review required';end if;
  new.approved_hash:=new.content_hash;new.approved_by:=auth.uid();new.approved_at:=now();
 elsif new.state='published' then
  if old.state<>'approved' or old.approved_hash is distinct from new.content_hash or old.approved_by is null then raise exception 'Exact approval required';end if;
  new.published_at:=now();
 end if;
 return new;
end $$;
create trigger guard_fiscal_publication before insert or update or delete on public.fiscal_publications for each row execute function private.guard_fiscal_publication();

create function private.audit_fiscal_publication() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.audit_logs(company_id,actor_id,action,record_id,metadata) values(new.company_id,auth.uid(),'fiscal.'||new.state,new.id,jsonb_build_object('year',new.fiscal_end_year,'version',new.version,'revision',new.revision,'checksum',new.content_hash));return new;
end $$;
create trigger audit_fiscal_publication after insert or update on public.fiscal_publications for each row execute function private.audit_fiscal_publication();

create function private.prepare_fiscal_publication(p_company uuid,p_year integer) returns public.fiscal_publications
language plpgsql security definer set search_path='' as $$
declare r public.fiscal_publications; previous public.fiscal_publications; s jsonb;c jsonb;o jsonb; sources jsonb;
begin
 if not coalesce(private.is_admin(p_company),false) then raise exception 'Admin authorization required';end if;
 if p_year is null or p_year not between 2020 and 2099 then raise exception 'Invalid fiscal year';end if;
 perform pg_advisory_xact_lock(hashtext(p_company::text),p_year);
 select * into r from public.fiscal_publications where company_id=p_company and fiscal_end_year=p_year and state<>'published';
 if r.id is not null then return r;end if;
 sources:=private.fiscal_publication_sources(p_company,p_year);s:=sources->'source';
 select * into previous from public.fiscal_publications where company_id=p_company and fiscal_end_year=p_year order by version desc limit 1;
 select context into c from private.fiscal_briefing_context where company_id=p_company and fiscal_end_year=p_year;
 o:=coalesce(previous.content->'organization',c->'organization',jsonb_build_object('asOf',s->>'asOf','employees',null,'onLeave',null,'partTime',null,'directors',null,'contractors',null,'confirmed',false,'sourceLabel','経営者による確認待ち','note','','areas','[]'::jsonb));
 insert into public.fiscal_publications(company_id,fiscal_end_year,version,content) values(p_company,p_year,coalesce(previous.version,0)+1,jsonb_build_object('source',s,'organization',o,'notes',coalesce(previous.content->'notes',c->'investorNotes','{"development":"","hiring":"","requests":"","risks":""}'::jsonb),'ownership',sources->'ownership','video',sources->'video')) returning * into r;
 return r;
end $$;
create function public.ir_prepare_fiscal_publication(p_company uuid,p_year integer) returns public.fiscal_publications language sql security invoker set search_path='' as $$select private.prepare_fiscal_publication(p_company,p_year)$$;

create function private.refresh_fiscal_publication(p_id uuid,p_revision integer) returns public.fiscal_publications
language plpgsql security definer set search_path='' as $$
declare r public.fiscal_publications; sources jsonb;
begin
 select * into r from public.fiscal_publications where id=p_id for update;
 if r.id is null or not coalesce(private.is_admin(r.company_id),false) then raise exception 'Admin authorization required';end if;
 if r.revision is distinct from p_revision then raise exception 'Concurrent revision';end if;
 if r.state='published' then raise exception 'Published snapshot is immutable';end if;
 sources:=private.fiscal_publication_sources(r.company_id,r.fiscal_end_year);
 update public.fiscal_publications set content=(content-array['source','ownership','video'])||sources,state='draft' where id=p_id returning * into r;
 return r;
end $$;
create function public.ir_refresh_fiscal_publication(p_id uuid,p_revision integer) returns public.fiscal_publications language sql security invoker set search_path='' as $$select private.refresh_fiscal_publication(p_id,p_revision)$$;

create function private.edit_fiscal_publication(p_id uuid,p_revision integer,p_editor jsonb) returns public.fiscal_publications
language plpgsql security definer set search_path='' as $$
declare r public.fiscal_publications;
begin
 select * into r from public.fiscal_publications where id=p_id for update;
 if r.id is null or not coalesce(private.is_admin(r.company_id),false) then raise exception 'Admin authorization required';end if;
 if r.revision is distinct from p_revision then raise exception 'Concurrent revision';end if;
 if r.state='published' then raise exception 'Published snapshot is immutable';end if;
 if not private.valid_fiscal_editor(p_editor) then raise exception 'Invalid fiscal editor';end if;
 update public.fiscal_publications set content=(content-array['organization','notes'])||p_editor,state='draft' where id=p_id returning * into r;return r;
end $$;
create function public.ir_edit_fiscal_publication(p_id uuid,p_revision integer,p_editor jsonb) returns public.fiscal_publications language sql security invoker set search_path='' as $$select private.edit_fiscal_publication(p_id,p_revision,p_editor)$$;

create function private.fiscal_transition(p_id uuid,p_revision integer,p_operation text,p_acknowledged boolean) returns public.fiscal_publications
language plpgsql security definer set search_path='' as $$
declare r public.fiscal_publications; next_state text;
begin
 select * into r from public.fiscal_publications where id=p_id for update;
 if r.id is null or not coalesce(private.is_admin(r.company_id),false) then raise exception 'Admin authorization required';end if;
 if r.revision is distinct from p_revision then raise exception 'Concurrent revision';end if;
 if p_operation='review' and r.state='draft' then
  if p_acknowledged is distinct from true then raise exception 'Confirm actual coverage, provisional values and unknown information';end if;next_state:='review';
 elsif p_operation='approve' and r.state='review' then next_state:='approved';
 elsif p_operation='publish' and r.state='approved' then next_state:='published';
 else raise exception 'Invalid transition or missing approval';end if;
 update public.fiscal_publications set state=next_state where id=p_id returning * into r;return r;
end $$;
create function public.ir_fiscal_transition(p_id uuid,p_revision integer,p_operation text,p_acknowledged boolean default false) returns public.fiscal_publications language sql security invoker set search_path='' as $$select private.fiscal_transition(p_id,p_revision,p_operation,p_acknowledged)$$;

create function private.record_fiscal_export(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare r public.fiscal_publications;
begin
 select * into r from public.fiscal_publications where id=p_id;
 if r.id is null or not(coalesce(private.is_admin(r.company_id),false) or(r.state='published' and coalesce(private.has_investor_grant(r.company_id),false))) then raise exception 'Authorization required';end if;
 insert into public.audit_logs(company_id,actor_id,action,record_id,metadata) values(r.company_id,auth.uid(),'fiscal.pdf',r.id,jsonb_build_object('version',r.version,'checksum',r.content_hash));
end $$;
create function public.ir_record_fiscal_export(p_id uuid) returns void language sql security invoker set search_path='' as $$select private.record_fiscal_export(p_id)$$;

revoke all on function private.valid_fiscal_editor(jsonb),private.redact_fiscal_source(jsonb),private.guard_fiscal_publication(),private.audit_fiscal_publication(),private.prepare_fiscal_publication(uuid,integer),private.edit_fiscal_publication(uuid,integer,jsonb),private.fiscal_transition(uuid,integer,text,boolean),private.record_fiscal_export(uuid),public.ir_prepare_fiscal_publication(uuid,integer),public.ir_edit_fiscal_publication(uuid,integer,jsonb),public.ir_fiscal_transition(uuid,integer,text,boolean),public.ir_record_fiscal_export(uuid) from public,anon,authenticated,service_role;
grant execute on function private.prepare_fiscal_publication(uuid,integer),private.edit_fiscal_publication(uuid,integer,jsonb),private.fiscal_transition(uuid,integer,text,boolean),private.record_fiscal_export(uuid),public.ir_prepare_fiscal_publication(uuid,integer),public.ir_edit_fiscal_publication(uuid,integer,jsonb),public.ir_fiscal_transition(uuid,integer,text,boolean),public.ir_record_fiscal_export(uuid) to authenticated;

revoke all on function private.fiscal_trim(text),private.fiscal_json_shape(jsonb,jsonb,integer),private.fiscal_content_contract(),private.valid_fiscal_publication_content(jsonb),private.fiscal_publication_sources(uuid,integer),private.refresh_fiscal_publication(uuid,integer),public.ir_refresh_fiscal_publication(uuid,integer) from public,anon,authenticated,service_role;
grant execute on function private.refresh_fiscal_publication(uuid,integer),public.ir_refresh_fiscal_publication(uuid,integer) to authenticated;
