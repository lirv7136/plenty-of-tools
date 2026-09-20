const { test } = require('node:test');
const assert = require('node:assert/strict');
const R = require('../tools/recipe-keeper/static/core.js');

const recipe = (over = {}) => Object.assign({
  id: 'r1', title: 'Pancakes', servings: 4, minutes: 20, tags: [], source: '', notes: '',
  ingredients: ['2 cups plain flour', '2 eggs', '1 1/2 cups milk', 'a pinch of salt'],
  steps: ['Whisk it.', 'Fry it.'],
}, over);

test('a quantity can be written any of the ways a recipe writes it', () => {
  assert.equal(R.parseQuantity('2'), 2);
  assert.equal(R.parseQuantity('0.5'), 0.5);
  assert.equal(R.parseQuantity('.5'), 0.5);
  assert.equal(R.parseQuantity('1/2'), 0.5);
  assert.equal(R.parseQuantity('3/4'), 0.75);
  assert.equal(R.parseQuantity('1 1/2'), 1.5);
  assert.equal(R.parseQuantity('½'), 0.5);
  assert.equal(R.parseQuantity('1½'), 1.5);
  assert.equal(R.parseQuantity('2 ¾'), 2.75);
  assert.ok(Math.abs(R.parseQuantity('⅓') - 1 / 3) < 1e-9);
  assert.equal(R.parseQuantity('1-2'), 1, 'a range takes the low end so you do not over shop');
  assert.equal(R.parseQuantity('2 to 3'), 2);
  assert.equal(R.parseQuantity('a few'), null);
  assert.equal(R.parseQuantity(''), null);
  assert.equal(R.parseQuantity(null), null);
  assert.equal(R.parseQuantity('1/0'), null, 'dividing by zero is not a quantity');
});

test('a quantity reads back as something you could write on a list', () => {
  assert.equal(R.formatQuantity(2), '2');
  assert.equal(R.formatQuantity(1.5), '1 1/2');
  assert.equal(R.formatQuantity(0.5), '1/2');
  assert.equal(R.formatQuantity(0.75), '3/4');
  assert.equal(R.formatQuantity(1 / 3), '1/3');
  assert.equal(R.formatQuantity(2 + 2 / 3), '2 2/3');
  assert.equal(R.formatQuantity(0.125), '1/8');
  assert.equal(R.formatQuantity(3.0001), '3', 'floating point noise does not become a fraction');
  assert.equal(R.formatQuantity(0), '');
  assert.equal(R.formatQuantity(-1), '');
  assert.equal(R.formatQuantity(NaN), '');
  assert.equal(R.formatQuantity(0.37), '3/8', 'a near miss snaps to the marking on a measuring cup');
  assert.equal(R.formatQuantity(0.42), '0.42', 'an amount near no fraction stays a decimal rather than a wrong one');
});

test('units are recognised however they are abbreviated', () => {
  for (const w of ['cup', 'cups', 'c']) assert.equal(R.normaliseUnit(w), 'cup');
  for (const w of ['tablespoon', 'tablespoons', 'tbsp', 'tbs', 'T']) assert.equal(R.normaliseUnit(w), 'tbsp');
  for (const w of ['teaspoon', 'tsp', 'ts']) assert.equal(R.normaliseUnit(w), 'tsp');
  for (const w of ['gram', 'grams', 'g']) assert.equal(R.normaliseUnit(w), 'g');
  assert.equal(R.normaliseUnit('tsp.'), 'tsp', 'a trailing full stop is still a unit');
  assert.equal(R.normaliseUnit('Cups'), 'cup');
  assert.equal(R.normaliseUnit('handful'), 'handful');
  assert.equal(R.normaliseUnit('flour'), '', 'an ingredient is not a unit');
  assert.equal(R.normaliseUnit(''), '');
  assert.equal(R.formatUnit('cup', 2), 'cups');
  assert.equal(R.formatUnit('cup', 1), 'cup');
  assert.equal(R.formatUnit('pinch', 3), 'pinches');
  assert.equal(R.formatUnit('g', 500), 'g', 'grams do not gain an s');
});

