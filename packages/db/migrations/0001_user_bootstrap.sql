-- Sign-up bootstrap (IMPLEMENTATION-PLAN §4.2 step 1): every user gets a customer profile and a
-- buying-power account in the same transaction as the user row. A trigger rather than a Better Auth
-- hook, because Better Auth runs `user.create.after` hooks only after its transaction commits.
-- It covers every creation path: email sign-up, Google, admin createUser, seeds.
CREATE FUNCTION "user_bootstrap"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO "customer_profiles" ("user_id") VALUES (NEW."id") ON CONFLICT DO NOTHING;
  INSERT INTO "buying_power_accounts" ("user_id") VALUES (NEW."id") ON CONFLICT DO NOTHING;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER "user_bootstrap_trg" AFTER INSERT ON "user"
FOR EACH ROW EXECUTE FUNCTION "user_bootstrap"();
