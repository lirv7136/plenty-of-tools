# Subscription Finder replies (9 Oct 2026)

Found through the Arctic Shift Reddit archive (Reddit itself blocks scripted reads). Rules are
archive snapshots of each sidebar and could have changed: read the live sidebar first.

## Who allows a link to your own tool

| Subreddit | Rule (archived) | Link allowed? |
|---|---|---|
| r/AusFinance | bans "Promotion of anything owned by you"; moderators removed 5 comments in one recent app thread | **No** |
| r/personalfinance | bans promoting anything you own "even if not monetized", but "Requires pre-approval: open source tools"; also bans AI generated content | **Only with modmail pre approval** |
| r/FinancialPlanning | "no links to your own sites" | No |
| r/Frugal | no self promotion | No |
| r/povertyfinance | disclosed links to your own content allowed | Yes, with disclosure (no fitting live thread on 9 Oct) |

**So:** modmail r/personalfinance first: "I'd like to share a free, MIT licensed, browser only
tool I built (github.com/lirv7136/plenty-of-tools, Subscription Finder) in replies where people
ask how to find recurring charges. Is that OK under the open source pre approval?" Without
approval, post the replies with the last paragraph removed (they still answer the question).
**Put both into your own words** (the sub bans AI written content) and recheck Rocket Money's
prices on the day.

## Facts checked 9 Oct

- Rocket Money's free tier finds recurring subscriptions and bills; Premium is "pay what you
  think is fair", typically US$7 to 14 a month, for cancellation help, unlimited budgets, net
  worth and desktop. Bill negotiation is open to all users and takes 35 to 60% of the first
  year's savings (Premium+ at US$15 a month removes the fee).
  rocketmoney.com/learn/personal-finance/how-much-does-rocket-money-cost
- Rocket Money "is only available to users located within the United States and with U.S. based
  banks" (help.rocketmoney.com/en/articles/79778). Usable in any Australian thread.
- Subscription Finder needs a charge at least twice, so yearly charges need two years of history.

## Reply 1: r/personalfinance "Tackling forgotten auto payments" (1 Oct)

https://www.reddit.com/r/personalfinance/comments/1wutvp5/

> Two different problems, with different fixes.
>
> Free trials: the reliable fix is doing something on the day you sign up. Some services let you cancel immediately and keep the trial until it ends; if so, cancel on day one and there is nothing left to remember. If cancelling ends access straight away, set the reminder two days before the renewal date rather than on it, so one busy day does not cost you a month.
>
> Charges that already slipped through: since you already check the card at the end of each month, the faster version is to export 12 months of transactions as CSV, sort by merchant and look for the same amount on a regular gap. Use 12 months, because annual renewals only show up once a year.
>
> On apps: you do not need to pay anyone for this part. Rocket Money's subscription detection is in its free tier; Premium (pay what you think is fair, typically US$7 to 14 a month) adds the cancellation concierge, unlimited budgets and net worth tracking. Bill negotiation is separate and takes 35 to 60% of the first year's savings if it works.
>
> [Only with mod approval:] If sorting the spreadsheet is the step that never happens, I built a page that does the pattern matching on that CSV: it finds charges that repeat weekly, monthly, quarterly or yearly, groups them and totals them per month. It runs in your browser, the file is not uploaded anywhere and there is no account. It will not cancel anything or connect to your bank, and it needs to see a charge at least twice, so yearly ones need two years of history. Disclosure: it's mine, free and open source. plentyoftools.io/tools/subscription-finder/

## Reply 2: r/personalfinance "Mystery Charges" (8 Oct)

https://www.reddit.com/r/personalfinance/comments/1x0yv9s/

> Those amounts are usually app store charges, and both stores will show you exactly what each one was.
>
> Apple: sign in at reportaproblem.apple.com, which lists every purchase and subscription renewal and lets you search by amount. On the phone it is App Store, your profile picture, Apps & Purchase History, Purchase History.
>
> Google: Play Store app, profile icon, Payments & subscriptions, Budget & history.
>
> If a charge matches neither, ask your card issuer for the full merchant name behind the statement descriptor. If nothing explains it, get a new card number, because tiny unexplained charges are a common way of testing whether a stolen card works.
>
> For tracking the ones that repeat: export a few months of card transactions as CSV and look for the same merchant at the same amount on a regular gap. Apps like Rocket Money do this detection in their free tier; Premium (pay what you think is fair, about US$7 to 14 a month) is for the cancellation concierge and budgeting extras, so you do not need it just to get the list.
>
> [Only with mod approval:] I built a page that does that matching on the CSV: it finds the recurring charges, groups them and totals them per month. It runs in the browser, the file is not uploaded and there is no account. It will not cancel anything or connect live to your bank, and one off charges will not show, only ones that repeat. Disclosure: it's mine, free and open source. plentyoftools.io/tools/subscription-finder/
