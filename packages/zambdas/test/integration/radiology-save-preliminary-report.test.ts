import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, ServiceRequest, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM, encodeRadiologyReport } from 'utils/lib/fhir/radiology';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { RADIOLOGY_TASK } from 'utils/lib/types/data/tasks/types';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { SECRETS } from '../data/secrets';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// radiology-save-preliminary-report: create a radiology order, then exercise the endpoint's preconditions
// and its happy path. AdvaPACS calls are mocked by the global setup. Created radiology resources are
// removed afterwards.
describe('radiology-save-preliminary-report integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let orderingPractitionerId: string;
  let cleanup: () => Promise<void>;

  // What the PACS webhook does in production once the study has been performed. Idempotent.
  const markPerformed = async (): Promise<void> => {
    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-save-preliminary-report.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
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
    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    orderingPractitionerId = getIdFromReference(serviceRequest.requester?.reference) as string;
  }, 60_000);

  afterAll(async () => {
    const resourceTypes = ['ServiceRequest', 'Procedure', 'Task', 'DiagnosticReport'] as const;
    const foundByType = await Promise.all(
      resourceTypes.map(async (resourceType) => {
        try {
          return (
            await oystehrAdmin.fhir.search({
              resourceType,
              params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
            })
          ).unbundle();
        } catch {
          return undefined;
        }
      })
    );
    for (const [index, resourceType] of resourceTypes.entries()) {
      try {
        const found = foundByType[index];
        if (!found) continue;
        await Promise.all(found.map((r) => oystehrAdmin.fhir.delete({ resourceType, id: r.id! })));
      } catch {
        // best-effort
      }
    }
    await cleanup();
  });

  // Runs before the study is marked performed, so it must come first.
  it('rejects a preliminary report on an order that has not been performed', async () => {
    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-save-preliminary-report',
        serviceRequestId,
        report: 'Integration test preliminary report',
        diagnosisCodes: ['E11.9'],
      })
    ).rejects.toThrow();
  });

  it('rejects a performedById that is not a Practitioner', async () => {
    await markPerformed();
    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-save-preliminary-report',
        serviceRequestId,
        report: 'Integration test preliminary report',
        diagnosisCodes: ['E11.9'],
        performedById: '00000000-0000-0000-0000-000000000000',
      })
    ).rejects.toThrow();

    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    expect(serviceRequest.performer).toBeUndefined();
  });

  // The endpoint rejects a second report on the same order, so the happy path is exercised once and
  // asserts on both of the things it records: the diagnosis and the performer.
  it('saves a preliminary radiology report, its diagnosis and the performer', async () => {
    await markPerformed();
    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId,
      report: 'Integration test preliminary report',
      diagnosisCodes: ['E11.9'],
      performedById: orderingPractitionerId,
    });
    expect(response.output).toBeDefined();

    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    expect(serviceRequest.reasonCode?.flatMap((reason) => reason.coding?.map((coding) => coding.code) ?? [])).toEqual([
      'E11.9',
    ]);
    expect(serviceRequest.performer?.map((ref) => ref.reference)).toEqual([`Practitioner/${orderingPractitionerId}`]);
  });

  // A second order is used because an order accepts only one preliminary report.
  it('saves a preliminary radiology report without a diagnosis', async () => {
    const created = await oystehrZambdas.zambda.execute({
      id: 'radiology-create-order',
      encounterId: base.encounter.id,
      cptCode: '71045',
      stat: false,
      clinicalHistory: 'Integration test clinical history',
      consentObtained: false,
    });
    const noDxServiceRequestId = (created.output as { serviceRequestId: string }).serviceRequestId;
    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: noDxServiceRequestId,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });

    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId: noDxServiceRequestId,
      report: 'Integration test preliminary report',
    });
    expect(response.output).toBeDefined();

    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: noDxServiceRequestId,
    });
    expect(serviceRequest.reasonCode).toBeUndefined();
  });
});

