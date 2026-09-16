/* HEIC/HEIF decoding off the main thread. libheif (LGPL 3.0) compiled to WebAssembly; see NOTICES.txt. */
importScripts('/assets/image-converter/libheif-bundle.js');
let lib = null, decoder = null;
async function ready() {
  if (lib) return lib;
  let m = typeof libheif === 'function' ? libheif() : libheif; // the bundle exports a factory
  if (m && typeof m.then === 'function') m = await m;
  if (m && m.ready && typeof m.ready.then === 'function') await m.ready;
  lib = m;
  return lib;
}
self.onmessage = async e => {
  const { id, buf } = e.data;
  try {
    const m = await ready();
    if (!decoder) decoder = new m.HeifDecoder();
    const images = decoder.decode(new Uint8Array(buf));
    if (!images || !images.length) throw new Error('No picture found in this HEIC file.');
    let img = images[0];
    for (const i of images) {
      try { if (i.is_primary && i.is_primary()) { img = i; break; } } catch (err) { /* ignore */ }
      if (i.get_width() * i.get_height() > img.get_width() * img.get_height()) img = i;
    }
    const w = img.get_width(), h = img.get_height();
    const data = new Uint8ClampedArray(w * h * 4);
    await new Promise((res, rej) => img.display({ data, width: w, height: h }, out => out ? res() : rej(new Error('The HEIC decoder could not read this picture.'))));
    for (const i of images) { try { if (i.free) i.free(); } catch (err) { /* ignore */ } }
    self.postMessage({ id, w, h, buf: data.buffer }, [data.buffer]);
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
