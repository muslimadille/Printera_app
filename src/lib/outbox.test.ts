import { describe, expect, it } from 'vitest';
import { coalesceOps, type OutboxOp } from '@/lib/outbox';

function op(partial: Partial<OutboxOp> & Pick<OutboxOp, 'type' | 'entityKey'>): OutboxOp {
  return {
    id: partial.id || `id_${partial.type}_${partial.entityKey}`,
    type: partial.type,
    payload: partial.payload || {},
    userId: partial.userId || 'u1',
    createdAt: partial.createdAt || '2026-01-01T00:00:00.000Z',
    entityKey: partial.entityKey,
    clientQuoteId: partial.clientQuoteId,
  };
}

describe('outbox coalesceOps', () => {
  it('merges create + update into a single saveQuote', () => {
    const create = op({
      type: 'saveQuote',
      entityKey: 'local_1',
      clientQuoteId: 'local_1',
      payload: { params: { title: 'A', quote_data: { x: 1 } }, clientQuoteId: 'local_1' },
    });
    const update = op({
      type: 'updateQuote',
      entityKey: 'local_1',
      payload: { quoteId: 'local_1', params: { title: 'B' } },
    });
    const next = coalesceOps([create], update);
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe('saveQuote');
    expect((next[0].payload.params as { title: string }).title).toBe('B');
  });

  it('cancels create + delete of the same local quote', () => {
    const create = op({
      type: 'saveQuote',
      entityKey: 'local_2',
      clientQuoteId: 'local_2',
      payload: { params: { title: 'A' }, clientQuoteId: 'local_2' },
    });
    const del = op({
      type: 'deleteQuote',
      entityKey: 'local_2',
      payload: { quoteId: 'local_2' },
    });
    expect(coalesceOps([create], del)).toHaveLength(0);
  });

  it('keeps latest settings merge for the same user', () => {
    const a = op({
      type: 'saveUserSettings',
      entityKey: 'settings',
      payload: { settings: [{ key: 'paperTypes', value: [1] }] },
    });
    const b = op({
      type: 'saveUserSettings',
      entityKey: 'settings',
      payload: { settings: [{ key: 'priceSettings', value: { a: 1 } }] },
    });
    const next = coalesceOps([a], b);
    expect(next).toHaveLength(1);
    const settings = next[0].payload.settings as { key: string; value: unknown }[];
    expect(settings).toEqual([
      { key: 'paperTypes', value: [1] },
      { key: 'priceSettings', value: { a: 1 } },
    ]);
  });
});
