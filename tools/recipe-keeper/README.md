# Recipe Keeper

Keep recipes, plan the week, get the shopping list added up. Everything is held in
`localStorage` on the one device. No account, no server, nothing uploaded.

## What it does

- **Unlimited recipes**, searched by name, tag or ingredient.
- **Paste a recipe** and it separates ingredients from method, by heading where the text
  has one, otherwise by the shape of each line.
- **Scaling.** Change the servings and the quantities move with it, read back as fractions
  a cook can measure: 1.5 becomes `1 1/2`, not `1.5`.
- **A week plan**, three meals a day, with an optional serving count per meal.
- **A shopping list** added up across the week, saying which recipes wanted each thing.
- Tick items off as you shop, copy as text, print, export and import a file.
- Works offline once visited; it is in the per build precache.

## The two decisions worth knowing about

**Units are merged only when they mean the same thing.** Two cups of flour plus one cup is
three cups. Two cups of flour plus 200 g of flour stays two lines, because converting a
volume to a weight depends on what is being measured, and guessing it would put the wrong
number on a shopping list. Aliases are merged: `cup`/`cups`/`c`, `tbsp`/`tablespoon`/`T`,
`g`/`gram`/`grams`, and so on.

**Nothing is silently dropped.** A line the parser cannot read keeps its original text and
reaches the shopping list with no quantity, rather than disappearing. `a pinch of salt` is
read as one pinch, because an article followed by a real unit is a quantity; `a few
tomatoes` is left alone, because `few` is not a unit.

Ranges take the low end: `1-2 onions` is one onion, which under shops rather than over.

## Limits

- **One device.** There is no sync. Export a file and import it on the other device.
- **No clipping from a web page.** Reading another site from a browser tab is blocked by
  the browser itself, which is why it asks you to paste. That is also the honest reason a
  paid app is worth it if you save recipes from social video; see `/vs/recime/`.
- **The paste parser is a guess.** It is good on recipes with headings and reasonable
  without, but check what it produced before saving. It never overwrites anything: it
  fills the editor and waits.
- **No nutrition data** and no reading aloud.
- `localStorage` is a few megabytes, which is thousands of text recipes but no images.
  There are no images in this tool for that reason.

## Tests

```bash
node --test tests/recipe-keeper.test.cjs     # 20 unit tests
node tests/recipe-keeper.browser.cjs         # the page
```

The unit tests cover the parts with edge cases: every way a recipe writes a quantity
(`1 1/2`, `1½`, `3/4`, `.5`, `1-2`, `2 to 3`), reading them back as fractions, unit
aliases, splitting an ingredient line into amount, unit, item and note, the paste parser
with and without headings, scaling, shopping list aggregation across recipes and the
separation of unlike units, and rebuilding an imported file field by field including a
dangerous id, an overlong title, out of range servings and a plan pointing at a recipe
that is not there.
