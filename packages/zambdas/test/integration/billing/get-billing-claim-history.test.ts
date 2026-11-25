import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Claim, FhirResource, Location, Organization, Practitioner, Provenance } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import { BillingPayerOption, SearchBillingPayersResponse } from 'utils/lib/types/data/billing/billing.types';
import { GetClaimHistoryResponse } from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { claimProvenanceRequest, humanClaimActor } from '../../../src/billing/provenance';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('get-billing-claim-history', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  const noteMessage = `Payer asked for records ${unique}`;
  const seeded: FhirResource[] = [];
  let payer: BillingPayerOption;
  let historian: Practitioner;
  let renderingMaster: Practitioner;
  let renderingCopy: Practitioner;
  let billingMaster: Organization;
  let billingCopy: Organization;
  let facilityMaster: Location;
  let facilityCopy: Location;
  let claim: Claim;
  let createEntry: Provenance;
  let noteEntry: Provenance;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const sourceExtension = (reference: string): NonNullable<Practitioner['extension']> => [
    { url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference } },
  ];

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-claim-history.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const payers = (await billing.zambda.execute({ id: 'search-billing-payers' }))
      .output as SearchBillingPayersResponse;
    payer = payers.payers.find((option) => option.name && option.payerId)!;

    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/Practitioner',
        resource: tagged<Practitioner>({
          resourceType: 'Practitioner',
          name: [{ family: 'Historian', given: ['Hank'] }],
        }),
      },
      {
        method: 'POST',
        url: '/Practitioner',
        fullUrl: 'urn:uuid:rendering-master',
        resource: tagged<Practitioner>({
          resourceType: 'Practitioner',
          name: [{ family: `Renderer${unique}`, given: ['Rita'] }],
        }),
      },
      {
        method: 'POST',
        url: '/Practitioner',
        resource: tagged<Practitioner>({
          resourceType: 'Practitioner',
          name: [{ family: `Renderer${unique}`, given: ['Rita'] }],
          extension: sourceExtension('urn:uuid:rendering-master'),
        }),
      },
      {
        method: 'POST',
        url: '/Organization',
        fullUrl: 'urn:uuid:billing-master',
        resource: tagged<Organization>({ resourceType: 'Organization', name: `History Billing Group ${unique}` }),
      },
      {
        method: 'POST',
        url: '/Organization',
        resource: tagged<Organization>({
          resourceType: 'Organization',
          name: `History Billing Group ${unique}`,
          extension: sourceExtension('urn:uuid:billing-master'),
        }),
      },
      {
        method: 'POST',
        url: '/Location',
        fullUrl: 'urn:uuid:facility-master',
        resource: tagged<Location>({ resourceType: 'Location', status: 'active', name: `History Clinic ${unique}` }),
      },
      {
        method: 'POST',
        url: '/Location',
        resource: tagged<Location>({
          resourceType: 'Location',
          status: 'active',
          name: `History Clinic ${unique}`,
          extension: sourceExtension('urn:uuid:facility-master'),
        }),
      },
    ];
    const created = (await billing.fhir.transaction<FhirResource>({ requests })).entry?.map((entry) => entry.resource);
    [historian, renderingMaster, renderingCopy, billingMaster, billingCopy, facilityMaster, facilityCopy] = created as [
      Practitioner,
      Practitioner,
      Practitioner,
      Organization,
      Organization,
      Location,
      Location,
    ];
    seeded.push(...(created as FhirResource[]));

    claim = await billing.fhir.create<Claim>(
      tagged<Claim>({
        resourceType: 'Claim',
        status: 'draft',
        use: 'claim',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        patient: { display: 'History Test Patient' },
        created: '2026-01-01',
        provider: { reference: `Organization/${billingCopy.id}` },
        facility: { reference: `Location/${facilityCopy.id}` },
        careTeam: [{ sequence: 1, provider: { reference: `Practitioner/${renderingCopy.id}` } }],
        insurer: { reference: getPayerUrl(payer.id) },
        priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
        insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      })
    );
    seeded.push(claim);

    const agent = humanClaimActor({ reference: `Practitioner/${historian.id}` });
    const claimReference = `Claim/${claim.id}`;
    [createEntry, noteEntry] = await Promise.all([
      billing.fhir.create<Provenance>(
        tagged(
          claimProvenanceRequest({
            targetReference: claimReference,
            claimReference,
            after: claim,
            agent,
            activity: 'create',
            recorded: '2026-01-01T10:00:00.000Z',
          })!.resource
        )
      ),
      billing.fhir.create<Provenance>(
        tagged(
          claimProvenanceRequest({
            targetReference: claimReference,
            claimReference,
            note: noteMessage,
            agent,
            activity: 'note',
            recorded: '2026-01-02T10:00:00.000Z',
          })!.resource
        )
      ),
    ]);
    seeded.push(createEntry, noteEntry);
  }, 90_000);

  afterAll(async () => {
    await admin.fhir
      .batch({
        requests: seeded
          .reverse()
          .map((resource) => ({ method: 'DELETE' as const, url: `${resource.resourceType}/${resource.id}` })),
      })
      .catch((error) => console.error('get-billing-claim-history cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('returns the history newest first with actors, notes and resolved provider, facility and payer names', async () => {
    const { entries } = (await billing.zambda.execute({ id: 'get-billing-claim-history', claimId: claim.id }))
      .output as GetClaimHistoryResponse;

    expect(entries.map((entry) => entry.id)).toEqual([noteEntry.id, createEntry.id]);
    const [note, creation] = entries;
    expect(note).toMatchObject({
      recorded: '2026-01-02T10:00:00.000Z',
      activity: 'Note',
      actor: { display: 'Historian, Hank', type: 'user' },
      message: noteMessage,
      changes: [],
    });
    expect(creation).toMatchObject({
      activity: 'Create Claim',
      actor: { display: 'Historian, Hank', type: 'user' },
    });
    expect(creation.changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'billingProvider',
          newValue: billingCopy.name,
          newRef: `Organization/${billingCopy.id}`,
          newLink: { screen: 'billing-providers', id: billingMaster.id },
        }),
        expect.objectContaining({
          field: 'renderingProvider',
          newValue: `Renderer${unique}, Rita`,
          newRef: `Practitioner/${renderingCopy.id}`,
          newLink: { screen: 'rendering-providers', id: renderingMaster.id },
        }),
        expect.objectContaining({
          field: 'facility',
          newValue: facilityCopy.name,
          newRef: `Location/${facilityCopy.id}`,
          newLink: { screen: 'service-facilities', id: facilityMaster.id },
        }),
        expect.objectContaining({
          field: 'payer',
          newValue: `${payer.name} (${payer.payerId})`,
          newRef: getPayerUrl(payer.id),
          newLink: null,
        }),
      ])
    );
  }, 60_000);
});
