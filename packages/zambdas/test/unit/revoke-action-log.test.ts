import { Task } from 'fhir/r4b';
import { makeOutboundDeliveryAttempt } from 'utils/lib/fhir/outbound-delivery';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../src/ehr/revoke-action-log';

const attempt = (id: string, over: Partial<Task> = {}): Task => ({
  ...makeOutboundDeliveryAttempt({
    channel: 'email',
    patientId: 'patient-1',
    recipientAddress: 'olivia@example.com',
    documentReferenceId: 'packet-1',
    senderOrganizationReference: 'Organization/org-1',
  }),
  id,
  status: 'completed',
  ...over,
});

const user = { id: 'user-1', name: 'Sam Stone', email: 'sam@example.com' } as any;

/** A FHIR client over a fixed set of attempts, resolving `get` by id and `part-of` searches by parent. */
const fhirOver = (tasks: Task[]): { get: any; search: any; patch: any } => ({
  get: vi.fn().mockImplementation(async ({ id }: { id: string }) => tasks.find((task) => task.id === id)),
  search: vi.fn().mockImplementation(async ({ params }: { params: { value: string }[] }) => ({
    unbundle: () => tasks.filter((task) => task.partOf?.[0]?.reference === params[0].value),
  })),
  patch: vi.fn().mockResolvedValue({}),
});

const cancelledIds = (patch: any): string[] => patch.mock.calls.map(([call]: [{ id: string }]) => call.id);

describe('revoke-action-log', () => {
  it('cancels the attempt and every later attempt in its resend chain', async () => {
    const fhir = fhirOver([attempt('attempt-1'), attempt('attempt-2', { partOf: [{ reference: 'Task/attempt-1' }] })]);

    const output = await performEffect({ attemptId: 'attempt-1', secrets: null }, { fhir } as any, user);

    expect(output).toEqual({ attemptId: 'attempt-1', revokedCount: 2 });
    expect(fhir.patch).toHaveBeenCalledTimes(2);
    for (const id of ['attempt-1', 'attempt-2']) {
      expect(fhir.patch).toHaveBeenCalledWith({
        resourceType: 'Task',
        id,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: 'add', path: '/statusReason', value: { text: 'Revoked by Sam Stone' } },
        ],
      });
    }
  });

  it('cancels the earlier links too when a re-sent link is revoked, so an expired original cannot re-send', async () => {
    const fhir = fhirOver([
      attempt('attempt-1'),
      attempt('attempt-2', { partOf: [{ reference: 'Task/attempt-1' }] }),
      attempt('attempt-3', { partOf: [{ reference: 'Task/attempt-2' }] }),
    ]);

    const output = await performEffect({ attemptId: 'attempt-2', secrets: null }, { fhir } as any, user);

    expect(output.revokedCount).toBe(3);
    expect(cancelledIds(fhir.patch).sort()).toEqual(['attempt-1', 'attempt-2', 'attempt-3']);
  });

  it('leaves a failed attempt in the chain as failed', async () => {
    const fhir = fhirOver([
      attempt('attempt-1'),
      attempt('attempt-2', { partOf: [{ reference: 'Task/attempt-1' }], status: 'failed' }),
    ]);

    await performEffect({ attemptId: 'attempt-1', secrets: null }, { fhir } as any, user);

    expect(cancelledIds(fhir.patch)).toEqual(['attempt-1']);
  });

  // The patches run in parallel, so a failed run can leave the clicked attempt cancelled and the rest live.
  it('finishes a partly applied revoke when it is retried on the already-cancelled attempt', async () => {
    const fhir = fhirOver([
      attempt('attempt-1'),
      attempt('attempt-2', { partOf: [{ reference: 'Task/attempt-1' }], status: 'cancelled' }),
    ]);

    const output = await performEffect({ attemptId: 'attempt-2', secrets: null }, { fhir } as any, user);

    expect(output.revokedCount).toBe(1);
    expect(cancelledIds(fhir.patch)).toEqual(['attempt-1']);
  });

  it('fails rather than revoke part of a chain longer than the walk bound', async () => {
    const chain = Array.from({ length: 51 }, (_, index) =>
      attempt(`attempt-${index}`, index > 0 ? { partOf: [{ reference: `Task/attempt-${index - 1}` }] } : {})
    );
    const fhir = fhirOver(chain);

    await expect(performEffect({ attemptId: 'attempt-0', secrets: null }, { fhir } as any, user)).rejects.toThrow(
      'longer than 50 attempts'
    );
    expect(fhir.patch).not.toHaveBeenCalled();
  });

  it('refuses anything that is not an emailed link', async () => {
    const fax = { ...attempt('attempt-1'), code: { coding: [{ system: 'other', code: 'fax' }] } };
    const fhir = fhirOver([fax]);

    await expect(performEffect({ attemptId: 'attempt-1', secrets: null }, { fhir } as any, user)).rejects.toThrow(
      'Only sent document links can be revoked'
    );
    expect(fhir.patch).not.toHaveBeenCalled();
  });

  it('refuses a visit-note email, which carries no link', async () => {
    const visitNote = makeOutboundDeliveryAttempt({
      channel: 'email',
      patientId: 'patient-1',
      recipientAddress: 'olivia@example.com',
    });
    const fhir = fhirOver([{ ...visitNote, id: 'attempt-1', status: 'completed' }]);

    await expect(performEffect({ attemptId: 'attempt-1', secrets: null }, { fhir } as any, user)).rejects.toThrow(
      'Only sent document links can be revoked'
    );
    expect(fhir.patch).not.toHaveBeenCalled();
  });

  it('refuses a link email that was never sent', async () => {
    const fhir = fhirOver([attempt('attempt-1', { status: 'failed' })]);

    await expect(performEffect({ attemptId: 'attempt-1', secrets: null }, { fhir } as any, user)).rejects.toThrow(
      'Only sent document links can be revoked'
    );
    expect(fhir.patch).not.toHaveBeenCalled();
  });
});
