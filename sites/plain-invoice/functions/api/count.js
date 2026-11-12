// POST /api/count with the event name as the body. Adds one to today's total for that event.
// Takes nothing else: no ids, no cookies, and the request's IP address is not read or stored.
import { EVENTS, bump } from './_shared.js';
export async function onRequestPost({ request, env }) {
  const event = (await request.text()).trim().slice(0, 40);
  if (!EVENTS.has(event)) return new Response(null, { status: 400 });
  await bump(env.DB, event);
  return new Response(null, { status: 204 });
}
