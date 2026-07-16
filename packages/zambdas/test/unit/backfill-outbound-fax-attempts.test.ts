import { Communication, Provenance } from 'fhir/r4b';
import { getOutboundDeliveryInput, OUTBOUND_DELIVERY_INPUT_CODES } from 'utils';
import { describe, expect, it } from 'vitest';
import { buildLegacyFaxAttempt } from '../../src/scripts/backfill-outbound-fax-attempts.helpers';

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
      agent: [],
      contained: [{ resourceType: 'Practitioner', id: 'recipient', name: [{ family: 'Historical' }] }],
    };
    const task = buildLegacyFaxAttempt(communication, provenance)!;
    expect(task.identifier?.[0].value).toBe('Communication/comm-1');
    expect(task.focus?.reference).toBe('Appointment/appointment-1');
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)?.valueString).toContain(
      'Historical'
    );
  });

  it('does not infer a recipient name or visit when no Provenance exists', () => {
    const task = buildLegacyFaxAttempt(communication)!;
    expect(task.focus).toBeUndefined();
    expect(getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.recipientName)).toBeUndefined();
  });
});
