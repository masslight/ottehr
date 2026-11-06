import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Basic, Claim, DocumentReference, FhirResource, Invoice, Location, Organization, Patient } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { claimNonInsurancePayerExtension } from 'utils/lib/fhir/billing';
import { getBillingInvoiceClaims, getInvoiceNumber } from 'utils/lib/fhir/billing-invoice';
import { CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM } from 'utils/lib/helpers/rcm/constants';
import { CreateBillingNioInvoiceInput } from 'utils/lib/types/data/billing/billing.schemas';
import { CreateBillingNioInvoiceResponse } from 'utils/lib/types/data/billing/billing.types';
import { AR_STAGE, claimStatusValuesToTags } from 'utils/lib/types/data/billing/claim-status';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  deleteAttachmentObject,
  invoiceAttachmentOwner,
  ownedAttachmentLocation,
} from '../../../src/billing/attachments';
import { INVOICE_NUMBER_COUNTER_KEY } from '../../../src/billing/invoice-number';
import { SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import { FHIR_COUNTER_CODE_SYSTEM, FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL } from '../../../src/shared/fhir-counter';
import { SECRETS } from '../../data/secrets';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

describe('create-billing-nio-invoice', () => {
  let oystehr: Oystehr;
  let cleanup: () => Promise<void>;
  let processId: string;

  const seededDeletes: BatchInputDeleteRequest[] = [];
  const createdInvoiceIds = new Set<string>();
  let nioId: string;
  let claimIds: string[];

  const seed = async <T extends FhirResource>(resource: T): Promise<string> => {
    const created = await oystehr.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    seededDeletes.push({
      method: 'DELETE',
      url: `${created.resourceType}/${created.id}`,
    });
    return created.id!;
  };

  const seedClaim = (patientId: string, providerId: string, facilityId: string, billed: number): Promise<string> =>
    seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: 'professional',
          },
        ],
      },
      created: '2026-09-14',
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
      patient: {
        reference: `Patient/${patientId}`,
      },
      provider: {
        reference: `Organization/${providerId}`,
      },
      facility: {
        reference: `Location/${facilityId}`,
      },
      total: {
        value: billed,
        currency: 'USD',
      },
      item: [
        {
          sequence: 1,
          productOrService: {
            text: 'Office visit',
          },
          servicedDate: '2026-09-14',
        },
      ],
      extension: [
        claimNonInsurancePayerExtension({
          reference: `Organization/${nioId}`,
        }),
      ],
      meta: {
        tag: [
          ...claimStatusValuesToTags({
            arStage: AR_STAGE.nonInsurancePayer,
            nonInsuranceArStatus: 'ready-to-invoice',
          }),
          {
            system: CODE_SYSTEM_SERVICE_CATEGORY_TAG_SYSTEM,
            code: 'office-visit',
          },
        ],
      },
    });

  const create = async (input: CreateBillingNioInvoiceInput): Promise<CreateBillingNioInvoiceResponse> => {
    const response = (
      await oystehr.zambda.execute({
        id: 'create-billing-nio-invoice',
        ...input,
      })
    ).output as unknown as CreateBillingNioInvoiceResponse;
    createdInvoiceIds.add(response.invoiceId);
    return response;
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/create-billing-nio-invoice.test.ts',
      M2MClientMockType.provider
    );
    oystehr = setup.oystehrBilling;
    cleanup = setup.cleanup;
    processId = setup.processId;

    nioId = await seed<Organization>({
      resourceType: 'Organization',
      active: true,
      name: 'Integration NIO',
      address: [
        {
          line: ['4820 Commerce Parkway'],
          city: 'Austin',
          state: 'TX',
          postalCode: '78744',
        },
      ],
    });
    const providerId = await seed<Organization>({
      resourceType: 'Organization',
      active: true,
      name: 'Integration Medical Group',
      address: [
        {
          line: ['2 Provider Way'],
        },
      ],
    });
    const facilityId = await seed<Location>({
      resourceType: 'Location',
      name: 'Integration Clinic',
      address: {
        line: ['1 Clinic Way'],
      },
      managingOrganization: {
        reference: `Organization/${providerId}`,
      },
      extension: [
        {
          url: SOURCE_IDENTIFIER_SYSTEM,
          valueReference: {
            reference: `Location/${randomUUID()}`,
          },
        },
      ],
    });
    const patientId = await seed<Patient>({
      resourceType: 'Patient',
      active: true,
      name: [
        {
          family: 'Pruitt',
          given: ['Jordan'],
        },
      ],
      birthDate: '1990-01-01',
    });
    claimIds = [
      await seedClaim(patientId, providerId, facilityId, 180),
      await seedClaim(patientId, providerId, facilityId, 95),
    ];
  }, 120_000);

  afterAll(async () => {
    for (const invoiceId of createdInvoiceIds) {
      try {
        const documentReferences = (
          await oystehr.fhir.search<DocumentReference>({
            resourceType: 'DocumentReference',
            params: [
              {
                name: 'related',
                value: `Invoice/${invoiceId}`,
              },
            ],
          })
        ).unbundle();
        for (const documentReference of documentReferences) {
          await deleteAttachmentObject(
            oystehr,
            ownedAttachmentLocation(documentReference, invoiceAttachmentOwner(invoiceId, SECRETS))
          );
          await oystehr.fhir.delete({
            resourceType: 'DocumentReference',
            id: documentReference.id!,
          });
        }
        await oystehr.fhir.delete({
          resourceType: 'Invoice',
          id: invoiceId,
        });
      } catch (error) {
        console.error(`Failed to clean up invoice ${invoiceId}:`, error);
      }
    }
    try {
      if (seededDeletes.length > 0) await oystehr.fhir.batch({ requests: seededDeletes });
    } catch (error) {
      console.error('Failed to clean up seeded fixtures; the run-tag sweep will retry:', error);
    }
    await cleanup();
  }, 120_000);

  let first: CreateBillingNioInvoiceResponse;
  const idempotencyKey = randomUUID();

  const lastIssuedProjectInvoiceNumber = async (): Promise<number | undefined> => {
    const [counter] = (
      await oystehr.fhir.search<Basic>({
        resourceType: 'Basic',
        params: [
          {
            name: 'code',
            value: `${FHIR_COUNTER_CODE_SYSTEM}|${INVOICE_NUMBER_COUNTER_KEY}`,
          },
        ],
      })
    ).unbundle();
    return counter?.extension?.find((ext) => ext.url === FHIR_COUNTER_LAST_ISSUED_EXTENSION_URL)?.valueInteger;
  };

  it('creates one numbered invoice for the claims and returns its PDF', async () => {
    const projectNumberBefore = await lastIssuedProjectInvoiceNumber();

    first = await create({
      claimIds,
      idempotencyKey,
    });

    expect(first.invoiceNumber).toMatch(/^INV-\d{5,}$/);
    expect(await lastIssuedProjectInvoiceNumber()).toBe(projectNumberBefore);
    const invoice = await oystehr.fhir.get<Invoice>({
      resourceType: 'Invoice',
      id: first.invoiceId,
    });
    expect(getInvoiceNumber(invoice)).toBe(first.invoiceNumber);
    expect(invoice.status).toBe('issued');
    expect(invoice.recipient?.reference).toBe(`Organization/${nioId}`);
    expect(getBillingInvoiceClaims(invoice)).toEqual([
      {
        claimId: claimIds[0],
        amountCents: 18000,
      },
      {
        claimId: claimIds[1],
        amountCents: 9500,
      },
    ]);

    const pdf = await fetch(first.pdfUrl);
    expect(pdf.ok).toBe(true);
    expect(
      Buffer.from(await pdf.arrayBuffer())
        .subarray(0, 4)
        .toString()
    ).toBe('%PDF');
  }, 120_000);

  it('returns the same invoice when retried with the same idempotency key', async () => {
    const retry = await create({
      claimIds,
      idempotencyKey,
    });

    expect(retry.invoiceId).toBe(first.invoiceId);
    expect(retry.invoiceNumber).toBe(first.invoiceNumber);
  }, 120_000);

  it('refuses claims that are already on an invoice', async () => {
    await expect(
      create({
        claimIds: [claimIds[1]],
        idempotencyKey: randomUUID(),
      })
    ).rejects.toThrow(/already on an invoice/);
  }, 120_000);
});
