import Oystehr from '@oystehr/sdk';
import { Basic, Claim, List } from 'fhir/r4b';
import { WorkQueue } from 'utils/lib/types/data/billing/work-queue.schemas';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DeleteBillingWorkQueueParams,
  performEffect as deleteWorkQueue,
} from '../../../src/billing/delete-billing-work-queue';
import { summarizeWorkQueue } from '../../../src/billing/get-billing-work-queues';
import {
  complexValidation,
  performEffect as saveWorkQueue,
  SaveBillingWorkQueueParams,
} from '../../../src/billing/save-billing-work-queue';
import {
  listToWorkQueues,
  withoutWorkQueue,
  withWorkQueue,
  WORK_QUEUE_TAG_SYSTEM,
  WORK_QUEUES_LIST_CODE,
  workQueueToContainedBasic,
} from '../../../src/billing/work-queues/serialization';

const queue = (id: string, overrides: Partial<WorkQueue> = {}): WorkQueue => ({
  id,
  name: `Queue ${id}`,
  description: 'Claims to work',
  owner: { practitionerId: 'prac-1', name: 'Sarah Chen' },
  filters: { arStage: ['insurance-payer'], payers: [{ id: 'p-1', name: 'Medicaid', payerId: 'MC' }] },
  layout: { columnOrder: ['billed', 'patientName'], sort: { field: 'billed', direction: 'desc' } },
  ...overrides,
});

const bundle = <T>(resources: T[], total = resources.length): unknown => ({
  resourceType: 'Bundle',
  type: 'searchset',
  total,
  entry: resources.map((resource) => ({ resource })),
  unbundle: () => resources,
});

describe('work queue serialization', () => {
  it('round-trips a queue through its List', () => {
    const list = withWorkQueue(undefined, queue('q-1'));

    expect(list.meta?.tag).toEqual([{ system: WORK_QUEUE_TAG_SYSTEM, code: WORK_QUEUES_LIST_CODE }]);
    expect(list.entry?.map((e) => e.item.reference)).toEqual(['#q-1']);
    const basic = list.contained?.[0] as Basic;
    expect(basic.author).toEqual({ reference: 'Practitioner/prac-1', display: 'Sarah Chen' });
    expect(listToWorkQueues(list)).toEqual([queue('q-1')]);
  });

  it('replaces an existing queue in place and appends a new one, leaving the rest alone', () => {
    const list = withWorkQueue(withWorkQueue(undefined, queue('q-1')), queue('q-2'));

    const updated = withWorkQueue(list, queue('q-1', { name: 'Renamed', owner: undefined }));
    const added = withWorkQueue(updated, queue('q-3'));

    expect(listToWorkQueues(added).map((q) => [q.id, q.name, q.owner?.name])).toEqual([
      ['q-1', 'Renamed', undefined],
      ['q-2', 'Queue q-2', 'Sarah Chen'],
      ['q-3', 'Queue q-3', 'Sarah Chen'],
    ]);
  });

  it('skips a queue it cannot read, but keeps it in the List when another queue is saved', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = workQueueToContainedBasic(queue('broken'));
    broken.extension = broken.extension?.map((e) => (e.url.endsWith('filters') ? { ...e, valueString: '{' } : e));
    const list: List = {
      ...withWorkQueue(undefined, queue('q-1')),
      contained: [workQueueToContainedBasic(queue('q-1')), broken],
      entry: [{ item: { reference: '#q-1' } }, { item: { reference: '#broken' } }],
    };

    expect(listToWorkQueues(list).map((q) => q.id)).toEqual(['q-1']);
    const saved = withWorkQueue(list, queue('q-2'));
    expect(saved.contained?.map((r) => r.id)).toEqual(['q-1', 'broken', 'q-2']);
  });
});

const versionConflict = (): Error =>
  new Oystehr.OystehrFHIRError({ code: 412, error: { resourceType: 'OperationOutcome', issue: [] } });

