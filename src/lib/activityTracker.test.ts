import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@/lib/apiClient';
import { clearActivityQueue, flushNow, setActivitySession, trackActivity } from '@/lib/activityTracker';

/**
 * FE-062 — the analytics beacon.
 *
 * This is the one authenticated-in-spirit call that does NOT use an Authorization header:
 * the queue is flushed with `navigator.sendBeacon` on page hide, and sendBeacon cannot set
 * headers. The token therefore travels in the body, and /activity/batch is deliberately
 * outside the session middleware to match (BE-025).
 */

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  clearActivityQueue();
  setActivitySession('jwt-abc');
});

afterEach(() => {
  setActivitySession(null);
  clearActivityQueue();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function sentBody() {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(init.body as string);
}

/** jsdom's Blob implements neither .text() nor undici's Response body handling. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

describe('flushNow', () => {
  it('posts queued events to /activity/batch with the token in the body', async () => {
    trackActivity('calculate', 'itemcost', { n: 1 });
    trackActivity('tab_open', 'diecut5');

    await flushNow();

    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/activity/batch`);
    expect(init.method).toBe('POST');

    const body = sentBody();
    expect(body.session_token).toBe('jwt-abc');
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({ action: 'calculate', tab_key: 'itemcost', details: { n: 1 } });
    expect(body.events[0].occurred_at).toBeTruthy();
  });

  it('drops the retired action envelope and the apikey header', async () => {
    trackActivity('calculate', 'itemcost');

    await flushNow();

    const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
    expect(sentBody()).not.toHaveProperty('action');
    expect(Object.keys((init.headers ?? {}) as Record<string, string>).map((h) => h.toLowerCase()))
      .not.toContain('apikey');
  });

  it('sends nothing when the queue is empty', async () => {
    await flushNow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends nothing when there is no session', async () => {
    setActivitySession(null);
    trackActivity('calculate', 'itemcost');

    await flushNow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-queues the batch when the request fails, so events are not lost', async () => {
    fetchMock.mockRejectedValue(new Error('offline'));
    trackActivity('calculate', 'itemcost');

    await flushNow();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    await flushNow();

    expect(sentBody().events).toHaveLength(1);
  });

  it('prefers sendBeacon on page hide and skips fetch when it succeeds', async () => {
    const beacon = vi.fn().mockReturnValue(true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });
    trackActivity('calculate', 'itemcost');

    await flushNow(true);

    expect(beacon).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();

    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe(`${API_BASE_URL}/activity/batch`);
    // A Blob keeps the JSON content type through unload.
    expect((blob as Blob).type).toBe('application/json');
    // The token rides in the body — the reason /activity/batch is not header-authenticated.
    expect(JSON.parse(await readBlob(blob as Blob))).toMatchObject({ session_token: 'jwt-abc' });
  });

  it('falls back to fetch when sendBeacon refuses the payload', async () => {
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn().mockReturnValue(false) });
    trackActivity('calculate', 'itemcost');

    await flushNow(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0][1] as RequestInit).keepalive).toBe(true);
  });
});

describe('trackActivity', () => {
  it('ignores events while logged out', async () => {
    setActivitySession(null);
    trackActivity('calculate', 'itemcost');
    setActivitySession('jwt-abc');

    await flushNow();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caps the queue at 200 events, dropping the oldest', async () => {
    for (let i = 0; i < 250; i++) trackActivity('calculate', `tab-${i}`);

    await flushNow();

    const events = sentBody().events;
    expect(events).toHaveLength(200);
    expect(events[events.length - 1].tab_key).toBe('tab-249');
  });
});
