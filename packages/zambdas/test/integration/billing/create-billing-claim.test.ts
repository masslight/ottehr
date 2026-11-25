import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Claim,
  Coverage,
  FhirResource,
  Location,
  Organization,
  Patient,
  Person,
  Practitioner,
  Provenance,
  RelatedPerson,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CLAIM_PROVENANCE_ACTIVITY, CLAIM_PROVENANCE_AGENT_TYPE } from 'utils/lib/types/data/billing/claim-history';
import {
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_KIND_CODE,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BILLING_WORKING_COPY_TAG, copySourceId } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('create-billing-claim', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let caller: Oystehr;
  let callerProfile: string;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  const payerName = `Create Claim Payer ${unique}`;
  const payerBusinessId = `OTR-${unique}`;
  let patient: Patient;
  let subscriber: RelatedPerson;
  let coverage: Coverage;
  let payer: Organization;
  let renderingProvider: Practitioner;
  let facility: Location;
  let billingProvider: Organization;
  let person: Person;
  let createdClaimId: string | undefined;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/create-billing-claim.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    callerProfile = setup.testUserM2MProfile;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/Patient',
        fullUrl: 'urn:uuid:patient',
        resource: tagged<Patient>({
          resourceType: 'Patient',
          active: true,
          name: [{ family: `CreateClaim${unique}`, given: ['Patty'] }],
          birthDate: '1985-04-12',
          gender: 'female',
        }),
      },
      {
        method: 'POST',
        url: '/RelatedPerson',
        fullUrl: 'urn:uuid:subscriber',
        resource: tagged<RelatedPerson>({
          resourceType: 'RelatedPerson',
          patient: { reference: 'urn:uuid:patient' },
          name: [{ family: `CreateClaim${unique}`, given: ['Sam'] }],
          birthDate: '1983-02-01',
          relationship: [
            {
              coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-RoleCode', code: 'SPS', display: 'spouse' }],
            },
          ],
        }),
      },
      {
        method: 'POST',
        url: '/Organization',
        fullUrl: 'urn:uuid:payer',
        resource: tagged<Organization>({
          resourceType: 'Organization',
          active: true,
          name: payerName,
          type: [{ coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: CUSTOM_INSURANCE_ORG_KIND_CODE }] }],
          identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: payerBusinessId }],
        }),
      },
      {
        method: 'POST',
        url: '/Coverage',
        fullUrl: 'urn:uuid:coverage',
        resource: tagged<Coverage>({
          resourceType: 'Coverage',
          status: 'active',
          subscriberId: `MEM-${unique}`,
          beneficiary: { reference: 'urn:uuid:patient' },
          subscriber: { reference: 'urn:uuid:subscriber' },
          payor: [{ reference: 'urn:uuid:payer' }],
          relationship: {
            coding: [
              {
                system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
                code: 'spouse',
                display: 'Spouse',
              },
            ],
          },
        }),
      },
      {
        method: 'POST',
        url: '/Practitioner',
        fullUrl: 'urn:uuid:rendering',
        resource: tagged<Practitioner>({
          resourceType: 'Practitioner',
          active: true,
          name: [{ family: `Renderer${unique}`, given: ['Rita'] }],
        }),
      },
      {
        method: 'POST',
        url: '/Location',
        fullUrl: 'urn:uuid:facility',
        resource: tagged<Location>({
          resourceType: 'Location',
          status: 'active',
          name: `Create Claim Facility ${unique}`,
        }),
      },
      {
        method: 'POST',
        url: '/Organization',
        fullUrl: 'urn:uuid:billing-provider',
        resource: tagged<Organization>({
          resourceType: 'Organization',
          active: true,
          name: `Create Claim Billing Group ${unique}`,
        }),
      },
      {
        method: 'POST',
        url: '/Person',
        fullUrl: 'urn:uuid:person',
        resource: tagged<Person>({
          resourceType: 'Person',
          link: [{ target: { reference: 'urn:uuid:patient' } }],
        }),
      },
    ];
    const created = (await billing.fhir.transaction<FhirResource>({ requests })).entry?.map((entry) => entry.resource);
    [patient, subscriber, payer, coverage, renderingProvider, facility, billingProvider, person] = created as [
      Patient,
      RelatedPerson,
      Organization,
      Coverage,
      Practitioner,
      Location,
      Organization,
      Person,
    ];
  }, 60_000);

  afterAll(async () => {
    const refs: string[] = [];
    if (createdClaimId) {
      const claim = await admin.fhir.get<Claim>({ resourceType: 'Claim', id: createdClaimId }).catch(() => undefined);
      const coverageCopyRef = claim?.insurance?.[0]?.coverage?.reference;
      const coverageCopy = coverageCopyRef
        ? await admin.fhir
            .get<Coverage>({ resourceType: 'Coverage', id: coverageCopyRef.replace('Coverage/', '') })
            .catch(() => undefined)
        : undefined;
      const provenances = (
        await admin.fhir.search<Provenance>({
          resourceType: 'Provenance',
          params: [{ name: 'target', value: `Claim/${createdClaimId}` }],
        })
      ).unbundle();
      refs.push(
        `Claim/${createdClaimId}`,
        ...provenances.map((provenance) => `Provenance/${provenance.id}`),
        ...[
          claim?.patient?.reference,
          coverageCopyRef,
          coverageCopy?.subscriber?.reference,
          claim?.careTeam?.[0]?.provider?.reference,
          claim?.facility?.reference,
          claim?.provider?.reference,
        ].filter((ref): ref is string => !!ref)
      );
    }
    refs.push(
      ...[person, coverage, subscriber, patient, payer, renderingProvider, facility, billingProvider]
        .filter((resource) => resource?.id)
        .map((resource) => `${resource.resourceType}/${resource.id}`)
    );
    await admin.fhir
      .batch({ requests: refs.map((url) => ({ method: 'DELETE' as const, url })) })
      .catch((error) => console.error('create-billing-claim cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('creates the claim on working copies with the payer resolved and history recorded as the caller', async () => {
    const { claimId } = (
      await caller.zambda.execute({
        id: 'create-billing-claim',
        patientId: patient.id,
        coverageId: coverage.id,
        renderingProvider: { id: renderingProvider.id, type: 'Practitioner' },
        facilityId: facility.id,
        billingProvider: { id: billingProvider.id, type: 'Organization' },
        diagnoses: [{ code: 'J02.9', display: 'Acute pharyngitis, unspecified' }],
        serviceLines: [
          {
            cptCode: '99213',
            units: 1,
            charges: 150,
            serviceDate: '2026-03-02',
            placeOfService: '11',
            diagnosisPointers: [1],
          },
        ],
      })
    ).output as { claimId: string };
    createdClaimId = claimId;

    const claim = await billing.fhir.get<Claim>({ resourceType: 'Claim', id: claimId });
    const payerDisplay = `${payerName} (${payerBusinessId})`;
    expect(claim.insurer).toEqual({ reference: `Organization/${payer.id}`, display: payerDisplay });
    expect(claim.insurance).toHaveLength(1);
    expect(claim.insurance[0].coverage.display).toBe(payerDisplay);
    expect(claim.careTeam?.[0]?.provider.display).toBe(`Renderer${unique}, Rita`);
    expect(claim.facility?.display).toBe(facility.name);
    expect(claim.provider.display).toBe(billingProvider.name);
    expect(claim.created).toBe('2026-03-02');
    expect(claim.total).toEqual({ value: 150, currency: 'USD' });
    expect(claim.diagnosis?.[0]?.diagnosisCodeableConcept?.coding?.[0]?.code).toBe('J02.9');
    expect(claim.item?.[0]?.productOrService.coding?.[0]?.code).toBe('99213');

    const copyRefs = {
      patient: claim.patient.reference!,
      coverage: claim.insurance[0].coverage.reference!,
      renderingProvider: claim.careTeam![0].provider.reference!,
      facility: claim.facility!.reference!,
      billingProvider: claim.provider.reference!,
    };
    const [patientCopy, coverageCopy, renderingCopy, facilityCopy, billingCopy] = await Promise.all(
      Object.values(copyRefs).map((ref) => {
        const [resourceType, id] = ref.split('/');
        return billing.fhir.get<FhirResource>({ resourceType: resourceType as FhirResource['resourceType'], id });
      })
    );
    expect(copySourceId(patientCopy as Patient)).toBe(patient.id);
    expect(copySourceId(coverageCopy as Coverage)).toBe(coverage.id);
    expect(copySourceId(renderingCopy as Practitioner)).toBe(renderingProvider.id);
    expect(copySourceId(facilityCopy as Location)).toBe(facility.id);
    expect(copySourceId(billingCopy as Organization)).toBe(billingProvider.id);
    expect(patientCopy.meta?.tag).toContainEqual(expect.objectContaining(BILLING_WORKING_COPY_TAG));
    expect((coverageCopy as Coverage).beneficiary.reference).toBe(copyRefs.patient);
    expect((coverageCopy as Coverage).subscriberId).toBe(`MEM-${unique}`);
    const subscriberCopy = await billing.fhir.get<RelatedPerson>({
      resourceType: 'RelatedPerson',
      id: (coverageCopy as Coverage).subscriber!.reference!.replace('RelatedPerson/', ''),
    });
    expect(copySourceId(subscriberCopy)).toBe(subscriber.id);

    const linkedPerson = await billing.fhir.get<Person>({ resourceType: 'Person', id: person.id! });
    expect(linkedPerson.link?.map((link) => link.target.reference)).toEqual([
      `Patient/${patient.id}`,
      copyRefs.patient,
    ]);

    const provenances = (
      await billing.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `Claim/${claimId}` }],
      })
    ).unbundle();
    expect(provenances).toHaveLength(1);
    expect(provenances[0].activity?.coding).toEqual([CLAIM_PROVENANCE_ACTIVITY.create]);
    expect(provenances[0].agent).toEqual([
      { type: { coding: [CLAIM_PROVENANCE_AGENT_TYPE.human] }, who: { reference: callerProfile } },
    ]);
  }, 90_000);
});
