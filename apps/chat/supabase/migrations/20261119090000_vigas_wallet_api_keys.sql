-- ---------------------------------------------------------------------------
-- Vigas unified account: prepaid credits wallet + API keys.
--
-- One Supabase identity now signs users into both vigas.app and vigas.app/chat.
-- This migration gives that identity the API side of the product:
--
--   vigas_wallets   one row per user — prepaid balance in micro-dollars
--   vigas_ledger    append-only history of every credit and debit
--   vigas_api_keys  OpenAI-compatible keys; only a SHA-256 hash is stored
--
-- The browser never touches these tables directly. Everything goes through
-- SECURITY DEFINER functions that read auth.uid(), so a client can only ever
-- see or change its own account, and money can only move via service-role
-- calls (payment webhook, API gateway).
-- ---------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

create table if not exists public.vigas_wallets (
  user_id               uuid primary key references public.profiles (id) on delete cascade,
  balance_micros        bigint not null default 0 check (balance_micros >= 0),
  lifetime_topup_micros bigint not null default 0 check (lifetime_topup_micros >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists public.vigas_ledger (
  id                   bigserial primary key,
  user_id              uuid not null references public.profiles (id) on delete cascade,
  kind                 text not null check (kind in ('topup', 'usage', 'refund', 'adjust')),
  -- Positive for credits, negative for debits.
  amount_micros        bigint not null,
  balance_after_micros bigint not null,
  -- Payment reference for top-ups (idempotency) or request id for usage.
  reference            text,
  description          text,
  api_key_id           uuid,
  model                text,
  created_at           timestamptz not null default now()
);

create index if not exists vigas_ledger_user_idx on public.vigas_ledger (user_id, created_at desc);
-- A payment provider retrying its webhook must never credit the same payment twice.
create unique index if not exists vigas_ledger_topup_reference_uidx
  on public.vigas_ledger (reference) where kind = 'topup' and reference is not null;

create table if not exists public.vigas_api_keys (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references public.profiles (id) on delete cascade,
  name                 text not null check (char_length(name) between 1 and 80),
  -- First characters of the key, shown in the dashboard so users can tell keys apart.
  prefix               text not null,
  key_hash             text not null unique,
  monthly_limit_micros bigint check (monthly_limit_micros is null or monthly_limit_micros between 1000000 and 100000000000),
  spent_month          date not null default (date_trunc('month', now()))::date,
  spent_month_micros   bigint not null default 0,
  last_used_at         timestamptz,
  created_at           timestamptz not null default now(),
  revoked_at           timestamptz
);

create index if not exists vigas_api_keys_user_idx on public.vigas_api_keys (user_id, created_at desc);

alter table public.vigas_wallets enable row level security;
alter table public.vigas_ledger enable row level security;
alter table public.vigas_api_keys enable row level security;

-- No client policies on purpose: the RPCs below are the only door.
revoke all on public.vigas_wallets, public.vigas_ledger, public.vigas_api_keys from anon, authenticated;

drop policy if exists "vigas_wallets_service_role" on public.vigas_wallets;
create policy "vigas_wallets_service_role" on public.vigas_wallets for all to service_role using (true) with check (true);
drop policy if exists "vigas_ledger_service_role" on public.vigas_ledger;
create policy "vigas_ledger_service_role" on public.vigas_ledger for all to service_role using (true) with check (true);
drop policy if exists "vigas_api_keys_service_role" on public.vigas_api_keys;
create policy "vigas_api_keys_service_role" on public.vigas_api_keys for all to service_role using (true) with check (true);

-- ---------------------------------------------------------------------------
-- Signed-in user RPCs
-- ---------------------------------------------------------------------------

-- Everything the dashboard shows, in one round trip.
create or replace function public.vigas_account()
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_wallet public.vigas_wallets;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;

  insert into public.vigas_wallets (user_id) values (v_uid) on conflict (user_id) do nothing;
  select * into v_wallet from public.vigas_wallets where user_id = v_uid;

  return jsonb_build_object(
    'wallet', jsonb_build_object(
      'balance_micros', v_wallet.balance_micros,
      'lifetime_topup_micros', v_wallet.lifetime_topup_micros,
      'updated_at', v_wallet.updated_at
    ),
    'keys', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', k.id,
        'name', k.name,
        'prefix', k.prefix,
        'monthly_limit_micros', k.monthly_limit_micros,
        'spent_month_micros', case when k.spent_month = (date_trunc('month', now()))::date then k.spent_month_micros else 0 end,
        'last_used_at', k.last_used_at,
        'created_at', k.created_at
      ) order by k.created_at desc)
      from public.vigas_api_keys k
      where k.user_id = v_uid and k.revoked_at is null
    ), '[]'::jsonb),
    'ledger', coalesce((
      select jsonb_agg(row_to_json(l)::jsonb order by l.created_at desc)
      from (
        select id, kind, amount_micros, balance_after_micros, description, model, created_at
        from public.vigas_ledger
        where user_id = v_uid
        order by created_at desc
        limit 25
      ) l
    ), '[]'::jsonb),
    'week', coalesce((
      select jsonb_agg(jsonb_build_object('day', d.day::date, 'cost_micros', coalesce(u.cost, 0)) order by d.day)
      from generate_series((now() - interval '6 days')::date, now()::date, interval '1 day') as d(day)
      left join (
        select created_at::date as day, sum(-amount_micros) as cost
        from public.vigas_ledger
        where user_id = v_uid and kind = 'usage' and created_at >= now() - interval '7 days'
        group by 1
      ) u on u.day = d.day::date
    ), '[]'::jsonb)
  );