test('an ingredient line is split into amount, unit, item and note', () => {
  assert.deepEqual(R.parseIngredientLine('1 1/2 cups plain flour, sifted'),
    { qty: 1.5, unit: 'cup', item: 'plain flour', note: 'sifted', raw: '1 1/2 cups plain flour, sifted' });
  assert.deepEqual(R.parseIngredientLine('2 eggs'),
    { qty: 2, unit: '', item: 'eggs', note: '', raw: '2 eggs' });
  assert.deepEqual(R.parseIngredientLine('500 g beef mince'),
    { qty: 500, unit: 'g', item: 'beef mince', note: '', raw: '500 g beef mince' });
  assert.deepEqual(R.parseIngredientLine('1 cup of milk'),
    { qty: 1, unit: 'cup', item: 'milk', note: '', raw: '1 cup of milk' });
  assert.deepEqual(R.parseIngredientLine('2 onions (finely diced)'),
    { qty: 2, unit: '', item: 'onions', note: 'finely diced', raw: '2 onions (finely diced)' });

  const loose = R.parseIngredientLine('salt and pepper to taste');
  assert.equal(loose.qty, null, 'no number means no number, rather than a guess');
  assert.equal(loose.item, 'salt and pepper to taste');

  assert.equal(R.parseIngredientLine(''), null);
  assert.equal(R.parseIngredientLine('   '), null);
});

test('an ingredient reads back the way it went in', () => {
  const round = s => R.formatIngredient(R.parseIngredientLine(s));
  assert.equal(round('2 cups plain flour'), '2 cups plain flour');
  assert.equal(round('1 cup milk'), '1 cup milk');
  assert.equal(round('1 1/2 cups milk'), '1 1/2 cups milk');
  assert.equal(round('500 g beef mince'), '500 g beef mince');
  assert.equal(round('salt and pepper to taste'), 'salt and pepper to taste');
  assert.equal(round('2 onions (finely diced)'), '2 onions, finely diced');
});

test('pasted text is split into a title, ingredients and steps', () => {
  const parsed = R.parseRecipeText([
    'Simple Pancakes',
    'Ingredients',
    '2 cups plain flour',
    '2 eggs',
    '1 1/2 cups milk',
    'Method',
    '1. Whisk the flour, eggs and milk together until there are no lumps left in it.',
    '2. Fry spoonfuls in a hot buttered pan until bubbles appear, then turn them over.',
  ].join('\n'));

  assert.equal(parsed.title, 'Simple Pancakes');
  assert.deepEqual(parsed.ingredients, ['2 cups plain flour', '2 eggs', '1 1/2 cups milk']);
  assert.equal(parsed.steps.length, 2);
  assert.match(parsed.steps[0], /^Whisk the flour/, 'the step number is stripped');
});

test('pasted text without headings still separates by shape', () => {
  const parsed = R.parseRecipeText([
    'Tomato Soup',
    '1 kg tomatoes',
    '2 cloves garlic',
    'Roast the tomatoes and garlic together until they collapse, then blend them smooth with stock.',
  ].join('\n'));
  assert.equal(parsed.title, 'Tomato Soup');
  assert.deepEqual(parsed.ingredients, ['1 kg tomatoes', '2 cloves garlic']);
  assert.equal(parsed.steps.length, 1);
});

test('empty paste gives an empty recipe rather than throwing', () => {
  assert.deepEqual(R.parseRecipeText(''), { title: '', ingredients: [], steps: [] });
  assert.deepEqual(R.parseRecipeText(null), { title: '', ingredients: [], steps: [] });
});

test('a recipe has to have a name, sensible servings and something in it', () => {
  assert.equal(R.validateRecipe(recipe()), '');
  assert.match(R.validateRecipe(recipe({ title: '' })), /name/);
  assert.match(R.validateRecipe(recipe({ servings: 0 })), /Servings/);
  assert.match(R.validateRecipe(recipe({ servings: 500 })), /Servings/);
  assert.match(R.validateRecipe(recipe({ servings: 'four' })), /Servings/);
  assert.match(R.validateRecipe(recipe({ ingredients: [] })), /ingredient/);
  assert.match(R.validateRecipe(null), /not a recipe/);
});

