-- OAuth credentials are encrypted in the application before storage. No Data API table grants.
create table private.freee_connections (
 company_id uuid primary key references public.companies(id),
 freee_company_id bigint not null check(freee_company_id>0),
 token_ciphertext text not null check(length(token_ciphertext) between 40 and 16000),
 expires_at timestamptz not null,
 connected_by uuid not null references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table private.freee_connections enable row level security;
revoke all on private.freee_connections from public,anon,authenticated;

create function private.save_freee_connection(p_company uuid,p_freee_company bigint,p_ciphertext text,p_expires_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.is_admin(p_company) then raise exception 'Admin MFA required'; end if;
 if p_freee_company<=0 or length(p_ciphertext) not between 40 and 16000 or p_expires_at<=now() then raise exception 'Invalid freee connection'; end if;
 insert into private.freee_connections(company_id,freee_company_id,token_ciphertext,expires_at,connected_by)
 values(p_company,p_freee_company,p_ciphertext,p_expires_at,auth.uid())
 on conflict(company_id) do update set freee_company_id=excluded.freee_company_id,token_ciphertext=excluded.token_ciphertext,expires_at=excluded.expires_at,connected_by=excluded.connected_by,updated_at=now();
 insert into public.audit_logs(company_id,actor_id,action,record_id,metadata)
 values(p_company,auth.uid(),'freee-connected',p_company,jsonb_build_object('freeeCompanyId',p_freee_company));
end $$;
create function private.freee_connection_status(p_company uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare c private.freee_connections;
begin
 if not private.is_admin(p_company) then raise exception 'Admin MFA required'; end if;
 select * into c from private.freee_connections where company_id=p_company;
 if c.company_id is null then return jsonb_build_object('connected',false); end if;
 return jsonb_build_object('connected',true,'freeeCompanyId',c.freee_company_id,'updatedAt',c.updated_at,'tokenExpiresAt',c.expires_at);
end $$;
create function public.ir_save_freee_connection(p_company uuid,p_freee_company bigint,p_ciphertext text,p_expires_at timestamptz) returns void language sql security invoker set search_path='' as $$ select private.save_freee_connection(p_company,p_freee_company,p_ciphertext,p_expires_at) $$;
create function public.ir_freee_connection_status(p_company uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.freee_connection_status(p_company) $$;
revoke all on function private.save_freee_connection(uuid,bigint,text,timestamptz),private.freee_connection_status(uuid),public.ir_save_freee_connection(uuid,bigint,text,timestamptz),public.ir_freee_connection_status(uuid) from public,anon;
grant execute on function private.save_freee_connection(uuid,bigint,text,timestamptz),private.freee_connection_status(uuid),public.ir_save_freee_connection(uuid,bigint,text,timestamptz),public.ir_freee_connection_status(uuid) to authenticated;
