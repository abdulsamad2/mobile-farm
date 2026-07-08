export interface SlotState {
  id: number;
  status: 'idle' | 'minting' | 'healthy' | 'failed';
  cookieCount: number;
  expiresAt: number | null;
  lastMint: number | null;
  error: string | null;
  currentUrl: string;
}

// Upload jar to portal
export async function uploadJar(
  portalUrl: string,
  apiKey: string,
  id: string,
  cookies: any[],
  ttlMs: number,
  meta: Record<string, any> = {},
): Promise<void> {
  const url = `${portalUrl.replace(/\/+$/, '')}/api/seed-jars`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ id, cookies, ttlMs, ...meta }),
  });
  if (!resp.ok) throw new Error(`Upload failed: ${resp.status}`);
}

// Pick event from portal — returns full URL when the DB row has one
export async function pickEvent(portalUrl: string, apiKey: string): Promise<string> {
  const base = portalUrl.replace(/\/+$/, '');
  const headers = { Authorization: `Bearer ${apiKey}` };

  // 1) preferred event from /api/seed-event
  let eventId: string | null = null;
  try {
    const r = await fetch(`${base}/api/seed-event`, { headers });
    if (r.ok) {
      const d = await r.json();
      eventId = d.eventId || null;
    }
  } catch {}

  // 2) look up full URL from /api/events
  try {
    const r = await fetch(`${base}/api/events`, { headers });
    if (r.ok) {
      const d = await r.json();
      const rows: any[] = Array.isArray(d) ? d : d.events || [];
      for (const row of rows) {
        if (!row) continue;
        const id = row.eventId || row.Event_ID || row.EventId || row.event_id;
        const url = (row.URL || row.url || '').trim();
        if (eventId && id === eventId && url) return url;
        if (!eventId && url) return url; // first available
      }
    }
  } catch {}

  if (eventId) return `https://www.ticketmaster.com/event/${eventId}`;
  throw new Error('No event available');
}
