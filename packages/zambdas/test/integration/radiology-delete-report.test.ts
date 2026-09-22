import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('radiology-delete-report integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let cleanup: () => Promise<void>;

  const getReports = async (): Promise<DiagnosticReport[]> =>
    (
      await oystehrAdmin.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();

  const getServiceRequest = async (): Promise<ServiceRequest> =>
    oystehrAdmin.fhir.get<ServiceRequest>({ resourceType: 'ServiceRequest', id: serviceRequestId });

  const getOrder = async (): Promise<{ status: string; history?: { status: string }[] }> => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-order-list',
      encounterIds: [base.encounter.id],
      itemsPerPage: 100,
      pageIndex: 0,
    });
    const { orders } = response.output as { orders: { serviceRequestId: string; status: string }[] };
    const order = orders.find((candidate) => candidate.serviceRequestId === serviceRequestId);
    if (!order) throw new Error('expected the seeded radiology order to be listed');
    return order;
  };

  const savePreliminaryReport = async (report: string): Promise<void> => {
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId,
      report,
      diagnosisCodes: ['E11.9'],
    });
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-delete-report.test.ts', M2MClientMockType.provider);
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
    await savePreliminaryReport('Original preliminary report');
  }, 60_000);

  afterAll(async () => {
    for (const resourceType of ['ServiceRequest', 'Procedure', 'Task', 'DiagnosticReport', 'Provenance'] as const) {
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

  it('rejects a request to delete the final read', async () => {
    await expect(
      oystehrZambdas.zambda.execute({ id: 'radiology-delete-report', serviceRequestId, reportType: 'final' })
    ).rejects.toThrow();

    expect((await getReports()).some((report) => report.status === 'preliminary')).toBe(true);
  });

  it('deletes the preliminary read and returns the order to performed', async () => {
    expect((await getOrder()).status).toBe('preliminary');

    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-delete-report',
      serviceRequestId,
      reportType: 'preliminary',
    });
    expect(response.output).toBeDefined();

    expect(await getReports()).toHaveLength(0);
    expect((await getOrder()).status).toBe('performed');
  });

  it('records who deleted the read on a Provenance', async () => {
    const provenances = (
      await oystehrAdmin.fhir.search<Provenance>({
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();

    const deleteProvenance = provenances.find(
      (provenance) => provenance.activity?.coding?.some((coding) => coding.code === 'preliminary-read-deleted')
    );
    expect(deleteProvenance?.agent?.[0]?.who?.reference).toMatch(/^Practitioner\//);
  });

  it('accepts a new preliminary read afterwards', async () => {
    await savePreliminaryReport('Replacement preliminary report');

    expect((await getReports()).filter((report) => report.status === 'preliminary')).toHaveLength(1);
    expect((await getOrder()).status).toBe('preliminary');
  });

  it('also deletes the duplicates the PACS webhook retired, so a replacement read is still accepted', async () => {
    const preliminary = (await getReports()).find((report) => report.status === 'preliminary');
    if (!preliminary?.id) throw new Error('expected a preliminary read to be present');

    const retiredDuplicate = await oystehrAdmin.fhir.create<DiagnosticReport>({
      ...preliminary,
      id: undefined,
      meta: undefined,
      status: 'entered-in-error',
    });

    await oystehrZambdas.zambda.execute({
      id: 'radiology-delete-report',
      serviceRequestId,
      reportType: 'preliminary',
    });

    const remaining = await getReports();
    expect(remaining.map((report) => report.id)).not.toContain(retiredDuplicate.id);
    expect(remaining).toHaveLength(0);

    await savePreliminaryReport('Preliminary read written after the retired duplicate was cleared');
    expect((await getReports()).filter((report) => report.status === 'preliminary')).toHaveLength(1);
  });

  it('strips the teleradiology extensions when deleting from pending final', async () => {
    await oystehrZambdas.zambda.execute({ id: 'radiology-send-for-final-read', serviceRequestId });
    expect((await getOrder()).status).toBe('pending final');

    await oystehrZambdas.zambda.execute({
      id: 'radiology-delete-report',
      serviceRequestId,
      reportType: 'preliminary',
    });

    const serviceRequest = await getServiceRequest();
    const urls = (serviceRequest.extension ?? []).map((ext) => ext.url);
    expect(urls).not.toContain(SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL);
    expect(urls).not.toContain(SERVICE_REQUEST_HAS_BEEN_SENT_TO_TELERADIOLOGY_EXTENSION_URL);
    expect(urls).not.toContain(SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL);

    const order = await getOrder();
    expect(order.status).toBe('performed');
    expect((order.history ?? []).map((row) => row.status)).not.toContain('pending final');
  });

  it('can be sent for a final read again once a replacement read is written', async () => {
    await savePreliminaryReport('Preliminary read written after the pending-final delete');
    expect((await getOrder()).status).toBe('preliminary');

    await oystehrZambdas.zambda.execute({ id: 'radiology-send-for-final-read', serviceRequestId });
    expect((await getOrder()).status).toBe('pending final');
  });

  it('deletes the preliminary read from a final order, leaving the final read and the order at final', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-final-report',
      serviceRequestId,
      report: 'Final report',
    });
    expect((await getOrder()).status).toBe('final');

    const finalReportId = (await getReports()).find((report) => report.status === 'final')?.id;
    if (!finalReportId) throw new Error('expected saving the final read to have produced one');

    await oystehrZambdas.zambda.execute({
      id: 'radiology-delete-report',
      serviceRequestId,
      reportType: 'preliminary',
    });

    const remaining = await getReports();
    expect(remaining.some((report) => report.status === 'preliminary')).toBe(false);
    expect(remaining.some((report) => report.id === finalReportId)).toBe(true);
    expect((await getOrder()).status).toBe('final');

    const urls = ((await getServiceRequest()).extension ?? []).map((ext) => ext.url);
    expect(urls).toContain(SERVICE_REQUEST_NEEDS_TO_BE_SENT_TO_TELERADIOLOGY_EXTENSION_URL);
  });

  it('accepts a replacement preliminary read on a final order without mirroring it to the PACS', async () => {
    await savePreliminaryReport('Preliminary read rewritten while the order is final');

    const reports = await getReports();
    const preliminary = reports.find((report) => report.status === 'preliminary');
    expect(preliminary).toBeDefined();
    expect(preliminary?.identifier ?? []).toHaveLength(0);
    expect(reports.some((report) => report.status === 'final')).toBe(true);
    expect((await getOrder()).status).toBe('final');
  });

  it('refuses a preliminary read that carries no author of ours', async () => {
    const preliminaryId = (await getReports()).find((report) => report.status === 'preliminary')?.id;
    if (!preliminaryId) throw new Error('expected the seeded preliminary read to still be present');

    await oystehrAdmin.fhir.patch<DiagnosticReport>({
      resourceType: 'DiagnosticReport',
      id: preliminaryId,
      operations: [{ op: 'remove', path: '/performer' }],
    });

    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-delete-report',
        serviceRequestId,
        reportType: 'preliminary',
      })
    ).rejects.toThrow();

    expect((await getReports()).some((report) => report.id === preliminaryId)).toBe(true);
  });

  it('refuses once the order has been reviewed', async () => {
    const tasks = (
      await oystehrAdmin.fhir.search<Task>({
        resourceType: 'Task',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();
    const reviewTaskId = tasks[0]?.id;
    if (!reviewTaskId) throw new Error('expected saving the final read to have created a review task');

    await oystehrAdmin.fhir.patch<Task>({
      resourceType: 'Task',
      id: reviewTaskId,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });

    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-delete-report',
        serviceRequestId,
        reportType: 'preliminary',
      })
    ).rejects.toThrow();
  });
});