describe('radiology-save-preliminary-report integration — mark as final', () => {
  const READ = 'Integration test read marked as final';

  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let cleanup: () => Promise<void>;

  const reportsForOrder = async (): Promise<DiagnosticReport[]> =>
    (
      await oystehrAdmin.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest(
      'radiology-save-preliminary-report-mark-as-final.test.ts',
      M2MClientMockType.provider
    );
    oystehrAdmin = setup.oystehr;
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const created = await oystehrZambdas.zambda.execute({
      id: 'radiology-create-order',
      encounterId: base.encounter.id,
      diagnosisCodes: ['E11.9'],
      cptCode: '71045',
      stat: false,
      clinicalHistory: 'Integration test clinical history',
      consentObtained: false,
    });
    serviceRequestId = (created.output as { serviceRequestId: string }).serviceRequestId;
    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId,
      report: READ,
      diagnosisCodes: ['E11.9'],
      markAsFinal: true,
    });
  }, 60_000);

  afterAll(async () => {
    const resourceTypes = ['ServiceRequest', 'Procedure', 'Task', 'DiagnosticReport'] as const;
    const foundByType = await Promise.all(
      resourceTypes.map(async (resourceType) => {
        try {
          return (
            await oystehrAdmin.fhir.search({
              resourceType,
              params: [{ name: 'encounter', value: `Encounter/${base.encounter.id}` }],
            })
          ).unbundle();
        } catch {
          return undefined;
        }
      })
    );
    for (const [index, resourceType] of resourceTypes.entries()) {
      try {
        const found = foundByType[index];
        if (!found) continue;
        await Promise.all(found.map((r) => oystehrAdmin.fhir.delete({ resourceType, id: r.id! })));
      } catch {
        // best-effort
      }
    }
    try {
      const reports = await reportsForOrder();
      await Promise.all(reports.map((r) => oystehrAdmin.fhir.delete({ resourceType: 'DiagnosticReport', id: r.id! })));
    } catch {
      // best-effort
    }
    await cleanup();
  });

  it('saves the read as the final read, keeping it as the preliminary read and assigning the review to its author', async () => {
    const reports = await reportsForOrder();
    const final = reports.find((r) => r.status === 'final');
    const preliminary = reports.find((r) => r.status === 'preliminary');
    expect(reports).toHaveLength(2);
    expect(final?.presentedForm?.[0]?.data).toBe(encodeRadiologyReport(READ));
    expect(preliminary?.presentedForm?.[0]?.data).toBe(encodeRadiologyReport(READ));
    expect(final?.issued).toBeDefined();
    const author = final?.performer?.[0]?.reference;
    expect(author).toMatch(/^Practitioner\//);
    expect(preliminary?.performer?.[0]?.reference).toBe(author);

    const reviewTasks = (
      await oystehrAdmin.fhir.search<Task>({
        resourceType: 'Task',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    )
      .unbundle()
      .filter((task) => task.code?.coding?.some((coding) => coding.code === RADIOLOGY_TASK.code.reviewFinalResultTask));
    expect(reviewTasks).toHaveLength(1);
    expect(reviewTasks[0].status).toBe('ready');
    expect(reviewTasks[0].owner?.reference).toBe(author);
  });

  it('keeps the read final when AdvaPACS calls back afterwards with its preliminary copy', async () => {
    const final = (await reportsForOrder()).find((r) => r.status === 'final');
    const advapacsId = final?.identifier?.find((i) => i.system === ADVAPACS_FHIR_RESOURCE_ID_CODE_SYSTEM)?.value;
    expect(advapacsId).toBeDefined();

    const response = await fetch(`${inject('EXECUTE_ZAMBDA_URL')}/zambda/radiology-pacs-webhook/execute-public`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRETS.ADVAPACS_WEBHOOK_SECRET}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resourceType: 'DiagnosticReport',
        id: advapacsId,
        status: 'preliminary',
        code: { coding: [{ system: 'http://loinc.org', code: '18748-4', display: 'Diagnostic imaging study' }] },
        presentedForm: [{ contentType: 'text/html', data: encodeRadiologyReport(READ) }],
      }),
    });
    expect(response.status).toBe(200);

    const after = await oystehrAdmin.fhir.get<DiagnosticReport>({ resourceType: 'DiagnosticReport', id: final!.id! });
    expect(after.status).toBe('final');
    expect(after.performer?.[0]?.reference).toBe(final?.performer?.[0]?.reference);
  });
});
