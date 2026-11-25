import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, Location, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getNPI } from 'utils/lib/fhir/helpers';
import {
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_AGENT_TYPE,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  ClaimFieldChange,
} from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCLIA, getPlaceOfServiceCode } from '../../../src/billing/service-facility.helpers';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('save-billing-service-facility', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let cleanup: () => Promise<void>;
  let claim: Claim;
  let facility: Location;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/save-billing-service-facility.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    cleanup = setup.cleanup;

    [claim, facility] = await Promise.all([
      billing.fhir.create<Claim>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Claim',
            status: 'draft',
            use: 'claim',
            type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
            patient: { display: 'Facility Test Patient' },
            created: '2026-01-01',
            provider: { display: 'Unknown' },
            priority: {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }],
            },
            insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
          },
          setup.processId
        ) as Claim
      ),
      billing.fhir.create<Location>(
        addProcessIdMetaTagToResource(
          {
            resourceType: 'Location',
            status: 'active',
            name: `Old Facility ${randomUUID()}`,
            address: { line: ['1 Old St'], city: 'Dallas', state: 'TX', postalCode: '75201' },
          },
          setup.processId
        ) as Location
      ),
    ]);
  }, 60_000);

  afterAll(async () => {
    const provenances = (
      await admin.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claim.id}` }],
      })
    ).unbundle();
    await admin.fhir
      .batch({
        requests: [
          ...provenances.map((provenance) => ({ method: 'DELETE' as const, url: `Provenance/${provenance.id}` })),
          { method: 'DELETE', url: `Location/${facility.id}` },
          { method: 'DELETE', url: `Claim/${claim.id}` },
        ],
      })
      .catch((error) => console.error('save-billing-service-facility cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it("updates the claim's facility and records the change in the claim history as the caller", async () => {
    const newName = `New Facility ${randomUUID()}`;

    const output = (
      await caller.zambda.execute({
        id: 'save-billing-service-facility',
        facilityId: facility.id,
        claimId: claim.id,
        name: newName,
        addressLine1: '200 Congress Ave',
        city: 'Austin',
        state: 'TX',
        zip: '78701-1234',
        npi: '1234567893',
        clia: '05D1234567',
        posCode: '11',
      })
    ).output as { id: string };

    expect(output).toEqual({ id: facility.id });

    const saved = await billing.fhir.get<Location>({ resourceType: 'Location', id: facility.id! });
    expect(saved.name).toBe(newName);
    expect(saved.address).toEqual({
      line: ['200 Congress Ave'],
      city: 'Austin',
      state: 'TX',
      postalCode: '78701-1234',
    });
    expect(getNPI(saved)).toBe('1234567893');
    expect(getCLIA(saved)).toBe('05D1234567');
    expect(getPlaceOfServiceCode(saved)).toBe('11');

    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claim.id}` }],
      })
    ).unbundle();
    expect(provenances).toHaveLength(1);
    const [history] = provenances;
    expect(history.target).toEqual([{ reference: `Location/${facility.id}` }, { reference: `Claim/${claim.id}` }]);
    expect(history.activity?.coding).toEqual([CLAIM_PROVENANCE_ACTIVITY.update]);
    expect(history.agent).toEqual([
      { type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: callerProfile } },
    ]);
    expect(history.entity).toContainEqual({
      role: 'revision',
      what: { reference: `Location/${facility.id}/_history/${facility.meta?.versionId}` },
    });
    const changes = JSON.parse(
      history.extension?.find((extension) => extension.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)?.valueString ?? '[]'
    ) as ClaimFieldChange[];
    expect(changes).toContainEqual({
      field: 'name',
      label: 'Name',
      previousValue: facility.name,
      newValue: newName,
    });
    expect(changes.map((change) => change.field)).toEqual(
      expect.arrayContaining(['name', 'npi', 'clia', 'posCode', 'address'])
    );
  }, 60_000);
});
