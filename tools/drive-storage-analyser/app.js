/* Google Storage Analyser — read only, runs in the browser. The OAuth token
   lives in memory for this tab and is revoked on sign out. Nothing is stored. */
(function () {
  "use strict";
  const $ = (s, r) => (r || document).querySelector(s);
  const CLIENT_ID = (window.POT && window.POT.googleClientId) || "";
  const SCOPE = "https://www.googleapis.com/auth/drive.metadata.readonly";
  const API = "https://www.googleapis.com/drive/v3";
  const FIELDS = "nextPageToken,files(id,name,mimeType,size,quotaBytesUsed,md5Checksum,modifiedTime,trashed,ownedByMe,webViewLink)";

  let token = null, tokenClient = null, data = null, view = "largest", isSample = false;

  // ---------- helpers ----------
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function bytes(n) {
    n = Number(n) || 0;
    const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
    while (n >= 1000 && i < u.length - 1) { n /= 1000; i++; }
    return (i === 0 ? n : n.toFixed(n >= 100 ? 0 : n >= 10 ? 1 : 2)) + " " + u[i];
  }
  const pct = (a, b) => b ? Math.max(0, Math.min(100, (a / b) * 100)) : 0;
  const when = iso => iso ? new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short" }) : "";
  function typeOf(m) {
    m = m || "";
    if (m.startsWith("video/")) return "Video";
    if (m.startsWith("image/")) return "Images";
    if (m.startsWith("audio/")) return "Audio";
    if (m === "application/pdf") return "PDFs";
    if (/zip|rar|7z|tar|gzip|x-iso|dmg|apk/.test(m)) return "Archives and disk images";
    if (m.startsWith("application/vnd.google-apps.")) return "Google Docs, Sheets, Slides";
    if (/msword|officedocument|opendocument|text\//.test(m)) return "Documents";
    if (m === "application/octet-stream") return "Unknown binaries";
    return "Other";
  }
  function setMsg(el, msg) { $(el).textContent = msg; }
  function show(id, on) { $(id).hidden = !on; }

  // ---------- auth ----------
  function loadGis() {
    return new Promise((res, rej) => {
      if (window.google && google.accounts) return res();
      const s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true;
      s.onload = res; s.onerror = () => rej(new Error("Could not load Google's sign in script. Check your connection or ad blocker."));
      document.head.appendChild(s);
    });
  }
  async function signIn() {
    if (!CLIENT_ID) { setMsg("#auth-msg", "Sign in is not configured on this deployment yet. Try the sample data to see what the tool does."); return; }
    try {
      show("#progress", true); setMsg("#progress-msg", "Opening Google sign in…");
      await loadGis();
      tokenClient = tokenClient || google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPE,
        callback: resp => {
          if (resp.error) { fail("Sign in was cancelled or refused: " + resp.error); return; }
          token = resp.access_token; isSample = false; scan().catch(fail);
        }
      });
      tokenClient.requestAccessToken({ prompt: "" });
    } catch (e) { fail(e.message); }
  }
  function signOut() {
    if (token && window.google) { try { google.accounts.oauth2.revoke(token, () => {}); } catch (e) {} }
    token = null; data = null; isSample = false;
    show("#results", false); show("#btn-signout", false); show("#btn-signin", true); show("#btn-sample", true);
    setMsg("#auth-msg", "Access revoked. Nothing about your files was kept.");
  }
  function fail(msg) { show("#progress", false); setMsg("#auth-msg", msg); }

  // ---------- fetch ----------
  async function gapi(path, params) {
    const u = new URL(API + path);
    Object.entries(params || {}).forEach(([k, v]) => u.searchParams.set(k, v));
    const r = await fetch(u, { headers: { Authorization: "Bearer " + token } });
    if (r.status === 401) throw new Error("Your sign in expired. Sign in again.");
    if (r.status === 403) throw new Error("Google refused the request (403). The Drive API may not be enabled for this deployment's Google project, or your account blocks third party apps.");
    if (!r.ok) throw new Error("Google returned " + r.status + ".");
    return r.json();
  }
  async function listAll(q, onPage) {
    let files = [], pageToken;
    do {
      const page = await gapi("/files", { pageSize: 1000, fields: FIELDS, q, corpora: "user", pageToken: pageToken || "" });
      files = files.concat(page.files || []); pageToken = page.nextPageToken; onPage(files.length);
    } while (pageToken);
    return files;
  }
  async function scan() {
    show("#progress", true); show("#btn-signin", false); show("#btn-sample", false);
    setMsg("#progress-msg", "Reading your storage quota…");
    const about = await gapi("/about", { fields: "storageQuota,user(displayName,emailAddress)" });
    const live = await listAll("trashed = false", n => setMsg("#progress-msg", `Scanning files… ${n.toLocaleString()} so far`));
    const trash = await listAll("trashed = true", n => setMsg("#progress-msg", `Scanning trash… ${n.toLocaleString()} so far`));
    data = analyse(about, live.concat(trash));
    render();
  }

  // ---------- analysis ----------
  function analyse(about, files) {
    const q = about.storageQuota || {};
    const quota = {
      limit: Number(q.limit) || 0, usage: Number(q.usage) || 0,
      drive: Number(q.usageInDrive) || 0, trash: Number(q.usageInDriveTrash) || 0
    };
    quota.other = Math.max(0, quota.usage - quota.drive - quota.trash); // Gmail + Photos, only available combined
    quota.free = Math.max(0, quota.limit - quota.usage);
    const mine = files.filter(f => f.ownedByMe !== false);
    const sharedWithMe = files.length - mine.length;
    for (const f of mine) f.q = Number(f.quotaBytesUsed) || Number(f.size) || 0;
    const live = mine.filter(f => !f.trashed), trashed = mine.filter(f => f.trashed);
    const largest = live.slice().sort((a, b) => b.q - a.q).slice(0, 200);
    // duplicates by checksum (binary files only)
    const byMd5 = new Map();
    for (const f of live) if (f.md5Checksum && f.q > 0) { const a = byMd5.get(f.md5Checksum) || []; a.push(f); byMd5.set(f.md5Checksum, a); }
    const dupes = [...byMd5.values()].filter(a => a.length > 1).map(a => ({ files: a.sort((x, y) => new Date(x.modifiedTime) - new Date(y.modifiedTime)), wasted: (a.length - 1) * a[0].q }))
      .sort((a, b) => b.wasted - a.wasted);
    const dupeWaste = dupes.reduce((s, d) => s + d.wasted, 0);
    const trashTotal = trashed.reduce((s, f) => s + f.q, 0);
    const cutoff = Date.now() - 2 * 365.25 * 86400000;
    const stale = live.filter(f => f.q > 10e6 && f.modifiedTime && new Date(f.modifiedTime) < cutoff).sort((a, b) => b.q - a.q).slice(0, 200);
    const staleTotal = stale.reduce((s, f) => s + f.q, 0);
    const types = {};
    for (const f of live) { const t = typeOf(f.mimeType); types[t] = types[t] || { type: t, count: 0, q: 0 }; types[t].count++; types[t].q += f.q; }
    return { user: about.user || {}, quota, count: live.length, sharedWithMe, largest, dupes, dupeWaste, trashed: trashed.sort((a, b) => b.q - a.q).slice(0, 200), trashTotal, stale, staleTotal, types: Object.values(types).sort((a, b) => b.q - a.q) };
  }

  // ---------- render ----------
  function render() {
    show("#progress", false); show("#results", true); show("#btn-signout", !isSample); show("#btn-signin", isSample); show("#btn-sample", isSample);
    $("#sample-badge").hidden = !isSample;
    const d = data, q = d.quota;
    $("#headline").textContent = isSample ? "A sample account" : "Your storage";
    $("#account").textContent = d.user.emailAddress ? d.user.emailAddress : "";
    // bar
    const segs = [["seg-drive", q.drive, "Drive files"], ["seg-trash", q.trash, "Drive trash"], ["seg-other", q.other, "Gmail + Photos"]];
    $("#quota-bar").innerHTML = segs.map(([c, v]) => `<span class="${c}" style="width:${pct(v, q.limit).toFixed(2)}%"></span>`).join("");
    const colors = { "seg-drive": "#0b7a5a", "seg-trash": "#c2410c", "seg-other": "#2b4ee6" };
    $("#quota-legend").innerHTML = segs.map(([c, v, l]) => `<span><i style="background:${colors[c]}"></i>${l} ${bytes(v)}</span>`).join("")
      + `<span><i style="background:var(--line)"></i>Free ${bytes(q.free)} of ${bytes(q.limit)}</span>`;
    // tiles
    const recoverable = d.trashTotal + d.dupeWaste;
    $("#tiles").innerHTML = [
      tile("Used", bytes(q.usage), `${pct(q.usage, q.limit).toFixed(0)}% of ${bytes(q.limit)}`),
      tile("Files you own", d.count.toLocaleString(), d.sharedWithMe ? `${d.sharedWithMe.toLocaleString()} shared with you, not counted` : "in Drive, not counting trash"),
      tile("Trash", bytes(d.trashTotal), "freed by emptying the trash", d.trashTotal > 0),
      tile("Duplicates", bytes(d.dupeWaste), `${d.dupes.length} sets of identical files`, d.dupeWaste > 0),
      tile("Untouched 2+ yrs", bytes(d.staleTotal), `${d.stale.length} files over 10 MB`),
      tile("Quick win", bytes(recoverable), "trash + duplicates, no judgement calls", recoverable > 0)
    ].join("");
    renderView();
  }
  function tile(k, v, s, win) { return `<div class="tile${win ? " win" : ""}"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${esc(s)}</span></div>`; }
  function row(f, extra) {
    const link = f.webViewLink ? `<a href="${esc(f.webViewLink)}" target="_blank" rel="noopener">${esc(f.name)}</a>` : esc(f.name);
    return `<tr><td>${link}<div class="type">${esc(typeOf(f.mimeType))}</div></td><td class="num">${bytes(f.q)}</td><td>${when(f.modifiedTime)}</td>${extra || ""}</tr>`;
  }
  function renderView() {
    const d = data, th = $("#thead"), tb = $("#tbody"), note = $("#view-note"), more = $("#more-note");
    document.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t.dataset.view === view));
    more.textContent = "";
    if (view === "largest") {
      note.textContent = "Files you own, by how much of your quota they use. Open one in Drive to move it or delete it.";
      th.innerHTML = "<tr><th>File</th><th class=num>Size</th><th>Modified</th></tr>";
      tb.innerHTML = d.largest.map(f => row(f)).join("") || empty("No files found.");
      if (d.largest.length === 200) more.textContent = "Showing the 200 largest.";
    } else if (view === "dupes") {
      note.textContent = `Identical content found by checksum. Keeping one copy of each would free ${bytes(d.dupeWaste)}. The oldest copy is listed first.`;
      th.innerHTML = "<tr><th>Copies</th><th class=num>Each</th><th class=num>Wasted</th></tr>";
      tb.innerHTML = d.dupes.slice(0, 100).map(g => `<tr><td>${g.files.map(f => f.webViewLink ? `<a href="${esc(f.webViewLink)}" target="_blank" rel="noopener">${esc(f.name)}</a>` : esc(f.name)).join("<br>")}<div class="type">${g.files.length} copies · ${esc(typeOf(g.files[0].mimeType))}</div></td><td class="num">${bytes(g.files[0].q)}</td><td class="num">${bytes(g.wasted)}</td></tr>`).join("") || empty("No duplicate files. Nice.");
    } else if (view === "trash") {
      note.textContent = d.trashTotal ? `Everything in the trash still counts. Emptying it frees ${bytes(d.trashTotal)} immediately.` : "The trash is empty.";
      th.innerHTML = "<tr><th>File</th><th class=num>Size</th><th>Modified</th></tr>";
      tb.innerHTML = d.trashed.map(f => row(f)).join("") || empty("Nothing in the trash.");
    } else if (view === "stale") {
      note.textContent = "Files over 10 MB that have not been modified in two years. Candidates for an external drive, or for deleting.";
      th.innerHTML = "<tr><th>File</th><th class=num>Size</th><th>Modified</th></tr>";
      tb.innerHTML = d.stale.map(f => row(f)).join("") || empty("Nothing large has gone untouched that long.");
    } else if (view === "types") {
      note.textContent = "Where the space goes by kind of file. Video is usually the answer.";
      th.innerHTML = "<tr><th>Type</th><th class=num>Files</th><th class=num>Total</th><th class=num>Share of Drive</th></tr>";
      const total = d.types.reduce((s, t) => s + t.q, 0);
      tb.innerHTML = d.types.map(t => `<tr><td>${esc(t.type)}</td><td class="num">${t.count.toLocaleString()}</td><td class="num">${bytes(t.q)}</td><td class="num">${pct(t.q, total).toFixed(1)}%</td></tr>`).join("") || empty("No files.");
    }
  }
  const empty = msg => `<tr><td colspan="4" class="muted">${esc(msg)}</td></tr>`;

  // ---------- sample ----------
  function sample() {
    const GB = 1e9, MB = 1e6, day = 86400000, now = Date.now();
    const iso = d => new Date(now - d * day).toISOString();
    const f = (name, mime, size, ageDays, extra) => Object.assign({ id: name, name, mimeType: mime, size, quotaBytesUsed: size, modifiedTime: iso(ageDays), ownedByMe: true, trashed: false, webViewLink: "https://drive.google.com/" }, extra || {});
    const files = [
      f("Europe trip 2022 raw.mp4", "video/mp4", 2.4 * GB, 900, { md5Checksum: "aa1" }),
      f("Europe trip 2022 raw (1).mp4", "video/mp4", 2.4 * GB, 880, { md5Checksum: "aa1" }),
      f("Wedding highlights 4K.mov", "video/quicktime", 1.8 * GB, 1300),
      f("Old laptop backup.zip", "application/zip", 1.1 * GB, 1500),
      f("Thesis drafts.zip", "application/zip", 640 * MB, 40),
      f("Podcast episode 12 master.wav", "audio/wav", 420 * MB, 300),
      f("Podcast episode 12 master.wav", "audio/wav", 420 * MB, 299, { md5Checksum: "bb2" }),
      f("Podcast episode 12 master copy.wav", "audio/wav", 420 * MB, 250, { md5Checksum: "bb2" }),
      f("Lecture recordings week 3.mp4", "video/mp4", 380 * MB, 700),
      f("Scanned tax documents 2021.pdf", "application/pdf", 96 * MB, 1000),
      f("Family photos export.zip", "application/zip", 88 * MB, 1100),
      f("IMG_4021.HEIC", "image/heic", 6 * MB, 100), f("IMG_4022.HEIC", "image/heic", 6 * MB, 100),
      f("Budget 2026", "application/vnd.google-apps.spreadsheet", 1.2 * MB, 3),
      f("Meeting notes", "application/vnd.google-apps.document", 200e3, 1),
      f("Design mockups.fig", "application/octet-stream", 210 * MB, 400),
      f("Deleted screen recording.mp4", "video/mp4", 1.3 * GB, 60, { trashed: true }),
      f("Deleted duplicates.zip", "application/zip", 700 * MB, 30, { trashed: true }),
      f("Shared team drive doc", "application/vnd.google-apps.document", 0, 5, { ownedByMe: false })
    ];
    const drive = files.filter(x => x.ownedByMe && !x.trashed).reduce((s, x) => s + x.size, 0);
    const trash = files.filter(x => x.trashed).reduce((s, x) => s + x.size, 0);
    const other = 1.9 * GB; // Gmail + Photos, as Google reports it: one number
    const about = { user: { emailAddress: "" }, storageQuota: { limit: 15 * GB, usage: drive + trash + other, usageInDrive: drive, usageInDriveTrash: trash } };
    isSample = true; data = analyse(about, files); render();
  }

  // ---------- wire ----------
  $("#btn-signin").addEventListener("click", signIn);
  $("#btn-sample").addEventListener("click", sample);
  $("#btn-signout").addEventListener("click", signOut);
  $("#tabs").addEventListener("click", e => { const t = e.target.closest(".tab"); if (!t) return; view = t.dataset.view; renderView(); });
  if (!CLIENT_ID) $("#btn-signin").title = "Not configured on this deployment yet";
})();
