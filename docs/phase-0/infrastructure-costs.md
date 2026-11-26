# Infrastructure cost estimate

Prepared 2026-11-21 from the vendors' public list prices, checked the same day. Prices exclude VAT. Lithuanian VAT is 21%; US SaaS vendors bill in USD and their VAT is reverse-charged. **Prices change, so check each one again before signing up.**

**Assumptions:**
- Exchange rate: $1 ≈ €0.90, for the estimate only.
- Launch volume: about 100 customers, 20 deposits a month (average $2,500), 50 ID checks a month, and fewer than 3,000 emails a month.

**Not included:**
- development time;
- legal and accounting costs;
- the Copart/IAAI broker accounts;
- vehicle history reports (Phase 2).

## 1. Monthly fixed costs (launch)

| Item | Choice | €/month | Notes |
|---|---|---:|---|
| Production server | Hetzner **CPX42** shared, 8 vCPU / 16 GB, Helsinki | 59.49 | Includes 20 TB of traffic and IPv4. Move to CCX23 (dedicated 4 vCPU / 16 GB, €73.49 in Helsinki) if neighbours on the shared host slow it down. |
| Staging server | Hetzner CPX22, 2 vCPU / 4 GB, Helsinki | 16.99 | |
| Server backups | Hetzner backup add-on (20% of the server price) | 11.90 | Whole-disk restore, on top of our own `pg_dump`. Optional. |
| Database backups | Hetzner Storage Box BX11, 1 TB | 3.20 | Daily and hourly `pg_dump` files |
| Lot data | **apibara Pro**, $70 (assumed) | ≈ 63 | 100k requests and 1 Sync Center feed (30 min) that doesn't count against the quota. Mega isn't needed: its webhooks only announce that a feed file is ready. The trial decides between **Power ($50)**, if `/changes` works over REST, Pro ($70) and Pro max ($110, 15-minute feed). See `apibara-trial-plan.md`. |
| CDN, WAF, Turnstile | Cloudflare Free | 0 | Pro ($20–25/month) only if the free WAF rules aren't enough |
| Transactional email | Resend **Pro**, $20 | ≈ 18 | The free tier stops at 100 emails a day, which is too risky on an auction night |
| ID checks | **Ondato**, about €0.50–1.40 per check | ≈ 70 | Assumes 50 checks/month at €1.40. A monthly minimum isn't published, so ask Ondato. Veriff: $0.80/check with a $49/month minimum. |
| Errors | Sentry Developer | 0 | Free for 1 user. Team plan is $26–29/month if broker staff need access. |
| Uptime and heartbeat | Better Stack free | 0 | 10 monitors and heartbeats in total |
| Domain | `.lt`, about €12/year | 1 | |
| CI and container images | GitHub Free, GHCR | 0 | About 2,000 build minutes a month. GHCR is currently free. |
| Telegram, Google sign-in, NHTSA VIN decoder, ECB exchange rates | | 0 | Free |
| **Total** | | **≈ €240/month** | **≈ €290 including 21% VAT** where it applies. Range about €220–285 depending on the apibara tier. |

**Possible savings, about €95/month at most:**
- drop staging (−€17);
- drop the Hetzner backup add-on (−€12);
- use apibara Power at $50 (−€18), if the trial shows `/changes` works on it;
- use Ondato at its lowest volume price.

That takes it to about **€145/month**, but those choices weaken uptime and data freshness.

## 2. Costs that scale with use

### Stripe deposit fees (Lithuanian Stripe account)

| Payment | Fee | On a $1,500 deposit | On a $5,000 deposit |
|---|---|---:|---:|
| Standard EEA card, **charged in EUR** | 1.5% + €0.25 | ≈ €20 | ≈ €68 |
| Standard EEA card, **charged in USD and settled in EUR** (not used: B14 now charges EUR) | 1.5% + 2% FX + €0.25 | ≈ €48 | ≈ €158 |
| Premium or business EEA card (add +2% FX if charged in USD) | 2.8% + €0.25 | ≈ €38 (€65) | ≈ €126 (€216) |
| International card | 3.15% + €0.25 | ≈ €43 | ≈ €142 |
| **Bank transfer in EUR** (virtual IBAN) | 0.5%, capped at €5 | **€5** | **€5** |
| Bank transfer in USD | 0.5% capped at €5, +1.5% if international, +2% if converted, +€15 per wire | €20–75 | €20–200 |

**Other Stripe fees:**
- **Refunds:** no fee, but the original fee isn't returned. A refunded card deposit costs the broker its full fee.
- **Disputes:** €20, plus €20 to contest (returned if you win).
- **Virtual IBANs:** the first 1,000 are free.

**Example month** (20 deposits averaging $2,500, half paid by card in USD, half by EUR bank transfer): about **€800 by card + €50 by transfer ≈ €850 a month**. Paid in EUR instead, the cards cost about €390, so roughly **€450 a month less**.

### Other scaling costs

| Item | When it grows |
|---|---|
| ID checks | Grow with sign-ups (€0.50–1.40 each) |
| apibara | Mega max ($195, 2M requests) if sync plus page views go over 1M requests a month |
| Servers | Move to CCX23 or larger when Postgres needs more than 70% of RAM or CPU stays above 60% |
| Email | Resend overage $0.90 per 1,000 above 50,000 a month |

## 3. One-off costs
- **Setup:** none significant at the infrastructure level.
- **KYC:** possibly a setup fee or contract minimum from Ondato (ask).
- **Domain:** first-year registration.

## 4. Decisions these numbers affect

1. **B14: deposit currency. Decided 2026-11-21: option (b).** Charging deposits in USD would add about 2% on every EUR card and on converted transfers, about €450 a month at the example volume. The options were:
   - **(a) Keep USD charges.** Simple, but customers or the broker pay about 2% more.
   - **(b) Keep buying power and bids in USD, but charge each plan's deposit as a fixed EUR amount** (for example, the Basic plan costs €1,350 and grants $10,000). That's still no exchange rate in bid checks; only the price is shown in EUR. VINAS lists both ($1,000 / €900).
   - **(c) Keep USD charges and turn on Stripe USD settlement** (about 1%) with a USD bank account. That needs the broker's bank to support it.
2. **Push bank transfers.** At €5 a deposit they are 4–30× cheaper than cards. Showing the fee difference on the payment page, or giving a small discount for transfers, saves the broker money.
3. **apibara tier.** apibara's data is only fresh to 15 minutes, so the plan now syncs every 15 minutes. The trial checks whether the REST `/changes` feed works on the cheaper plans (see `apibara-trial-plan.md`).

## Sources
- hetzner.com/cloud (regular-performance, general-purpose), hetzner.com/storage/storage-box, hetzner.com/storage/object-storage
- developers.cloudflare.com/r2/pricing, cloudflare.com/plans
- stripe.com/en-lt/pricing, stripe.com/en-lt/pricing/local-payment-methods
- ondato.com/plans-pricing, veriff.com/plans/self-serve
- resend.com/pricing, sentry.io/pricing, betterstack.com/pricing
- apibara.tech/en/pricing
- docs.github.com (Actions and Packages billing), core.telegram.org/bots/faq
