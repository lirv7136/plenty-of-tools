// POST /api/waitlist {email, feature, remove?, website}. Adds or removes one email address on the
// list of people to tell when Pro opens. "website" is a field people never see; bots fill it in.
import { FEATURES, json } from './_shared.js';
const EMAIL = /^[^\s@,;<>"]{1,64}@[^\s@,;<>"]{1,190}\.[^\s@,;<>"]{2,}$/;
export async function onRequestPost({ request, env }) {
  if (Number(request.headers.get('content-length') || 0) > 2000) return json({ ok: false, error: 'Too long.' }, 413);
  let body; try { body = await request.json(); } catch { return json({ ok: false, error: 'Send JSON.' }, 400); }
  if (body.website) return json({ ok: true });                        // quietly ignore bots
  const email = String(body.email || '').trim().toLowerCase().slice(0, 254);
  if (!EMAIL.test(email)) return json({ ok: false, error: 'That email address does not look right.' }, 400);
  if (body.remove) {
    await env.DB.prepare('DELETE FROM waitlist WHERE email = ?').bind(email).run();
    return json({ ok: true, removed: true });
  }
  const feature = FEATURES.has(body.feature) ? body.feature : 'any';
  await env.DB.prepare('INSERT INTO waitlist (email, feature, created) VALUES (?, ?, ?) ON CONFLICT (email) DO NOTHING')
    .bind(email, feature, new Date().toISOString().slice(0, 10)).run();
  return json({ ok: true });
}
