import Oystehr from '@oystehr/sdk';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';
import {
  createContinuationRefreshTask,
  findActiveRefreshTask,
  kickOffRefreshTask,
  MAX_REFRESH_CHAIN,
  REFRESH_TASK_IDENTIFIER_SYSTEM,
  refreshTaskChain,
} from '../../../src/billing/reports/framework/refresh-task';

const CACHE_KEY = 'payments:v1:all';
const freshISO = DateTime.now().minus({ minutes: 1 }).toUTC().toISO() ?? '';
const staleISO = DateTime.now().minus({ minutes: 60 }).toUTC().toISO() ?? '';

const refreshTask = (id: string, lastUpdated: string): Task => ({
  resourceType: 'Task',
  id,
  status: 'requested',
  intent: 'order',
  identifier: [{ system: REFRESH_TASK_IDENTIFIER_SYSTEM, value: CACHE_KEY }],
  meta: { lastUpdated },
});

interface FhirMocks {
  search?: ReturnType<typeof vi.fn>;
  create?: ReturnType<typeof vi.fn>;
  patch?: ReturnType<typeof vi.fn>;
  get?: ReturnType<typeof vi.fn>;
}

const clientWith = (fhir: FhirMocks): Oystehr => ({ fhir }) as unknown as Oystehr;

const searchResult = (tasks: Task[]): { unbundle: () => Task[] } => ({ unbundle: () => tasks });

describe('findActiveRefreshTask', () => {
  it('returns undefined when no active tasks exist', async () => {
    const oystehr = clientWith({ search: vi.fn().mockResolvedValue(searchResult([])) });
    expect(await findActiveRefreshTask(oystehr, CACHE_KEY)).toBeUndefined();
  });

  it('returns a fresh task', async () => {
    const fresh = refreshTask('fresh', freshISO);
    const oystehr = clientWith({ search: vi.fn().mockResolvedValue(searchResult([fresh])) });
    expect(await findActiveRefreshTask(oystehr, CACHE_KEY)).toBe(fresh);
  });

  it('ignores tasks past the stale threshold', async () => {
    const oystehr = clientWith({ search: vi.fn().mockResolvedValue(searchResult([refreshTask('stale', staleISO)])) });
    expect(await findActiveRefreshTask(oystehr, CACHE_KEY)).toBeUndefined();
  });

  it('classifies offset-formatted timestamps by instant, not string order', async () => {
    const freshWithOffset = refreshTask('fresh-offset', DateTime.now().minus({ minutes: 1 }).toISO() ?? '');
    const staleWithOffset = refreshTask('stale-offset', DateTime.now().minus({ minutes: 60 }).toISO() ?? '');
    const oystehr = clientWith({
      search: vi.fn().mockResolvedValue(searchResult([staleWithOffset, freshWithOffset])),
    });
    expect(await findActiveRefreshTask(oystehr, CACHE_KEY)).toBe(freshWithOffset);
  });
});

describe('createContinuationRefreshTask', () => {
  const input = { kind: 'cards-on-file' as const, params: {}, cacheKey: CACHE_KEY };

  it('creates the next task unconditionally with an incremented chain input', async () => {
    const create = vi.fn().mockImplementation(async (task: Task) => task);
    const oystehr = clientWith({ create });

    const next = await createContinuationRefreshTask(oystehr, input, 2);
    expect(create).toHaveBeenCalledTimes(1);
    // no ifNoneExist: the running worker's own in-progress task would swallow the continuation
    expect(create.mock.calls[0]).toHaveLength(1);
    expect(next && refreshTaskChain(next)).toBe(3);
  });

  it('stops at the chain bound', async () => {
    const create = vi.fn();
    const oystehr = clientWith({ create });

    expect(await createContinuationRefreshTask(oystehr, input, MAX_REFRESH_CHAIN)).toBeUndefined();
    expect(create).not.toHaveBeenCalled();
  });
});

describe('refreshTaskChain', () => {
  it('defaults to 0 when the input is absent', () => {
    expect(refreshTaskChain(refreshTask('t', freshISO))).toBe(0);
  });
});

