-- WeDrink U-Thong Coffee BOGO Coupon System
-- Run this in the Supabase SQL Editor

create table if not exists coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,              -- short code embedded in QR, e.g. WD-7K2P9X
  status text not null default 'unclaimed', -- 'unclaimed' | 'claimed' | 'redeemed'
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  redeemed_at timestamptz,
  claimed_by_phone text,                  -- non-transferable: tied to this phone
  generated_by text                       -- optional: which staff/till generated it
);

-- Enforce the hard cap of 100 coupons ever created
create or replace function check_coupon_limit()
returns trigger as $$
begin
  if (select count(*) from coupons) >= 100 then
    raise exception 'Coupon limit of 100 reached';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists enforce_coupon_limit on coupons;
create trigger enforce_coupon_limit
  before insert on coupons
  for each row execute function check_coupon_limit();

-- Index for fast lookup by code (used on claim + redeem pages)
create index if not exists idx_coupons_code on coupons(code);

-- Row Level Security: allow anon key to read/update only via specific safe operations.
-- For simplicity in this small internal tool, we allow anon read/insert/update,
-- and rely on the hidden staff URL + app logic for protection.
alter table coupons enable row level security;

create policy "Allow anon select" on coupons for select using (true);
create policy "Allow anon insert" on coupons for insert with check (true);
create policy "Allow anon update" on coupons for update using (true);
