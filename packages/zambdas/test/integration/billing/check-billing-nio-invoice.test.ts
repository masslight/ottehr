import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Invoice, Location, Organization, Patient } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { claimNonInsurancePayerExtension } from 'utils/lib/fhir/billing';
import { buildBillingInvoice } from 'utils/lib/fhir/billing-invoice';
import { CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM } from 'utils/lib/helpers/rcm/constants';
import { CheckBillingNioInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('check-billing-nio-invoice', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  let nioId: string;
  let readyClaimIds: string[];
  let invoicedClaimId: string;
  const patientFamily = `Nio${randomUUID().slice(0, 8)}`;

  const seed = async <T extends FhirResource>(resource: T): Promise<string> => {
    const created = await oystehrBilling.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created.id!;
  };

  const seedClaim = (patientId: string, providerId: string, facilityId: string, billed: number): Promise<string> =>
    seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      created: '2026-09-14',
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Self-pay' } }],
      patient: { reference: `Patient/${patientId}` },
      provider: { reference: `Organization/${providerId}` },
      facility: { reference: `Location/${facilityId}` },
      total: { value: billed, currency: 'USD' },
      item: [{ sequence: 1, productOrService: { text: 'Office visit' }, servicedDate: '2026-09-14' }],
      extension: [claimNonInsurancePayerExtension({ reference: `Organization/${nioId}` })],
      meta: {
        tag: [
          ...claimStatusValuesToTags({
            arStage: AR_STAGE.nonInsurancePayer,
            nonInsuranceArStatus: 'ready-to-invoice',
          }),
          { system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM, code: 'office-visit' },
        ],
      },
    });

  const check = async (claimIds: string[]): Promise<CheckBillingNioInvoiceResponse> =>
    (await oystehr.zambda.execute({ id: 'check-billing-nio-invoice', claimIds }))
      .output as unknown as CheckBillingNioInvoiceResponse;

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/check-billing-nio-invoice.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;

    nioId = await seed<Organization>({
      resourceType: 'Organization',
      active: true,
      name: 'Integration NIO',
      address: [{ line: ['4820 Commerce Parkway'], city: 'Austin', state: 'TX', postalCode: '78744' }],
    });
    const providerId = await seed<Organization>({
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
      address: [{ line: ['2 Provider Way'] }],
    });
    const facilityId = await seed<Location>({
      resourceType: 'Location',
      name: 'Integration Clinic',
      address: { line: ['1 Clinic Way'] },
      managingOrganization: { reference: `Organization/${providerId}` },
      extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: `Location/${randomUUID()}` } }],
    });
    const patientId = await seed<Patient>({
      resourceType: 'Patient',
      active: true,
      name: [{ family: patientFamily, given: ['Jordan'] }],
      birthDate: '1990-01-01',
    });
    readyClaimIds = [
      await seedClaim(patientId, providerId, facilityId, 180),
      await seedClaim(patientId, providerId, facilityId, 95),
    ];
    invoicedClaimId = await seedClaim(patientId, providerId, facilityId, 60);
    await seed<Invoice>(
      buildBillingInvoice({
        status: 'issued',
        date: '2026-09-20T12:00:00Z',
        dueDate: '2026-10-20',
        recipient: { reference: `Organization/${nioId}` },
        claims: [{ claimId: invoicedClaimId, amountCents: 6000 }],
      })
    );
  }, 120_000);

  afterAll(async () => {
    try {
      if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it('reports ready claims of one non-insurance payer as invoiceable', async () => {
    expect(await check(readyClaimIds)).toEqual({ invoiceable: true });
  }, 120_000);

  it('names the patient of a claim that is already on an active invoice', async () => {
    const response = await check([readyClaimIds[0], invoicedClaimId]);

    expect(response).toEqual({
      invoiceable: false,
      reason: `${patientFamily}, Jordan (2026-09-14) is already on an invoice`,
    });
  }, 120_000);
});
