/* CV Builder — runs entirely in the browser. No network calls. */
(function () {
  "use strict";
  const KEY = "pot:cv-builder:v1";
  const $ = (s, r) => (r || document).querySelector(s);

  // ---------- data model ----------
  const blank = () => ({
    basics: { name: "", label: "", email: "", phone: "", location: "", website: "", summary: "" },
    work: [], education: [], skills: [], projects: [], custom: [],
    order: ["summary", "work", "education", "skills", "projects"],
    meta: { template: "plain", paper: "a4", size: "10.5", accent: "#0b7a5a" }
  });
  const newWork = () => ({ company: "", position: "", location: "", dates: "", highlights: "" });
  const newEdu = () => ({ institution: "", area: "", dates: "", score: "", highlights: "" });
  const newSkill = () => ({ name: "", keywords: "" });
  const newProject = () => ({ name: "", url: "", dates: "", description: "", highlights: "" });
  const newCustom = () => ({ id: "c" + Math.random().toString(36).slice(2, 7), title: "Certifications", items: [] });
  const newCustomItem = () => ({ heading: "", sub: "", dates: "", text: "" });

  const example = () => ({
    basics: {
      name: "Alex Nguyen", label: "Mechatronics Engineer", email: "alex.nguyen@example.com", phone: "+61 400 000 000",
      location: "Sydney, NSW", website: "github.com/alexnguyen",
      summary: "Mechatronics graduate with two years of part time experience in building automation and data pipelines. Comfortable across embedded C++, Python analytics and control design. Looking for a graduate role in robotics or industrial automation."
    },
    work: [
      { company: "Northline Building Services", position: "Analytics Engineer (part time)", location: "Sydney", dates: "Feb 2025 – Present",
        highlights: "Built a fault detection pipeline over 1,200 air handling units across five sites, cutting time to detect stuck valves from days to hours\nWrote the GraphQL export tooling the maintenance team now uses daily\nPresented findings to the operations lead monthly" },
      { company: "USYD Robotics Club", position: "Firmware Lead", location: "Sydney", dates: "Mar 2024 – Dec 2024",
        highlights: "Led a team of four writing STM32 firmware for a line following robot that placed second in the national competition\nSet up CI with hardware in the loop tests" }
    ],
    education: [
      { institution: "University of Sydney", area: "B.E. (Hons) Mechatronic Engineering", dates: "2022 – 2026", score: "WAM 78",
        highlights: "Thesis: component level health scoring for HVAC plant using rule libraries and survival analysis" }
    ],
    skills: [
      { name: "Languages", keywords: "Python, C++, MATLAB, SQL, TypeScript" },
      { name: "Tools", keywords: "ROS 2, Simulink, Git, Docker, Cloudflare, Firebase" },
      { name: "Domains", keywords: "Control systems, embedded firmware, time series analytics, PLC integration" }
    ],
    projects: [
      { name: "AUV depth and heading controller", url: "", dates: "2026", description: "Course project, AMME3500",
        highlights: "Designed PID and lead compensators in Simulink; met 2% settling spec on both axes" }
    ],
    custom: [
      { id: "c1", title: "Certifications", items: [
        { heading: "HashiCorp Certified: Terraform Associate (004)", sub: "", dates: "2026", text: "" } ] }
    ],
    order: ["summary", "work", "education", "skills", "projects", "c1"],
    meta: { template: "plain", paper: "a4", size: "10.5", accent: "#0b7a5a" }
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) { const s = JSON.parse(raw); return normalise(s); }
    } catch (e) { /* storage unavailable or corrupt: start fresh */ }
    return blank();
  }
  function normalise(s) {
    const b = blank();
    const out = Object.assign(b, s || {});
    out.basics = Object.assign(b.basics, (s && s.basics) || {});
    out.meta = Object.assign(b.meta, (s && s.meta) || {});
    for (const k of ["work", "education", "skills", "projects", "custom"]) if (!Array.isArray(out[k])) out[k] = [];
    if (!Array.isArray(out.order) || !out.order.length) out.order = b.order;
    // make sure every custom section is in order and no dead ids remain
    const ids = new Set(out.custom.map(c => c.id));
    const builtin = ["summary", "work", "education", "skills", "projects"];
    out.order = out.order.filter(k => builtin.includes(k) || ids.has(k));
    for (const k of ["summary", "work", "education", "skills", "projects"]) if (!out.order.includes(k)) out.order.push(k);
    for (const c of out.custom) if (!out.order.includes(c.id)) out.order.push(c.id);
    return out;
  }

  let saveTimer;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(state)); flash("Saved in this browser"); }
      catch (e) { flash("Could not save locally"); }
    }, 400);
  }
  function flash(msg) {
    const el = $("#saved-indicator"); if (!el) return;
    el.textContent = msg; clearTimeout(flash.t); flash.t = setTimeout(() => { el.textContent = ""; }, 1800);
  }

  // ---------- helpers ----------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lines = s => String(s || "").split("\n").map(x => x.trim()).filter(Boolean);
  function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
  function setPath(obj, path, val) {
    const ks = path.split("."); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]];
    o[ks[ks.length - 1]] = val;
  }
  function move(arr, i, d) { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; }

  const SECTION_TITLES = { summary: "Summary", work: "Experience", education: "Education", skills: "Skills", projects: "Projects" };
  function sectionTitle(key) {
    if (SECTION_TITLES[key]) return SECTION_TITLES[key];
    const c = state.custom.find(x => x.id === key); return c ? (c.title || "Section") : key;
  }

  // ---------- editor ----------
  const collapsed = new Set();
  function field(label, path, opts) {
    opts = opts || {};
    const val = esc(getPath(state, path));
    const id = "f_" + path.replace(/\W/g, "_");
    const ctl = opts.textarea
      ? `<textarea id="${id}" data-path="${path}" placeholder="${esc(opts.placeholder || "")}" rows="${opts.rows || 3}">${val}</textarea>`
      : `<input id="${id}" type="${opts.type || "text"}" data-path="${path}" value="${val}" placeholder="${esc(opts.placeholder || "")}">`;
    return `<div class="field"><label for="${id}">${esc(label)}</label>${ctl}${opts.hint ? `<span class="hint">${esc(opts.hint)}</span>` : ""}</div>`;
  }
  function entryHead(title, listPath, i, n) {
    return `<div class="entry-head"><strong>${esc(title) || "<span class=muted>New entry</span>"}</strong><div class="ctl">
      <button class="icon" type="button" data-act="up" data-list="${listPath}" data-i="${i}" ${i === 0 ? "disabled" : ""} title="Move up" aria-label="Move up">↑</button>
      <button class="icon" type="button" data-act="down" data-list="${listPath}" data-i="${i}" ${i === n - 1 ? "disabled" : ""} title="Move down" aria-label="Move down">↓</button>
      <button class="icon del" type="button" data-act="del" data-list="${listPath}" data-i="${i}" title="Remove" aria-label="Remove">×</button></div></div>`;
  }
  function section(key, title, body, idx, n, extraCtl) {
    const col = collapsed.has(key) ? " collapsed" : "";
    return `<div class="sec${col}" data-sec="${key}">
      <div class="sec-head" data-toggle="${key}"><span class="chev">▾</span><h2>${esc(title)}</h2><div class="ctl">
        ${extraCtl || ""}
        ${idx != null ? `<button class="icon" type="button" data-act="secup" data-key="${key}" ${idx === 0 ? "disabled" : ""} title="Move section up" aria-label="Move section up">↑</button>
        <button class="icon" type="button" data-act="secdown" data-key="${key}" ${idx === n - 1 ? "disabled" : ""} title="Move section down" aria-label="Move section down">↓</button>` : ""}
      </div></div>
      <div class="sec-body">${body}</div></div>`;
  }

  function renderEditor() {
    const ed = $("#editor");
    let html = "";
    html += section("basics", "Contact", [
      field("Full name", "basics.name", { placeholder: "Alex Nguyen" }),
      field("Title", "basics.label", { placeholder: "Mechatronics Engineer" }),
      `<div class="row">${field("Email", "basics.email", { type: "email" })}${field("Phone", "basics.phone")}</div>`,
      `<div class="row">${field("Location", "basics.location", { placeholder: "Sydney, NSW" })}${field("Website / LinkedIn", "basics.website", { placeholder: "linkedin.com/in/…" })}</div>`
    ].join(""));

    const n = state.order.length;
    state.order.forEach((key, idx) => {
      if (key === "summary") {
        html += section(key, "Summary", field("Two to four sentences", "basics.summary", { textarea: true, rows: 4 }), idx, n);
      } else if (key === "work") {
        const body = state.work.map((w, i) => `<div class="entry">${entryHead(w.position || w.company, "work", i, state.work.length)}
          <div class="row">${field("Role", `work.${i}.position`)}${field("Company", `work.${i}.company`)}</div>
          <div class="row">${field("Dates", `work.${i}.dates`, { placeholder: "Mar 2024 – Present" })}${field("Location", `work.${i}.location`)}</div>
          ${field("Achievements, one per line", `work.${i}.highlights`, { textarea: true, rows: 4, hint: "Start with a verb, end with a number where you can." })}</div>`).join("")
          + `<button class="btn small" type="button" data-act="add" data-list="work">+ Add role</button>`;
        html += section(key, "Experience", body, idx, n);
      } else if (key === "education") {
        const body = state.education.map((e, i) => `<div class="entry">${entryHead(e.institution || e.area, "education", i, state.education.length)}
          ${field("Institution", `education.${i}.institution`)}
          ${field("Qualification", `education.${i}.area`, { placeholder: "B.E. (Hons) Mechatronic Engineering" })}
          <div class="row">${field("Dates", `education.${i}.dates`, { placeholder: "2022 – 2026" })}${field("Grade", `education.${i}.score`, { placeholder: "WAM 78 / GPA 3.8" })}</div>
          ${field("Notes, one per line", `education.${i}.highlights`, { textarea: true, rows: 2 })}</div>`).join("")
          + `<button class="btn small" type="button" data-act="add" data-list="education">+ Add education</button>`;
        html += section(key, "Education", body, idx, n);
      } else if (key === "skills") {
        const body = state.skills.map((s, i) => `<div class="entry">${entryHead(s.name, "skills", i, state.skills.length)}
          <div class="row">${field("Group", `skills.${i}.name`, { placeholder: "Languages" })}${field("Skills, comma separated", `skills.${i}.keywords`, { placeholder: "Python, C++, SQL" })}</div></div>`).join("")
          + `<button class="btn small" type="button" data-act="add" data-list="skills">+ Add skill group</button>`;
        html += section(key, "Skills", body, idx, n);
      } else if (key === "projects") {
        const body = state.projects.map((p, i) => `<div class="entry">${entryHead(p.name, "projects", i, state.projects.length)}
          <div class="row">${field("Project", `projects.${i}.name`)}${field("Dates", `projects.${i}.dates`)}</div>
          <div class="row">${field("Link", `projects.${i}.url`, { placeholder: "github.com/…" })}${field("One line description", `projects.${i}.description`)}</div>
          ${field("Details, one per line", `projects.${i}.highlights`, { textarea: true, rows: 3 })}</div>`).join("")
          + `<button class="btn small" type="button" data-act="add" data-list="projects">+ Add project</button>`;
        html += section(key, "Projects", body, idx, n);
      } else {
        const ci = state.custom.findIndex(c => c.id === key); if (ci < 0) return;
        const c = state.custom[ci];
        const body = field("Section title", `custom.${ci}.title`, { placeholder: "Certifications, Awards, Volunteering, Referees…" })
          + c.items.map((it, i) => `<div class="entry">${entryHead(it.heading, `custom.${ci}.items`, i, c.items.length)}
          <div class="row">${field("Heading", `custom.${ci}.items.${i}.heading`)}${field("Dates", `custom.${ci}.items.${i}.dates`)}</div>
          ${field("Subheading", `custom.${ci}.items.${i}.sub`)}
          ${field("Details, one per line", `custom.${ci}.items.${i}.text`, { textarea: true, rows: 2 })}</div>`).join("")
          + `<button class="btn small" type="button" data-act="add" data-list="custom.${ci}.items">+ Add item</button>`;
        html += section(key, c.title || "Custom section", body, idx, n,
          `<button class="icon del" type="button" data-act="delsec" data-key="${key}" title="Remove section" aria-label="Remove section">×</button>`);
      }
    });
    html += `<button class="btn" type="button" data-act="addsec">+ Add a section</button>`;
    ed.innerHTML = html;
  }

  // ---------- preview ----------
  function renderPreview() {
    const b = state.basics, m = state.meta;
    const page = $("#page");
    page.className = "page tpl-" + m.template + (m.paper === "letter" ? " letter" : "");
    page.style.setProperty("--cv-accent", m.accent || "#0b7a5a");
    page.style.setProperty("--cv-size", (m.size || "10.5") + "pt");
    const contact = [b.email, b.phone, b.location, b.website].filter(Boolean).map(x => `<span>${esc(x)}</span>`).join("");
    let html = `<header class="head"><p class="name">${esc(b.name) || '<span class="empty">Your name</span>'}</p>`
      + (b.label ? `<p class="label">${esc(b.label)}</p>` : "")
      + (contact ? `<div class="contact">${contact}</div>` : "") + `</header>`;
    const ul = txt => { const l = lines(txt); return l.length ? `<ul>${l.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""; };
    for (const key of state.order) {
      if (key === "summary") { if (b.summary) html += `<h2>Summary</h2><p class="summary">${esc(b.summary)}</p>`; }
      else if (key === "work") {
        const w = state.work.filter(x => x.company || x.position || x.highlights); if (!w.length) continue;
        html += `<h2>Experience</h2>` + w.map(x => `<div class="entry-p"><div class="eh"><span class="t">${esc(x.position)}</span><span class="d">${esc(x.dates)}</span></div>
          <div class="sub"><span>${esc(x.company)}</span><span>${esc(x.location)}</span></div>${ul(x.highlights)}</div>`).join("");
      } else if (key === "education") {
        const e = state.education.filter(x => x.institution || x.area); if (!e.length) continue;
        html += `<h2>Education</h2>` + e.map(x => `<div class="entry-p"><div class="eh"><span class="t">${esc(x.institution)}</span><span class="d">${esc(x.dates)}</span></div>
          <div class="sub"><span>${esc(x.area)}</span><span>${esc(x.score)}</span></div>${ul(x.highlights)}</div>`).join("");
      } else if (key === "skills") {
        const s = state.skills.filter(x => x.name || x.keywords); if (!s.length) continue;
        html += `<h2>Skills</h2><div class="skills">` + s.map(x => `<span class="k">${esc(x.name)}</span><span>${esc(x.keywords)}</span>`).join("") + `</div>`;
      } else if (key === "projects") {
        const p = state.projects.filter(x => x.name || x.description); if (!p.length) continue;
        html += `<h2>Projects</h2>` + p.map(x => `<div class="entry-p"><div class="eh"><span class="t">${esc(x.name)}${x.url ? ` <span style="font-weight:400;color:#444">· ${esc(x.url)}</span>` : ""}</span><span class="d">${esc(x.dates)}</span></div>
          ${x.description ? `<div class="sub"><span>${esc(x.description)}</span></div>` : ""}${ul(x.highlights)}</div>`).join("");
      } else {
        const c = state.custom.find(x => x.id === key); if (!c) continue;
        const items = c.items.filter(x => x.heading || x.text || x.sub); if (!items.length) continue;
        html += `<h2>${esc(c.title || "Section")}</h2>` + items.map(x => `<div class="entry-p"><div class="eh"><span class="t">${esc(x.heading)}</span><span class="d">${esc(x.dates)}</span></div>
          ${x.sub ? `<div class="sub"><span>${esc(x.sub)}</span></div>` : ""}${ul(x.text)}</div>`).join("");
      }
    }
    page.innerHTML = html;
    fit();
    // page size for print
    let st = $("#pagesize"); if (!st) { st = document.createElement("style"); st.id = "pagesize"; document.head.appendChild(st); }
    st.textContent = `@media print{@page{size:${m.paper === "letter" ? "Letter" : "A4"};margin:0}}`;
  }
  function fit() {
    const wrap = $("#preview-wrap"), page = $("#page");
    const avail = wrap.clientWidth - 32; // padding
    page.style.transform = "none";
    const w = page.offsetWidth, h = page.offsetHeight;
    const s = Math.min(1, avail / w);
    page.style.transform = `scale(${s})`;
    wrap.style.height = (h * s + 32) + "px";
  }
  function syncControls() {
    $("#opt-template").value = state.meta.template; $("#opt-paper").value = state.meta.paper;
    $("#opt-size").value = state.meta.size; $("#opt-accent").value = state.meta.accent;
  }
  function renderAll() { renderEditor(); renderPreview(); syncControls(); }

  // ---------- events ----------
  let previewTimer;
  $("#editor").addEventListener("input", e => {
    const p = e.target.dataset.path; if (!p) return;
    setPath(state, p, e.target.value);
    // keep entry headings in sync without rebuilding the form
    const head = e.target.closest(".entry") && e.target.closest(".entry").querySelector(".entry-head strong");
    if (head && /\.(position|company|institution|area|name|heading|title)$/.test(p)) {
      const parts = p.split("."); const list = getPath(state, parts.slice(0, -1).join("."));
      head.textContent = list.position || list.company || list.institution || list.area || list.name || list.heading || "";
    }
    if (/^custom\.\d+\.title$/.test(p)) { const h = e.target.closest(".sec").querySelector("h2"); if (h) h.textContent = e.target.value || "Custom section"; }
    clearTimeout(previewTimer); previewTimer = setTimeout(renderPreview, 60);
    save();
  });
  $("#editor").addEventListener("click", e => {
    const t = e.target.closest("[data-act],[data-toggle]"); if (!t) return;
    if (t.dataset.toggle) {
      if (e.target.closest(".ctl")) return;
      const k = t.dataset.toggle; collapsed.has(k) ? collapsed.delete(k) : collapsed.add(k); t.parentElement.classList.toggle("collapsed"); return;
    }
    const act = t.dataset.act;
    if (act === "add") {
      const list = getPath(state, t.dataset.list);
      const mk = { work: newWork, education: newEdu, skills: newSkill, projects: newProject }[t.dataset.list] || newCustomItem;
      list.push(mk());
    } else if (act === "del") { getPath(state, t.dataset.list).splice(+t.dataset.i, 1); }
    else if (act === "up" || act === "down") { move(getPath(state, t.dataset.list), +t.dataset.i, act === "up" ? -1 : 1); }
    else if (act === "secup" || act === "secdown") { move(state.order, state.order.indexOf(t.dataset.key), act === "secup" ? -1 : 1); }
    else if (act === "addsec") { const c = newCustom(); state.custom.push(c); state.order.push(c.id); collapsed.clear(); }
    else if (act === "delsec") {
      if (!confirm("Remove this section and everything in it?")) return;
      state.custom = state.custom.filter(c => c.id !== t.dataset.key); state.order = state.order.filter(k => k !== t.dataset.key);
    }
    renderAll(); save();
  });

  for (const [id, key] of [["#opt-template", "template"], ["#opt-paper", "paper"], ["#opt-size", "size"], ["#opt-accent", "accent"]]) {
    $(id).addEventListener("input", e => { state.meta[key] = e.target.value; renderPreview(); save(); });
  }
  $("#btn-pdf").addEventListener("click", () => {
    const old = document.title;
    document.title = (state.basics.name ? state.basics.name.replace(/\s+/g, "_") : "CV") + "_CV";
    window.print();
    setTimeout(() => { document.title = old; }, 1000);
  });
  $("#btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = (state.basics.name ? state.basics.name.replace(/\s+/g, "_") : "cv") + ".json"; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("#file-import").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { state = normalise(JSON.parse(r.result)); renderAll(); save(); flash("Imported"); } catch (err) { alert("That file is not a CV export from this tool."); } };
    r.readAsText(f); e.target.value = "";
  });
  $("#btn-example").addEventListener("click", () => {
    const hasContent = state.basics.name || state.work.length || state.education.length;
    if (hasContent && !confirm("Replace what you have with the example CV?")) return;
    state = example(); renderAll(); save();
  });
  $("#btn-clear").addEventListener("click", () => {
    if (!confirm("Clear everything? This cannot be undone.")) return;
    state = blank(); try { localStorage.removeItem(KEY); } catch (e) {} renderAll(); flash("Cleared");
  });
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(x => { x.classList.remove("active"); x.setAttribute("aria-selected", "false"); });
    b.classList.add("active"); b.setAttribute("aria-selected", "true");
    document.body.classList.toggle("show-preview", b.dataset.tab === "preview"); fit();
  }));
  window.addEventListener("resize", fit);
  window.addEventListener("beforeprint", () => { $("#page").style.transform = "none"; });
  window.addEventListener("afterprint", fit);

  // first paint: an empty state should still show what the tool does
  if (!state.basics.name && !state.work.length && !state.education.length) {
    // leave blank but preview shows placeholder name; the example button is one click away
  }
  renderAll();
})();
