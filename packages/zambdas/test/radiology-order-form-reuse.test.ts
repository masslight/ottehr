import { DocumentReference, ServiceRequest } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isRadiologyOrderFormStale } from '../src/ehr/radiology/shared/order-form-resources';

const docRefGeneratedAt = (date?: string): DocumentReference =>
  ({ resourceType: 'DocumentReference', status: 'current', content: [], date }) as DocumentReference;

const orderUpdatedAt = (lastUpdated?: string): ServiceRequest =>
  ({
    resourceType: 'ServiceRequest',
    status: 'active',
    intent: 'order',
    subject: {},
    meta: lastUpdated ? { lastUpdated } : undefined,
  }) as ServiceRequest;

describe('isRadiologyOrderFormStale', () => {
  it('reuses the stored order form when the order has not changed since it was generated', () => {
    expect(
      isRadiologyOrderFormStale(
        docRefGeneratedAt('2026-07-29T12:00:05.000Z'),
        orderUpdatedAt('2026-07-29T12:00:00.000Z')
      )
    ).toBe(false);
  });

  it('regenerates when the order was edited after the order form was generated', () => {
    expect(
      isRadiologyOrderFormStale(
        docRefGeneratedAt('2026-07-29T12:00:00.000Z'),
        orderUpdatedAt('2026-07-29T12:05:00.000Z')
      )
    ).toBe(true);
  });

  it('reuses when the two timestamps are identical', () => {
    const sameInstant = '2026-07-29T12:00:00.000Z';
    expect(isRadiologyOrderFormStale(docRefGeneratedAt(sameInstant), orderUpdatedAt(sameInstant))).toBe(false);
  });

  it('compares instants across differing offsets rather than raw strings', () => {
    // 08:00-04:00 is the same instant as 12:00Z.
    expect(
      isRadiologyOrderFormStale(
        docRefGeneratedAt('2026-07-29T08:00:00.000-04:00'),
        orderUpdatedAt('2026-07-29T12:00:00.000Z')
      )
    ).toBe(false);
  });

  it('regenerates when the order form has no generation time to compare', () => {
    expect(isRadiologyOrderFormStale(docRefGeneratedAt(undefined), orderUpdatedAt('2026-07-29T12:00:00.000Z'))).toBe(
      true
    );
  });

  it('reuses when the order carries no lastUpdated', () => {
    expect(isRadiologyOrderFormStale(docRefGeneratedAt('2026-07-29T12:00:00.000Z'), orderUpdatedAt(undefined))).toBe(
      false
    );
  });
});