describe('save-billing-work-queue', () => {
  const search = vi.fn();
  const create = vi.fn();
  const update = vi.fn();
  const batch = vi.fn();
  const oystehr = { fhir: { search, create, update, batch } } as unknown as Oystehr;

  const params = (overrides: Partial<SaveBillingWorkQueueParams> = {}): SaveBillingWorkQueueParams =>
    ({
      name: 'Medicaid Claims',
      filters: { arStage: ['insurance-payer'] },
      layout: {},
      secrets: null,
      ...overrides,
    }) as SaveBillingWorkQueueParams;

  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation(async (list: List) => ({
      ...list,
      id: 'list-1',
      meta: { ...list.meta, versionId: '1' },
    }));
    update.mockImplementation(async (list: List) => ({ ...list, meta: { ...list.meta, versionId: '2' } }));
  });

  it('creates the List with the first queue, giving the queue an id', async () => {
    search.mockResolvedValue(bundle([]));

    const { queue: saved } = await saveWorkQueue(oystehr, params());

    expect(update).not.toHaveBeenCalled();
    expect(saved.id).toBeTruthy();
    expect(saved.name).toBe('Medicaid Claims');
    expect(listToWorkQueues(create.mock.calls[0][0])).toEqual([saved]);
  });

  it('updates an existing queue, locking on the version it read', async () => {
    const existing = { ...withWorkQueue(undefined, queue('q-1')), id: 'list-1', meta: { versionId: '7' } };
    search.mockResolvedValue(bundle([existing]));

    const { queue: saved } = await saveWorkQueue(oystehr, params({ queueId: 'q-1', owner: null }));

    const [written, options] = update.mock.calls[0];
    expect(options).toEqual({ optimisticLockingVersionId: '7' });
    expect(listToWorkQueues(written)).toHaveLength(1);
    expect(saved).toEqual({
      id: 'q-1',
      name: 'Medicaid Claims',
      filters: { arStage: ['insurance-payer'] },
      layout: {},
    });
  });

  it('saves into the List with the smallest id and deletes the duplicates', async () => {
    const list = (id: string): List => ({ ...withWorkQueue(undefined, queue('q-1')), id, meta: { versionId: '1' } });
    search.mockResolvedValue(bundle([list('list-a'), list('list-b'), list('list-c')]));

    await saveWorkQueue(oystehr, params({ queueId: 'q-1' }));

    expect(search.mock.calls[0][0].params).toContainEqual({ name: '_sort', value: '_id' });
    expect(update.mock.calls[0][0].id).toBe('list-a');
    expect(batch).toHaveBeenCalledWith({
      requests: [
        { method: 'DELETE', url: '/List/list-b' },
        { method: 'DELETE', url: '/List/list-c' },
      ],
    });
  });

  it('re-reads the List and tries again when another save got there first', async () => {
    const v1 = { ...withWorkQueue(undefined, queue('q-1')), id: 'list-1', meta: { versionId: '1' } };
    const v2 = { ...withWorkQueue(v1, queue('q-2')), meta: { versionId: '2' } };
    search.mockResolvedValueOnce(bundle([v1])).mockResolvedValueOnce(bundle([v2]));
    update.mockRejectedValueOnce(versionConflict());

    await saveWorkQueue(oystehr, params({ queueId: 'q-1' }));

    expect(update).toHaveBeenCalledTimes(2);
    const [written, options] = update.mock.calls[1];
    expect(options).toEqual({ optimisticLockingVersionId: '2' });
    // The other save's queue survives the retry.
    expect(listToWorkQueues(written).map((q) => q.id)).toEqual(['q-1', 'q-2']);
  });

  it('gives up after repeated conflicts', async () => {
    const existing = { ...withWorkQueue(undefined, queue('q-1')), id: 'list-1', meta: { versionId: '1' } };
    search.mockResolvedValue(bundle([existing]));
    update.mockRejectedValue(versionConflict());

    await expect(saveWorkQueue(oystehr, params({ queueId: 'q-1' }))).rejects.toMatchObject({
      code: APIErrorCode.PRECONDITION_FAILED,
    });
    expect(update).toHaveBeenCalledTimes(3);
  });

  it('refuses to update a queue that does not exist', async () => {
    search.mockResolvedValue(bundle([]));

    await expect(saveWorkQueue(oystehr, params({ queueId: 'missing' }))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(create).not.toHaveBeenCalled();
  });

  it('only lets a Billing Admin own a queue', async () => {
    const projectClient = {
      role: { list: vi.fn().mockResolvedValue([{ id: 'role-ba', name: 'BillingAdmin' }]) },
      user: {
        listV2: vi.fn().mockResolvedValue({
          data: [{ id: 'user-1', name: 'sarah@example.com', profile: 'Practitioner/prac-1' }],
          metadata: { nextCursor: null },
        }),
      },
    } as unknown as Oystehr;
    const fhirClient = {
      fhir: { search: vi.fn().mockResolvedValue(bundle([{ resourceType: 'Practitioner', id: 'prac-1' }])) },
    } as unknown as Oystehr;

    await expect(
      complexValidation(projectClient, fhirClient, params({ owner: { practitionerId: 'prac-1', name: 'Sarah' } }))
    ).resolves.toBeUndefined();
    await expect(
      complexValidation(projectClient, fhirClient, params({ owner: { practitionerId: 'prac-9', name: 'Someone' } }))
    ).rejects.toMatchObject({ code: APIErrorCode.INVALID_INPUT });
  });
});

