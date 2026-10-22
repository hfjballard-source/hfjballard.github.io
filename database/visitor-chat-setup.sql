-- Run in a dedicated VISITOR CHAT Supabase project. No store data belongs here.
begin;
-- Visitor project only: sgkuooxwgksmmbouzzvt. Do not run in Store Databases.
-- Existing unrelated tables and the old prototype namespace are not changed.
create schema if not exists bookshop_visitors_private;
revoke all on schema bookshop_visitors_private from public, anon, authenticated;
grant usage on schema bookshop_visitors_private to authenticated;

create table if not exists bookshop_visitors_private.visitors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  attempt uuid not null,
  state text not null check (state in ('waiting','paired','ended')),
  room uuid,
  peer uuid,
  role smallint check (role in (0,1)),
  joined_at timestamptz not null default now(),
  touched_at timestamptz not null default now(),
  check ((state = 'paired') = (room is not null and peer is not null and role is not null))
);
alter table bookshop_visitors_private.visitors enable row level security;
revoke all on bookshop_visitors_private.visitors from public, anon, authenticated;
create index if not exists bookshop_visitors_waiting on bookshop_visitors_private.visitors(joined_at) where state='waiting';
create index if not exists bookshop_visitors_expiry on bookshop_visitors_private.visitors(touched_at);

-- Only this narrowly scoped function can change queue membership.
-- A transaction lock prevents simultaneous arrivals being paired twice.
create or replace function bookshop_visitors_private.encounter(p_action text, p_attempt uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
  mine bookshop_visitors_private.visitors%rowtype;
  other bookshop_visitors_private.visitors%rowtype;
  shared_room uuid;
begin
  if me is null or not coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then
    raise exception 'Anonymous visitor session required' using errcode='42501';
  end if;
  if p_attempt is null or p_action not in ('join','status','leave') or p_action is null then
    raise exception 'Invalid encounter request' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(721695,1);

  -- Expired rows cannot authorize channels. Delete on the next queue/heartbeat call.
  delete from bookshop_visitors_private.visitors where touched_at < now()-interval '45 seconds';
  update bookshop_visitors_private.visitors v set state='ended',room=null,peer=null,role=null
    where v.state='paired' and not exists (
      select 1 from bookshop_visitors_private.visitors p where p.user_id=v.peer and p.room=v.room and p.state='paired'
    );
  select * into mine from bookshop_visitors_private.visitors where user_id=me;

  if p_action='leave' then
    if mine.user_id is not null and mine.attempt=p_attempt then
      update bookshop_visitors_private.visitors set state='ended',room=null,peer=null,role=null,touched_at=now()
        where user_id=me or (room=mine.room and mine.room is not null);
    elsif mine.user_id is null then
      -- A tombstone prevents a delayed join request resurrecting cancelled waiting.
      insert into bookshop_visitors_private.visitors(user_id,attempt,state) values(me,p_attempt,'ended');
    end if;
    return jsonb_build_object('state','ended');
  end if;

  if p_action='join' and (mine.user_id is null or mine.attempt<>p_attempt) then
    if mine.room is not null then
      update bookshop_visitors_private.visitors set state='ended',room=null,peer=null,role=null
        where room=mine.room and user_id<>me;
    end if;
    if (select count(*) from bookshop_visitors_private.visitors where state='waiting')>=32 then
      return jsonb_build_object('state','busy');
    end if;
    insert into bookshop_visitors_private.visitors(user_id,attempt,state)
      values(me,p_attempt,'waiting') on conflict(user_id) do update
      set attempt=excluded.attempt,state='waiting',room=null,peer=null,role=null,joined_at=now(),touched_at=now();
    select * into mine from bookshop_visitors_private.visitors where user_id=me;
  end if;
  if mine.user_id is null or mine.attempt<>p_attempt or mine.state='ended' then
    return jsonb_build_object('state','ended');
  end if;
  update bookshop_visitors_private.visitors set touched_at=now() where user_id=me;

  -- Bounded launch capacity: four simultaneous pairs. Other willing visitors wait.
  if mine.state='waiting' and (select count(*) from bookshop_visitors_private.visitors where state='paired')<8 then
    select * into other from bookshop_visitors_private.visitors
      where state='waiting' and user_id<>me order by joined_at,user_id limit 1;
    if other.user_id is not null then
      shared_room := gen_random_uuid();
      update bookshop_visitors_private.visitors set state='paired',room=shared_room,peer=me,role=0 where user_id=other.user_id;
      update bookshop_visitors_private.visitors set state='paired',room=shared_room,peer=other.user_id,role=1 where user_id=me;
    end if;
  end if;
  select * into mine from bookshop_visitors_private.visitors where user_id=me;
  if mine.state='paired' then
    return jsonb_build_object('state','paired','room',mine.room,'peer',mine.peer,'role',mine.role);
  end if;
  return jsonb_build_object('state',mine.state);
end;
$$;
revoke all on function bookshop_visitors_private.encounter(text,uuid) from public,anon,authenticated;
grant execute on function bookshop_visitors_private.encounter(text,uuid) to authenticated;

-- Public REST wrapper has no elevated privileges of its own.
create or replace function public.bookshop_encounter(p_action text,p_attempt uuid)
returns jsonb language sql security invoker set search_path='' as $$
  select bookshop_visitors_private.encounter(p_action,p_attempt);
$$;
revoke all on function public.bookshop_encounter(text,uuid) from public,anon,authenticated;
grant execute on function public.bookshop_encounter(text,uuid) to authenticated;

create or replace function bookshop_visitors_private.can_join(p_topic text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists (
    select 1 from bookshop_visitors_private.visitors
    where user_id=(select auth.uid()) and state='paired'
      and touched_at>now()-interval '45 seconds'
      and p_topic='bookshop-live:'||room::text
  );
$$;
revoke all on function bookshop_visitors_private.can_join(text) from public,anon,authenticated;
grant execute on function bookshop_visitors_private.can_join(text) to authenticated;

-- WebSocket Broadcast only; never realtime.send() or persisted chat rows.
drop policy if exists bookshop_live_receive on realtime.messages;
create policy bookshop_live_receive on realtime.messages for select to authenticated
  using (extension='broadcast' and (select bookshop_visitors_private.can_join((select realtime.topic()))));
drop policy if exists bookshop_live_send on realtime.messages;
create policy bookshop_live_send on realtime.messages for insert to authenticated
  with check (extension='broadcast' and (select bookshop_visitors_private.can_join((select realtime.topic()))));
-- Restrictive guards prevent another permissive policy authorizing these rooms.
drop policy if exists bookshop_live_receive_guard on realtime.messages;
create policy bookshop_live_receive_guard on realtime.messages as restrictive for select to authenticated
 using ((select realtime.topic()) not like 'bookshop-live:%'
  or (extension='broadcast' and (select bookshop_visitors_private.can_join((select realtime.topic())))));
drop policy if exists bookshop_live_send_guard on realtime.messages;
create policy bookshop_live_send_guard on realtime.messages as restrictive for insert to authenticated
 with check ((select realtime.topic()) not like 'bookshop-live:%'
  or (extension='broadcast' and (select bookshop_visitors_private.can_join((select realtime.topic())))));
notify pgrst,'reload schema';
commit;
