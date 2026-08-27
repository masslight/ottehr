import { describe, expect, it } from 'vitest';
import { getNioReferenceUrl } from '../../helpers/helpers';
import { FhirOrganizationReferenceSchema } from './update-visit-details.types';

const ORG_ID = '11111111-1111-4111-8111-111111111111';

describe('FhirOrganizationReferenceSchema', () => {
  it.each([
    ['a legacy Organization/{uuid} reference', `Organization/${ORG_ID}`],
    ['an NIO reference token', getNioReferenceUrl(ORG_ID)],
  ])('accepts %s', (_label, reference) => {
    expect(FhirOrganizationReferenceSchema.safeParse({ reference, display: 'FedEx' }).success).toBe(true);
  });

  it.each([
    ['a non-uuid Organization reference', 'Organization/not-a-uuid'],
    ['a bare uuid', ORG_ID],
    ['an unrelated absolute URL', 'https://rcm-api.zapehr.com/v1/payer/PAYER123'],
    ['a different resource type', `Location/${ORG_ID}`],
  ])('rejects %s', (_label, reference) => {
    expect(FhirOrganizationReferenceSchema.safeParse({ reference }).success).toBe(false);
  });
});
