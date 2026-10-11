begin;
create function public.ir_issue_platform_code(p_platform_user uuid,p_code_hash text,p_challenge text)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from private.platform_admin_links l join private.admin_memberships m
    on m.user_id=l.ir_user_id and m.company_id=l.company_id
    where l.platform_user_id=p_platform_user and l.enabled) then
    raise exception 'Platform administrator access denied';
  end if;
  -- Serialize issuance for this identity, including concurrent requests.
  perform 1 from private.platform_admin_links where platform_user_id=p_platform_user for update;
  if (select count(*) from private.platform_login_codes where platform_user_id=p_platform_user
      and created_at>now()-interval '5 minutes')>=10 then
    raise exception 'Platform login rate limited';
  end if;
  delete from private.platform_login_codes where created_at<now()-interval '1 day';
  insert into private.platform_login_codes(code_hash,platform_user_id,challenge)
    values(p_code_hash,p_platform_user,p_challenge);
end $$;
create function public.ir_redeem_platform_code(p_code_hash text,p_challenge text)
returns table(ir_user_id uuid,company_id uuid,platform_user_id uuid)
language plpgsql security invoker set search_path='' as $$
declare code private.platform_login_codes; link private.platform_admin_links;
begin
  select * into code from private.platform_login_codes c where c.code_hash=p_code_hash for update;
  if not found or code.consumed_at is not null or code.expires_at<=now() or code.challenge<>p_challenge then
    raise exception 'Invalid or expired Platform login code';
  end if;
  select * into link from private.platform_admin_links l where l.platform_user_id=code.platform_user_id and l.enabled;
  if not found or not exists(select 1 from private.admin_memberships m
     where m.user_id=link.ir_user_id and m.company_id=link.company_id) then
    raise exception 'Platform administrator access denied';
  end if;
  update private.platform_login_codes set consumed_at=now() where code_hash=p_code_hash;
  insert into public.audit_logs(company_id,actor_id,action,record_id,metadata)
    values(link.company_id,link.ir_user_id,'auth.platform_code_redeemed',link.ir_user_id,jsonb_build_object('platform_user_id',link.platform_user_id));
  return query select link.ir_user_id,link.company_id,link.platform_user_id;
end $$;
revoke all on function public.ir_issue_platform_code(uuid,text,text),public.ir_redeem_platform_code(text,text) from public,anon,authenticated;
grant execute on function public.ir_issue_platform_code(uuid,text,text),public.ir_redeem_platform_code(text,text) to service_role;
commit;