describe('delete-billing-work-queue', () => {
  const search = vi.fn();
  const update = vi.fn();
  const oystehr = { fhir: { search, update } } as unknown as Oystehr;
  const params = (queueId: string): DeleteBillingWorkQueueParams => ({ queueId }) as DeleteBillingWorkQueueParams;
  const stored = (versionId: string, ...ids: string[]): List => {
    const list = ids.reduce<List | undefined>((acc, id) => withWorkQueue(acc, queue(id)), undefined);
    return { ...list, resourceType: 'List', status: 'current', mode: 'working', id: 'list-1', meta: { versionId } };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    update.mockImplementation(async (list: List) => list);
  });

  it('removes only the queue, locking on the version it read', async () => {
    search.mockResolvedValue(bundle([stored('4', 'q-1', 'q-2')]));

    await expect(deleteWorkQueue(oystehr, params('q-1'))).resolves.toEqual({ deleted: true });

    const [written, options] = update.mock.calls[0];
    expect(options).toEqual({ optimisticLockingVersionId: '4' });
    expect(written.contained.map((r: Basic) => r.id)).toEqual(['q-2']);
    expect(listToWorkQueues(written).map((q) => q.id)).toEqual(['q-2']);
  });

  it('re-reads the List and tries again when another save got there first', async () => {
    search
      .mockResolvedValueOnce(bundle([stored('1', 'q-1')]))
      .mockResolvedValueOnce(bundle([stored('2', 'q-1', 'q-2')]));
    update.mockRejectedValueOnce(versionConflict());

    await deleteWorkQueue(oystehr, params('q-1'));

    expect(update).toHaveBeenCalledTimes(2);
    const [written, options] = update.mock.calls[1];
    expect(options).toEqual({ optimisticLockingVersionId: '2' });
    expect(listToWorkQueues(written).map((q) => q.id)).toEqual(['q-2']);
  });

  it('refuses to delete a queue that does not exist', async () => {
    search.mockResolvedValue(bundle([stored('1', 'q-1')]));

    await expect(deleteWorkQueue(oystehr, params('missing'))).rejects.toMatchObject({
      code: APIErrorCode.FHIR_RESOURCE_NOT_FOUND,
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('removes the entry along with the contained Basic', () => {
    const list = withoutWorkQueue(stored('1', 'q-1', 'q-2'), 'q-2');

    expect(list.entry?.map((e) => e.item.reference)).toEqual(['#q-1']);
  });
});

describe('get-billing-work-queues summaries', () => {
  const search = vi.fn();
  const oystehr = { fhir: { search } } as unknown as Oystehr;
  const claim = (id: string, total?: number): Claim =>
    ({ resourceType: 'Claim', id, ...(total === undefined ? {} : { total: { value: total } }) }) as Claim;

  beforeEach(() => vi.clearAllMocks());

  it("counts the queue's claims and sums what they billed", async () => {
    search.mockResolvedValue(bundle([claim('c-1', 100.1), claim('c-2', 200.2), claim('c-3')]));

    const summary = await summarizeWorkQueue(oystehr, queue('q-1', { filters: { arStage: ['insurance-payer'] } }));

    expect(summary).toMatchObject({ claimCount: 3, charged: 300.3, incomplete: false });
    const [{ params }] = search.mock.calls[0];
    expect(params).toEqual(
      expect.arrayContaining([
        { name: '_elements', value: 'id,meta,total' },
        { name: '_sort', value: '_id' },
      ])
    );
  });

  it('flags figures that are lower bounds', async () => {
    search.mockResolvedValue(bundle([claim('c-1', 10)], 50_000));

    const summary = await summarizeWorkQueue(oystehr, queue('q-1', { filters: {} }));

    expect(summary.incomplete).toBe(true);
  });

  it("reports figures it couldn't work out as missing, rather than failing the list", async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    search.mockRejectedValue(new Error('boom'));

    const summary = await summarizeWorkQueue(oystehr, queue('q-1', { filters: {} }));

    expect(summary).toMatchObject({ id: 'q-1', claimCount: null, charged: null });
  });
});
