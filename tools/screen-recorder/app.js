/* Screen Recorder — runs in the browser. Nothing is uploaded; the recording is
   written to a file on the user's computer as it happens (File System Access
   API, Chromium) or kept in memory until download (other browsers). */
(function () {
  "use strict";
  const $ = s => document.querySelector(s);
  const has = {
    display: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
    recorder: typeof MediaRecorder !== "undefined",
    fsa: typeof window.showSaveFilePicker === "function"
  };

  // ---------- capability gate ----------
  if (!has.display || !has.recorder) {
    const u = $("#unsupported"); u.hidden = false;
    u.innerHTML = "<strong>This browser cannot record the screen.</strong> Screen recording from a web page needs a desktop browser: Chrome, Edge, Firefox or Safari on a computer. Phones and tablets do not allow it.";
    $("#setup").hidden = true; return;
  }
  const FORMATS = [
    { label: "MP4 (H.264 + AAC) — plays everywhere", mime: 'video/mp4;codecs="avc1.42E01E,mp4a.40.2"', ext: "mp4", kind: "mp4" },
    { label: "WebM (VP9)", mime: "video/webm;codecs=vp9,opus", ext: "webm", kind: "webm" },
    { label: "MP4 (H.264 + Opus) — not for iPhone or QuickTime", mime: 'video/mp4;codecs="avc1.42E01E,opus"', ext: "mp4", kind: "mp4" },
    { label: "WebM (VP8)", mime: "video/webm;codecs=vp8,opus", ext: "webm", kind: "webm" },
    { label: "WebM", mime: "video/webm", ext: "webm", kind: "webm" },
    { label: "MP4", mime: "video/mp4", ext: "mp4", kind: "mp4" }
  ].filter(f => { try { return MediaRecorder.isTypeSupported(f.mime); } catch (e) { return false; } });
  if (!FORMATS.length) {
    const u = $("#unsupported"); u.hidden = false;
    u.textContent = "This browser supports screen capture but cannot encode video from it. Try Chrome, Edge or Firefox."; $("#setup").hidden = true; return;
  }
  const selFormat = $("#sel-format");
  FORMATS.forEach((f, i) => selFormat.append(new Option(f.label, String(i))));
  if (!has.fsa) {
    $("#opt-stream").checked = false; $("#opt-stream").disabled = true;
    $("#stream-hint").textContent = "(Chrome and Edge only; here the recording is kept in this tab until you download it, so very long recordings depend on free memory)";
  }

  // ---------- devices ----------
  async function listDevices() {
    try {
      const devs = await navigator.mediaDevices.enumerateDevices();
      fill($("#sel-mic"), devs.filter(d => d.kind === "audioinput"), "Default microphone");
      fill($("#sel-cam"), devs.filter(d => d.kind === "videoinput"), "Default camera");
    } catch (e) { /* enumeration blocked; defaults still work */ }
  }
  function fill(sel, devs, dflt) {
    const cur = sel.value; sel.replaceChildren(new Option(dflt, ""));
    devs.forEach((d, i) => sel.append(new Option(d.label || `${dflt.split(" ")[1]} ${i + 1}`, d.deviceId)));
    if ([...sel.options].some(o => o.value === cur)) sel.value = cur;
  }
  listDevices();
  if (navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener("devicechange", listDevices);

  // ---------- state ----------
  let display = null, mic = null, cam = null, out = null, rec = null, audioCtx = null;
  let chunks = [], bytes = 0, firstChunk = null, fixedFirstLen = 0;
  let handle = null, writable = null, writeQueue = Promise.resolve();
  let startedAt = 0, pausedAt = 0, pausedTotal = 0, timer = null, tickWorker = null, drawing = false;
  let resultUrl = null, format = FORMATS[0];

  const pad = n => String(n).padStart(2, "0");
  const fmtTime = ms => { const s = Math.floor(ms / 1000); return (s >= 3600 ? pad(Math.floor(s / 3600)) + ":" : "") + pad(Math.floor(s / 60) % 60) + ":" + pad(s % 60); };
  const fmtBytes = n => n < 1e6 ? (n / 1e3).toFixed(0) + " KB" : n < 1e9 ? (n / 1e6).toFixed(1) + " MB" : (n / 1e9).toFixed(2) + " GB";
  const elapsed = () => (pausedAt ? pausedAt : Date.now()) - startedAt - pausedTotal;
  const stamp = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}`; };
  const stopTracks = s => { if (s) s.getTracks().forEach(t => { try { t.stop(); } catch (e) {} }); };

  // ---------- stage A: choose sources ----------
  $("#btn-start").addEventListener("click", async () => {
    const wantSys = $("#opt-sys").checked, wantMic = $("#opt-mic").checked, wantCam = $("#opt-cam").checked;
    try {
      display = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 30, cursor: "always" }, audio: wantSys });
    } catch (e) { return; } // user cancelled the picker
    const notes = [];
    if (wantSys && !display.getAudioTracks().length) notes.push("The browser did not share audio for that source (tab audio needs a Chrome tab; system audio is Windows only).");
    if (wantMic) {
      try { mic = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: $("#sel-mic").value ? { exact: $("#sel-mic").value } : undefined, echoCancellation: true, noiseSuppression: true } }); }
      catch (e) { notes.push("Microphone was not available or was refused, so it is not being recorded."); }
    }
    if (wantCam) {
      try { cam = await navigator.mediaDevices.getUserMedia({ video: { deviceId: $("#sel-cam").value ? { exact: $("#sel-cam").value } : undefined, width: { ideal: 640 }, height: { ideal: 480 } } }); }
      catch (e) { notes.push("Camera was not available or was refused, so there is no bubble."); }
    }
    listDevices();
    // arm stage B
    $("#setup").hidden = true; $("#live").hidden = false;
    $("#live-preview").srcObject = display; $("#live-preview").play().catch(() => {});
    $("#rec-time").textContent = "00:00"; $("#rec-size").textContent = ""; $("#rec-mode").textContent = notes.join(" ");
    $("#rec-dot").classList.add("paused");
    $("#btn-pause").hidden = true;
    const go = $("#btn-stop"); go.textContent = "● Start recording"; go.dataset.role = "go";
    display.getVideoTracks()[0].addEventListener("ended", () => { if (rec && rec.state !== "inactive") stop(); else cancelSetup(); });
  });
  function cancelSetup() { stopTracks(display); stopTracks(mic); stopTracks(cam); display = mic = cam = null; $("#live").hidden = true; $("#setup").hidden = false; }

  // ---------- stage B: start ----------
  $("#btn-stop").addEventListener("click", async e => {
    if (e.currentTarget.dataset.role === "go") await start(); else stop();
  });
  async function start() {
    format = FORMATS[Number(selFormat.value)] || FORMATS[0];
    const stream = $("#opt-stream").checked && has.fsa;
    const name = `Screen recording ${stamp()}.${format.ext}`;
    if (stream) {
      try {
        handle = await window.showSaveFilePicker({ suggestedName: name, types: [{ description: format.kind === "mp4" ? "MP4 video" : "WebM video", accept: { [format.kind === "mp4" ? "video/mp4" : "video/webm"]: ["." + format.ext] } }] });
        writable = await handle.createWritable();
      } catch (err) { if (err && err.name === "AbortError") return; handle = null; writable = null; $("#rec-mode").textContent = "Could not open a file to save into; recording in memory instead."; }
    }
    if ($("#opt-countdown").checked) await countdown(3);
    // output stream
    const q = $("#sel-quality").value;
    let videoTrack = display.getVideoTracks()[0];
    if (cam && cam.getVideoTracks().length) videoTrack = startComposite(videoTrack, q).getVideoTracks()[0];
    else if (q !== "native") { try { await videoTrack.applyConstraints({ height: { max: Number(q) } }); } catch (err) {} }
    const audioTracks = [...display.getAudioTracks(), ...(mic ? mic.getAudioTracks() : [])];
    out = new MediaStream([videoTrack, ...mixAudio(audioTracks)]);
    chunks = []; bytes = 0; firstChunk = null; fixedFirstLen = 0; writeQueue = Promise.resolve();
    const vbps = q === "720" ? 2.5e6 : 5e6;
    try { rec = new MediaRecorder(out, { mimeType: format.mime, videoBitsPerSecond: vbps, audioBitsPerSecond: 128e3 }); }
    catch (err) { rec = new MediaRecorder(out); }
    rec.addEventListener("dataavailable", onData);
    rec.addEventListener("stop", finalize);
    rec.addEventListener("error", ev => { $("#rec-mode").textContent = "Recording error: " + (ev.error && ev.error.name || "unknown") + ". Saving what was captured."; stop(); });
    rec.start(1000);
    startedAt = Date.now(); pausedAt = 0; pausedTotal = 0;
    timer = setInterval(tick, 250); tick();
    $("#rec-dot").classList.remove("paused"); $("#btn-pause").hidden = false; $("#btn-pause").textContent = "Pause";
    const b = $("#btn-stop"); b.textContent = "■ Stop and save"; b.dataset.role = "stop";
    $("#rec-mode").textContent = (writable ? `Saving to ${handle.name} as you record.` : "Recording in memory; you will download at the end.") + (cam ? " Keep this tab open so the camera bubble keeps drawing." : "");
    window.addEventListener("beforeunload", warnUnload);
  }
  function warnUnload(e) { if (rec && rec.state !== "inactive") { e.preventDefault(); e.returnValue = ""; } }
  function countdown(n) {
    return new Promise(res => {
      const box = $("#countdown"), num = $("#countdown-n"); box.hidden = false;
      const step = k => { if (k === 0) { box.hidden = true; res(); return; } num.textContent = k; setTimeout(() => step(k - 1), 1000); };
      step(n);
    });
  }
  function tick() {
    $("#rec-time").textContent = fmtTime(elapsed());
    if (bytes) $("#rec-size").textContent = fmtBytes(bytes);
  }

  // ---------- data path ----------
  function onData(e) {
    if (!e.data || !e.data.size) return;
    bytes += e.data.size;
    if (writable) {
      if (!firstChunk) {
        firstChunk = e.data;
        // WebM from MediaRecorder has no duration in its header. Write a patched
        // first chunk with a placeholder duration now (same length as the final
        // patch), then overwrite it with the real duration when we stop.
        writeQueue = writeQueue.then(async () => {
          let first = firstChunk;
          if (format.kind === "webm" && window.ysFixWebmDuration) {
            try { const f = await ysFixWebmDuration(firstChunk, 1); if (f && f.size) { first = f; fixedFirstLen = f.size; } } catch (err) {}
          }
          await writable.write(first);
        });
      } else {
        writeQueue = writeQueue.then(() => writable.write(e.data));
      }
      writeQueue = writeQueue.catch(err => { $("#rec-mode").textContent = "Could not write to the file (" + (err && err.name) + "). Stopping."; stop(); });
    } else {
      chunks.push(e.data);
    }
  }

  // ---------- pause / stop ----------
  $("#btn-pause").addEventListener("click", () => {
    if (!rec) return;
    if (rec.state === "recording") { rec.pause(); pausedAt = Date.now(); $("#btn-pause").textContent = "Resume"; $("#rec-dot").classList.add("paused"); }
    else if (rec.state === "paused") { rec.resume(); pausedTotal += Date.now() - pausedAt; pausedAt = 0; $("#btn-pause").textContent = "Pause"; $("#rec-dot").classList.remove("paused"); }
  });
  function stop() {
    if (!rec || rec.state === "inactive") { cancelSetup(); return; }
    if (rec.state === "paused") { pausedTotal += Date.now() - pausedAt; pausedAt = 0; }
    clearInterval(timer);
    try { rec.stop(); } catch (e) { finalize(); }
  }
  async function finalize() {
    const durationMs = Math.max(0, elapsed());
    stopDraw(); stopTracks(display); stopTracks(mic); stopTracks(cam); stopTracks(out);
    if (audioCtx) { try { audioCtx.close(); } catch (e) {} audioCtx = null; }
    window.removeEventListener("beforeunload", warnUnload);
    $("#live").hidden = true; $("#result").hidden = false;
    const meta = $("#result-meta"), note = $("#result-note"), dl = $("#btn-download"), vid = $("#result-video");
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    try {
      if (writable) {
        await writeQueue;
        if (fixedFirstLen && format.kind === "webm" && window.ysFixWebmDuration) {
          try { const f = await ysFixWebmDuration(firstChunk, durationMs); if (f && f.size === fixedFirstLen) await writable.write({ type: "write", position: 0, data: f }); } catch (err) {}
        }
        await writable.close();
        const file = await handle.getFile();
        resultUrl = URL.createObjectURL(file); vid.src = resultUrl;
        meta.textContent = `Saved as ${handle.name} · ${fmtBytes(file.size)} · ${fmtTime(durationMs)}`;
        dl.hidden = true;
        note.textContent = "The file is already on your computer. Nothing was uploaded anywhere.";
      } else {
        let blob = new Blob(chunks, { type: format.mime.split(";")[0] });
        if (format.kind === "webm" && window.ysFixWebmDuration) { try { blob = await ysFixWebmDuration(blob, durationMs); } catch (err) {} }
        resultUrl = URL.createObjectURL(blob); vid.src = resultUrl;
        dl.hidden = false; dl.href = resultUrl; dl.download = `Screen recording ${stamp()}.${format.ext}`;
        meta.textContent = `${fmtBytes(blob.size)} · ${fmtTime(durationMs)} · ${format.label}`;
        note.textContent = "Download it now; it lives only in this tab and is gone when you close it.";
      }
    } catch (err) {
      meta.textContent = "Something went wrong while saving: " + (err && err.message || err);
    }
    rec = null; display = mic = cam = out = null; handle = null; writable = null; chunks = []; firstChunk = null;
  }
  $("#btn-again").addEventListener("click", () => {
    if (resultUrl) { URL.revokeObjectURL(resultUrl); resultUrl = null; }
    $("#result-video").removeAttribute("src"); $("#result").hidden = true; $("#setup").hidden = false;
    const b = $("#btn-stop"); b.textContent = "■ Stop and save"; b.dataset.role = "stop";
  });

  // ---------- audio mixing ----------
  function mixAudio(tracks) {
    if (tracks.length <= 1) return tracks;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const dest = audioCtx.createMediaStreamDestination();
      tracks.forEach(t => audioCtx.createMediaStreamSource(new MediaStream([t])).connect(dest));
      audioCtx.resume();
      return dest.stream.getAudioTracks();
    } catch (e) { return [tracks[0]]; }
  }

  // ---------- camera bubble compositing ----------
  function startComposite(screenTrack, q) {
    const canvas = $("#composite"), camEl = $("#cam-el"), screenEl = $("#live-preview");
    camEl.srcObject = cam; camEl.play().catch(() => {});
    const s = screenTrack.getSettings(); let w = s.width || 1280, h = s.height || 720;
    const cap = q === "1080" ? 1080 : q === "720" ? 720 : Infinity;
    if (h > cap) { w = Math.round(w * cap / h); h = cap; }
    if (w % 2) w++; if (h % 2) h++;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { alpha: false });
    const frac = Number($("#sel-bubble").value), corner = $("#sel-corner").value;
    const draw = () => {
      if (!drawing) return;
      if (screenEl.videoWidth) ctx.drawImage(screenEl, 0, 0, w, h);
      if (camEl.videoWidth) {
        const r = Math.round(Math.min(w, h) * frac / 2), padPx = Math.round(r * 0.4);
        const cx = corner.endsWith("l") ? padPx + r : w - padPx - r, cy = corner.startsWith("t") ? padPx + r : h - padPx - r;
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
        const vw = camEl.videoWidth, vh = camEl.videoHeight, sc = Math.max(2 * r / vw, 2 * r / vh), dw = vw * sc, dh = vh * sc;
        ctx.drawImage(camEl, cx - dw / 2, cy - dh / 2, dw, dh); ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.lineWidth = Math.max(3, r * 0.06); ctx.strokeStyle = "#ffffff"; ctx.stroke();
      }
    };
    drawing = true;
    // A worker timer keeps ticking when this tab is in the background, where
    // requestAnimationFrame would stop and freeze the bubble.
    try {
      tickWorker = new Worker(URL.createObjectURL(new Blob(["setInterval(()=>postMessage(0),33)"], { type: "text/javascript" })));
      tickWorker.onmessage = draw;
    } catch (e) { const loop = () => { if (!drawing) return; draw(); requestAnimationFrame(loop); }; loop(); }
    draw();
    return canvas.captureStream(30);
  }
  function stopDraw() { drawing = false; if (tickWorker) { tickWorker.terminate(); tickWorker = null; } }
})();
