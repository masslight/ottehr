import { Account } from 'fhir/r4b';
import { OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE } from 'utils/lib/fhir/constants';
import { getNioReferenceUrl } from 'utils/lib/helpers/helpers';
import { describe, expect, it } from 'vitest';
import { buildEmployerAccountResource } from '../../src/ehr/shared/harvest';

const PATIENT_ID = '11111111-1111-4111-8111-111111111111';
const NIO_ID = '22222222-2222-4222-8222-222222222222';
const LEGACY_ORG_ID = '33333333-3333-4333-8333-333333333333';

describe('buildEmployerAccountResource with NIO reference tokens', () => {
  it('stores the token verbatim on owner with its display, and omits the guarantor type hint', () => {
    const account = buildEmployerAccountResource({
      patientId: PATIENT_ID,
      organizationReference: getNioReferenceUrl(NIO_ID),
      organizationDisplay: 'FedEx',
      accountTypeCoding: OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
    });

    expect(account.owner).toEqual({ reference: getNioReferenceUrl(NIO_ID), display: 'FedEx' });
    expect(account.guarantor).toEqual([{ party: { reference: getNioReferenceUrl(NIO_ID) } }]);
  });

  it('keeps the Organization type hint and bare owner for legacy references', () => {
    const account = buildEmployerAccountResource({
      patientId: PATIENT_ID,
      organizationReference: `Organization/${LEGACY_ORG_ID}`,
      accountTypeCoding: OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
    });

    expect(account.owner).toEqual({ reference: `Organization/${LEGACY_ORG_ID}` });
    expect(account.guarantor).toEqual([
      { party: { reference: `Organization/${LEGACY_ORG_ID}`, type: 'Organization' } },
    ]);
  });

  it('replaces a previous owner guarantor entry when the employer changes', () => {
    const existingAccount: Account = {
      resourceType: 'Account',
      status: 'active',
      guarantor: [{ party: { reference: `Organization/${LEGACY_ORG_ID}`, type: 'Organization' } }],
    };

    const account = buildEmployerAccountResource({
      patientId: PATIENT_ID,
      existingAccount,
      organizationReference: getNioReferenceUrl(NIO_ID),
      organizationDisplay: 'FedEx',
      accountTypeCoding: OCCUPATIONAL_MEDICINE_ACCOUNT_TYPE,
    });

    // The old legacy guarantor stays (different reference); the new token entry is appended.
    expect(account.guarantor).toEqual([
      { party: { reference: `Organization/${LEGACY_ORG_ID}`, type: 'Organization' } },
      { party: { reference: getNioReferenceUrl(NIO_ID) } },
    ]);
  });
});