describe('kickOffRefreshTask', () => {
  const kickoffInput = { kind: 'payments' as const, params: {}, cacheKey: CACHE_KEY };

  it('returns the existing fresh task without creating a new one', async () => {
    const fresh = refreshTask('fresh', freshISO);
    const create = vi.fn();
    const oystehr = clientWith({ search: vi.fn().mockResolvedValue(searchResult([fresh])), create });

    expect(await kickOffRefreshTask(oystehr, kickoffInput)).toBe(fresh);
    expect(create).not.toHaveBeenCalled();
  });

  it('cancels stale tasks, then creates a new one', async () => {
    const created = refreshTask('created', freshISO);
    const patch = vi.fn().mockResolvedValue(undefined);
    const create = vi.fn().mockResolvedValue(created);
    const oystehr = clientWith({
      search: vi
        .fn()
        .mockResolvedValue(searchResult([refreshTask('stale-1', staleISO), refreshTask('stale-2', staleISO)])),
      create,
      patch,
    });

    expect(await kickOffRefreshTask(oystehr, kickoffInput)).toBe(created);
    expect(patch).toHaveBeenCalledTimes(2);
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Task',
        id: 'stale-1',
        operations: expect.arrayContaining([{ op: 'replace', path: '/status', value: 'cancelled' }]),
      })
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('throws when a stale task cannot be cancelled and is still active', async () => {
    const stale = refreshTask('stale', staleISO);
    const create = vi.fn();
    const oystehr = clientWith({
      search: vi.fn().mockResolvedValue(searchResult([stale])),
      create,
      patch: vi.fn().mockRejectedValue(new Error('gone')),
      get: vi.fn().mockResolvedValue(stale),
    });

    await expect(kickOffRefreshTask(oystehr, kickoffInput)).rejects.toThrow(/could not cancel stale refresh/i);
    expect(create).not.toHaveBeenCalled();
  });

  it('still creates when the failed cancel turns out to be already resolved', async () => {
    const created = refreshTask('created', freshISO);
    const oystehr = clientWith({
      search: vi.fn().mockResolvedValue(searchResult([refreshTask('stale', staleISO)])),
      create: vi.fn().mockResolvedValue(created),
      patch: vi.fn().mockRejectedValue(new Error('conflict')),
      get: vi.fn().mockResolvedValue({ ...refreshTask('stale', staleISO), status: 'cancelled' }),
    });

    expect(await kickOffRefreshTask(oystehr, kickoffInput)).toBe(created);
  });

  it('creates with a conditional-create criterion on the cache key identifier', async () => {
    const create = vi.fn().mockResolvedValue(refreshTask('created', freshISO));
    const oystehr = clientWith({ search: vi.fn().mockResolvedValue(searchResult([])), create });

    await kickOffRefreshTask(oystehr, kickoffInput);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ resourceType: 'Task', status: 'requested' }),
      expect.objectContaining({
        ifNoneExist: expect.arrayContaining([
          { name: 'identifier', value: `${REFRESH_TASK_IDENTIFIER_SYSTEM}|${CACHE_KEY}` },
        ]),
      })
    );
  });

  it('falls back to the concurrent task when the conditional create races (e.g. 412)', async () => {
    const concurrent = refreshTask('concurrent', freshISO);
    const search = vi
      .fn()
      .mockResolvedValueOnce(searchResult([])) // kickoff dedupe lookup
      .mockResolvedValueOnce(searchResult([concurrent])); // fallback findActiveRefreshTask
    const oystehr = clientWith({ search, create: vi.fn().mockRejectedValue(new Error('412 Precondition Failed')) });

    expect(await kickOffRefreshTask(oystehr, kickoffInput)).toBe(concurrent);
  });

  it('rethrows the create error when no concurrent task exists', async () => {
    const search = vi.fn().mockResolvedValue(searchResult([]));
    const oystehr = clientWith({ search, create: vi.fn().mockRejectedValue(new Error('boom')) });

    await expect(kickOffRefreshTask(oystehr, kickoffInput)).rejects.toThrow('boom');
  });
});
