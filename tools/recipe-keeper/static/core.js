/* Recipe Keeper core: quantities, ingredient lines, scaling, the week plan and the
   shopping list. Pure functions, no DOM, no storage.
   UMD so node tests can require() it and the page can use RecipeCore. */
(function (root) {
  'use strict';
  const VERSION = 1;
  const MEALS = ['Breakfast', 'Lunch', 'Dinner'];
  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const MAX_RECIPES = 2000;
  const MAX_INGREDIENTS = 100;
  const MAX_STEPS = 100;

  // ---------- quantities ----------
  const VULGAR = {
    '½': 0.5, '⅓': 1 / 3, '⅔': 2 / 3, '¼': 0.25, '¾': 0.75, '⅕': 0.2, '⅖': 0.4,
    '⅗': 0.6, '⅘': 0.8, '⅙': 1 / 6, '⅚': 5 / 6, '⅐': 1 / 7, '⅛': 0.125, '⅜': 0.375,
    '⅝': 0.625, '⅞': 0.875, '⅑': 1 / 9, '⅒': 0.1,
  };
  // The fractions a cook actually reads off a measuring cup.
  const NICE = [
    [1 / 8, '1/8'], [1 / 6, '1/6'], [1 / 4, '1/4'], [1 / 3, '1/3'], [3 / 8, '3/8'],
    [1 / 2, '1/2'], [5 / 8, '5/8'], [2 / 3, '2/3'], [3 / 4, '3/4'], [5 / 6, '5/6'], [7 / 8, '7/8'],
  ];

  /** "1 1/2", "1½", "1.5", "½" and "1-2" all become a number. Ranges take the low end. */
  function parseQuantity(text) {
    let s = String(text == null ? '' : text).trim();
    if (!s) return null;
    for (const [glyph, value] of Object.entries(VULGAR)) {
      // A digit immediately before a vulgar fraction is a mixed number: 1½ is 1 + ½.
      s = s.replace(new RegExp('(\\d)\\s*' + glyph, 'g'), (_, d) => `${d} ${value}`);
      s = s.replace(new RegExp(glyph, 'g'), ` ${value} `);
    }
    s = s.replace(/\s+/g, ' ').trim();
    // A range: take the smaller number, which is the one that will not over shop.
    const range = /^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)$/.exec(s);
    if (range) return Number(range[1]);
    const mixed = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s);
    if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
    const mixedDecimal = /^(\d+)\s+(0?\.\d+)$/.exec(s);
    if (mixedDecimal) return Number(mixedDecimal[1]) + Number(mixedDecimal[2]);
    const plain = /^(\d+(?:\.\d+)?)$/.exec(s);
    if (plain) return Number(plain[1]);
    const lone = /^(0?\.\d+)$/.exec(s);
    if (lone) return Number(lone[1]);
    return null;
  }

  /** Back to something a person would write on a list. 1.5 reads as "1 1/2". */
  function formatQuantity(n) {
    const v = Number(n);
    if (!Number.isFinite(v) || v <= 0) return '';
    const whole = Math.floor(v + 1e-9);
    const rest = v - whole;
    if (rest < 0.02) return String(whole);
    for (const [value, label] of NICE) {
      if (Math.abs(rest - value) < 0.02) return whole ? `${whole} ${label}` : label;
    }
    const rounded = Math.round(v * 100) / 100;
    return String(rounded);
  }

  // ---------- units ----------
  // Only units that mean the same thing are merged. A cup of flour and 200 g of flour are
  // not added together, because they are different measurements of a different thing.
  const UNIT_ALIASES = {
    cup: 'cup', cups: 'cup', c: 'cup',
    tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp', tb: 'tbsp', T: 'tbsp',
    teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp', ts: 'tsp',
    gram: 'g', grams: 'g', g: 'g', gm: 'g',
    kilogram: 'kg', kilograms: 'kg', kg: 'kg', kgs: 'kg',
    millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml', ml: 'ml',
    litre: 'l', litres: 'l', liter: 'l', liters: 'l', l: 'l',
    ounce: 'oz', ounces: 'oz', oz: 'oz',
    pound: 'lb', pounds: 'lb', lb: 'lb', lbs: 'lb',
    pinch: 'pinch', pinches: 'pinch',
    clove: 'clove', cloves: 'clove',
    slice: 'slice', slices: 'slice',
    can: 'can', cans: 'can', tin: 'can', tins: 'can',
    bunch: 'bunch', bunches: 'bunch',
    sprig: 'sprig', sprigs: 'sprig',
    handful: 'handful', handfuls: 'handful',
    packet: 'packet', packets: 'packet', pack: 'packet',
    stick: 'stick', sticks: 'stick',
    sheet: 'sheet', sheets: 'sheet',
  };
  const PLURALS = {
    cup: 'cups', tbsp: 'tbsp', tsp: 'tsp', g: 'g', kg: 'kg', ml: 'ml', l: 'l', oz: 'oz',
    lb: 'lb', pinch: 'pinches', clove: 'cloves', slice: 'slices', can: 'cans',
    bunch: 'bunches', sprig: 'sprigs', handful: 'handfuls', packet: 'packets',
    stick: 'sticks', sheet: 'sheets',
  };

  function normaliseUnit(word) {
    if (!word) return '';
    const raw = String(word).trim().replace(/\.$/, '');
    if (Object.prototype.hasOwnProperty.call(UNIT_ALIASES, raw)) return UNIT_ALIASES[raw];
    const lower = raw.toLowerCase();
    return Object.prototype.hasOwnProperty.call(UNIT_ALIASES, lower) ? UNIT_ALIASES[lower] : '';
  }

  function formatUnit(unit, qty) {
    if (!unit) return '';
    const plural = PLURALS[unit] || unit;
    return qty > 1 ? plural : unit;
  }

  // ---------- ingredient lines ----------
  const QTY_HEAD = /^\s*((?:\d+\s+\d+\s*\/\s*\d+)|(?:\d+\s*\/\s*\d+)|(?:\d+(?:\.\d+)?\s*(?:-|–|to)\s*\d+(?:\.\d+)?)|(?:\d+(?:\.\d+)?)|[½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])\s*/;

  /**
   * "1 1/2 cups plain flour, sifted" becomes
   * { qty: 1.5, unit: 'cup', item: 'plain flour', note: 'sifted' }.
   * Anything it cannot read keeps its original text in `item`, with qty null, so nothing
   * is ever silently dropped off a shopping list.
   */
  function parseIngredientLine(line) {
    const original = String(line == null ? '' : line).replace(/\s+/g, ' ').trim();
    if (!original) return null;

    let rest = original;
    let qty = null;
    const head = QTY_HEAD.exec(rest);
    if (head) {
      // A mixed vulgar fraction such as "1½" arrives as one token.
      const mixedGlyph = /^(\d+)([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅐⅛⅜⅝⅞⅑⅒])/.exec(rest);
      if (mixedGlyph) {
        qty = Number(mixedGlyph[1]) + VULGAR[mixedGlyph[2]];
        rest = rest.slice(mixedGlyph[0].length).trim();
      } else {
        qty = parseQuantity(head[1]);
        rest = rest.slice(head[0].length).trim();
      }
    }

    // "a pinch of salt" and "an onion" are quantities too. Only treat the article as one
    // when a real unit follows it, so "a few tomatoes" is left alone rather than being
    // read as one "few".
    if (qty == null) {
      const article = /^(an?)\s+(\S+)/i.exec(rest);
      if (article && normaliseUnit(article[2])) {
        qty = 1;
        rest = rest.slice(article[1].length).trim();
      }
    }

    let unit = '';
    const firstWord = rest.split(' ')[0];
    const candidate = normaliseUnit(firstWord);
    if (candidate) {
      unit = candidate;
      rest = rest.slice(firstWord.length).trim();
      if (/^of\s+/i.test(rest)) rest = rest.replace(/^of\s+/i, '');
    }

    let note = '';
    const comma = rest.indexOf(',');
    if (comma >= 0) {
      note = rest.slice(comma + 1).trim();
      rest = rest.slice(0, comma).trim();
    }
    const paren = /\(([^)]*)\)/.exec(rest);
    if (paren) {
      note = note ? note + ', ' + paren[1].trim() : paren[1].trim();
      rest = rest.replace(paren[0], '').replace(/\s+/g, ' ').trim();
    }

    return { qty, unit, item: rest || original, note, raw: original };
  }

  /** A key that decides what may be added together on the shopping list. */
  function ingredientKey(ing) {
    return (ing.item || '').toLowerCase().replace(/\s+/g, ' ').trim() + '\u0000' + (ing.unit || '');
  }

  /**
   * "1 eggs" reads badly, so a count of exactly one singularises the item. Deliberately
   * conservative: only the endings that are safe to reverse are touched, and anything
   * else is left exactly as the cook wrote it. A wrong singular is worse than a plural.
   */
  function singularise(item) {
    const words = String(item || '').split(' ');
    const last = words[words.length - 1];
    if (last.length < 3) return item;
    const lower = last.toLowerCase();
    let singular = null;
    if (/[^aeiou]ies$/.test(lower) && last.length > 4) singular = last.slice(0, -3) + 'y';
    else if (/oes$/.test(lower)) singular = last.slice(0, -2);
    else if (/(ss|us|is|es)$/.test(lower)) singular = null;      // leave these alone
    else if (/s$/.test(lower)) singular = last.slice(0, -1);
    if (!singular) return item;
    words[words.length - 1] = singular;
    return words.join(' ');
  }

  function formatIngredient(ing) {
    const bits = [];
    if (ing.qty != null && ing.qty > 0) bits.push(formatQuantity(ing.qty));
    const unit = formatUnit(ing.unit, ing.qty == null ? 1 : ing.qty);
    if (unit) bits.push(unit);
    // Only a bare count singularises. With a unit the item is what is being measured
    // ("2 cups blueberries"), and that stays plural however much of it there is.
    bits.push(!unit && ing.qty === 1 ? singularise(ing.item) : ing.item);
    let out = bits.filter(Boolean).join(' ');
    if (ing.note) out += ', ' + ing.note;
    return out;
  }

  // ---------- pasted text ----------
  const STEP_HEADING = /^(method|steps?|instructions?|directions?|preparation)\b/i;
  const ING_HEADING = /^(ingredients?|you will need|what you need)\b/i;

  /**
   * Splits pasted recipe text into a title, ingredients and steps. It looks for the usual
   * headings first; failing that, a line that starts with a quantity is an ingredient and
   * a long sentence is a step.
   */
  function parseRecipeText(text) {
    const lines = String(text == null ? '' : text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { title: '', ingredients: [], steps: [] };

    let title = '';
    const ingredients = [];
    const steps = [];
    let mode = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (ING_HEADING.test(line) && line.length < 40) { mode = 'ing'; continue; }
      if (STEP_HEADING.test(line) && line.length < 40) { mode = 'step'; continue; }
      if (!title && i === 0 && !QTY_HEAD.test(line) && line.length < 90) { title = line; continue; }

      const numbered = /^\s*\d+\s*[.)]\s+/.test(line);
      const looksIngredient = QTY_HEAD.test(line) && line.length < 120 && !numbered;

      if (mode === 'ing' || (mode !== 'step' && looksIngredient)) {
        if (ingredients.length < MAX_INGREDIENTS) ingredients.push(line);
        continue;
      }
      if (mode === 'step' || numbered || line.length > 60) {
        if (steps.length < MAX_STEPS) steps.push(line.replace(/^\s*\d+\s*[.)]\s+/, ''));
        continue;
      }
      if (ingredients.length < MAX_INGREDIENTS) ingredients.push(line);
    }
    return { title, ingredients, steps };
  }

  // ---------- recipes ----------
  function uniqueId(existing) {
    let id;
    do { id = 'r' + Math.random().toString(36).slice(2, 10); } while (existing && existing.has && existing.has(id));
    return id;
  }

  function validateRecipe(recipe) {
    if (!recipe || typeof recipe !== 'object') return 'That is not a recipe.';
    const title = String(recipe.title || '').trim();
    if (!title) return 'Give the recipe a name.';
    if (title.length > 120) return 'Keep the name under 120 characters.';
    const servings = Number(recipe.servings);
    if (!Number.isFinite(servings) || servings < 1 || servings > 100) return 'Servings must be between 1 and 100.';
    if (!Array.isArray(recipe.ingredients) || !recipe.ingredients.length) return 'Add at least one ingredient.';
    if (recipe.ingredients.length > MAX_INGREDIENTS) return `Keep it under ${MAX_INGREDIENTS} ingredients.`;
    if (recipe.steps && recipe.steps.length > MAX_STEPS) return `Keep it under ${MAX_STEPS} steps.`;
    return '';
  }

  /** Quantities move with the servings; anything without a number is left as written. */
  function scaleIngredients(recipe, servings) {
    const from = Number(recipe.servings) || 1;
    const to = Number(servings) || from;
    const factor = from > 0 ? to / from : 1;
    return (recipe.ingredients || []).map(line => {
      const ing = parseIngredientLine(line);
      if (!ing) return null;
      return ing.qty == null ? ing : Object.assign({}, ing, { qty: ing.qty * factor });
    }).filter(Boolean);
  }

  // ---------- the plan ----------
  function emptyPlan() {
    const plan = {};
    for (const day of DAYS) { plan[day] = {}; for (const meal of MEALS) plan[day][meal] = null; }
    return plan;
  }

  function planEntries(plan) {
    const out = [];
    for (const day of DAYS) {
      for (const meal of MEALS) {
        const cell = plan && plan[day] ? plan[day][meal] : null;
        if (cell && cell.recipeId) out.push({ day, meal, recipeId: cell.recipeId, servings: Number(cell.servings) || null });
      }
    }
    return out;
  }

  /**
   * Everything the week needs, added up. Lines that share an item and a unit are summed;
   * lines with the same item in different units are kept apart and both shown, because
   * pretending to convert a cup of flour into grams would be a guess.
   */
  function shoppingList(plan, recipes) {
    const byId = new Map((recipes || []).map(r => [r.id, r]));
    const merged = new Map();
    const unparsed = [];

    for (const entry of planEntries(plan)) {
      const recipe = byId.get(entry.recipeId);
      if (!recipe) continue;
      const servings = entry.servings || recipe.servings;
      for (const ing of scaleIngredients(recipe, servings)) {
        if (ing.qty == null) {
          unparsed.push({ item: ing.item, note: ing.note, from: [recipe.title] });
          continue;
        }
        const key = ingredientKey(ing);
        const row = merged.get(key);
        if (row) {
          row.qty += ing.qty;
          if (!row.from.includes(recipe.title)) row.from.push(recipe.title);
        } else {
          merged.set(key, { item: ing.item, unit: ing.unit, qty: ing.qty, from: [recipe.title] });
        }
      }
    }

    // Loose items that appeared with no quantity are listed once each.
    const looseByItem = new Map();
    for (const u of unparsed) {
      const key = u.item.toLowerCase();
      const row = looseByItem.get(key);
      if (row) { for (const t of u.from) if (!row.from.includes(t)) row.from.push(t); }
      else looseByItem.set(key, { item: u.item, unit: '', qty: null, from: u.from.slice() });
    }

    const list = Array.from(merged.values()).concat(Array.from(looseByItem.values()));
    return list.sort((a, b) => a.item.localeCompare(b.item) || (a.unit || '').localeCompare(b.unit || ''));
  }

  function shoppingLines(list) {
    return (list || []).map(row => formatIngredient({ qty: row.qty, unit: row.unit, item: row.item, note: '' }));
  }

  // ---------- storage shape ----------
  function emptyState() {
    return { version: VERSION, recipes: [], plan: emptyPlan(), ticked: [] };
  }

  function exportJson(state) {
    return JSON.stringify({ version: VERSION, recipes: state.recipes, plan: state.plan }, null, 2);
  }

  /** Anything decoded from a file is rebuilt field by field; nothing is merged wholesale. */
  function importJson(text) {
    let raw;
    try { raw = JSON.parse(String(text)); } catch { return { error: 'That file is not readable.' }; }
    if (!raw || typeof raw !== 'object') return { error: 'That file is not a recipe collection.' };
    if (!Array.isArray(raw.recipes)) return { error: 'That file has no recipes in it.' };
    if (raw.recipes.length > MAX_RECIPES) return { error: 'That file has too many recipes in it.' };

    const recipes = [];
    const seen = new Set();
    for (const r of raw.recipes) {
      if (!r || typeof r !== 'object') continue;
      const id = typeof r.id === 'string' && /^[\w-]{1,40}$/.test(r.id) && !seen.has(r.id) ? r.id : uniqueId(seen);
      seen.add(id);
      const recipe = {
        id,
        title: String(r.title || '').slice(0, 120).trim(),
        servings: Math.min(100, Math.max(1, Math.round(Number(r.servings) || 2))),
        minutes: Math.min(1440, Math.max(0, Math.round(Number(r.minutes) || 0))),
        tags: Array.isArray(r.tags) ? r.tags.slice(0, 10).map(t => String(t).slice(0, 24).trim()).filter(Boolean) : [],
        source: String(r.source || '').slice(0, 300).trim(),
        notes: String(r.notes || '').slice(0, 2000),
        ingredients: Array.isArray(r.ingredients)
          ? r.ingredients.slice(0, MAX_INGREDIENTS).map(l => String(l).slice(0, 200).trim()).filter(Boolean) : [],
        steps: Array.isArray(r.steps)
          ? r.steps.slice(0, MAX_STEPS).map(l => String(l).slice(0, 1000).trim()).filter(Boolean) : [],
      };
      if (!validateRecipe(recipe)) recipes.push(recipe);
    }
    if (!recipes.length) return { error: 'No usable recipes were found in that file.' };

    const ids = new Set(recipes.map(r => r.id));
    const plan = emptyPlan();
    if (raw.plan && typeof raw.plan === 'object') {
      for (const day of DAYS) {
        const dayPlan = raw.plan[day];
        if (!dayPlan || typeof dayPlan !== 'object') continue;
        for (const meal of MEALS) {
          const cell = dayPlan[meal];
          if (cell && typeof cell === 'object' && ids.has(cell.recipeId)) {
            plan[day][meal] = {
              recipeId: cell.recipeId,
              servings: Math.min(100, Math.max(1, Math.round(Number(cell.servings) || 0))) || null,
            };
          }
        }
      }
    }
    return { recipes, plan };
  }

  const api = {
    VERSION, MEALS, DAYS, MAX_RECIPES, MAX_INGREDIENTS, MAX_STEPS,
    parseQuantity, formatQuantity, normaliseUnit, formatUnit,
    parseIngredientLine, ingredientKey, formatIngredient, singularise, parseRecipeText,
    uniqueId, validateRecipe, scaleIngredients,
    emptyPlan, planEntries, shoppingList, shoppingLines,
    emptyState, exportJson, importJson,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RecipeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
