// Shared by the two endpoints. The date is Sydney's, so a day matches an Australian working day.
export const EVENTS = new Set(['pdf', 'print', 'email', 'pro_sync', 'pro_send', 'pro_recurring', 'pro_reminders', 'pro_page', 'bulk']);
export const FEATURES = new Set(['sync', 'send', 'recurring', 'reminders', 'any']);
export const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Australia/Sydney' }).format(new Date());
export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
export async function bump(db, event) {
  await db.prepare('INSERT INTO counts (day, event, n) VALUES (?, ?, 1) ON CONFLICT (day, event) DO UPDATE SET n = n + 1').bind(today(), event).run();
}
