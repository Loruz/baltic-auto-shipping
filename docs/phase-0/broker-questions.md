> **Superseded by `../BROKER-QUESTIONS.md` (2026-11-24)**, which includes every question below plus new ones. Kept for reference.

# Questions for the broker: Phase 0

Prepared 2026-11-21. Each answer either replaces a provisional default in the implementation plan (§10) or unblocks a milestone. "Default" is what we build if there is no answer.

Please answer in writing. A reply to this document is enough.

---

## A. Bidding rules (needed before Milestone 6)

**A1. Two customers want the same car.** We bid from one Copart/IAAI account, so only one of their max bids can be placed. Which rule should we use?

- **Option 1: instant takeover.** A new bid must be at least $100 higher than the current top bid. The earlier customer is told straight away that they were outbid. The higher bid can't be cancelled afterwards.
- **Option 2: sealed bids.** Every customer bids without seeing anyone else's bid. One hour before the auction we place the highest one, and the earliest bid wins a tie. The others are told at that point that they lost.

Default: option 1.

Notes:
- Option 2 can't be gamed. Under option 1, a customer can find the other customer's maximum by bidding in $100 steps.
- VINAS publishes "first order wins", but its code uses "highest bid wins".

Answer:

**D3. Buying power after a won car is paid.** Default: it comes back as soon as you mark the car **paid** in the admin panel. VINAS works the same way. Should it come back at that point, later, or never?

Answer:

**D8. Buy Now.** Not in the first version. Later, should a customer's Buy Now be an **instant purchase** or a **request** that your staff confirm?

Answer:

## B. Money (needed before Milestone 2)

**D10. Plan tiers.** Deposit, buying power, active bids at once, and the maximum per car.

The deposit is charged in **EUR** at a fixed price, and buying power is in **USD**. This avoids Stripe's 2% currency-conversion fee on Lithuanian cards. You can change the EUR price at any time by publishing a new plan version, for example when the exchange rate moves a lot.

| Plan | Deposit (EUR) | Buying power (USD) | Active bids | Max per car |
|---|---|---|---|---|
| Basic (default) | €1,350 | $10,000 | 2 | none |
| Standard (default) | €2,700 | $30,000 | 5 | none |
| Pro (default) | €4,500 | $50,000 | 10 | none |

For comparison, VINAS's help page lists **$1,000 → $10,000 (5 cars)**, $2,500 → $50,000 and $5,000 → $200,000.

Your tiers:

**D2. Refunds while bids are open.** Default:
- A refund is **blocked** while the customer has active bids or an unpaid won car.
- If a refund or chargeback happens in Stripe anyway, the customer's buying power drops at once and you get an alert. Their open bids are **not** cancelled automatically.

OK, or different?

Answer:

**Forfeits.** When a customer doesn't pay for a won car, how much of the deposit do you keep?
- the whole deposit,
- Copart's actual penalty (in USD, which you convert to EUR when you enter it), or
- a fixed amount?

Should the account also be blocked?

Answer:

**Apply the deposit to the car price.** VINAS never does this. Do you ever want to use a deposit as part of the car payment? If not, we drop that action.

Answer:

**Stripe account.** Is there a Stripe account in the company's name? Who is its owner or admin? Please confirm that **bank transfers in EUR (SEPA)** can be turned on in it.

Answer:

## C. Notifications and staff (needed before Milestone 6)

**D5. Bid alerts.** Default: **email and Telegram** for every new bid, raise and cancellation. Which email addresses and which Telegram chat or group should receive them?

Answer:

**Staff.** Who will place bids, and how many people? Do they need separate logins? (Every login gets two-factor authentication.)

Answer:

**Auction hours.** Who covers US auction times, roughly 16:00–02:00 Lithuanian time? Is a 1-hour cutoff enough for them to enter all bids?

Answer:

## D. Customers (needed before Milestone 1–2)

**D9. Languages.** Default: Lithuanian and English. Are RU, PL, LV or UA needed at launch?

Answer:

**D11. Phone verification.** Default: an ID check (Ondato) is required before a customer can buy a plan. The phone number is collected but **not** verified by SMS. VINAS doesn't verify phone numbers either. OK?

Answer:

**Company customers and dealers.** Do dealers get custom plans? What deposit and buying power, and do they get a different broker fee?

Answer:

## E. Prices for the calculator (needed before Milestone 5)

**D4.** Please fill in the templates in `rate-templates/`. Each file matches one table in the database, so it can be imported directly. Every row marked EXAMPLE should be replaced.

| File | What it holds |
|---|---|
| `auction_fee_bands.csv` | Copart and IAAI fees for **your** account type, by price band |
| `towing_rates.csv` | Towing from a yard (or a whole state) to a US export port |
| `ocean_rates.csv` | Shipping from a US port to Klaipėda, by vehicle type |
| `fixed_fees.csv` | Broker fee, customs agent, unloading, surcharges |
| `tax_rates.csv` | Duty and import VAT, **confirmed with your customs agent** |
| `ports.csv` | The ports you use |

Please also send **at least 5 real past invoices covering both auctions**. We use them to check that the calculator reproduces the real totals.

Which rates are you still missing?

Answer:

## F. Legal and risk

- **Data licence:** lot data and photos come from apibara, which is not affiliated with Copart or IAAI. Showing them publicly and keeping an archive could put your auction accounts at risk. **Please confirm in writing that you accept this risk.**
- **Account sharing (D1, later):** please ask your Copart and IAAI representatives in writing whether tools like BidManager or AuctionGate are allowed on your broker accounts.
- **Terms of service:** who writes them, you or your lawyer? The bidding rules, deposit, refund and forfeit wording must match the platform exactly. VINAS's help pages and terms contradict each other, and that's what we want to avoid.
