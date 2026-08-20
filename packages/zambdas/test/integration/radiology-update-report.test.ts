import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, ServiceRequest, Task } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// radiology-update-report corrects a read that was already saved. The tests walk one order through its
// lifecycle in order — preliminary read, then final read — because what may be edited depends on where the
// order has got to. AdvaPACS is mocked by global setup; created radiology resources are removed afterwards.
describe('radiology-update-report integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let cleanup: () => Promise<void>;

  const decodeReport = (report: DiagnosticReport | undefined): string | undefined => {
    const data = report?.presentedForm?.find((attachment) => attachment.contentType === 'text/html')?.data;
    return data == null ? undefined : Buffer.from(data, 'base64').toString('utf-8');
  };

  const getReports = async (): Promise<DiagnosticReport[]> =>
    (
      await oystehrAdmin.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-update-report.test.ts', M2MClientMockType.provider);
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
    // A preliminary report is only accepted once the study has been performed (the PACS webhook's job).
    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId,
      report: 'Original preliminary report',
      diagnosisCodes: ['E11.9'],
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

  it('rejects an edit of a final read that does not exist yet', async () => {
    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-update-report',
        serviceRequestId,
        report: 'Final read that was never written',
        reportType: 'final',
      })
    ).rejects.toThrow();
  });

  it('edits the preliminary read in place, leaving it preliminary', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-update-report',
      serviceRequestId,
      report: 'Corrected preliminary report\nsecond line',
      reportType: 'preliminary',
    });
    expect(response.output).toBeDefined();

    const preliminary = (await getReports()).find((report) => report.status === 'preliminary');
    // Newlines are stored as <br>, the same way the original save writes them.
    expect(decodeReport(preliminary)).toBe('Corrected preliminary report<br>second line');
  });

  // From here the order has a final read, which changes what may be edited.
  it('edits a final read written here, by the provider who wrote it', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-final-report',
      serviceRequestId,
      report: 'Original final report',
    });

    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-update-report',
      serviceRequestId,
      report: 'Corrected final report',
      reportType: 'final',
    });
    expect(response.output).toBeDefined();

    const final = (await getReports()).find((report) => report.status === 'final');
    expect(decodeReport(final)).toBe('Corrected final report');
  });

  it('keeps the preliminary read as its own report once the final read is saved', async () => {
    const preliminary = (await getReports()).find((report) => report.status === 'preliminary');
    expect(decodeReport(preliminary)).toBe('Corrected preliminary report<br>second line');
    // The snapshot is ours alone — no AdvaPACS identifier, so a later edit to it is never pushed there.
    expect(preliminary?.identifier ?? []).toHaveLength(0);
  });

  it('still edits the preliminary read after the final read is back', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'radiology-update-report',
      serviceRequestId,
      report: 'Preliminary corrected after finalization',
      reportType: 'preliminary',
    });
    expect(response.output).toBeDefined();

    const preliminary = (await getReports()).find((report) => report.status === 'preliminary');
    expect(decodeReport(preliminary)).toBe('Preliminary corrected after finalization');
    // The final read is untouched by a preliminary edit.
    const final = (await getReports()).find((report) => report.status === 'final');
    expect(decodeReport(final)).toBe('Corrected final report');
  });

  // The author is what marks a read as ours. Strip it and the read reads as teleradiology's, so nobody may
  // correct it — not even the provider who ordered the study, who otherwise could.
  it('refuses a preliminary read that carries no author of ours', async () => {
    const preliminary = (await getReports()).find((report) => report.status === 'preliminary');
    // Says which precondition broke, rather than failing inside the patch with a confusing message.
    expect(preliminary?.id).toBeDefined();
    await oystehrAdmin.fhir.patch<DiagnosticReport>({
      resourceType: 'DiagnosticReport',
      id: preliminary!.id!,
      operations: [{ op: 'remove', path: '/performer' }],
    });

    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-update-report',
        serviceRequestId,
        report: 'Not mine to correct',
        reportType: 'preliminary',
      })
    ).rejects.toThrow();

    // Unchanged on disk.
    const after = (await getReports()).find((report) => report.status === 'preliminary');
    expect(decodeReport(after)).toBe('Preliminary corrected after finalization');
  });

  it('refuses both reads once the order has been reviewed', async () => {
    const tasks = (
      await oystehrAdmin.fhir.search<Task>({
        resourceType: 'Task',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();
    // Saving the final read leaves the review task open; completing it is what locks the reads.
    expect(tasks[0]?.status).toBe('ready');
    await oystehrAdmin.fhir.patch<Task>({
      resourceType: 'Task',
      id: tasks[0].id!,
      operations: [{ op: 'replace', path: '/status', value: 'completed' }],
    });

    for (const reportType of ['preliminary', 'final'] as const) {
      await expect(
        oystehrZambdas.zambda.execute({
          id: 'radiology-update-report',
          serviceRequestId,
          report: 'Too late to correct this',
          reportType,
        })
      ).rejects.toThrow();
    }
  });

  it('rejects an unknown reportType', async () => {
    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-update-report',
        serviceRequestId,
        report: 'Some report',
        reportType: 'amended',
      })
    ).rejects.toThrow();
  });
});
