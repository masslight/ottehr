import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import {
  Claim,
  ClaimResponse,
  Coverage,
  DocumentReference,
  FhirResource,
  Organization,
  Patient,
  PaymentReconciliation,
  Practitioner,
} from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { ManualEraHeader } from 'utils/lib/types/data/billing/billing.schemas';
import { EraDetailResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  CUSTOM_INSURANCE_ORG_ID_SYSTEM,
  CUSTOM_INSURANCE_ORG_KIND_CODE,
} from 'utils/lib/types/data/billing/custom-insurance-org.types';
import { NIO_ORGANIZATION_KIND_SYSTEM } from 'utils/lib/types/data/billing/non-insurance-org.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildManualClaimResponse,
  buildManualEraProvenance,
  buildManualPaymentReconciliation,
  ManualEraBillingProviderAndPayer,
} from '../../../src/billing/manual-era';
import { setTaxId } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('get-billing-era-detail', () => {
  let admin: Oystehr;
  let billing: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  const unique = randomUUID().slice(0, 8);
  let seeded: FhirResource[] = [];
  let payer: Organization;
  let billingProvider: Organization;
  let keyer: Practitioner;
  let claimPatient: Patient;
  let remittedPatient: Patient;
  let coverage: Coverage;
  let claim: Claim;
  let era: PaymentReconciliation;
  let matchedResponse: ClaimResponse;
  let unmatchedResponse: ClaimResponse;
  let attachment: DocumentReference;

  const tagged = <T extends FhirResource>(resource: T): T => addProcessIdMetaTagToResource(resource, processId) as T;
  const created = <T extends FhirResource>(resources: FhirResource[], resourceType: T['resourceType']): T[] =>
    resources.filter((resource): resource is T => resource.resourceType === resourceType);

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/get-billing-era-detail.test.ts',
      M2MClientMockType.provider
    );
    admin = setup.oystehr;
    billing = setup.oystehrBilling;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const provider: Organization = {
      resourceType: 'Organization',
      name: `ERA Billing Group ${unique}`,
      identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567893' }],
    };
    setTaxId(provider, '123456789');
    const parties = (
      await billing.fhir.transaction<FhirResource>({
        requests: [
          {
            method: 'POST',
            url: '/Organization',
            resource: tagged<Organization>({
              resourceType: 'Organization',
              name: `ERA Payer ${unique}`,
              type: [{ coding: [{ system: NIO_ORGANIZATION_KIND_SYSTEM, code: CUSTOM_INSURANCE_ORG_KIND_CODE }] }],
              identifier: [{ system: CUSTOM_INSURANCE_ORG_ID_SYSTEM, value: `OTR-${unique}` }],
            }),
          },
          { method: 'POST', url: '/Organization', resource: tagged(provider) },
          {
            method: 'POST',
            url: '/Practitioner',
            resource: tagged<Practitioner>({
              resourceType: 'Practitioner',
              name: [{ family: 'Keyer', given: ['Kim'] }],
            }),
          },
          {
            method: 'POST',
            url: '/Patient',
            fullUrl: 'urn:uuid:claim-patient',
            resource: tagged<Patient>({
              resourceType: 'Patient',
              name: [{ family: `Remitted${unique}`, given: ['Rae'] }],
              birthDate: '1990-05-05',
            }),
          },
          {
            method: 'POST',
            url: '/Coverage',
            fullUrl: 'urn:uuid:coverage',
            resource: tagged<Coverage>({
              resourceType: 'Coverage',
              status: 'active',
              subscriberId: `ERA-MEM-${unique}`,
              beneficiary: { reference: 'urn:uuid:claim-patient' },
              payor: [{ display: `ERA Payer ${unique}` }],
            }),
          },
          {
            method: 'POST',
            url: '/Claim',
            resource: tagged<Claim>({
              resourceType: 'Claim',
              // not active, so the ERA-match subscription (request.status=active) leaves the claim alone
              status: 'draft',
              use: 'claim',
              type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
              patient: { reference: 'urn:uuid:claim-patient' },
              created: '2026-03-01',
              provider: { display: 'Unknown' },
              priority: {
                coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }],
              },
              insurance: [{ sequence: 1, focal: true, coverage: { reference: 'urn:uuid:coverage' } }],
              item: [
                {
                  sequence: 1,
                  productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }] },
                  servicedPeriod: { start: '2026-03-01' },
                  net: { value: 120, currency: 'USD' },
                },
              ],
              total: { value: 120, currency: 'USD' },
            }),
          },
          {
            method: 'POST',
            url: '/Patient',
            resource: tagged<Patient>({
              resourceType: 'Patient',
              name: [{ family: `Unmatched${unique}`, given: ['Una'] }],
              birthDate: '1975-11-30',
            }),
          },
        ],
      })
    ).entry!.map((entry) => entry.resource!);
    [payer, billingProvider] = created<Organization>(parties, 'Organization');
    [keyer] = created<Practitioner>(parties, 'Practitioner');
    [claimPatient, remittedPatient] = created<Patient>(parties, 'Patient');
    [coverage] = created<Coverage>(parties, 'Coverage');
    [claim] = created<Claim>(parties, 'Claim');
    seeded.push(...parties);

    const header: ManualEraHeader = {
      payerId: payer.id!,
      billingProviderRef: `Organization/${billingProvider.id}`,
      checkNumber: `CHK-${unique}`,
      checkAmountCents: 9000,
      paymentMethod: 'CHK',
      remitDate: '2026-03-10',
      checkDate: '2026-03-09',
    };
    const billingProviderAndPayer: ManualEraBillingProviderAndPayer = {
      payer: { reference: `Organization/${payer.id}`, display: payer.name! },
      billingProvider: {
        reference: `Organization/${billingProvider.id}`,
        name: billingProvider.name!,
        npi: '1234567893',
        taxId: '123456789',
      },
    };
    const matched = buildManualClaimResponse({
      claim: {
        statusCode: '1',
        patientName: `Rae Remitted${unique}`,
        serviceLines: [
          {
            serviceDate: '2026-03-01',
            procedureCode: '99213',
            billedCents: 12000,
            allowedCents: 10000,
            paidCents: 8000,
            adjustments: [
              { groupCode: 'CO', reasonCode: '45', amountCents: 2000 },
              { groupCode: 'PR', reasonCode: '2', amountCents: 2000 },
            ],
            remarkCodes: [],
          },
        ],
      },
      header,
      billingProviderAndPayer,
      matchedClaim: { id: claim.id, patient: claim.patient, type: claim.type },
    });
    const unmatched: ClaimResponse = {
      ...buildManualClaimResponse({
        claim: {
          statusCode: '1',
          patientName: `Una Unmatched${unique}`,
          memberId: `UNM-${unique}`,
          serviceLines: [
            {
              serviceDate: '2026-02-20',
              procedureCode: '99212',
              billedCents: 8000,
              allowedCents: 1000,
              paidCents: 1000,
              adjustments: [{ groupCode: 'CO', reasonCode: '45', amountCents: 7000 }],
              remarkCodes: [],
            },
          ],
        },
        header,
        billingProviderAndPayer,
      }),
      patient: { reference: `Patient/${remittedPatient.id}` },
    };
    const requests: BatchInputRequest<FhirResource>[] = [
      {
        method: 'POST',
        url: '/PaymentReconciliation',
        fullUrl: 'urn:uuid:era',
        resource: tagged(
          buildManualPaymentReconciliation({
            header,
            billingProviderAndPayer,
            created: '2026-03-10T12:00:00.000Z',
            editedAt: '2026-03-10T12:00:00.000Z',
          })
        ),
      },
      { method: 'POST', url: '/ClaimResponse', fullUrl: 'urn:uuid:matched', resource: tagged(matched) },
      { method: 'POST', url: '/ClaimResponse', fullUrl: 'urn:uuid:unmatched', resource: tagged(unmatched) },
      {
        method: 'POST',
        url: '/Provenance',
        resource: tagged(
          buildManualEraProvenance({
            targets: ['urn:uuid:era', 'urn:uuid:matched', 'urn:uuid:unmatched'],
            agent: { reference: `Practitioner/${keyer.id}`, display: 'Kim Keyer' },
            recorded: '2026-03-10T12:00:00.000Z',
          })
        ),
      },
      {
        method: 'POST',
        url: '/DocumentReference',
        resource: tagged<DocumentReference>({
          resourceType: 'DocumentReference',
          status: 'current',
          date: '2026-03-10T12:05:00.000Z',
          content: [
            {
              attachment: {
                title: 'remit-scan.pdf',
                contentType: 'application/pdf',
                url: 'https://example.com/remit-scan.pdf',
              },
            },
          ],
          context: { related: [{ reference: 'urn:uuid:era' }] },
        }),
      },
    ];
    const eraResources = (await billing.fhir.transaction<FhirResource>({ requests })).entry!.map(
      (entry) => entry.resource!
    );
    [era] = created<PaymentReconciliation>(eraResources, 'PaymentReconciliation');
    [matchedResponse, unmatchedResponse] = created<ClaimResponse>(eraResources, 'ClaimResponse');
    [attachment] = created<DocumentReference>(eraResources, 'DocumentReference');
    seeded = [...seeded, ...eraResources];
  }, 90_000);

  afterAll(async () => {
    await admin.fhir
      .batch({
        requests: seeded
          .reverse()
          .map((resource) => ({ method: 'DELETE' as const, url: `${resource.resourceType}/${resource.id}` })),
      })
      .catch((error) => console.error('get-billing-era-detail cleanup failed:', error));
    await cleanup();
  }, 60_000);

  it('returns the ERA with its payer, payee, matched and unmatched claims, attachments and manual entry', async () => {
    const detail = (await billing.zambda.execute({ id: 'get-billing-era-detail', eraId: era.id }))
      .output as EraDetailResponse;

    expect(detail).toMatchObject({
      id: era.id,
      source: 'manual',
      status: 'active',
      versionId: era.meta?.versionId,
      checkNumber: `CHK-${unique}`,
      checkDate: '2026-03-09',
      checkAmount: 90,
      paymentMethod: 'CHK',
      payerName: payer.name,
      payerFhirId: payer.id,
      payee: { name: billingProvider.name, npi: '1234567893', taxId: '123456789' },
      totalClaims: 2,
      matchedClaims: 1,
      unmatchedClaims: 1,
    });
    expect(detail.claims).toHaveLength(2);
    expect(detail.claims[0]).toMatchObject({
      claimId: claim.id,
      patientName: `Remitted${unique}, Rae`,
      patientDob: claimPatient.birthDate,
      dos: '2026-03-01',
      billed: 120,
      allowed: 100,
      paid: 80,
      patientResp: 20,
      memberId: coverage.subscriberId,
      matched: true,
      claimResponseIds: [matchedResponse.id],
    });
    expect(detail.claims[1]).toMatchObject({
      claimId: `unmatched-${unmatchedResponse.id}`,
      patientName: `Unmatched${unique}, Una`,
      patientDob: remittedPatient.birthDate,
      billed: 80,
      paid: 10,
      memberId: `UNM-${unique}`,
      matched: false,
      claimResponseIds: [unmatchedResponse.id],
    });
    expect(detail.attachments).toEqual([
      {
        id: attachment.id,
        fileName: 'remit-scan.pdf',
        contentType: 'application/pdf',
        dateAdded: '2026-03-10T12:05:00.000Z',
      },
    ]);
    expect(detail.manualEntry).toMatchObject({
      header: { payerId: payer.id, checkNumber: `CHK-${unique}`, checkAmountCents: 9000 },
      enteredBy: 'Kim Keyer',
      enteredAt: '2026-03-10T12:00:00.000Z',
    });
    expect(detail.manualEntry?.claims.map((entry) => entry.matchedClaimId)).toEqual(
      expect.arrayContaining([claim.id, null])
    );
  }, 60_000);
});
