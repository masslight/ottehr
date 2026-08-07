import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, ServiceRequest } from 'fhir/r4b';
import { ACCESSION_NUMBER_CODE_SYSTEM, ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM, M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SECRETS } from '../data/secrets';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy paths for radiology-pacs-webhook: AdvaPACS posts us a FHIR resource of
// one of three kinds — ServiceRequest, DiagnosticReport, ImagingStudy. The
// webhook is http_open and authed by a Bearer ADVAPACS_WEBHOOK_SECRET header, so
// it's invoked with a direct POST (the SDK can't set that header). AdvaPACS
// callbacks are mocked by the global setup. One radiology order is created in
// setup and reused; created radiology resources are removed afterwards.
describe('radiology-pacs-webhook integration — happy paths', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let orderServiceRequest: ServiceRequest;
  let executeUrl: string;
  let cleanup: () => Promise<void>;

  const postWebhook = (resource: unknown): Promise<Response> =>
    fetch(`${executeUrl}/zambda/radiology-pacs-webhook/execute-public`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SECRETS.ADVAPACS_WEBHOOK_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resource),
    });

  const accessionNumber = (): string =>
    orderServiceRequest.identifier?.find((i) => i.system === ACCESSION_NUMBER_CODE_SYSTEM)?.value as string;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-pacs-webhook.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    executeUrl = inject('EXECUTE_ZAMBDA_URL');
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const created = await oystehrZambdas.zambda.execute({
      id: 'radiology-create-order',
      encounterId: base.encounter.id,
      // icd-10-search zambda was removed; pass a valid ICD-10 code directly. radiology-create-order
      // still validates it via searchIcd10Codes, which returns exactly one match for E11.9.
      diagnosisCodes: ['E11.9'],
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

  it('ServiceRequest webhook updates the matching order status', async () => {
    const webhookServiceRequest: ServiceRequest = {
      resourceType: 'ServiceRequest',
      // AdvaPACS includes its own resource id on the posted resource (required).
      id: 'advapacs-mock-service-request',
      status: 'completed',
      intent: 'order',
      subject: orderServiceRequest.subject,
      identifier: orderServiceRequest.identifier,
    };
    const response = await postWebhook(webhookServiceRequest);
    expect(response.status).toBe(200);

    const updated = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    expect(updated.status).toBe('completed');
  });

  it('DiagnosticReport webhook finalizes our matching DiagnosticReport', async () => {
    // Seed our DiagnosticReport (created from the mocked AdvaPACS report, whose id
    // is now unique per mock invocation). Read back the AdvaPACS-resource-id
    // identifier our local DR carries so the webhook DR can reuse that exact id —
    // this keeps the test parallel-safe (no shared identifier across radiology tests).
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId,
      report: 'Integration test preliminary report',
      // Diagnosis is required when saving a preliminary read (it is optional at order time).
      diagnosisCodes: ['E11.9'],
    });
    const seededReports = (
      await oystehrAdmin.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();
    const advapacsId = seededReports
      .flatMap((r) => r.identifier ?? [])
      .find((i) => i.system === ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM)?.value;
    expect(advapacsId).toBeDefined();
    const webhookDiagnosticReport: DiagnosticReport = {
      resourceType: 'DiagnosticReport',
      id: advapacsId,
      status: 'final',
      code: { coding: [{ system: 'http://loinc.org', code: '18748-4', display: 'Diagnostic imaging study' }] },
      presentedForm: [
        { contentType: 'text/html', data: Buffer.from('Final report body').toString('base64'), title: 'Final report' },
      ],
      issued: '2026-06-13T12:00:00.000Z',
    } as DiagnosticReport;

    const response = await postWebhook(webhookDiagnosticReport);
    expect(response.status).toBe(200);

    const reports = (
      await oystehrAdmin.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();
    expect(reports.some((r) => r.status === 'final')).toBe(true);
  });

  it('ImagingStudy webhook is accepted and marks the study complete', async () => {
    // handleImagingStudy reads the accession number and marks the order complete
    // in AdvaPACS (mocked) — no local FHIR write, so a 200 is the happy path.
    const webhookImagingStudy = {
      resourceType: 'ImagingStudy',
      id: 'advapacs-mock-imaging-study',
      status: 'available',
      subject: orderServiceRequest.subject,
      identifier: [{ system: ACCESSION_NUMBER_CODE_SYSTEM, value: accessionNumber() }],
    };
    const response = await postWebhook(webhookImagingStudy);
    expect(response.status).toBe(200);
  });
});
