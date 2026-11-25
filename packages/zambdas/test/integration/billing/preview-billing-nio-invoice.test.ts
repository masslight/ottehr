import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, FhirResource, Invoice, Location, Organization, Patient } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { claimNonInsurancePayerExtension } from 'utils/lib/fhir/billing';
import { CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM } from 'utils/lib/helpers/rcm/constants';
import { PreviewBillingNioInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('preview-billing-nio-invoice', () => {
  let oystehr: Oystehr;
  let oystehrBilling: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const nioName = `Integration NIO ${randomUUID().slice(0, 8)}`;
  let nioId: string;
  let claimIds: string[];

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

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/preview-billing-nio-invoice.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrTestUserM2M;
    oystehrBilling = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;

    nioId = await seed<Organization>({
      resourceType: 'Organization',
      active: true,
      name: nioName,
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
      name: [{ family: 'Pruitt', given: ['Jordan'] }],
      birthDate: '1990-01-01',
    });
    claimIds = [
      await seedClaim(patientId, providerId, facilityId, 180),
      await seedClaim(patientId, providerId, facilityId, 95),
    ];
  }, 120_000);

  afterAll(async () => {
    try {
      if (seededDeletes.length > 0) await oystehrBilling.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  it('renders a PDF for the claims addressed to their non-insurance payer without saving an invoice', async () => {
    const response = (await oystehr.zambda.execute({ id: 'preview-billing-nio-invoice', claimIds }))
      .output as unknown as PreviewBillingNioInvoiceResponse;

    expect(response.recipient).toEqual({ id: nioId, name: nioName });
    const pdf = Buffer.from(response.pdfBase64, 'base64');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1000);

    const invoices = (
      await oystehrBilling.fhir.search<Invoice>({
        resourceType: 'Invoice',
        params: [{ name: 'recipient', value: `Organization/${nioId}` }],
      })
    ).unbundle();
    expect(invoices).toEqual([]);
  }, 120_000);
});