test('scaling moves the numbers and leaves the rest alone', () => {
  const doubled = R.scaleIngredients(recipe(), 8);
  assert.equal(doubled[0].qty, 4, 'two cups becomes four');
  assert.equal(doubled[2].qty, 3, 'one and a half cups becomes three');
  assert.equal(doubled[3].qty, 2, 'a pinch of salt is one pinch, so it doubles to two');
  assert.equal(doubled[3].unit, 'pinch');
  assert.equal(doubled[3].item, 'salt');

  const halved = R.scaleIngredients(recipe(), 2);
  assert.equal(halved[0].qty, 1);
  assert.equal(R.formatQuantity(halved[2].qty), '3/4');

  const same = R.scaleIngredients(recipe(), 4);
  assert.equal(same[0].qty, 2, 'scaling to the same servings changes nothing');
});

// ---------- the plan and the list ----------
function planWith(entries) {
  const plan = R.emptyPlan();
  for (const [day, meal, recipeId, servings] of entries) plan[day][meal] = { recipeId, servings: servings || null };
  return plan;
}

test('the plan reads back only the meals that were filled in', () => {
  const plan = planWith([['Monday', 'Dinner', 'r1'], ['Friday', 'Lunch', 'r2', 6]]);
  const entries = R.planEntries(plan);
  assert.equal(entries.length, 2);
  assert.deepEqual(entries[0], { day: 'Monday', meal: 'Dinner', recipeId: 'r1', servings: null });
  assert.deepEqual(entries[1], { day: 'Friday', meal: 'Lunch', recipeId: 'r2', servings: 6 });
  assert.deepEqual(R.planEntries(R.emptyPlan()), []);
  assert.deepEqual(R.planEntries(null), []);
});

test('the shopping list adds up what can be added and keeps apart what cannot', () => {
  const pancakes = recipe();
  const cake = recipe({
    id: 'r2', title: 'Cake', servings: 8,
    ingredients: ['1 cup plain flour', '200 g plain flour', '3 eggs'],
  });
  const plan = planWith([['Monday', 'Dinner', 'r1'], ['Tuesday', 'Dinner', 'r2']]);
  const list = R.shoppingList(plan, [pancakes, cake]);
  const find = (item, unit) => list.find(r => r.item === item && (r.unit || '') === unit);

  assert.equal(find('plain flour', 'cup').qty, 3, 'two cups plus one cup is three cups');
  assert.equal(find('plain flour', 'g').qty, 200, 'grams are not folded into cups');
  assert.equal(find('eggs', '').qty, 5, 'two eggs plus three eggs');
  assert.deepEqual(find('plain flour', 'cup').from.sort(), ['Cake', 'Pancakes'],
    'the list says which recipes wanted it');

  const salt = find('salt', 'pinch');
  assert.ok(salt, 'a pinch of salt reaches the list as a pinch');
  assert.equal(salt.qty, 1);

  assert.deepEqual(list.map(r => r.item), list.map(r => r.item).slice().sort(),
    'the list is in an order you could shop in');
});

test('the same meal twice in a week is counted twice', () => {
  const plan = planWith([['Monday', 'Dinner', 'r1'], ['Thursday', 'Dinner', 'r1']]);
  const list = R.shoppingList(plan, [recipe()]);
  assert.equal(list.find(r => r.item === 'plain flour').qty, 4, 'two cups, twice');
});

test('a plan entry with its own servings overrides the recipe', () => {
  const plan = planWith([['Monday', 'Dinner', 'r1', 8]]);
  const list = R.shoppingList(plan, [recipe()]);
  assert.equal(list.find(r => r.item === 'plain flour').qty, 4, 'cooking for eight doubles a recipe for four');
});

test('a plan pointing at a recipe that is gone is skipped, not crashed on', () => {
  const plan = planWith([['Monday', 'Dinner', 'missing'], ['Tuesday', 'Dinner', 'r1']]);
  const list = R.shoppingList(plan, [recipe()]);
  assert.ok(list.length > 0);
  assert.equal(list.find(r => r.item === 'plain flour').qty, 2);
  assert.deepEqual(R.shoppingList(R.emptyPlan(), [recipe()]), []);
});

test('an ingredient with no quantity at all still reaches the list', () => {
  const loose = recipe({ id: 'r9', ingredients: ['1 cup flour', 'salt and pepper to taste'] });
  const plan = planWith([['Monday', 'Dinner', 'r9']]);
  const list = R.shoppingList(plan, [loose]);
  const row = list.find(r => r.item === 'salt and pepper to taste');
  assert.ok(row, 'nothing is silently dropped');
  assert.equal(row.qty, null);
});

