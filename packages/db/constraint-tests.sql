-- Self-checking constraint tests (14 cases). Run on an EMPTY database after migrating:
--   psql -v ON_ERROR_STOP=1 -f constraint-tests.sql
-- Any failed expectation raises an exception and psql exits non-zero.
-- Milestone 1 ports these to Vitest + Testcontainers (Postgres 17) in CI.
\set ON_ERROR_STOP 1

create or replace function pg_temp.expect_violation(stmt text, constraint_name text) returns void
language plpgsql as $$
declare c text;
begin
  begin
    execute stmt;
  exception when others then
    get stacked diagnostics c = constraint_name;
    if c is distinct from expect_violation.constraint_name then
      raise exception 'FAIL: expected %, got % (%)', expect_violation.constraint_name, c, sqlerrm;
    end if;
    raise notice 'PASS: % rejected by %', left(stmt, 60), c;
    return;
  end;
  raise exception 'FAIL: statement succeeded, expected %: %', expect_violation.constraint_name, stmt;
end $$;

-- fixtures
insert into "user"(id,name,email) values ('u1','A','a@x.lt'),('u2','B','b@x.lt');
-- customer_profiles and buying_power_accounts rows come from the user_bootstrap trigger (T14)
insert into vehicles(vin,make,model,year) values ('1HGCM82633A004352','Honda','Accord',2003);
insert into lots(source,external_lot_id,vehicle_id,status,sale_at) values ('copart','12345678',1,'upcoming', now()+interval '2 days');
insert into bids(user_id,lot_id,max_bid_usd_cents,lot_snapshot,terms_version,idempotency_key) values ('u1',1,500000,'{}','2026-11','k1');

-- T1 one active bid per lot
select pg_temp.expect_violation($q$insert into bids(user_id,lot_id,max_bid_usd_cents,lot_snapshot,terms_version,idempotency_key) values ('u2',1,510000,'{}','2026-11','k2')$q$, 'bids_one_active_per_lot_uq');

-- T2 takeover in one transaction succeeds: old → outbid, new inserted, then link
update bids set status='outbid' where id=1;
insert into bids(user_id,lot_id,max_bid_usd_cents,lot_snapshot,terms_version,idempotency_key) values ('u2',1,510000,'{}','2026-11','k2');
update bids set outbid_by_bid_id = (select id from bids where idempotency_key='k2') where id=1;
do $$ begin
  if (select count(*) from bids where lot_id=1 and status in ('pending','locked','placed','won_pending_approval')) <> 1
  then raise exception 'FAIL: T2 expected exactly one active bid'; end if;
  raise notice 'PASS: T2 takeover leaves exactly one active bid';
end $$;

-- T3 duplicate idempotency key
select pg_temp.expect_violation($q$insert into bids(user_id,lot_id,max_bid_usd_cents,lot_snapshot,terms_version,idempotency_key,status) values ('u1',1,1,'{}','2026-11','k2','cancelled')$q$, 'bids_idempotency_key_unique');
-- T4 zero bid
select pg_temp.expect_violation($q$insert into bids(user_id,lot_id,max_bid_usd_cents,lot_snapshot,terms_version,idempotency_key,status) values ('u1',1,0,'{}','2026-11','k9','cancelled')$q$, 'bids_amount_chk');
-- T5 one active rate card
insert into rate_cards(name,status) values ('v1','active');
select pg_temp.expect_violation($q$insert into rate_cards(name,status) values ('v2','active')$q$, 'rate_cards_one_active_uq');

-- T6 Stripe refund recorded twice (admin path + webhook)
insert into plans(code,name) values ('basic','Basic');
insert into plan_versions(plan_id,version,deposit_eur_cents,buying_power_usd_cents,max_active_bids) values (1,1,150000,1000000,2);
insert into deposits(user_id,plan_version_id,amount_eur_cents,grants_buying_power_usd_cents,status) values ('u1',1,150000,1000000,'succeeded');
insert into deposit_transactions(deposit_id,kind,origin,amount_eur_cents,stripe_object_id) values (1,'refund','platform',150000,'re_123');
select pg_temp.expect_violation($q$insert into deposit_transactions(deposit_id,kind,origin,amount_eur_cents,stripe_object_id) values (1,'refund','stripe_dashboard',150000,'re_123')$q$, 'deposit_tx_stripe_kind_uq');
-- T7 admin forfeit double-click
insert into deposit_transactions(deposit_id,kind,origin,amount_eur_cents,idempotency_key) values (1,'forfeit','platform',10000,'adm-1');
select pg_temp.expect_violation($q$insert into deposit_transactions(deposit_id,kind,origin,amount_eur_cents,idempotency_key) values (1,'forfeit','platform',10000,'adm-1')$q$, 'deposit_transactions_idempotency_key_unique');
-- T8 admin row without any dedupe key
select pg_temp.expect_violation($q$insert into deposit_transactions(deposit_id,kind,origin,amount_eur_cents) values (1,'forfeit','platform',10000)$q$, 'deposit_tx_dedupe_chk');
-- T9 negative reserved buying power
select pg_temp.expect_violation($q$update buying_power_accounts set reserved_usd_cents=-1 where user_id='u1'$q$, 'bp_accounts_nonneg_chk');
-- T10 invalid role (Better Auth default 'user' must be configured away)
select pg_temp.expect_violation($q$update "user" set role='user' where id='u1'$q$, 'user_role_chk');
-- T11 towing rate with neither yard nor state
insert into ports(code,name,country,kind) values ('US-NJ','Newark','US','us_export');
select pg_temp.expect_violation($q$insert into towing_rates(rate_card_id,port_id,price_usd_cents) values (1,1,50000)$q$, 'towing_target_chk');
-- T12 dangling outbid reference
select pg_temp.expect_violation($q$update bids set outbid_by_bid_id=999 where id=1$q$, 'bids_outbid_by_bid_id_bids_id_fk');

-- T13 vehicles without VIN are allowed (many)
insert into vehicles(make) values ('X'),('Y');

-- T14 every new user gets a customer profile and an all-zero buying-power account (§4.2)
do $$
begin
  if (select count(*) from customer_profiles where user_id in ('u1','u2')) <> 2 then
    raise exception 'FAIL: T14 customer_profiles not bootstrapped';
  end if;
  if (select count(*) from buying_power_accounts
      where user_id in ('u1','u2') and granted_usd_cents = 0 and consumed_usd_cents = 0) <> 2 then
    raise exception 'FAIL: T14 buying_power_accounts not bootstrapped';
  end if;
  raise notice 'PASS: T14 user insert bootstraps profile and buying-power account';
end $$;

\echo 'ALL CONSTRAINT TESTS PASSED'
