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
  }),
  id,
  status: 'completed',
  ...over,
});

const user = { id: 'user-1', name: 'Sam Stone', email: 'sam@example.com' } as any;

describe('revoke-action-log', () => {
  it('cancels the attempt and every later attempt in its resend chain', async () => {
    const original = attempt('attempt-1');
    const resend = attempt('attempt-2', { partOf: [{ reference: 'Task/attempt-1' }] });
    const get = vi.fn().mockResolvedValue(original);
    const search = vi.fn().mockImplementation(async ({ params }: { params: { value: string }[] }) => ({
      unbundle: () => (params[0].value === 'Task/attempt-1' ? [resend] : []),
    }));
    const patch = vi.fn().mockResolvedValue({});

    const output = await performEffect(
      { attemptId: 'attempt-1', secrets: null },
      { fhir: { get, search, patch } } as any,
      user
    );

    expect(output).toEqual({ attemptId: 'attempt-1', revokedCount: 2 });
    expect(patch).toHaveBeenCalledTimes(2);
    for (const id of ['attempt-1', 'attempt-2']) {
      expect(patch).toHaveBeenCalledWith({
        resourceType: 'Task',
        id,
        operations: [
          { op: 'replace', path: '/status', value: 'cancelled' },
          { op: 'add', path: '/statusReason', value: { text: 'Revoked by Sam Stone' } },
        ],
      });
    }
  });

  it('refuses anything that is not an emailed link', async () => {
    const fax = { ...attempt('attempt-1'), code: { coding: [{ system: 'other', code: 'fax' }] } };
    const get = vi.fn().mockResolvedValue(fax);
    const patch = vi.fn();

    await expect(
      performEffect({ attemptId: 'attempt-1', secrets: null }, { fhir: { get, search: vi.fn(), patch } } as any, user)
    ).rejects.toThrow('Only emailed document links can be revoked');
    expect(patch).not.toHaveBeenCalled();
  });
});
