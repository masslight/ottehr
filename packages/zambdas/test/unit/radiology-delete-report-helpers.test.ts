import { ServiceRequest } from 'fhir/r4b';
import {
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { describe, expect, it } from 'vitest';
import { buildTeleradiologyStripOperations } from '../../src/ehr/radiology/delete-report/helpers';

const orderedAt = { url: SERVICE_REQUEST_REQUESTED_TIME_EXTENSION_URL, valueDateTime: '2026-09-01T10:00:00.000Z' };
const needsFinalRead = {
  url: SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  valueDateTime: '2026-09-02T10:00:00.000Z',
};
const hasBeenSent = {
  url: SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  valueDateTime: '2026-09-02T10:05:00.000Z',
};
const sentBy = {
  url: SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
  valueReference: { reference: 'Practitioner/abc', display: 'Dr Who' },
};

const serviceRequest = (extension?: ServiceRequest['extension']): ServiceRequest =>
  ({ resourceType: 'ServiceRequest', status: 'completed', intent: 'order', subject: {}, extension }) as ServiceRequest;

describe('buildTeleradiologyStripOperations', () => {
  it('emits no operations for an order that was never sent for a final read', () => {
    expect(buildTeleradiologyStripOperations(serviceRequest([orderedAt]))).toEqual([]);
  });

  it('emits no operations for an order with no extensions at all', () => {
    expect(buildTeleradiologyStripOperations(serviceRequest())).toEqual([]);
  });

  it('removes all three teleradiology extensions and keeps the unrelated ones', () => {
    const operations = buildTeleradiologyStripOperations(
      serviceRequest([orderedAt, needsFinalRead, hasBeenSent, sentBy])
    );

    expect(operations).toEqual([{ op: 'replace', path: '/extension', value: [orderedAt] }]);
  });

  it('removes the element entirely rather than leaving an empty extension array', () => {
    const operations = buildTeleradiologyStripOperations(serviceRequest([needsFinalRead, hasBeenSent, sentBy]));

    expect(operations).toEqual([{ op: 'remove', path: '/extension' }]);
  });

  it('strips even when the order was marked but not yet dispatched to teleradiology', () => {
    const operations = buildTeleradiologyStripOperations(serviceRequest([orderedAt, needsFinalRead, sentBy]));

    expect(operations).toEqual([{ op: 'replace', path: '/extension', value: [orderedAt] }]);
  });
});
