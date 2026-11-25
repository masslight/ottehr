import { randomUUID } from 'node:crypto';
import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Claim, ClaimResponse, FhirResource, Organization, Patient, Provenance } from 'fhir/r4b';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { setNpi } from 'utils/lib/fhir/helpers';
import { CreateTimelyFilingReportResponse } from 'utils/lib/types/data/billing/billing.types';
import {
  CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL,
  CLAIM_PROVENANCE_ACTIVITY,
  CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL,
  ClaimAcknowledgmentEvent,
  ClaimTransmitEvent,
} from 'utils/lib/types/data/billing/claim-history';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildCustomInsuranceOrganization } from '../../../src/billing/custom-insurance-org.helpers';
import { CLAIM_PCN_IDENTIFIER_SYSTEM, ERA_ICN_EXTENSION } from '../../../src/billing/shared';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../../helpers/integration-test-seed-data-setup';

const pdfText = async (pdfBase64: string): Promise<string> => {
  const pdf = await getDocument({ data: new Uint8Array(Buffer.from(pdfBase64, 'base64')) }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join(' ').replace(/\s+/g, ' ');
};

describe('create-timely-filing-report', () => {
  let billing: Oystehr;
  let caller: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;
  const deletes: BatchInputDeleteRequest[] = [];
  const unique = randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase();
  const patientFamily = `Quill${unique}`;
  const billingProviderName = `Group${unique}`;
  const payerName = `Payer${unique}`;
  const pcn = `PCN${unique}`;
  const batchId = `B${unique}`;
  const acknowledgmentMessage = `Accepted${unique}`;
  const eraIcn = `ICN${unique}`;
  let claimId: string;

  const seed = async <T extends FhirResource>(resource: T): Promise<T & { id: string }> => {
    const created = await billing.fhir.create<T>(addProcessIdMetaTagToResource(resource, processId) as T);
    deletes.unshift({ method: 'DELETE', url: `${created.resourceType}/${created.id}` });
    return created as T & { id: string };
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'integration/billing/create-timely-filing-report.test.ts',
      M2MClientMockType.provider
    );
    billing = setup.oystehrBilling;
    caller = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;

    const billingProvider: Organization = { resourceType: 'Organization', name: billingProviderName };
    setNpi(billingProvider, '1234567893');
    const [patient, provider, payer] = await Promise.all([
      seed<Patient>({ resourceType: 'Patient', name: [{ given: ['Zephyr'], family: patientFamily }] }),
      seed<Organization>(billingProvider),
      seed<Organization>(
        buildCustomInsuranceOrganization({
          orgId: `OTR-${unique}`,
          name: payerName,
          insuranceTypes: ['medical'],
          submissionMechanism: 'mail',
          acceptedClaimForm: 'cms-1500',
        })
      ),
    ]);
    const claim = await seed<Claim>({
      resourceType: 'Claim',
      status: 'active',
      use: 'claim',
      type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
      identifier: [{ system: CLAIM_PCN_IDENTIFIER_SYSTEM, value: pcn }],
      patient: { reference: `Patient/${patient.id}` },
      created: '2026-08-05',
      provider: { reference: `Organization/${provider.id}` },
      insurer: { reference: `Organization/${payer.id}` },
      priority: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/processpriority', code: 'normal' }] },
      insurance: [{ sequence: 1, focal: true, coverage: { display: 'Integration Coverage' } }],
      item: [
        {
          sequence: 1,
          productOrService: { coding: [{ system: 'http://www.ama-assn.org/go/cpt', code: '99213' }] },
          servicedDate: '2026-08-05',
        },
      ],
      total: { value: 627, currency: 'USD' },
    });
    claimId = claim.id;

    const acknowledgment: ClaimAcknowledgmentEvent = {
      source: 'claimmd',
      entityName: 'Clearinghouse',
      entityKind: 'clearinghouse',
      message: acknowledgmentMessage,
      responseId: `id:${unique}`,
      eventTime: '2026-08-05T15:02:00.000Z',
    };
    const transmit: ClaimTransmitEvent = { transmittedAt: '2026-08-05T11:53:00.000Z', batchId };
    await Promise.all([
      seed<Provenance>({
        resourceType: 'Provenance',
        target: [{ reference: `Claim/${claimId}` }],
        recorded: acknowledgment.eventTime,
        activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.acknowledgment] },
        agent: [{ who: { display: 'Clearinghouse' } }],
        extension: [
          { url: CLAIM_PROVENANCE_ACKNOWLEDGMENT_EXTENSION_URL, valueString: JSON.stringify(acknowledgment) },
        ],
      }),
      seed<Provenance>({
        resourceType: 'Provenance',
        target: [{ reference: `Claim/${claimId}` }],
        recorded: transmit.transmittedAt,
        activity: { coding: [CLAIM_PROVENANCE_ACTIVITY.submit] },
        agent: [{ who: { display: 'Rules engine' } }],
        extension: [{ url: CLAIM_PROVENANCE_TRANSMIT_EXTENSION_URL, valueString: JSON.stringify(transmit) }],
      }),
      seed<ClaimResponse>({
        resourceType: 'ClaimResponse',
        status: 'active',
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/claim-type', code: 'professional' }] },
        use: 'claim',
        patient: { reference: `Patient/${patient.id}` },
        created: '2026-09-01',
        insurer: { reference: `Organization/${payer.id}` },
        request: { reference: `Claim/${claimId}` },
        outcome: 'complete',
        extension: [{ url: ERA_ICN_EXTENSION, valueString: eraIcn }],
      }),
    ]);
  }, 120_000);

  afterAll(async () => {
    await billing.fhir.batch({ requests: deletes });
    await cleanup();
  }, 120_000);

  it("renders the claim's timely filing report from its graph, payer, history and remits", async () => {
    const output = (await caller.zambda.execute({ id: 'create-timely-filing-report', claimId }))
      .output as CreateTimelyFilingReportResponse;

    expect(output.fileName).toMatch(new RegExp(`^Timely_Filing_Report_${pcn}_\\d{8}_\\d{6}\\.pdf$`));
    const text = await pdfText(output.pdfBase64);
    expect(text).toContain(patientFamily);
    expect(text).toContain(billingProviderName);
    expect(text).toContain('1234567893');
    expect(text).toContain(payerName);
    expect(text).toContain(acknowledgmentMessage);
    expect(text).toContain(batchId);
    expect(text).toContain(eraIcn);
  }, 60_000);
});
