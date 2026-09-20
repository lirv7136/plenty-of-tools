/* Recipe Keeper page logic. Everything is held in localStorage on this device.
   All user text reaches the page as text nodes, never as markup. */
(function () {
  'use strict';
  const C = window.RecipeCore;
  if (!C) return;

  const KEY = 'pot.recipe-keeper.v1';
  const $ = id => document.getElementById(id);
  const el = {
    summary: $('rk-summary'), toast: $('rk-toast'),
    neu: $('rk-new'), sample: $('rk-sample'), exp: $('rk-export'), imp: $('rk-import'), clear: $('rk-clear'),
    search: $('rk-search'), list: $('rk-list'), empty: $('rk-empty'),
    detail: $('rk-detail'), dTitle: $('rk-detail-title'), dMeta: $('rk-detail-meta'),
    servings: $('rk-servings'), servingsUnit: $('rk-servings-unit'),
    edit: $('rk-edit'), print: $('rk-print'), del: $('rk-delete'),
    ings: $('rk-ings'), steps: $('rk-steps'), notesWrap: $('rk-notes-wrap'), notes: $('rk-notes'),
    editor: $('rk-editor'), editorHeading: $('rk-editor-heading'), form: $('rk-form'),
    title: $('rk-title'), serves: $('rk-serves'), minutes: $('rk-minutes'), tags: $('rk-tags'),
    source: $('rk-source'), ingredients: $('rk-ingredients'), stepsInput: $('rk-steps-input'),
    notesInput: $('rk-notes-input'), error: $('rk-error'), cancel: $('rk-cancel'),
    pasteOpen: $('rk-paste-open'), paste: $('rk-paste'), pasteText: $('rk-paste-text'),
    pasteGo: $('rk-paste-go'), pasteCancel: $('rk-paste-cancel'),
    plan: $('rk-plan'), planClear: $('rk-plan-clear'),
    shopNote: $('rk-shop-note'), shopList: $('rk-shop-list'),
    copy: $('rk-copy'), shopPrint: $('rk-shop-print'), untick: $('rk-untick'),
  };

  let state = C.emptyState();
  let selectedId = null;
  let editingId = null;
  let toastTimer = null;

  // ---------- storage ----------
  function load() {
    let raw;
    try { raw = localStorage.getItem(KEY); } catch { return C.emptyState(); }
    if (!raw) return C.emptyState();
    const parsed = C.importJson(raw);
    if (parsed.error) return C.emptyState();
    const ticked = (() => {
      try { return JSON.parse(raw).ticked; } catch { return []; }
    })();
    return {
      version: C.VERSION,
      recipes: parsed.recipes,
      plan: parsed.plan,
      ticked: Array.isArray(ticked) ? ticked.filter(t => typeof t === 'string').slice(0, 500) : [],
    };
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        version: C.VERSION, recipes: state.recipes, plan: state.plan, ticked: state.ticked,
      }));
    } catch {
      toast('That could not be saved. Your browser storage may be full or blocked; export a file to be safe.');
    }
  }

  function toast(message) {
    el.toast.textContent = message || '';
    clearTimeout(toastTimer);
    if (message) toastTimer = setTimeout(() => { el.toast.textContent = ''; }, 6000);
  }

  // ---------- library ----------
  function matches(recipe, query) {
    if (!query) return true;
    const q = query.toLowerCase();
    return recipe.title.toLowerCase().includes(q) ||
      (recipe.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (recipe.ingredients || []).some(i => i.toLowerCase().includes(q));
  }

  function renderLibrary() {
    const query = el.search.value.trim();
    const shown = state.recipes.filter(r => matches(r, query))
      .sort((a, b) => a.title.localeCompare(b.title));
    el.list.innerHTML = '';
    for (const r of shown) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      if (r.id === selectedId) b.setAttribute('aria-current', 'true');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = r.title;
      const sub = document.createElement('span');
      sub.className = 'sub';
      const bits = [`serves ${r.servings}`];
      if (r.minutes) bits.push(`${r.minutes} min`);
      if (r.tags && r.tags.length) bits.push(r.tags.join(', '));
      sub.textContent = bits.join(' · ');
      b.append(name, sub);
      b.addEventListener('click', () => { selectedId = r.id; renderLibrary(); renderDetail(); });
      li.append(b);
      el.list.append(li);
    }
    el.empty.hidden = shown.length > 0;
    if (query && !shown.length) el.empty.textContent = 'Nothing matches that.';
    else el.empty.textContent = 'Add a recipe, or paste one in, and it will appear here.';

    el.summary.textContent = state.recipes.length
      ? `${state.recipes.length} recipe${state.recipes.length === 1 ? '' : 's'} kept on this device.`
      : 'No recipes yet.';
  }

  // ---------- detail ----------
  function current() { return state.recipes.find(r => r.id === selectedId) || null; }

  function renderDetail() {
    const r = current();
    el.detail.hidden = !r;
    if (!r) return;
    el.dTitle.textContent = r.title;
    const bits = [];
    if (r.minutes) bits.push(`${r.minutes} minutes`);
    if (r.tags && r.tags.length) bits.push(r.tags.join(', '));
    if (r.source) bits.push(r.source);
    el.dMeta.textContent = bits.join(' · ');
    el.servings.value = String(r.servings);
    renderIngredients();
    el.steps.innerHTML = '';
    for (const s of r.steps || []) {
      const li = document.createElement('li');
      li.textContent = s;
      el.steps.append(li);
    }
    el.notesWrap.hidden = !r.notes;
    el.notes.textContent = r.notes || '';
  }

  function renderIngredients() {
    const r = current();
    if (!r) return;
    const want = Math.max(1, Math.min(100, Number(el.servings.value) || r.servings));
    el.servingsUnit.textContent = want === 1 ? 'serving' : 'servings';
    el.ings.innerHTML = '';
    for (const ing of C.scaleIngredients(r, want)) {
      const li = document.createElement('li');
      li.textContent = C.formatIngredient(Object.assign({}, ing, { note: '' }));
      if (ing.note) {
        const note = document.createElement('span');
        note.className = 'note';
        note.textContent = ', ' + ing.note;
        li.append(note);
      }
      el.ings.append(li);
    }
  }

  // ---------- editor ----------
  function openEditor(recipe) {
    editingId = recipe ? recipe.id : null;
    el.editorHeading.textContent = recipe ? 'Edit recipe' : 'Add a recipe';
    el.title.value = recipe ? recipe.title : '';
    el.serves.value = recipe ? String(recipe.servings) : '4';
    el.minutes.value = recipe ? String(recipe.minutes || 0) : '20';
    el.tags.value = recipe ? (recipe.tags || []).join(', ') : '';
    el.source.value = recipe ? recipe.source || '' : '';
    el.ingredients.value = recipe ? (recipe.ingredients || []).join('\n') : '';
    el.stepsInput.value = recipe ? (recipe.steps || []).join('\n') : '';
    el.notesInput.value = recipe ? recipe.notes || '' : '';
    el.error.hidden = true;
    el.editor.hidden = false;
    el.paste.hidden = true;
    el.title.focus();
    el.editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function closeEditor() {
    el.editor.hidden = true;
    editingId = null;
  }

  function readForm() {
    const lines = v => v.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    return {
      id: editingId || C.uniqueId(new Set(state.recipes.map(r => r.id))),
      title: el.title.value.trim(),
      servings: Number(el.serves.value),
      minutes: Number(el.minutes.value) || 0,
      tags: el.tags.value.split(',').map(t => t.trim()).filter(Boolean).slice(0, 10),
      source: el.source.value.trim(),
      notes: el.notesInput.value.trim(),
      ingredients: lines(el.ingredients.value).slice(0, C.MAX_INGREDIENTS),
      steps: lines(el.stepsInput.value).slice(0, C.MAX_STEPS),
    };
  }

  el.form.addEventListener('submit', event => {
    event.preventDefault();
    const recipe = readForm();
    const problem = C.validateRecipe(recipe);
    if (problem) {
      el.error.textContent = problem;
      el.error.hidden = false;
      return;
    }
    if (state.recipes.length >= C.MAX_RECIPES && !editingId) {
      el.error.textContent = 'That is as many recipes as this will hold.';
      el.error.hidden = false;
      return;
    }
    const index = state.recipes.findIndex(r => r.id === recipe.id);
    if (index >= 0) state.recipes[index] = recipe; else state.recipes.push(recipe);
    selectedId = recipe.id;
    save();
    closeEditor();
    renderAll();
    toast(index >= 0 ? 'Recipe updated.' : 'Recipe saved.');
  });

  el.cancel.addEventListener('click', closeEditor);
  el.neu.addEventListener('click', () => openEditor(null));
  el.edit.addEventListener('click', () => { const r = current(); if (r) openEditor(r); });

  el.del.addEventListener('click', () => {
    const r = current();
    if (!r) return;
    if (!window.confirm(`Delete "${r.title}"? This cannot be undone.`)) return;
    state.recipes = state.recipes.filter(x => x.id !== r.id);
    for (const day of C.DAYS) for (const meal of C.MEALS) {
      const cell = state.plan[day][meal];
      if (cell && cell.recipeId === r.id) state.plan[day][meal] = null;
    }
    selectedId = null;
    el.detail.hidden = true;
    save();
    renderAll();
    toast('Recipe deleted.');
  });

  el.servings.addEventListener('input', renderIngredients);
  el.print.addEventListener('click', () => window.print());
  el.search.addEventListener('input', renderLibrary);

  // ---------- paste ----------
  el.pasteOpen.addEventListener('click', () => {
    el.paste.hidden = false;
    el.editor.hidden = true;
    el.pasteText.value = '';
    el.pasteText.focus();
    el.paste.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  el.pasteCancel.addEventListener('click', () => { el.paste.hidden = true; });
  el.pasteGo.addEventListener('click', () => {
    const parsed = C.parseRecipeText(el.pasteText.value);
    if (!parsed.ingredients.length && !parsed.steps.length) {
      toast('Nothing could be read from that. Try including an "Ingredients" heading.');
      return;
    }
    el.paste.hidden = true;
    openEditor(null);
    el.title.value = parsed.title;
    el.ingredients.value = parsed.ingredients.join('\n');
    el.stepsInput.value = parsed.steps.join('\n');
    toast('Read it. Check the ingredients and method, then save.');
  });

  // ---------- plan ----------
  function renderPlan() {
    el.plan.innerHTML = '';
    const head = document.createElement('thead');
    const hr = document.createElement('tr');
    const corner = document.createElement('th');
    corner.scope = 'col';
    corner.textContent = 'Day';
    hr.append(corner);
    for (const meal of C.MEALS) {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = meal;
      hr.append(th);
    }
    head.append(hr);
    el.plan.append(head);

    const body = document.createElement('tbody');
    for (const day of C.DAYS) {
      const tr = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = day;
      tr.append(th);
      for (const meal of C.MEALS) {
        const td = document.createElement('td');
        const select = document.createElement('select');
        select.setAttribute('aria-label', `${meal} on ${day}`);
        const none = document.createElement('option');
        none.value = '';
        none.textContent = '—';
        select.append(none);
        for (const r of state.recipes.slice().sort((a, b) => a.title.localeCompare(b.title))) {
          const option = document.createElement('option');
          option.value = r.id;
          option.textContent = r.title;
          select.append(option);
        }
        const cell = state.plan[day][meal];
        select.value = cell ? cell.recipeId : '';
        select.addEventListener('change', () => {
          state.plan[day][meal] = select.value ? { recipeId: select.value, servings: null } : null;
          save();
          renderPlan();
          renderShopping();
        });
        td.append(select);

        if (cell) {
          const serves = document.createElement('input');
          serves.type = 'number';
          serves.className = 'serves';
          serves.min = '1';
          serves.max = '100';
          serves.placeholder = 'serves';
          serves.value = cell.servings ? String(cell.servings) : '';
          serves.setAttribute('aria-label', `Servings for ${meal} on ${day}`);
          serves.addEventListener('change', () => {
            const n = Number(serves.value);
            state.plan[day][meal].servings = Number.isFinite(n) && n >= 1 && n <= 100 ? Math.round(n) : null;
            save();
            renderShopping();
          });
          td.append(serves);
        }
        tr.append(td);
      }
      body.append(tr);
    }
    el.plan.append(body);
  }

  el.planClear.addEventListener('click', () => {
    state.plan = C.emptyPlan();
    save();
    renderPlan();
    renderShopping();
    toast('The week is clear.');
  });

  // ---------- shopping ----------
  function renderShopping() {
    const list = C.shoppingList(state.plan, state.recipes);
    el.shopList.innerHTML = '';
    if (!list.length) {
      el.shopNote.hidden = false;
      return;
    }
    el.shopNote.hidden = true;
    for (const row of list) {
      const key = (row.item + '|' + (row.unit || '')).toLowerCase();
      const li = document.createElement('li');
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.ticked.includes(key);
      cb.addEventListener('change', () => {
        if (cb.checked) { if (!state.ticked.includes(key)) state.ticked.push(key); }
        else state.ticked = state.ticked.filter(k => k !== key);
        save();
      });
      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = C.formatIngredient({ qty: row.qty, unit: row.unit, item: row.item, note: '' });
      const from = document.createElement('span');
      from.className = 'from';
      from.textContent = row.from.join(', ');
      text.append(from);
      label.append(cb, text);
      li.append(label);
      el.shopList.append(li);
    }
  }

  el.copy.addEventListener('click', async () => {
    const lines = C.shoppingLines(C.shoppingList(state.plan, state.recipes));
    if (!lines.length) { toast('There is nothing on the list yet.'); return; }
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      toast('Shopping list copied.');
    } catch {
      toast('Your browser would not let the page copy. Select the list and copy it yourself.');
    }
  });
  el.shopPrint.addEventListener('click', () => window.print());
  el.untick.addEventListener('click', () => { state.ticked = []; save(); renderShopping(); });

  // ---------- file ----------
  el.exp.addEventListener('click', () => {
    const blob = new Blob([C.exportJson(state)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'recipes.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });

  el.imp.addEventListener('change', async () => {
    const file = el.imp.files && el.imp.files[0];
    el.imp.value = '';
    if (!file) return;
    const text = await file.text();
    const parsed = C.importJson(text);
    if (parsed.error) { toast(parsed.error + ' Nothing was changed.'); return; }
    state.recipes = parsed.recipes;
    state.plan = parsed.plan;
    state.ticked = [];
    selectedId = null;
    el.detail.hidden = true;
    save();
    renderAll();
    toast(`Imported ${parsed.recipes.length} recipe${parsed.recipes.length === 1 ? '' : 's'}.`);
  });

  el.clear.addEventListener('click', () => {
    if (!window.confirm('Delete every recipe and the week plan from this device? Export a file first if you want to keep them.')) return;
    state = C.emptyState();
    selectedId = null;
    el.detail.hidden = true;
    save();
    renderAll();
    toast('Cleared.');
  });

  // ---------- sample ----------
  function sample() {
    const recipes = [
      {
        id: 'sample-pancakes', title: 'Weekend pancakes', servings: 4, minutes: 20,
        tags: ['breakfast', 'quick'], source: '', notes: 'Rest the batter ten minutes if you have time.',
        ingredients: ['2 cups plain flour', '2 tbsp caster sugar', '2 eggs', '1 1/2 cups milk', '50 g butter, melted', 'a pinch of salt'],
        steps: ['Whisk the dry ingredients together in a wide bowl.', 'Beat in the eggs, milk and melted butter until smooth.', 'Fry spoonfuls in a hot buttered pan until bubbles appear, then turn.'],
      },
      {
        id: 'sample-soup', title: 'Roast tomato soup', servings: 4, minutes: 55,
        tags: ['vegetarian', 'dinner'], source: '', notes: '',
        ingredients: ['1 kg tomatoes, halved', '2 cloves garlic', '1 onion, quartered', '2 tbsp olive oil', '500 ml vegetable stock', 'a pinch of salt'],
        steps: ['Heat the oven to 200C.', 'Toss the tomatoes, garlic and onion in the oil and roast for 40 minutes.', 'Blend with the stock until smooth and season.'],
      },
      {
        id: 'sample-pasta', title: 'Garlic and chilli pasta', servings: 2, minutes: 15,
        tags: ['quick', 'dinner'], source: '', notes: '',
        ingredients: ['200 g spaghetti', '3 cloves garlic, sliced', '4 tbsp olive oil', '1 bunch parsley, chopped', 'a pinch of salt'],
        steps: ['Boil the spaghetti in well salted water.', 'Warm the garlic gently in the oil until it just colours.', 'Toss the drained pasta through with the parsley.'],
      },
    ];
    const plan = C.emptyPlan();
    plan.Monday.Dinner = { recipeId: 'sample-soup', servings: null };
    plan.Wednesday.Dinner = { recipeId: 'sample-pasta', servings: 4 };
    plan.Saturday.Breakfast = { recipeId: 'sample-pancakes', servings: null };
    return { version: C.VERSION, recipes, plan, ticked: [] };
  }

  el.sample.addEventListener('click', () => {
    state = sample();
    selectedId = 'sample-pancakes';
    save();
    renderAll();
    renderDetail();
    toast('Three recipes and a few meals planned, so you can see how it works.');
  });

  // ---------- go ----------
  function renderAll() {
    renderLibrary();
    renderDetail();
    renderPlan();
    renderShopping();
  }

  state = load();
  renderAll();

  window.__recipes = {
    get state() { return state; },
    set state(v) { state = v; },
    renderAll, sample, load, save,
    select: id => { selectedId = id; renderLibrary(); renderDetail(); },
  };
})();
