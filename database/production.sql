-- Production extension for the baseline schema. No seed financial data.
begin;
alter table public.report_versions add column analysis text not null default 'not-generated' check(analysis in ('not-generated','human-authored','generated-ai','reviewed'));
create unique index one_unpublished_version on public.report_versions(report_id) where state<>'published';
-- Production mutations must pass the transactional validation RPCs.
revoke insert,update,delete on public.reports from authenticated;
revoke insert(report_id,financial_snapshot_id,version,content),update(content,financial_snapshot_id) on public.report_versions from authenticated;
create table public.monthly_inputs(version_id uuid primary key references public.report_versions(id),notes text not null check(length(notes)<=12000),updated_at timestamptz not null default now());
create table private.ir_invitations(company_id uuid not null references public.companies(id),email text not null check(email=lower(trim(email))),role text not null default 'investor' check(role in ('admin','investor')),active boolean not null default true,created_at timestamptz not null default now(),primary key(company_id,email));
-- The accepted invitation is bound to a stable Auth user ID even if their email changes.
alter table public.investor_grants add column invitation_email text;
alter table public.investor_grants add constraint investor_invitation_reference foreign key(company_id,invitation_email) references private.ir_invitations(company_id,email);
create or replace function private.has_investor_grant(company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.investor_grants g join private.ir_invitations i on i.company_id=g.company_id and i.email=g.invitation_email where g.user_id=auth.uid() and g.company_id=company and g.revoked_at is null and i.active and i.role='investor')
$$;
create table public.ir_documents(
 id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id), version_id uuid not null references public.report_versions(id),
 title text not null check(length(title) between 1 and 120),category text not null check(category in ('pl','bs','trial-balance','cash-flow','other')),
 period text not null check(period ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),basis text not null check(basis in ('monthly','ytd','year-end','other')),description text not null default '' check(length(description)<=1000),
 file_name text not null check(length(file_name) between 1 and 200),bytes integer not null check(bytes between 1 and 4194304),checksum text not null check(checksum ~ '^[a-f0-9]{64}$'),
 storage_path text not null unique,status text not null default 'pending' check(status in ('pending','ready','removed')),created_at timestamptz not null default now()
);
create index document_company_period on public.ir_documents(company_id,period);
alter table public.monthly_inputs enable row level security;
alter table private.ir_invitations enable row level security;
alter table public.ir_documents enable row level security;
-- AAL is verified by Supabase Auth, never taken from editable user metadata.
create or replace function private.is_admin(company uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and coalesce((select auth.jwt()->>'aal'),'aal1')='aal2' and exists(select 1 from private.admin_memberships m where m.user_id=auth.uid() and m.company_id=company)
$$;
create function private.document_metadata(d public.ir_documents) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('id',d.id,'title',d.title,'category',d.category,'period',d.period,'basis',d.basis,'description',d.description,'fileName',d.file_name,'bytes',d.bytes,'checksum',d.checksum,'uploadedAt',to_char(d.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
$$;
create function private.can_read_document(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.ir_documents d where d.storage_path=object_path and d.status='ready' and (private.is_admin(d.company_id) or (private.has_investor_grant(d.company_id) and exists(select 1 from public.report_versions v join public.reports r on r.id=v.report_id where r.company_id=d.company_id and v.state='published' and v.content->'documents' @> jsonb_build_array(jsonb_build_object('id',d.id))))))
$$;
create function private.can_upload_document(object_path text) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.ir_documents d join public.report_versions v on v.id=d.version_id where d.storage_path=object_path and d.status='pending' and v.state<>'published' and private.is_admin(d.company_id))
$$;
revoke all on function private.document_metadata(public.ir_documents),private.can_read_document(text),private.can_upload_document(text) from public,anon;
grant execute on function private.document_metadata(public.ir_documents),private.can_read_document(text),private.can_upload_document(text) to authenticated;
create policy monthly_admin on public.monthly_inputs for select to authenticated using(private.can_manage_report((select v.report_id from public.report_versions v where v.id=version_id)));
create policy document_read on public.ir_documents for select to authenticated using(private.can_read_document(storage_path) or private.is_admin(company_id));
revoke all on public.monthly_inputs,public.ir_documents from public,anon,authenticated;
grant select on public.monthly_inputs,public.ir_documents to authenticated;
revoke all on private.ir_invitations from public,anon,authenticated;
-- Every helper checks the currently verified identity and, for writes, MFA.
create function private.ir_actor(p_company uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return null; end if;
 if exists(select 1 from private.admin_memberships m where m.user_id=auth.uid() and m.company_id=p_company) then return jsonb_build_object('id',auth.uid(),'role','admin','companyId',p_company,'needsMfa',coalesce(auth.jwt()->>'aal','aal1')<>'aal2'); end if;
 if private.has_investor_grant(p_company) then return jsonb_build_object('id',auth.uid(),'role','investor','companyId',p_company,'needsMfa',false); end if;
 return null;
end $$;
create function private.accept_invitation(p_company uuid) returns void language plpgsql security definer set search_path='' as $$
declare invitation private.ir_invitations; verified_email text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 select lower(u.email) into verified_email from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null;
 select * into invitation from private.ir_invitations i where i.company_id=p_company and i.email=verified_email and i.active for update;
 if invitation.company_id is null then return; end if;
 if invitation.role='admin' then insert into private.admin_memberships(user_id,company_id) values(auth.uid(),p_company) on conflict do nothing;
 else insert into public.investor_grants(user_id,company_id,invitation_email) values(auth.uid(),p_company,verified_email) on conflict(user_id,company_id) do update set revoked_at=null,invitation_email=excluded.invitation_email; end if;
end $$;
create function private.set_invitation(p_company uuid,p_email text,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin(p_company) then raise exception 'Admin MFA required'; end if;
 if length(p_email)>254 or p_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Invalid email'; end if;
 if exists(select 1 from private.ir_invitations where company_id=p_company and email=lower(trim(p_email)) and role='admin') then raise exception 'Cannot change administrator access'; end if;
 insert into private.ir_invitations(company_id,email,active) values(p_company,lower(trim(p_email)),p_active) on conflict(company_id,email) do update set active=excluded.active;
 if not p_active then update public.investor_grants g set revoked_at=now() where g.company_id=p_company and g.invitation_email=lower(trim(p_email)); end if;
 insert into public.audit_logs(company_id,actor_id,action,record_id,metadata) values(p_company,auth.uid(),case when p_active then 'investor-access-enabled' else 'investor-access-revoked' end,p_company,jsonb_build_object('email',lower(trim(p_email))));
end $$;
create function private.list_invitations(p_company uuid) returns table(email text,active boolean,created_at timestamptz) language plpgsql security definer set search_path='' as $$
begin if not private.is_admin(p_company) then raise exception 'Admin MFA required'; end if; return query select i.email,i.active,i.created_at from private.ir_invitations i where i.company_id=p_company and i.role='investor' order by i.created_at desc; end $$;
create function private.lock_version(p_id uuid,p_revision integer) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare v public.report_versions; company uuid;
begin
 select * into v from public.report_versions where id=p_id for update;
 select company_id into company from public.reports where id=v.report_id;
 if not coalesce(private.is_admin(company),false) then raise exception 'Admin MFA required'; end if;
 if v.state='published' then raise exception 'Published version is immutable'; end if;
 if p_revision is null or p_revision<1 or v.revision is distinct from p_revision then raise exception 'Concurrent revision; reload report'; end if;
 return v;
end $$;
create function private.validate_text_fields(o jsonb,fields text[],max_length integer default 2000) returns void language plpgsql set search_path='' as $$
declare field text;
begin
 if jsonb_typeof(o) is distinct from 'object' then raise exception 'Invalid text section'; end if;
 if exists(select 1 from jsonb_object_keys(o) k where not(k=any(fields))) then raise exception 'Invalid text fields'; end if;
 foreach field in array fields loop
  if jsonb_typeof(o->field) is distinct from 'string' or length(o->>field)>max_length then raise exception 'Invalid text field: %',field; end if;
 end loop;
end $$;
create function private.validate_content(c jsonb) returns void language plpgsql set search_path='' as $$
declare metric text; f jsonb; item jsonb; section text;
begin
 if jsonb_typeof(c) is distinct from 'object' then raise exception 'Invalid report content'; end if;
 if octet_length(c::text)>200000 or exists(select 1 from jsonb_object_keys(c) k where k not in ('financial','summary','financialAnalysis','revenueDrivers','profitDrivers','highlights','ai','forward','risks','ceo','documents')) then raise exception 'Invalid report content'; end if;
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
create function private.create_report(p_company uuid,p_period text,p_content jsonb) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare r uuid; s uuid; v public.report_versions;
begin
 if not private.is_admin(p_company) then raise exception 'Admin MFA required'; end if;
 if p_period !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' or p_content->'financial'->>'period' is distinct from p_period then raise exception 'Invalid period'; end if;
 perform private.validate_content(p_content);
 if jsonb_array_length(p_content->'documents')<>0 then raise exception 'New report has no documents'; end if;
 insert into public.reports(company_id,period) values(p_company,(p_period||'-01')::date) returning id into r;
 s:=(p_content->'financial'->>'id')::uuid;
 insert into public.financial_snapshots(id,company_id,period,source,is_synthetic,data) values(s,p_company,(p_period||'-01')::date,p_content->'financial'->>'source',false,p_content->'financial');
 insert into public.report_versions(report_id,financial_snapshot_id,version,content) values(r,s,'v1.0',p_content) returning * into v;
 return v;
end $$;
create function private.save_report(p_id uuid,p_revision integer,p_content jsonb,p_analysis text,p_notes text) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare v public.report_versions; s uuid; r public.reports;
begin
 v:=private.lock_version(p_id,p_revision); perform private.validate_content(p_content);
 if p_content->'documents' is distinct from v.content->'documents' then raise exception 'Document manifest requires attachment workflow'; end if;
 select * into r from public.reports where id=v.report_id;
 s:=(p_content->'financial'->>'id')::uuid;
 if p_content->'financial' is distinct from v.content->'financial' then
  insert into public.financial_snapshots(id,company_id,period,source,is_synthetic,data) values(s,r.company_id,r.period,p_content->'financial'->>'source',false,p_content->'financial');
 end if;
 update public.report_versions set content=p_content,financial_snapshot_id=s,analysis=p_analysis,state=case when p_notes is not null then 'draft' else state end,approved_hash=case when p_notes is not null then null else approved_hash end,approved_by=case when p_notes is not null then null else approved_by end,approved_at=case when p_notes is not null then null else approved_at end,reviewed_by=case when p_notes is not null then null else reviewed_by end,reviewed_at=case when p_notes is not null then null else reviewed_at end where id=p_id returning * into v;
 if p_notes is not null then insert into public.monthly_inputs(version_id,notes) values(p_id,p_notes) on conflict(version_id) do update set notes=excluded.notes,updated_at=now(); end if;
 return v;
end $$;
create function private.transition_report(p_id uuid,p_revision integer,p_operation text) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare v public.report_versions; next_state text; f jsonb; d jsonb;
begin
 v:=private.lock_version(p_id,p_revision);
 next_state:=case p_operation when 'review' then 'review' when 'approve' then 'approved' when 'publish' then 'published' else null end;
 if next_state is null then raise exception 'Invalid operation'; end if;
 if length(trim(coalesce(v.content->'summary'->>'text','')))=0 or length(trim(coalesce(v.content->'ceo'->>'message','')))=0 then raise exception 'Summary and CEO commentary required'; end if;
 if p_operation='review' then
  f:=v.content->'financial';
  if f->>'available'='true' and ((f->'revenue'->>'current')::numeric-(f->'revenue'->>'previous')::numeric<>coalesce((select sum((x->>'amount')::numeric) from jsonb_array_elements(v.content->'revenueDrivers') x),0) or (f->'operatingProfit'->>'current')::numeric-(f->'operatingProfit'->>'previous')::numeric<>coalesce((select sum((x->>'amount')::numeric) from jsonb_array_elements(v.content->'profitDrivers') x),0)) then raise exception 'Financial drivers must reconcile'; end if;
 end if;
 for d in select * from jsonb_array_elements(v.content->'documents') loop
  if not exists(select 1 from public.ir_documents doc join public.report_versions source on source.id=doc.version_id where doc.id=(d->>'id')::uuid and source.report_id=v.report_id and doc.status='ready' and private.document_metadata(doc)=d) then raise exception 'Invalid document manifest'; end if;
 end loop;
 update public.report_versions set state=next_state where id=p_id returning * into v;
 return v;
end $$;
create function private.revise_report(p_id uuid,p_kind text) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare source public.report_versions; v public.report_versions; label text; major integer; minor integer; company uuid;
begin
 select * into source from public.report_versions where id=p_id;
 select company_id into company from public.reports where id=source.report_id for update;
 if not coalesce(private.is_admin(company),false) then raise exception 'Admin MFA required'; end if;
 if source.state<>'published' then raise exception 'Revision requires published source'; end if;
 select max(split_part(substr(version,2),'.',1)::integer) into major from public.report_versions where report_id=source.report_id;
 select max(split_part(version,'.',2)::integer) into minor from public.report_versions where report_id=source.report_id and split_part(substr(version,2),'.',1)::integer=major;
 label:=case when p_kind='major' then 'v'||(major+1)||'.0' when p_kind='minor' then 'v'||major||'.'||(minor+1) else null end;
 if label is null then raise exception 'Invalid revision kind'; end if;
 insert into public.report_versions(report_id,financial_snapshot_id,version,content,analysis) values(source.report_id,source.financial_snapshot_id,label,source.content,source.analysis) returning * into v;
 insert into public.monthly_inputs(version_id,notes) select v.id,notes from public.monthly_inputs where version_id=p_id;
 return v;
end $$;
create function private.reserve_document(p_id uuid,p_revision integer,p_metadata jsonb) returns public.ir_documents language plpgsql security definer set search_path='' as $$
declare v public.report_versions; d public.ir_documents; company uuid; reporting_period text; doc_id uuid:=gen_random_uuid();
begin
 v:=private.lock_version(p_id,p_revision); select company_id,to_char(period,'YYYY-MM') into company,reporting_period from public.reports where id=v.report_id;
 if p_metadata->>'period' is distinct from reporting_period then raise exception 'Document period mismatch'; end if;
 insert into public.ir_documents(id,company_id,version_id,title,category,period,basis,description,file_name,bytes,checksum,storage_path) values(doc_id,company,p_id,p_metadata->>'title',p_metadata->>'category',reporting_period,p_metadata->>'basis',coalesce(p_metadata->>'description',''),p_metadata->>'fileName',(p_metadata->>'bytes')::integer,p_metadata->>'checksum',company||'/'||p_id||'/'||doc_id||'.pdf') returning * into d;
 return d;
end $$;
create function private.attach_document(p_id uuid,p_revision integer,p_document uuid) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare v public.report_versions; d public.ir_documents;
begin
 v:=private.lock_version(p_id,p_revision); select * into d from public.ir_documents where id=p_document and version_id=p_id and status='pending' for update;
 if d.id is null or not exists(select 1 from storage.objects where bucket_id='ir-financial-documents' and name=d.storage_path) then raise exception 'Uploaded document required'; end if;
 update public.ir_documents set status='ready' where id=d.id returning * into d;
 update public.report_versions set content=jsonb_set(content,'{documents}',coalesce(content->'documents','[]'::jsonb)||jsonb_build_array(private.document_metadata(d))) where id=p_id returning * into v;
 insert into public.audit_logs(company_id,actor_id,action,record_id,metadata) values(d.company_id,auth.uid(),'document-attached',d.id,jsonb_build_object('checksum',d.checksum,'bytes',d.bytes)); return v;
end $$;
create function private.detach_document(p_id uuid,p_revision integer,p_document uuid) returns public.report_versions language plpgsql security definer set search_path='' as $$
declare v public.report_versions;
begin
 v:=private.lock_version(p_id,p_revision);
 update public.report_versions set content=jsonb_set(content,'{documents}',coalesce((select jsonb_agg(d) from jsonb_array_elements(content->'documents') d where d->>'id'<>p_document::text),'[]'::jsonb)) where id=p_id returning * into v;
 return v;
end $$;
create function private.guard_document() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op='DELETE' or old.status<>'pending' or (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') or exists(select 1 from public.report_versions where id=old.version_id and state='published') then raise exception 'Document metadata is immutable'; end if;
 return new;
end $$;
create trigger document_immutable before update or delete on public.ir_documents for each row execute function private.guard_document();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('ir-financial-documents','ir-financial-documents',false,4194304,array['application/pdf']) on conflict(id) do nothing;
create policy ir_private_download on storage.objects for select to authenticated using(bucket_id='ir-financial-documents' and private.can_read_document(name));
create policy ir_private_upload on storage.objects for insert to authenticated with check(bucket_id='ir-financial-documents' and private.can_upload_document(name));
-- No UPDATE or DELETE policy: financial file objects cannot be replaced.
-- Public wrappers are SECURITY INVOKER. Private privileged helpers explicitly check Auth/MFA.
create function public.ir_current_actor(p_company uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.ir_actor(p_company) $$;
create function public.ir_accept_invitation(p_company uuid) returns void language sql security invoker set search_path='' as $$ select private.accept_invitation(p_company) $$;
create function public.ir_set_invitation(p_company uuid,p_email text,p_active boolean) returns void language sql security invoker set search_path='' as $$ select private.set_invitation(p_company,p_email,p_active) $$;
create function public.ir_list_invitations(p_company uuid) returns table(email text,active boolean,created_at timestamptz) language sql security invoker set search_path='' as $$ select * from private.list_invitations(p_company) $$;
create function public.ir_create_report(p_company uuid,p_period text,p_content jsonb) returns public.report_versions language sql security invoker set search_path='' as $$ select private.create_report(p_company,p_period,p_content) $$;
create function public.ir_save_report(p_id uuid,p_revision integer,p_content jsonb,p_analysis text,p_notes text default null) returns public.report_versions language sql security invoker set search_path='' as $$ select private.save_report(p_id,p_revision,p_content,p_analysis,p_notes) $$;
create function public.ir_transition_report(p_id uuid,p_revision integer,p_operation text) returns public.report_versions language sql security invoker set search_path='' as $$ select private.transition_report(p_id,p_revision,p_operation) $$;
create function public.ir_revise_report(p_id uuid,p_kind text) returns public.report_versions language sql security invoker set search_path='' as $$ select private.revise_report(p_id,p_kind) $$;
create function public.ir_reserve_document(p_id uuid,p_revision integer,p_metadata jsonb) returns public.ir_documents language sql security invoker set search_path='' as $$ select private.reserve_document(p_id,p_revision,p_metadata) $$;
create function public.ir_attach_document(p_id uuid,p_revision integer,p_document uuid) returns public.report_versions language sql security invoker set search_path='' as $$ select private.attach_document(p_id,p_revision,p_document) $$;
create function public.ir_detach_document(p_id uuid,p_revision integer,p_document uuid) returns public.report_versions language sql security invoker set search_path='' as $$ select private.detach_document(p_id,p_revision,p_document) $$;
-- Do not inherit PostgreSQL's default PUBLIC execute grant.
revoke all on all functions in schema private from public,anon;
revoke all on function public.ir_current_actor(uuid),public.ir_accept_invitation(uuid),public.ir_set_invitation(uuid,text,boolean),public.ir_list_invitations(uuid),public.ir_create_report(uuid,text,jsonb),public.ir_save_report(uuid,integer,jsonb,text,text),public.ir_transition_report(uuid,integer,text),public.ir_revise_report(uuid,text),public.ir_reserve_document(uuid,integer,jsonb),public.ir_attach_document(uuid,integer,uuid),public.ir_detach_document(uuid,integer,uuid) from public,anon;
grant execute on function private.ir_actor(uuid),private.accept_invitation(uuid),private.set_invitation(uuid,text,boolean),private.list_invitations(uuid),private.create_report(uuid,text,jsonb),private.save_report(uuid,integer,jsonb,text,text),private.transition_report(uuid,integer,text),private.revise_report(uuid,text),private.reserve_document(uuid,integer,jsonb),private.attach_document(uuid,integer,uuid),private.detach_document(uuid,integer,uuid) to authenticated;
grant execute on function public.ir_current_actor(uuid),public.ir_accept_invitation(uuid),public.ir_set_invitation(uuid,text,boolean),public.ir_list_invitations(uuid),public.ir_create_report(uuid,text,jsonb),public.ir_save_report(uuid,integer,jsonb,text,text),public.ir_transition_report(uuid,integer,text),public.ir_revise_report(uuid,text),public.ir_reserve_document(uuid,integer,jsonb),public.ir_attach_document(uuid,integer,uuid),public.ir_detach_document(uuid,integer,uuid) to authenticated;
create function private.record_pdf_export(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare company uuid;
begin
 select r.company_id into company from public.report_versions v join public.reports r on r.id=v.report_id where v.id=p_id and v.state='published';
 if company is null or not (private.is_admin(company) or private.has_investor_grant(company)) then raise exception 'Authorization required'; end if;
 insert into public.audit_logs(company_id,actor_id,action,record_id) values(company,auth.uid(),'pdf-export',p_id);
end $$;
create function public.ir_record_pdf_export(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.record_pdf_export(p_id) $$;
revoke all on function private.record_pdf_export(uuid),public.ir_record_pdf_export(uuid) from public,anon;
grant execute on function private.record_pdf_export(uuid),public.ir_record_pdf_export(uuid) to authenticated;
create function private.record_document_download(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.ir_documents;
begin
 select * into d from public.ir_documents where id=p_id;
 if d.id is null or not private.can_read_document(d.storage_path) then raise exception 'Authorization required'; end if;
 insert into public.audit_logs(company_id,actor_id,action,record_id,metadata) values(d.company_id,auth.uid(),'document-download',d.id,jsonb_build_object('checksum',d.checksum));
end $$;
create function public.ir_record_document_download(p_id uuid) returns void language sql security invoker set search_path='' as $$ select private.record_document_download(p_id) $$;
revoke all on function private.record_document_download(uuid),public.ir_record_document_download(uuid) from public,anon;
grant execute on function private.record_document_download(uuid),public.ir_record_document_download(uuid) to authenticated;
commit;
