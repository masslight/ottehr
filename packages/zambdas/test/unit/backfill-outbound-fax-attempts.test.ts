import { Communication, Provenance, Task } from 'fhir/r4b';
import {
  getOutboundDeliveryInput,
  OUTBOUND_DELIVERY_INPUT_CODES,
  OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM,
} from 'utils';
import { describe, expect, it, vi } from 'vitest';
import {
  backfillOutboundFaxAttempts,
  buildLegacyFaxAttempt,
} from '../../src/scripts/backfill-outbound-fax-attempts.helpers';

const communication: Communication = {
  resourceType: 'Communication',
  id: 'comm-1',
  status: 'completed',
  subject: { reference: 'Patient/patient-1' },
  recipient: [{ reference: '#recipient' }],
  contained: [
    {
      resourceType: 'Practitioner',
      id: 'recipient',
      telecom: [{ system: 'fax', value: '+12125551234' }],
    },
  ],
  sent: '2024-01-01T00:00:00Z',
};

describe('legacy outbound fax backfill', () => {
  it('uses the historical snapshot and deterministic source identifier', () => {
    const provenance: Provenance = {
      resourceType: 'Provenance',
      target: [{ reference: 'Communication/comm-1' }, { reference: 'Appointment/appointment-1' }],
      recorded: '2024-01-01T00:00:00Z',
      agent: [
        {
          who: { reference: 'Practitioner/sender-1', display: 'Sender', identifier: { value: 'user-1' } },
          onBehalfOf: { reference: 'Organization/organization-1' },
        },
      ],
      contained: [{ resourceType: 'Practitioner', id: 'recipient', name: [{ family: 'Historical' }] }],
    };
    const task = buildLegacyFaxAttempt(communication, provenance)!;
    expect(task.identifier?.[0].value).toBe('Communication/comm-1');
    expect(task.focus?.reference).toBe('Appointment/appointment-1');
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)?.valueString).toContain(
      'Historical'
    );
    expect(task.requester?.reference).toBe('Practitioner/sender-1');
    expect(
      getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderOrganization)?.valueReference?.reference
    ).toBe('Organization/organization-1');
  });

  it('does not infer a recipient name or visit when no Provenance exists', () => {
    const task = buildLegacyFaxAttempt(communication)!;
    expect(task.focus).toBeUndefined();
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)).toBeUndefined();
  });

  it('pages Communications and reports existing records without writing during a dry run', async () => {
    const secondCommunication: Communication = { ...communication, id: 'comm-2' };
    const existingTask: Task = {
      ...buildLegacyFaxAttempt(communication)!,
      id: 'existing-task',
    };
    const search = vi.fn(async ({ resourceType, params }: any) => {
      if (resourceType === 'Communication') {
        const offset = params.find((parameter: any) => parameter.name === '_offset')?.value;
        return {
          total: 2,
          unbundle: () => (offset === '0' ? [communication] : [secondCommunication]),
        };
      }
      if (resourceType === 'Task') {
        return {
          total: 1,
          entry: [{ resource: existingTask, search: { mode: 'match' } }],
          unbundle: () => [existingTask],
        };
      }
      return { total: 0, entry: [], unbundle: () => [] };
    });
    const create = vi.fn();

    const result = await backfillOutboundFaxAttempts({ fhir: { search, create } } as any, true);

    expect(result).toEqual({ examined: 2, created: 1, existing: 1, skipped: 0, failed: 0 });
    expect(create).not.toHaveBeenCalled();
    expect(search.mock.calls.filter(([request]) => request.resourceType === 'Communication')).toHaveLength(2);
  });

  it('uses a conditional create keyed by the source Communication', async () => {
    const search = vi.fn(async ({ resourceType }: any) =>
      resourceType === 'Communication'
        ? { total: 1, unbundle: () => [communication] }
        : { total: 0, entry: [], unbundle: () => [] }
    );
    const create = vi.fn(async (candidate: Task, _options?: unknown) => ({ ...candidate, id: 'created-task' }));

    const result = await backfillOutboundFaxAttempts({ fhir: { search, create } } as any, false);

    expect(result).toEqual({ examined: 1, created: 1, existing: 0, skipped: 0, failed: 0 });
    expect(create.mock.calls[0][1]).toEqual({
      ifNoneExist: [
        {
          name: 'identifier',
          value: `${OUTBOUND_DELIVERY_SOURCE_IDENTIFIER_SYSTEM}|Communication/comm-1`,
        },
      ],
    });
  });
});
