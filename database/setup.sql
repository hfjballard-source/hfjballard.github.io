-- Run once in the Supabase SQL Editor. Keep the digital-assets bucket PRIVATE.
create table public.store_orders (
  session_id text primary key,
  sheet_row bigint generated always as identity unique,
  payment_intent text unique not null,
  email text not null check (email = lower(trim(email))),
  amount_total bigint not null,
  currency text not null,
  status text not null check (status in ('paid', 'refunded', 'disputed')),
  refunded_amount bigint not null default 0,
  entitlements jsonb not null check (jsonb_typeof(entitlements) = 'array'),
  purchased_at timestamptz not null,
  revision bigint not null default 1,
  sheet_synced_revision bigint not null default 0,
  sheet_sync_token uuid,
  sheet_lease_until timestamptz
);
create index store_orders_email_idx on public.store_orders(email);
-- Retains revocations even if a refund/dispute arrives BEFORE checkout fulfillment.
create table public.store_payment_states (
  payment_intent text primary key,
  status text not null check (status in ('paid','refunded','disputed')),
  refunded_amount bigint not null default 0
);
create table public.store_rate_limits (
  key text primary key,
  expires_at timestamptz not null,
  hits integer not null
);
alter table public.store_orders enable row level security;
alter table public.store_rate_limits enable row level security;
alter table public.store_payment_states enable row level security;
revoke all on public.store_orders, public.store_rate_limits, public.store_payment_states from anon, authenticated;
grant all on public.store_orders, public.store_rate_limits, public.store_payment_states to service_role;
grant usage, select on sequence public.store_orders_sheet_row_seq to service_role;
-- No browser policies: all purchases and download decisions go through the server.

create or replace function public.record_store_order(
  p_session text, p_payment text, p_email text, p_amount bigint, p_currency text,
  p_status text, p_refunded bigint, p_items jsonb, p_purchased timestamptz
) returns void language plpgsql set search_path = public as $$
declare previous public.store_payment_states; effective_status text; effective_refunded bigint;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_payment,0));
  select * into previous from store_payment_states where payment_intent=p_payment;
  effective_status := case when previous.status='refunded' or p_status='refunded' then 'refunded'
    when previous.status='disputed' or p_status='disputed' then 'disputed' else 'paid' end;
  effective_refunded := greatest(coalesce(previous.refunded_amount,0),p_refunded);
  insert into store_orders(session_id,payment_intent,email,amount_total,currency,status,refunded_amount,entitlements,purchased_at)
  values(p_session,p_payment,lower(trim(p_email)),p_amount,p_currency,effective_status,effective_refunded,p_items,p_purchased)
  on conflict(session_id) do nothing;
  -- Fulfillment retries must NEVER reactivate revoked purchases.
  if p_status <> 'paid' then
    perform update_store_payment(p_payment,p_status,p_refunded);
  end if;
end $$;

create or replace function public.update_store_payment(p_payment text,p_status text,p_refunded bigint)
returns void language plpgsql set search_path = public as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_payment,0));
  insert into store_payment_states(payment_intent,status,refunded_amount) values(p_payment,p_status,p_refunded)
  on conflict(payment_intent) do update set
    status = case when store_payment_states.status='refunded' or excluded.status='refunded' then 'refunded'
      when store_payment_states.status='disputed' or excluded.status='disputed' then 'disputed' else 'paid' end,
    refunded_amount=greatest(store_payment_states.refunded_amount,excluded.refunded_amount);
  update store_orders set
    status = case when status='refunded' or p_status='refunded' then 'refunded'
      when status='disputed' or p_status='disputed' then 'disputed' else 'paid' end,
    refunded_amount = greatest(refunded_amount,p_refunded), revision = revision+1
  where payment_intent = p_payment and (status <> p_status or refunded_amount < p_refunded);
end $$;

create or replace function public.store_rate_limit(p_key text,p_seconds integer,p_limit integer)
returns boolean language plpgsql set search_path = public as $$
declare count_now integer;
begin
  insert into store_rate_limits(key,expires_at,hits) values(p_key,now()+make_interval(secs=>p_seconds),1)
  on conflict(key) do update set
    hits = case when store_rate_limits.expires_at <= now() then 1 else store_rate_limits.hits+1 end,
    expires_at = case when store_rate_limits.expires_at <= now() then excluded.expires_at else store_rate_limits.expires_at end
  returning hits into count_now;
  return count_now <= p_limit;
end $$;

create or replace function public.claim_store_sheet_rows(p_token uuid)
returns setof public.store_orders language plpgsql set search_path = public as $$
begin
  delete from store_rate_limits where expires_at < now()-interval '1 day';
  return query
  update store_orders set sheet_sync_token=p_token,sheet_lease_until=now()+interval '10 minutes'
  where session_id in (
    select session_id from store_orders
    where sheet_synced_revision < revision and (sheet_lease_until is null or sheet_lease_until < now())
    order by sheet_row limit 20 for update skip locked
  ) returning *;
end $$;

-- Functions are not callable by browser users, even with a public Supabase key.
revoke all on function public.record_store_order(text,text,text,bigint,text,text,bigint,jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.update_store_payment(text,text,bigint) from public,anon,authenticated;
revoke all on function public.store_rate_limit(text,integer,integer) from public,anon,authenticated;
revoke all on function public.claim_store_sheet_rows(uuid) from public,anon,authenticated;
grant execute on function public.record_store_order(text,text,text,bigint,text,text,bigint,jsonb,timestamptz) to service_role;
grant execute on function public.update_store_payment(text,text,bigint) to service_role;
grant execute on function public.store_rate_limit(text,integer,integer) to service_role;
grant execute on function public.claim_store_sheet_rows(uuid) to service_role;

insert into storage.buckets(id,name,public) values ('digital-assets','digital-assets',false)
on conflict(id) do update set public=false;
-- Do NOT add public read policies on storage.objects for digital-assets.
