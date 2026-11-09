-- Passwords are managed by Supabase Auth; this table contains no credentials.
create table private.ir_investor_credentials (
  company_id uuid not null,
  email text not null,
  auth_user_id uuid references auth.users(id) on delete set null,
  issued_at timestamptz,
  request_id uuid,
  requested_at timestamptz,
  requested_by uuid references auth.users(id),
  primary key (company_id,email),
  foreign key (company_id,email) references private.ir_invitations(company_id,email)
);
alter table private.ir_investor_credentials enable row level security;
revoke all on private.ir_investor_credentials from public,anon,authenticated;
grant usage on schema private to service_role;

-- Returns the bound Auth identity, never its password hash or other user data.
create function private.investor_password_target(p_company uuid,p_email text)
returns uuid language plpgsql security definer set search_path='' as $$
declare target uuid; metadata jsonb;
begin
  select u.id,u.raw_app_meta_data into target,metadata from auth.users u where lower(u.email)=p_email;
  if exists(select 1 from private.ir_invitations i where i.email=p_email and (i.role='admin' or i.company_id<>p_company))
     or exists(select 1 from private.admin_memberships m where m.user_id=target)
     or exists(select 1 from public.investor_grants g where g.user_id=target and g.company_id<>p_company)
     or exists(select 1 from private.ir_investor_credentials c where c.auth_user_id=target and c.company_id<>p_company)
  then raise exception 'CREDENTIAL_PROTECTED'; end if;
  if exists(select 1 from public.investor_grants g where g.company_id=p_company and g.invitation_email=p_email and g.user_id is distinct from target)
     or exists(select 1 from private.ir_investor_credentials c where c.company_id=p_company and c.email=p_email and c.auth_user_id is not null and c.auth_user_id is distinct from target)
  then raise exception 'CREDENTIAL_IDENTITY_CHANGED'; end if;
  if target is not null and not (
    exists(select 1 from public.investor_grants g where g.company_id=p_company and g.user_id=target and g.invitation_email=p_email)
    or exists(select 1 from private.ir_investor_credentials c where c.company_id=p_company and c.email=p_email and c.auth_user_id=target)
    or coalesce(metadata->>'ir_credential_company'=p_company::text and metadata->>'ir_invitation_email'=p_email,false)
  ) then raise exception 'CREDENTIAL_UNRELATED_ACCOUNT'; end if;
  return target;
end $$;
revoke all on function private.investor_password_target(uuid,text) from public,anon,authenticated;

