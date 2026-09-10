import { Account, Organization, QuestionnaireItem } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNioReferenceUrl } from '../helpers';
import { mapOccupationalMedicineEmployerToQuestionnaireResponseItems } from './prePopulation';

const NIO_ID = '11111111-1111-4111-8111-111111111111';
const LEGACY_ORG_ID = '22222222-2222-4222-8222-222222222222';

const flags = vi.hoisted(() => ({ nonInsuranceOrganizationsEnabled: true }));
vi.mock('../../ottehr-config/feature-flags', () => ({ FEATURE_FLAGS_CONFIG: flags }));

const items: QuestionnaireItem[] = [{ linkId: 'occupational-medicine-employer', type: 'reference' }];

const legacyOrg: Organization = { resourceType: 'Organization', id: LEGACY_ORG_ID, name: 'Acme Industrial Corp' };

const tokenOwnerAccount: Account = {
  resourceType: 'Account',
  status: 'active',
  owner: { reference: getNioReferenceUrl(NIO_ID), display: 'FedEx' },
};

const legacyOwnerAccount: Account = {
  resourceType: 'Account',
  status: 'active',
  owner: { reference: `Organization/${LEGACY_ORG_ID}` },
};

const answerOf = (result: ReturnType<typeof mapOccupationalMedicineEmployerToQuestionnaireResponseItems>): unknown =>
  result[0]?.answer?.[0]?.valueReference;

describe('occ-med employer prepopulation in NIO mode', () => {
  beforeEach(() => {
    flags.nonInsuranceOrganizationsEnabled = true;
  });

  it('prefills from an NIO token owner using the stored display — no FHIR-derived data', () => {
    const result = mapOccupationalMedicineEmployerToQuestionnaireResponseItems({
      items,
      occupationalMedicineAccount: tokenOwnerAccount,
      occupationalMedicineEmployerOrganization: legacyOrg,
    });
    expect(answerOf(result)).toEqual({ reference: getNioReferenceUrl(NIO_ID), display: 'FedEx' });
  });

  it('does not prefill from a legacy employer org when the flag is on', () => {
    const result = mapOccupationalMedicineEmployerToQuestionnaireResponseItems({
      items,
      occupationalMedicineAccount: legacyOwnerAccount,
      occupationalMedicineEmployerOrganization: legacyOrg,
    });
    expect(result[0]?.answer).toBeUndefined();
  });

  it('keeps the visit-level reference override untouched', () => {
    const override = { reference: getNioReferenceUrl(NIO_ID), display: 'FedEx' };
    const result = mapOccupationalMedicineEmployerToQuestionnaireResponseItems({
      items,
      occupationalMedicineEmployerReference: override,
      occupationalMedicineEmployerOrganization: legacyOrg,
    });
    expect(answerOf(result)).toEqual(override);
  });

  it('prefills from the legacy employer org when the flag is off', () => {
    flags.nonInsuranceOrganizationsEnabled = false;
    const result = mapOccupationalMedicineEmployerToQuestionnaireResponseItems({
      items,
      occupationalMedicineAccount: legacyOwnerAccount,
      occupationalMedicineEmployerOrganization: legacyOrg,
    });
    expect(answerOf(result)).toEqual({ reference: `Organization/${LEGACY_ORG_ID}`, display: 'Acme Industrial Corp' });
  });
});
