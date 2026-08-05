import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Organization, Patient, Person, Practitioner } from 'fhir/r4b';
import {
  AR_STAGE,
  CLAIM_STATUS_TAG_SYSTEMS,
  M2MClientMockType,
  SearchBillingClaimsInput,
  SearchBillingClaimsResponse,
} from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLAIM_PCN_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('search-billing-claims search text', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];

  const seed = async <T extends FhirResource>(resource: T): Promise<string> => {
    const created = await oystehr.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.push({
      method: 'DELETE',
      url: `${created.resourceType}/${created.id}`,
    });
    return created.id;
  };

  const createdClaimIds: string[] = [];
  let patientId: string;
  let claimPatientId: string;
  let practitionerId: string;
  let organizationId: string;

  // Unique per run so a prefix search matches only this test's seed data.
  let unique: string;
  let patientFamily: string;
  let patientGiven: string;
  let renderingFamily: string;
  let billingOrgName: string;
  const customPcn = 'PCN-SEARCH-TEST';

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/search-billing-claims.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;

    unique = `Zst${processId.replace(/\D/g, '').slice(-10)}`;
    patientFamily = `${unique}PatientFam`;
    patientGiven = `${unique}PatientGiv`;
    renderingFamily = `${unique}RenderingFam`;
    billingOrgName = `${unique} Billing Group`;

    patientId = await seed<Patient>({
      resourceType: 'Patient',
      active: true,
      name: [
        {
          family: patientFamily,
          given: [patientGiven],
        },
      ],
      birthDate: '1990-01-01',
    });

    practitionerId = await seed<Practitioner>({
      resourceType: 'Practitioner',
      active: true,
      name: [
        {
          family: renderingFamily,
          given: ['Rendering'],
        },
      ],
    });

    organizationId = await seed<Organization>({
      resourceType: 'Organization',
      active: true,
      name: billingOrgName,
    });

    const claimBase = {
      resourceType: 'Claim' as const,
      status: 'draft' as const,
      use: 'claim' as const,
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
          },
        ],
      },
      created: '2026-01-01',
      priority: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/processpriority',
            code: 'normal',
          },
        ],
      },
      insurance: [
        {
          sequence: 1,
          focal: true,
          coverage: {
            display: 'Self-pay',
          },
        },
      ],
    };

    claimPatientId = await seed<Patient>({
      resourceType: 'Patient',
      active: true,
      name: [
        {
          family: patientFamily,
          given: [patientGiven],
        },
      ],
      birthDate: '1990-01-01',
    });

    await seed<Person>({
      resourceType: 'Person',
      link: [
        {
          target: {
            reference: `Patient/${patientId}`,
          },
        },
        {
          target: {
            reference: `Patient/${claimPatientId}`,
          },
        },
      ],
    });

    // The claim every name and id search should find. No PCN identifier, so its PCN is its own id
    // with the dashes stripped.
    const claimId = await seed<Claim>({
      ...claimBase,
      patient: {
        reference: `Patient/${claimPatientId}`,
      },
      provider: {
        reference: `Organization/${organizationId}`,
      },
      careTeam: [
        {
          sequence: 1,
          provider: {
            reference: `Practitioner/${practitionerId}`,
          },
        },
      ],
      meta: {
        tag: [
          {
            system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
            code: AR_STAGE.insurancePayer,
          },
        ],
      },
    } as Claim);
    createdClaimIds.push(claimId);

    // A second claim carrying an explicit patient control number, for the identifier clause.
    const pcnClaimId = await seed<Claim>({
      ...claimBase,
      identifier: [
        {
          system: CLAIM_PCN_IDENTIFIER_SYSTEM,
          value: `${customPcn}-${unique}`,
        },
      ],
      patient: {
        display: 'Unrelated',
      },
      provider: {
        display: 'Unknown',
      },
    } as Claim);
    createdClaimIds.push(pcnClaimId);
  }, 120_000);

  afterAll(async () => {
    try {
      if (seededDeletes.length > 0) await oystehr.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded search fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  const search = async (input: SearchBillingClaimsInput): Promise<SearchBillingClaimsResponse> =>
    (await oystehr.zambda.execute({ id: 'search-billing-claims', ...input }))
      .output as unknown as SearchBillingClaimsResponse;

  const idsFor = async (searchText: string): Promise<string[]> =>
    (await search({ searchText })).claims.map((claim) => claim.id);

  it('finds the claim by the patient last name', async () => {
    expect(await idsFor(patientFamily)).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('finds the claim by the patient first name', async () => {
    expect(await idsFor(patientGiven)).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('finds the claim by the patient id shown in the UI, not just the copy the claim references', async () => {
    expect(await idsFor(patientId)).toEqual([createdClaimIds[0]]);
    expect(await idsFor(claimPatientId)).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('finds the claim by the billing provider name', async () => {
    expect(await idsFor(unique)).toContain(createdClaimIds[0]);
    expect(await idsFor(billingOrgName)).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('finds the claim by the rendering provider last name', async () => {
    expect(await idsFor(renderingFamily)).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('finds the claim by its resource id', async () => {
    expect(await idsFor(createdClaimIds[0])).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('finds the claim by the PCN shown in the UI, which is its id with dashes stripped', async () => {
    expect(await idsFor(createdClaimIds[0].replaceAll('-', ''))).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('finds a claim by an explicit patient control number identifier', async () => {
    expect(await idsFor(`${customPcn}-${unique}`)).toEqual([createdClaimIds[1]]);
  }, 60_000);

  it('still applies the other filters alongside the search text', async () => {
    const matching = await search({
      searchText: patientFamily,
      arStage: AR_STAGE.insurancePayer,
    });
    expect(matching.claims.map((claim) => claim.id)).toEqual([createdClaimIds[0]]);

    const mismatched = await search({
      searchText: patientFamily,
      arStage: AR_STAGE.patient,
    });
    expect(mismatched.claims).toEqual([]);
    expect(mismatched.total).toBe(0);
  }, 60_000);

  it('filters by the patient of record supplied by the Patient picker', async () => {
    const matching = await search({
      patientId,
    });
    expect(matching.claims.map((claim) => claim.id)).toEqual([createdClaimIds[0]]);
  }, 60_000);

  it('returns nothing for text that matches no field', async () => {
    expect(await idsFor(`${unique}NoSuchThing`)).toEqual([]);
  }, 60_000);
});
