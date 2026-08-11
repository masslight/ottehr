import { Task as FhirTask } from 'fhir/r4b';
import { TASK_LOCATION_SYSTEM } from 'utils';
import { describe, expect, it, vi } from 'vitest';

const mockSafelyCaptureMessage = vi.fn();
vi.mock('utils/lib/frontend/sentry', () => ({
  safelyCaptureMessage: (...args: unknown[]) => mockSafelyCaptureMessage(...args),
  safelyCaptureException: vi.fn(),
}));

import { mergeLocationFilteredTasks, TaskSearchStream } from '../../src/features/visits/in-person/hooks/useTasks';

const LOCATION_ID = 'location-1';

const taggedTask = (id: string, authoredOn: string, locationId = LOCATION_ID): FhirTask => ({
  resourceType: 'Task',
  id,
  status: 'ready',
  intent: 'order',
  authoredOn,
  meta: { tag: [{ code: 'task' }, { system: TASK_LOCATION_SYSTEM, code: locationId }] },
});

// Inbound faxes are the motivating case: created with no location tag at all.
const locationLessTask = (id: string, authoredOn: string): FhirTask => ({
  resourceType: 'Task',
  id,
  status: 'ready',
  intent: 'order',
  authoredOn,
  meta: { tag: [{ code: 'task' }] },
});

const stream = (tasks: FhirTask[], total?: number): TaskSearchStream => ({ tasks, total });

describe('mergeLocationFilteredTasks', () => {
  it('keeps location-agnostic tasks visible alongside the filtered location', () => {
    const { tasks } = mergeLocationFilteredTasks({
      tagged: stream([taggedTask('tagged-1', '2026-08-01T10:00:00Z')], 1),
      untagged: stream([locationLessTask('fax-1', '2026-08-01T11:00:00Z')], 1),
      pageOffset: 0,
      pageSize: 20,
    });

    expect(tasks.map((t) => t.id)).toEqual(['fax-1', 'tagged-1']);
  });

  it('orders the merged page by authoredOn descending across both streams', () => {
    const { tasks } = mergeLocationFilteredTasks({
      tagged: stream([taggedTask('t-old', '2026-08-01T08:00:00Z'), taggedTask('t-new', '2026-08-01T12:00:00Z')], 2),
      untagged: stream([locationLessTask('f-mid', '2026-08-01T10:00:00Z')], 1),
      pageOffset: 0,
      pageSize: 20,
    });

    expect(tasks.map((t) => t.id)).toEqual(['t-new', 'f-mid', 't-old']);
  });

  it('slices out the requested page from the merged, sorted set', () => {
    const tagged = stream([taggedTask('a', '2026-08-01T14:00:00Z'), taggedTask('c', '2026-08-01T12:00:00Z')], 2);
    const untagged = stream(
      [locationLessTask('b', '2026-08-01T13:00:00Z'), locationLessTask('d', '2026-08-01T11:00:00Z')],
      2
    );

    // Merged order is a, b, c, d — page 1 with pageSize 2 is the second half.
    const { tasks } = mergeLocationFilteredTasks({ tagged, untagged, pageOffset: 2, pageSize: 2 });

    expect(tasks.map((t) => t.id)).toEqual(['c', 'd']);
  });

  it('sums both totals so pagination spans the merged set', () => {
    const { total } = mergeLocationFilteredTasks({
      tagged: stream([taggedTask('tagged-1', '2026-08-01T10:00:00Z')], 30),
      untagged: stream([locationLessTask('fax-1', '2026-08-01T11:00:00Z')], 4),
      pageOffset: 0,
      pageSize: 20,
    });

    expect(total).toBe(34);
  });

  it('reports an unknown total when either stream omits its total', () => {
    const { total } = mergeLocationFilteredTasks({
      tagged: stream([taggedTask('tagged-1', '2026-08-01T10:00:00Z')], undefined),
      untagged: stream([locationLessTask('fax-1', '2026-08-01T11:00:00Z')], 4),
      pageOffset: 0,
      pageSize: 20,
    });

    expect(total).toBe(-1);
  });

  it('deduplicates a task returned by both streams', () => {
    const shared = taggedTask('dupe', '2026-08-01T10:00:00Z');

    const { tasks } = mergeLocationFilteredTasks({
      tagged: stream([shared], 1),
      untagged: stream([shared], 1),
      pageOffset: 0,
      pageSize: 20,
    });

    expect(tasks.map((t) => t.id)).toEqual(['dupe']);
  });

  it('drops tasks without an id rather than emitting them', () => {
    const { tasks } = mergeLocationFilteredTasks({
      tagged: stream([{ ...taggedTask('x', '2026-08-01T10:00:00Z'), id: undefined }], 1),
      untagged: stream([], 0),
      pageOffset: 0,
      pageSize: 20,
    });

    expect(tasks).toEqual([]);
  });

  describe('when the server does not honor `_tag:not`', () => {
    // `_tag:not=<system>|` (system with an empty code) is meant to exclude every task carrying a
    // tag in the location system. A server reading the empty code literally returns
    // location-tagged tasks in the "untagged" stream instead.
    const unfiltered = (): { tasks: FhirTask[]; total: number } =>
      mergeLocationFilteredTasks({
        tagged: stream([taggedTask('tagged-1', '2026-08-01T10:00:00Z')], 1),
        untagged: stream(
          [
            taggedTask('other-location', '2026-08-01T12:00:00Z', 'location-2'),
            locationLessTask('fax-1', '2026-08-01T11:00:00Z'),
          ],
          500
        ),
        pageOffset: 0,
        pageSize: 20,
      });

    it('never leaks another location tasks into a filtered page', () => {
      const { tasks } = unfiltered();

      expect(tasks.map((t) => t.id)).toEqual(['fax-1', 'tagged-1']);
      expect(tasks.map((t) => t.id)).not.toContain('other-location');
    });

    it('reports an unknown total instead of a count inflated by discarded rows', () => {
      const { total } = unfiltered();

      expect(total).toBe(-1);
    });

    it('reports the broken filter so it is not silently absorbed', () => {
      mockSafelyCaptureMessage.mockClear();

      unfiltered();

      expect(mockSafelyCaptureMessage).toHaveBeenCalledWith(
        expect.stringContaining('_tag:not'),
        expect.objectContaining({ level: 'error' })
      );
    });

    it('stays quiet when the filter works as intended', () => {
      mockSafelyCaptureMessage.mockClear();

      mergeLocationFilteredTasks({
        tagged: stream([taggedTask('tagged-1', '2026-08-01T10:00:00Z')], 1),
        untagged: stream([locationLessTask('fax-1', '2026-08-01T11:00:00Z')], 1),
        pageOffset: 0,
        pageSize: 20,
      });

      expect(mockSafelyCaptureMessage).not.toHaveBeenCalled();
    });
  });
});