test('the list prints as lines a person can read', () => {
  const plan = planWith([['Monday', 'Dinner', 'r1']]);
  const lines = R.shoppingLines(R.shoppingList(plan, [recipe()]));
  assert.ok(lines.includes('2 cups plain flour'));
  assert.ok(lines.includes('2 eggs'));
  assert.ok(lines.includes('1 pinch salt'));
});

// ---------- files ----------
test('a collection survives a round trip through a file', () => {
  const state = { version: 1, recipes: [recipe()], plan: planWith([['Monday', 'Dinner', 'r1']]) };
  const back = R.importJson(R.exportJson(state));
  assert.equal(back.error, undefined);
  assert.equal(back.recipes.length, 1);
  assert.equal(back.recipes[0].title, 'Pancakes');
  assert.deepEqual(back.recipes[0].ingredients, state.recipes[0].ingredients);
  assert.equal(back.plan.Monday.Dinner.recipeId, 'r1');
});

test('an imported file is rebuilt field by field and never trusted', () => {
  assert.match(R.importJson('not json').error, /not readable/);
  assert.match(R.importJson('[]').error, /no recipes/);
  assert.match(R.importJson('{"recipes":[]}').error, /No usable recipes/);
  assert.match(R.importJson('{"recipes":[{"title":""}]}').error, /No usable recipes/);

  const messy = R.importJson(JSON.stringify({
    recipes: [{
      id: '../../etc/passwd', title: 'X'.repeat(300), servings: 9999, minutes: -5,
      tags: Array(50).fill('t'), ingredients: ['1 cup flour'], steps: ['do it'],
      extra: 'should not survive',
    }],
    plan: { Monday: { Dinner: { recipeId: 'nope', servings: 4 } } },
  }));
  const r = messy.recipes[0];
  assert.match(r.id, /^[\w-]{1,40}$/, 'a dangerous id is replaced with a safe one');
  assert.equal(r.title.length, 120, 'an overlong name is cut, not rejected');
  assert.equal(r.servings, 100, 'servings are clamped to the maximum');
  assert.equal(r.minutes, 0, 'a negative time becomes zero');
  assert.equal(r.tags.length, 10, 'tags are capped');
  assert.equal(r.extra, undefined, 'unknown fields do not come along');
  assert.equal(messy.plan.Monday.Dinner, null, 'a plan entry for a recipe that is not there is dropped');
});

test('two recipes claiming the same id both survive with distinct ids', () => {
  const out = R.importJson(JSON.stringify({
    recipes: [
      { id: 'same', title: 'One', servings: 2, ingredients: ['1 cup flour'] },
      { id: 'same', title: 'Two', servings: 2, ingredients: ['1 cup sugar'] },
    ],
  }));
  assert.equal(out.recipes.length, 2);
  assert.notEqual(out.recipes[0].id, out.recipes[1].id);
});

test('a count of one reads as one thing, without inventing a wrong singular', () => {
  const one = (item, unit) => R.formatIngredient({ qty: 1, unit: unit || '', item, note: '' });
  assert.equal(one('eggs'), '1 egg');
  assert.equal(one('onions'), '1 onion');
  assert.equal(one('spring onions'), '1 spring onion', 'only the last word changes');
  assert.equal(one('tomatoes'), '1 tomato');
  assert.equal(one('potatoes'), '1 potato');
  assert.equal(one('berries'), '1 berry');
  assert.equal(one('carrots'), '1 carrot');

  // Left alone, because a wrong singular is worse than a plural.
  assert.equal(one('asparagus'), '1 asparagus');
  assert.equal(one('molasses'), '1 molasses');
  assert.equal(one('watercress'), '1 watercress');
  assert.equal(one('chives'), '1 chives');
  assert.equal(one('rice'), '1 rice');

  // With a unit the item is what is being measured, so it keeps its plural.
  assert.equal(one('blueberries', 'cup'), '1 cup blueberries');
  assert.equal(one('eggs', 'cup'), '1 cup eggs');
  // And more than one is always left as written.
  assert.equal(R.formatIngredient({ qty: 2, unit: '', item: 'eggs', note: '' }), '2 eggs');
  assert.equal(R.formatIngredient({ qty: null, unit: '', item: 'eggs', note: '' }), 'eggs');
});