create function private.reserve_investor_password(p_company uuid,p_email text,p_mode text,p_acknowledged boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare normalized text:=lower(trim(p_email)); target uuid; invitation private.ir_invitations; entry private.ir_investor_credentials; request uuid:=gen_random_uuid();
begin
  if auth.uid() is null or not private.is_admin(p_company) then raise exception 'CREDENTIAL_ADMIN_REQUIRED'; end if;
  if normalized is null or length(normalized)>254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or p_mode is null or p_mode not in ('create','issue','reset') then raise exception 'CREDENTIAL_INVALID'; end if;
  if p_mode<>'create' and p_acknowledged is distinct from true then raise exception 'CREDENTIAL_ACK_REQUIRED'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ir-password:'||normalized,0));
  select * into invitation from private.ir_invitations i where i.company_id=p_company and i.email=normalized for update;
  if p_mode='create' and invitation.company_id is not null then raise exception 'CREDENTIAL_REGISTERED'; end if;
  if p_mode<>'create' and invitation.company_id is null then raise exception 'CREDENTIAL_NOT_REGISTERED'; end if;
  if invitation.company_id is not null and (invitation.role<>'investor' or not invitation.active) then raise exception 'CREDENTIAL_INACTIVE'; end if;
  target:=private.investor_password_target(p_company,normalized);
  if p_mode='create' and target is not null then raise exception 'CREDENTIAL_REGISTERED'; end if;
  if p_mode='create' then perform private.set_invitation(p_company,normalized,true); end if;
  insert into private.ir_investor_credentials(company_id,email) values(p_company,normalized) on conflict do nothing;
  select * into entry from private.ir_investor_credentials c where c.company_id=p_company and c.email=normalized for update;
  if entry.request_id is not null and entry.requested_at>now()-interval '2 minutes' then raise exception 'CREDENTIAL_BUSY'; end if;
  if entry.issued_at is not null and p_mode<>'reset' then raise exception 'CREDENTIAL_ALREADY_ISSUED'; end if;
  update private.ir_investor_credentials set request_id=request,requested_at=now(),requested_by=auth.uid()
    where company_id=p_company and email=normalized;
  insert into public.audit_logs(company_id,actor_id,action,record_id,metadata)
    values(p_company,auth.uid(),'investor-password-requested',p_company,jsonb_build_object('email',normalized,'operation',p_mode,'requestId',request));
  return jsonb_build_object('requestId',request,'email',normalized,'targetUserId',target);
end $$;
create function public.ir_reserve_investor_password(p_company uuid,p_email text,p_mode text,p_acknowledged boolean)
returns jsonb language sql security invoker set search_path='' as $$
  select private.reserve_investor_password(p_company,p_email,p_mode,p_acknowledged)
$$;
revoke all on function private.reserve_investor_password(uuid,text,text,boolean),public.ir_reserve_investor_password(uuid,text,text,boolean) from public,anon;
grant execute on function private.reserve_investor_password(uuid,text,text,boolean),public.ir_reserve_investor_password(uuid,text,text,boolean) to authenticated;

-- Only the verified Edge Function can mark an Auth API operation complete.
create function private.complete_investor_password(p_company uuid,p_email text,p_request uuid,p_actor uuid,p_user uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare entry private.ir_investor_credentials; target uuid;
begin
  if coalesce(auth.jwt()->>'role','')<>'service_role' then raise exception 'CREDENTIAL_SERVICE_REQUIRED'; end if;
  select * into entry from private.ir_investor_credentials c where c.company_id=p_company and c.email=p_email for update;
  if entry.request_id is distinct from p_request or p_request is null or entry.requested_by is distinct from p_actor
     or entry.requested_at<=now()-interval '2 minutes' then raise exception 'CREDENTIAL_STALE'; end if;
  if not exists(select 1 from private.admin_memberships m join auth.users u on u.id=m.user_id where m.user_id=p_actor and m.company_id=p_company and u.email_confirmed_at is not null)
     or not exists(select 1 from private.ir_invitations i where i.company_id=p_company and i.email=p_email and i.active and i.role='investor')
  then raise exception 'CREDENTIAL_INACTIVE'; end if;
  target:=private.investor_password_target(p_company,p_email);
  if target is null or target is distinct from p_user then raise exception 'CREDENTIAL_IDENTITY_CHANGED'; end if;
  update private.ir_investor_credentials set auth_user_id=p_user,issued_at=now(),request_id=null,requested_at=null,requested_by=null
    where company_id=p_company and email=p_email;
  insert into public.audit_logs(company_id,actor_id,action,record_id,metadata)
    values(p_company,p_actor,'investor-password-issued',p_company,jsonb_build_object('email',p_email,'userId',p_user));
  return true;
end $$;
create function public.ir_complete_investor_password(p_company uuid,p_email text,p_request uuid,p_actor uuid,p_user uuid)
returns boolean language sql security invoker set search_path='' as $$
  select private.complete_investor_password(p_company,p_email,p_request,p_actor,p_user)
$$;
revoke all on function private.complete_investor_password(uuid,text,uuid,uuid,uuid),public.ir_complete_investor_password(uuid,text,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function private.complete_investor_password(uuid,text,uuid,uuid,uuid),public.ir_complete_investor_password(uuid,text,uuid,uuid,uuid) to service_role;

create function private.list_investor_access(p_company uuid)
returns table(email text,active boolean,created_at timestamptz,password_issued_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.is_admin(p_company) then raise exception 'CREDENTIAL_ADMIN_REQUIRED'; end if;
  return query select i.email,i.active,i.created_at,c.issued_at from private.ir_invitations i
    left join private.ir_investor_credentials c on c.company_id=i.company_id and c.email=i.email
    where i.company_id=p_company and i.role='investor' order by i.created_at desc;
end $$;
create function public.ir_list_investor_access(p_company uuid)
returns table(email text,active boolean,created_at timestamptz,password_issued_at timestamptz)
language sql security invoker set search_path='' as $$select * from private.list_investor_access(p_company)$$;
revoke all on function private.list_investor_access(uuid),public.ir_list_investor_access(uuid) from public,anon;
grant execute on function private.list_investor_access(uuid),public.ir_list_investor_access(uuid) to authenticated;
