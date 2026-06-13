import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SECRETS } from '../data/secrets';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for radiology-pacs-webhook: AdvaPACS posts us a FHIR resource
// (ServiceRequest / DiagnosticReport / ImagingStudy). This exercises the
// ServiceRequest case: a webhook ServiceRequest carrying our order's accession
// number flips our matching order's status. The webhook is http_open and
// authenticated by a Bearer ADVAPACS_WEBHOOK_SECRET header, so it's invoked
// with a direct POST (the SDK can't set that header).
describe('radiology-pacs-webhook integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let orderServiceRequest: ServiceRequest;
  let executeUrl: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-pacs-webhook.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    executeUrl = inject('EXECUTE_ZAMBDA_URL');
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const icd = (await oystehrZambdas.zambda.execute({ id: 'icd-10-search', search: 'diabetes' })).output as {
      codes: Array<{ code: string }>;
    };
    const created = await oystehrZambdas.zambda.execute({
      id: 'radiology-create-order',
      encounterId: base.encounter.id,
      diagnosisCode: icd.codes[0].code,
      cptCode: '71045',
      stat: false,
      clinicalHistory: 'Integration test clinical history',
      consentObtained: false,
    });
    serviceRequestId = (created.output as { serviceRequestId: string }).serviceRequestId;
    orderServiceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
  }, 60_000);

  afterAll(async () => {
    for (const resourceType of ['ServiceRequest', 'Procedure', 'Task', 'DiagnosticReport'] as const) {
      try {
        const found = (
          await oystehrAdmin.fhir.search({
            resourceType,
            params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
          })
        ).unbundle();
        await Promise.all(found.map((r) => oystehrAdmin.fhir.delete({ resourceType, id: r.id! })));
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  it('processes a ServiceRequest webhook and updates the matching order', async () => {
    // Mimic the ServiceRequest AdvaPACS would post back: same accession
    // identifier as our order, now in a completed state.
    const webhookServiceRequest: ServiceRequest = {
      resourceType: 'ServiceRequest',
      // AdvaPACS includes its own resource id on the posted resource; the webhook
      // requires it to be present (it matches our order by accession number).
      id: 'advapacs-mock-service-request',
      status: 'completed',
      intent: 'order',
      subject: orderServiceRequest.subject,
      identifier: orderServiceRequest.identifier,
    };

    const response = await fetch(`${executeUrl}/zambda/radiology-pacs-webhook/execute-public`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRETS.ADVAPACS_WEBHOOK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookServiceRequest),
    });
    expect(response.status).toBe(200);

    const updated = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    expect(updated.status).toBe('completed');
  });
});
