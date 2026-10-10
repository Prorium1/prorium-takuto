-- An invited, email-confirmed administrator can use a normal Supabase session.
-- Membership, RLS, review and publication checks remain in force.
create or replace function private.is_admin(company uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1
    from private.admin_memberships m
    join auth.users u on u.id=m.user_id
    where m.user_id=auth.uid()
      and m.company_id=company
      and u.email_confirmed_at is not null
  )
$$;

create or replace function private.ir_actor(p_company uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null then return null; end if;
  if private.is_admin(p_company) then
    return jsonb_build_object('id',auth.uid(),'role','admin','companyId',p_company,'needsMfa',false);
  end if;
  if private.has_investor_grant(p_company) then
    return jsonb_build_object('id',auth.uid(),'role','investor','companyId',p_company,'needsMfa',false);
  end if;
  return null;
end $$;

revoke all on function private.is_admin(uuid),private.ir_actor(uuid) from public,anon;
grant execute on function private.is_admin(uuid),private.ir_actor(uuid) to authenticated,service_role;
