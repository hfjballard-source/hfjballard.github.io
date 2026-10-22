-- Run only in the EXISTING STORE project. Private preferences, not new purchases.
begin;
create table if not exists public.store_signed_editions (
  email text not null,
  sku text not null,
  files jsonb,
  template_version text,
  placeholder boolean not null default false,
  requested_at timestamptz not null default now(),
  primary key(email,sku),
  check(email=lower(trim(email)))
);
alter table public.store_signed_editions add column if not exists files jsonb;
alter table public.store_signed_editions add column if not exists template_version text;
alter table public.store_signed_editions add column if not exists placeholder boolean not null default false;
alter table public.store_signed_editions enable row level security;
revoke all on public.store_signed_editions from public,anon,authenticated;
grant select,insert,update on public.store_signed_editions to service_role;
notify pgrst,'reload schema';
commit;