end;
$$;

-- Returns the full secret exactly once; only its hash is kept.
create or replace function public.vigas_create_api_key(p_name text, p_monthly_limit_micros bigint default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_secret text;
  v_row public.vigas_api_keys;
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception 'Give the key a name (1–80 characters).' using errcode = '22023';
  end if;
  if p_monthly_limit_micros is not null and (p_monthly_limit_micros < 1000000 or p_monthly_limit_micros > 100000000000) then
    raise exception 'Monthly limit must be between $1 and $100,000.' using errcode = '22023';
  end if;
  if (select count(*) from public.vigas_api_keys where user_id = v_uid and revoked_at is null) >= 25 then
    raise exception 'You can have up to 25 active keys. Revoke one first.' using errcode = '23514';
  end if;

  v_secret := 'vg-' || encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.vigas_api_keys (user_id, name, prefix, key_hash, monthly_limit_micros)
  values (v_uid, v_name, left(v_secret, 11), encode(extensions.digest(v_secret, 'sha256'), 'hex'), p_monthly_limit_micros)
  returning * into v_row;

  return jsonb_build_object(
    'id', v_row.id,
    'name', v_row.name,
    'prefix', v_row.prefix,
    'key', v_secret,
    'monthly_limit_micros', v_row.monthly_limit_micros,
    'created_at', v_row.created_at
  );
end;
$$;

create or replace function public.vigas_revoke_api_key(p_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not signed in.' using errcode = '28000';
  end if;
  update public.vigas_api_keys set revoked_at = now()
  where id = p_id and user_id = v_uid and revoked_at is null;
  return found;
end;
$$;

-- ---------------------------------------------------------------------------
-- Service-role RPCs (payment webhook, API gateway)
-- ---------------------------------------------------------------------------

-- Idempotent by reference: the same payment can be reported any number of times.
create or replace function public.vigas_credit_topup(
  p_user_id uuid,
  p_amount_micros bigint,
  p_reference text,
  p_description text default 'Credit top-up'
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_balance bigint;
begin
  if p_amount_micros <= 0 then
    raise exception 'Top-up amount must be positive.' using errcode = '22023';
  end if;
  if p_reference is not null and exists (
    select 1 from public.vigas_ledger where kind = 'topup' and reference = p_reference
  ) then
    select balance_micros into v_balance from public.vigas_wallets where user_id = p_user_id;
    return v_balance;
  end if;

  insert into public.vigas_wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;
  update public.vigas_wallets
     set balance_micros = balance_micros + p_amount_micros,
         lifetime_topup_micros = lifetime_topup_micros + p_amount_micros,
         updated_at = now()
   where user_id = p_user_id
  returning balance_micros into v_balance;

  insert into public.vigas_ledger (user_id, kind, amount_micros, balance_after_micros, reference, description)
  values (p_user_id, 'topup', p_amount_micros, v_balance, p_reference, p_description);

  return v_balance;
end;
$$;

-- Resolves a presented API key for the gateway. Returns no row for unknown/revoked keys.
create or replace function public.vigas_authenticate_api_key(p_key text)
returns table (key_id uuid, user_id uuid, balance_micros bigint, monthly_limit_micros bigint, spent_month_micros bigint)
language sql
security definer
set search_path = public, extensions
as $$
  select k.id, k.user_id, coalesce(w.balance_micros, 0), k.monthly_limit_micros,
         case when k.spent_month = (date_trunc('month', now()))::date then k.spent_month_micros else 0 end
  from public.vigas_api_keys k
  left join public.vigas_wallets w on w.user_id = k.user_id
  where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
    and k.revoked_at is null
  limit 1;
$$;

-- Atomically debits a completed API request. Fails (and charges nothing) when the
-- balance or the key's monthly limit would be exceeded.
create or replace function public.vigas_charge_usage(
  p_key_id uuid,
  p_cost_micros bigint,
  p_model text,
  p_reference text default null
)
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_key public.vigas_api_keys;
  v_month date := (date_trunc('month', now()))::date;
  v_spent bigint;
  v_balance bigint;
begin
  if p_cost_micros < 0 then
    raise exception 'Cost cannot be negative.' using errcode = '22023';
  end if;

  select * into v_key from public.vigas_api_keys where id = p_key_id and revoked_at is null for update;
  if not found then
    raise exception 'Unknown or revoked API key.' using errcode = '28000';
  end if;

  v_spent := case when v_key.spent_month = v_month then v_key.spent_month_micros else 0 end;
  if v_key.monthly_limit_micros is not null and v_spent + p_cost_micros > v_key.monthly_limit_micros then
    raise exception 'This key has reached its monthly limit.' using errcode = '23514';
  end if;

  update public.vigas_wallets
     set balance_micros = balance_micros - p_cost_micros, updated_at = now()
   where user_id = v_key.user_id and balance_micros >= p_cost_micros
  returning balance_micros into v_balance;
  if not found then
    raise exception 'Insufficient credits.' using errcode = '23514';
  end if;

  update public.vigas_api_keys
     set spent_month = v_month, spent_month_micros = v_spent + p_cost_micros, last_used_at = now()
   where id = p_key_id;

  insert into public.vigas_ledger (user_id, kind, amount_micros, balance_after_micros, reference, description, api_key_id, model)
  values (v_key.user_id, 'usage', -p_cost_micros, v_balance, p_reference, 'API usage', p_key_id, p_model);

  return v_balance;
end;
$$;

revoke all on function public.vigas_account() from public, anon;
revoke all on function public.vigas_create_api_key(text, bigint) from public, anon;
revoke all on function public.vigas_revoke_api_key(uuid) from public, anon;
revoke all on function public.vigas_credit_topup(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.vigas_authenticate_api_key(text) from public, anon, authenticated;
revoke all on function public.vigas_charge_usage(uuid, bigint, text, text) from public, anon, authenticated;

grant execute on function public.vigas_account() to authenticated;
grant execute on function public.vigas_create_api_key(text, bigint) to authenticated;
grant execute on function public.vigas_revoke_api_key(uuid) to authenticated;
grant execute on function public.vigas_credit_topup(uuid, bigint, text, text) to service_role;
grant execute on function public.vigas_authenticate_api_key(text) to service_role;
grant execute on function public.vigas_charge_usage(uuid, bigint, text, text) to service_role;
