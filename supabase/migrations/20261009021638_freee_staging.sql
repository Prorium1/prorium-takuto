-- Production-only, private staging. Values remain unverified until an MFA admin reviews the accounting close and mapping.
create table private.freee_staged_financials (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null references public.companies(id),
 period date not null check(extract(day from period)=1),
 freee_company_id bigint not null check(freee_company_id>0),
 candidate jsonb not null check(jsonb_typeof(candidate)='object'),
 provenance jsonb not null check(jsonb_typeof(provenance)='object'),
 checksum text not null default '',
 status text not null default 'pending-review' check(status='pending-review'),
 created_at timestamptz not null default now(),
 unique(company_id,period,checksum)
);
alter table private.freee_staged_financials enable row level security;
revoke all on private.freee_staged_financials from public,anon,authenticated;
create function private.prepare_freee_stage() returns trigger language plpgsql set search_path='' as $$
begin
 if octet_length(new.candidate::text)>20000 or octet_length(new.provenance::text)>20000 then raise exception 'Staged payload too large'; end if;
 if new.candidate->>'period' is distinct from to_char(new.period,'YYYY-MM') or new.provenance->>'period' is distinct from to_char(new.period,'YYYY-MM') then raise exception 'Staged period mismatch'; end if;
 if new.candidate->>'currency' is distinct from 'JPY' or new.provenance->>'closeConfirmed' is distinct from 'false' then raise exception 'Staged financial provenance required'; end if;
 new.checksum:=encode(sha256(convert_to(new.candidate::text||new.provenance::text,'UTF8')),'hex');
 return new;
end $$;
create trigger prepare_freee_stage before insert on private.freee_staged_financials for each row execute function private.prepare_freee_stage();
create function private.reject_freee_stage_mutation() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Staged freee import is immutable'; end $$;
create trigger freee_stage_immutable before update or delete on private.freee_staged_financials for each row execute function private.reject_freee_stage_mutation();
create function private.list_freee_staged(p_company uuid) returns table(id uuid,period text,candidate jsonb,provenance jsonb,checksum text,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if not private.is_admin(p_company) then raise exception 'Admin MFA required'; end if;
 return query select s.id,to_char(s.period,'YYYY-MM'),s.candidate,s.provenance,s.checksum,s.created_at from private.freee_staged_financials s where s.company_id=p_company order by s.created_at desc limit 50;
end $$;
create function public.ir_list_freee_staged(p_company uuid) returns table(id uuid,period text,candidate jsonb,provenance jsonb,checksum text,created_at timestamptz) language sql security invoker set search_path='' as $$ select * from private.list_freee_staged(p_company) $$;
revoke all on function private.list_freee_staged(uuid),public.ir_list_freee_staged(uuid),private.prepare_freee_stage(),private.reject_freee_stage_mutation() from public,anon;
grant execute on function private.list_freee_staged(uuid),public.ir_list_freee_staged(uuid) to authenticated;
