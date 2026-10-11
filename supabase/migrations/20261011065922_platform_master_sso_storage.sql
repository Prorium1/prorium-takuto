begin;
create table private.platform_admin_links (
  platform_user_id uuid primary key,
  ir_user_id uuid not null references auth.users(id),
  company_id uuid not null references public.companies(id),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create table private.platform_login_codes (
  code_hash text primary key check(code_hash ~ '^[a-f0-9]{64}$'),
  platform_user_id uuid not null references private.platform_admin_links(platform_user_id),
  challenge text not null check(challenge ~ '^[A-Za-z0-9_-]{43}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '60 seconds'),
  consumed_at timestamptz
);
create index platform_codes_user_created on private.platform_login_codes(platform_user_id,created_at);
alter table private.platform_admin_links enable row level security;
alter table private.platform_login_codes enable row level security;
revoke all on private.platform_admin_links,private.platform_login_codes from public,anon,authenticated;
grant select,insert,update,delete on private.platform_admin_links,private.platform_login_codes to service_role;

commit;
