# Is It Worth It? Calculators (#11)

Nine local calculators in one page at `/tools/worth-it-calculators/`, with linkable sections `#vinted`, `#etsy`, `#ebay`, `#uber` and `#fasttrack`. Vanilla JavaScript, no dependencies, network calls, browser storage, current price API or tracking. Figures stay in tab memory when switching calculators; reload clears them. Currency selection changes formatting only. Example values are explicitly illustrative, not current rates or predictions.

`static/core.js` holds definitions, input validation and pure formulas. `app.js` builds accessible labelled forms, result breakdowns and sensitivity tables from those definitions. All numeric inputs are required, nonnegative and limited to two decimal places; counts are integral. Limits are shown on validation errors. Calculations use JavaScript numbers with rounding only for display, not accounting ledger arithmetic. A result within half a cent of zero is labelled approximately break even.

- Vinted: incremental sale probability × contribution per item − bump price. Break even lift is in percentage points; a required probability above 100% is called out.
- Etsy Ads: attributed orders × estimated incrementality × contribution per order − ad spend. CPA/CPC/ROAS use actual attributed data; they are not substituted for profit. Offsite Ads fees are not calculated.
- eBay labels: total direct carrier cash cost minus total eBay cash cost. Handling time and its personal value appear separately, with a combined value metric.
- Uber One: planned cash savings + usable membership credits − monthly equivalent fee − induced spending. Annual fees are paid upfront. Break even orders hold other benefits and extra spending fixed.
- Fast track: total personal value of queue time saved minus fees for the group. A negative time saving is allowed when the priority lane is slower. This is not a cash saving claim or queue prediction.

Inputs and result tables can be downloaded as a text report or printed/saved as PDF. Download reports contain assumptions, scenario rows and a relevant official source link. Undefined ratios and impossible finite thresholds display “Not available”. Empty/invalid inputs hide results and prevent export.

Official context checked 16 September 2026: [Vinted](https://www.vinted.com/help/450-buying-a-bump), [Etsy advertising policy](https://www.etsy.com/legal/advertising/), [eBay labels](https://www.ebay.com/help/-/-/-/shipping-labels?id=4157), [Uber One Australia](https://www.uber.com/au/en/uber-one/), [Heathrow fast track](https://www.heathrow.com/at-the-airport/airport-services/fast-track). Offers differ by country and account; the tool uses only user entered costs.

```sh
python3 build.py
node tests/worth-it-calculators.test.cjs
# With dist served at localhost:8765:
node tests/worth-it-calculators.browser.cjs
```

## Travel extension — September 2026

Nine calculators now include `#seats`, `#bags`, `#wifi` and `#parking` alongside the original five. Each has illustrative inputs, a threshold, sensitivity rows, and the same text and print reports.

- Seats compare expected inconvenience avoided for the whole party against fees for the seats actually purchased. A child triggers a reminder to confirm family seating. Solo travellers have no party separation benefit. [Ryanair's June 2026 announcement](https://corporate.ryanair.com/news/ryanair-tweaks-seat-allocation-for-families-to-match-industry-standard/) confirms free adjacent family allocation after check in for new bookings; optional selected seats require a booking quote.
- Bags include cabin allowance fees, a cabin bag purchase spread across comparable trips, gate charges and party time. [Jetstar](https://www.jetstar.com/au/en/help/excess-baggage-charges-at-the-airport) lists AUD 125 domestic excess cabin baggage at the gate, distinct from AUD 85 for extra 7 kg. Travel date matters because a February 2027 change is announced.
- Wifi separates billed days from useful sea and port days and prices one shared connection. [Carnival](https://www.carnival.com/internet-plans) lists Value from USD 23.80 per day before sailing for the whole cruise, or USD 28 for an onboard 24 hour plan. Check app and device restrictions.
- Parking compares daily, pass and return shuttle or rideshare costs. Coverage caps prevent impossible pass savings. [Walt Disney World](https://disneyworld.disney.go.com/guest-services/parking/) lists USD 35 standard parking per day including tax; eligible hotel guests and passholders have it included. The example pass price is hypothetical.

Official figures reviewed September 2026. They are source notes, not automatic quotes or currency conversions. Chrome verified all nine text reports and printed PDFs, narrow layouts, invalid input handling and no script exceptions. Unit tests include both numeric limits and the four new break even calculations.
