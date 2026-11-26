# Questions for the broker

Prepared 2026-11-24. This list replaces `phase-0/broker-questions.md` (2026-11-21). It keeps every question from that file that is still unanswered, and adds:
- questions about customers bidding through AuctionGate themselves (D1),
- questions raised by the screen designs.

**How to use it:**
- Each question says why it matters and which part of the build waits for it.
- **Default** is what we build if there's no answer. It can be changed later, but changing it after that part is built costs more.
- Please answer in writing, under **Answer**. A reply to this document is enough.
- IDs (A1, D2…) match the open items in `IMPLEMENTATION-PLAN.md` §10.

**Development doesn't wait for these answers.** The build uses the defaults listed in `IMPLEMENTATION-PLAN.md` §10 "Development defaults" and is adjusted as answers arrive. The answers are needed before launch.

**Most urgent:** A1, D10, the rates (D4), section 1 of AuctionGate, and section 9 (legal).

---

## 1. Bidding rules (needed before Milestone 6)

**A1. Two customers want the same car.** We bid from one Copart/IAAI account, so only one of their max bids can be placed. Which rule should we use?

(A "max bid" is the highest price a customer is willing to pay for a car. Your staff bid for them at the auction up to that amount. Because every customer bids through your one account, the auction sees only one bidder. Your staff can't bid against themselves for two customers, so the platform has to choose one customer per car before the auction.)

- **Option 1: instant takeover.** A new bid only has to be higher than the current top bid (by at least $1). The earlier customer is told straight away that they were outbid. The higher bid can't be cancelled afterwards.
  - ("Takeover": customer B places a higher max bid on a car customer A already bid on, and B's bid replaces A's.)
  - ("Higher by at least $1": any bigger bid wins, as on VINAS. A larger minimum step, e.g. $100, is one setting if you want to stop customers taking cars over with tiny increases.)
  - ("Outbid": A's bid is no longer active. A's held buying power is freed straight away, and A can bid again higher, or on another car.)
  - ("Can't be cancelled": once B has pushed A out, B can't withdraw. Otherwise B could knock A out and then cancel, and nobody would bid on the car.)
  - (Customers don't see the other customer's amount, only "someone has bid; you need at least $X".)
- **Option 2: sealed bids.** Customers can't see each other's bids. One hour before the auction we place the highest one, and the earliest bid wins a tie. The others are told at that point that they lost.
  - ("Sealed": like a closed envelope. Several customers can have a bid on the same car, and nobody knows whether anyone else has bid.)
  - ("One hour before the auction": this is the cutoff, when bids are locked and handed to your staff. At that moment the platform picks the highest bid and gives it to your staff.)
  - ("Earliest bid wins a tie": if two customers both bid $6,000, the one who bid first gets it.)
  - ("Told at that point that they lost": the other customers learn only at the cutoff that their bid won't be placed. Until then, the buying power for all of them stays held.)

Option 2 can't be gamed. Under option 1, a customer can find another customer's maximum by bidding in small steps. (Each time they're told their bid is too low, they get closer; with a $1 step they can find it exactly.)

(In short: option 1 gives customers an answer immediately but is a bit easier to game. Option 2 is fairer, but customers wait until 1 hour before the auction to know whether their bid will be placed.)

Default: option 1, with a $1 step.

Answer:

**1.2. Can a customer cancel or lower a normal bid before the cutoff?** Default:
- Yes, a bid can be cancelled or changed until the cutoff.
- A takeover bid can't be cancelled (option 1 above).

Answer:

**1.3. How do your staff bid with a customer's max bid?** Do they bid only as high as needed (so the customer may win for less), or go straight to the maximum? Do they use Copart/IAAI pre-bids or live bidding? The "How it works" and "Bidding rules" pages promise "you may win for less than your max".

Answer:

**1.4. Is a 1-hour cutoff right?** After the cutoff, bids are locked and handed to your staff. Is one hour enough to enter every bid? Would you prefer a different time, or a different time for Copart and IAAI?

Answer:

**1.5. "Won, waiting for seller approval".** When a car sells below the seller's reserve ("On approval" / "On minimum bid"), how long does approval usually take? Is the customer's bid binding during that time? Default: buying power stays held until you mark it won or lost.

Answer:

**1.6. A car sells or disappears before the cutoff** (for example someone buys it with Buy Now). Default: the bid is cancelled automatically and the customer is told. OK?

Answer:

**D8. Buy Now.** Not in the first version. Later, should a customer's Buy Now be an **instant purchase** or a **request** that your staff confirm?

Answer:

---

## 2. Plans, deposits and buying power (needed before Milestone 2)

**D10. Plan tiers.** For each plan we need:
- the deposit
- the buying power
- how many bids can be active at once
- any maximum per car

The deposit is charged in **EUR** at a fixed price, and buying power is in **USD**. This avoids Stripe's 2% currency-conversion fee on Lithuanian cards. You can change the EUR price at any time, for example when the exchange rate moves a lot.

We currently have **three different sets of example numbers**, so we need your real ones:

| Where | Plans |
|---|---|
| Earlier question list | Basic €1,350 → $10,000, 2 bids · Standard €2,700 → $30,000, 5 bids · Pro €4,500 → $50,000, 10 bids |
| Plan §10 default | Basic $1,500 → $10,000, 2 bids · Standard $3,000 → $30,000, 5 bids · Pro $5,000 → $50,000, 10 bids |
| Screen designs | Starter €700 → $5,000, 2 bids · Standard €1,350 → $10,000, 5 bids · Pro €3,300 → $25,000, 10 bids · Dealer (custom) |

For comparison, VINAS lists $1,000 → $10,000 (5 cars), $2,500 → $50,000 and $5,000 → $200,000.

Your tiers (names, deposit, buying power, active bids, max per car):

**2.2. Dealers and companies.** Do dealers get custom plans? If so:
- What deposit and buying power?
- Do they get a different broker fee?
- Do they need invoices to a company with a VAT number?

Answer:

**D3. Buying power after a won car is paid.** Default: it comes back as soon as you mark the car **paid** in the admin panel. VINAS works the same way. Should it come back at that point, later, or never?

Answer:

**D2. Refunds while bids are open.** Default:
- A refund is **blocked** while the customer has active bids or an unpaid won car.
- If a refund or chargeback happens in Stripe anyway, the customer's buying power drops at once and you get an alert. Their open bids are **not** cancelled automatically.

OK, or different?

Answer:

**2.5. How long refunds take.** Is a refund paid to the card the customer paid with? The FAQ currently says "5–10 business days" for card refunds. Is there a notice period, or a fee you keep?

Answer:

**2.6. Unpaid won car (forfeit).** When a customer doesn't pay for a won car, how much of the deposit do you keep?
- the whole deposit,
- Copart/IAAI's actual penalty (in USD, which you convert to EUR when you enter it), or
- a fixed amount?

Is the account also blocked?

Answer:

**2.7. Payment deadline after a win.** The plan uses 2 US business days for Copart and 4 for IAAI, due by 17:00 New York time. Are these your deadlines for customers, or do you need the money earlier so you can pay the auction in time?

Answer:

**2.8. Using the deposit towards the car price.** VINAS never does this. Do you ever want to use a deposit as part of the car payment? If not, we drop that action.

Answer:

**2.9. Upgrading a plan.** Default: the customer pays only the difference, and the new buying power applies at once. OK?

Answer:

**2.10. Stripe account.** Is there a Stripe account in the company's name? Who is its owner or admin? Please confirm that **bank transfers in EUR (SEPA)** can be turned on. Would you like to offer a small discount for paying the deposit by bank transfer? It costs about €5, against roughly 1.5–3% for cards.

Answer:

---

## 3. Customers bidding themselves through AuctionGate (D1, later phase)

You asked whether shared accounts can be issued automatically. AuctionGate's API can do the following:
- create a "sub-bidder" login
- attach it to your Copart and IAAI accounts
- set its limits: maximum per bid, number of active bids, total of active bids, number of unpaid cars
- switch it on and off
- tell us when that customer **buys** a car

It **can't** do the following:
- tell us about bids, outbids or losses
- give access for one auction only
- delete a login

So the platform would only learn about a purchase after it happened. AuctionGate's limits would be the only thing stopping a customer from over-bidding.

**3.1. How does it work today?** When a customer asks for a shared account now:
- Which tool do you use (BidManager, AuctionGate, something else)?
- Who creates it, and how long does it take?
- What limits do you set?

Answer:

**3.2. Your auction accounts.** How many Copart and IAAI accounts do customers share? Is it one of each for everyone, or several?

Answer:

**3.3. Two customers on the same car.** When two customers on the same shared account bid on the same lot, what happens? Do they push the price up against each other? Does the auction see them as one bidder? How do you handle it today?

Answer:

**3.4. AuctionGate subscription.** Do you already use AuctionGate? Does your plan include **API access** (the "Generate API token" button in the dashboard)? What does it cost per sub-bidder or per month?

Answer:

**3.5. When should access be given and taken away?** Our proposal:
- **Given:** after the ID check and paid deposit, when the customer asks for it.
- **Switched off:** when a won car is unpaid past its deadline, or the deposit is refunded, or you block the customer.

Is that right? Should anything else switch it off?

Answer:

**3.6. One mode or both?** Can a customer use both "we bid for you" and "bid myself" at the same time? Allowing both makes it possible to spend the same buying power twice. Default: one mode at a time, chosen in the account.

Answer:

**3.7. Limits.** Is the per-bid limit the plan's maximum per car? Is the total of active bids the customer's available buying power? Should Buy Now be allowed for self-bidders (AuctionGate has a switch for it)?

Answer:

**3.8. Login details.** AuctionGate doesn't send an invitation. We'd show the login and a generated password once in the customer's account. Is that OK, or do you have a preferred way?

Answer:

**3.9. A trial.** Can we create one test sub-bidder (switched off) on your account? We'd use it to check that limits are enforced during live bidding, and that switching off ends an open session. AuctionGate has no test environment.

Answer:

**3.10. Permission.** Please ask your Copart and IAAI representatives **in writing** whether customers may bid on your broker accounts through tools like AuctionGate or BidManager.

Answer:

---

## 4. Prices for the calculator (needed before Milestone 5)

**D4. Rates.** Please fill in the templates in `phase-0/rate-templates/`. Each file matches one table in the database, so it can be imported directly. Every row marked EXAMPLE should be replaced.

| File | What it holds |
|---|---|
| `auction_fee_bands.csv` | Copart and IAAI fees for **your** account type, by price band |
| `towing_rates.csv` | Towing from a yard (or a whole state) to a US export port |
| `ocean_rates.csv` | Shipping from a US port to Klaipėda, by vehicle type |
| `fixed_fees.csv` | Broker fee, customs agent, unloading, surcharges (EV/hybrid, oversized) |
| `tax_rates.csv` | Customs duty and import VAT, **confirmed with your customs agent** |
| `ports.csv` | The US ports you ship from |

Which rates are you still missing?

Answer:

**4.2. Real invoices.** Please send **at least 5 real past invoices covering both auctions**. We use them to check that the calculator reproduces the real totals.

Answer:

**4.3. Customs duty and VAT.** Please confirm with your customs agent:
- **Duty:** is it 0% for US-made cars with proof of origin, and 10% otherwise? What proof is needed?
- **Import VAT base:** is it the car + shipping value + duty + which local fees?

Answer:

**4.4. Export port.** Should the calculator always pick the cheapest port for the car's yard, or should customers choose? Are there ports you don't use?

Answer:

**4.5. Delivery time.** The pages say **30–50 days** from auction to Klaipėda. Is that realistic? Is it different per port?

Answer:

**4.6. Car arriving in Klaipėda.** Is the delivery point always Klaipėda port? Do you offer delivery further, for example to Vilnius or other countries? If so, is it in the first version?

Answer:

---

## 5. Notifications and staff (needed before Milestone 6)

**D5. Bid alerts.** Default: **email and Telegram** for every new bid, raise and cancellation. Which email addresses and which Telegram chat or group should receive them?

Answer:

**5.2. Staff.** Who will place bids, and how many people? Do they each need their own login? Every staff login uses two-factor authentication.

Answer:

**5.3. Auction hours.** Who covers US auction times, roughly 16:00–02:00 Lithuanian time? Is anyone on duty at weekends?

Answer:

---

## 6. Customers and sign-up (needed before Milestones 1–2)

**D9. Languages.** Default: Lithuanian and English. Are RU, PL, LV or UA needed at launch?

Answer:

**D11. Phone verification.** Default: an ID check (Ondato) is required before a customer can buy a plan. The phone number is collected but **not** verified by SMS. VINAS doesn't verify phone numbers either. OK?

Answer:

**6.3. Which countries.** Can customers outside Lithuania sign up (Latvia, Estonia, Poland…)? Do they need different taxes or delivery?

Answer:

---

## 7. Website content and branding (needed before launch)

**7.1. Contact details for the site:** phone number, support email, address, opening hours, and messenger links (Telegram, WhatsApp, Viber).

Answer:

**7.2. IAA partner badge.** The design shows the "IAA Market Alliance" logo with "Official IAA Market Alliance partner in Lithuania". Please confirm:
- that IAA allows its logo to be used this way, and any rules it has for that
- the link to the press release or announcement we should point to

Answer:

**7.3. Copart.** Are you a Copart Registered Broker? If yes and you have written confirmation, we can show a badge like the IAA one. If not, the site says only "Copart and IAAI are trademarks of their owners".

Answer:

**7.4. Logo files.** We took the logo from shipbaltic.com. Do you have the original files (SVG, and a white version for dark backgrounds) and any brand guidelines?

Answer:

**7.5. Who writes the texts?** Do you want to approve or write the FAQ answers, "How it works" and the plan descriptions? We've written drafts that follow the plan.

Answer:

---

## 8. Lot data and photos

**8.1. Data licence risk.** Lot data and photos come from apibara, which is not affiliated with Copart or IAAI. Showing them publicly and keeping an archive of sold cars could put your auction accounts at risk. **Please confirm in writing that you accept this risk**, or tell us to show less (for example, only to signed-in customers).

Answer:

**8.2. Broker checks.** Do you want to mark lots you've reviewed ("checked by broker"), or hide some lots (for example, cars that can't be exported)? Default: both are possible in the admin panel, and nothing is required.

Answer:

---

## 9. Legal

**9.1. Terms of service and privacy policy.** Who writes them, you or your lawyer? The bidding rules, deposit, refund and forfeit wording must match the platform exactly. VINAS's help pages and terms contradict each other, and that's what we want to avoid.

Answer:

**9.2. Which company.** Which legal entity runs the platform and takes the deposits? Please send its name, registration number, VAT number and address for invoices and the site footer. The footer currently says "Baltic Auto Shipping, Inc."

Answer:

**9.3. Customer contract.** Does a customer sign anything today before bidding through you, such as a mandate or agency agreement? Should the platform show it and record that they accepted it?

Answer:
