import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import {
  SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL,
  SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL,
} from 'utils/lib/fhir/radiology';
import { GetRadiologyOrderListZambdaOutput, RadiologyOrderStatus } from 'utils/lib/types/api/radiology';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Every lifecycle row carries its own performer, recorded on the resource that transition created — and no
// row borrows another's. Walks one order from performed through final, asserting the history as it goes.
describe('radiology history performers integration', () => {
  let oystehrAdmin: Oystehr;
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let serviceRequestId: string;
  let orderingPractitionerId: string;
  let cleanup: () => Promise<void>;

  const getReports = async (): Promise<DiagnosticReport[]> =>
    (
      await oystehrAdmin.fhir.search<DiagnosticReport>({
        resourceType: 'DiagnosticReport',
        params: [{ name: 'based-on', value: `ServiceRequest/${serviceRequestId}` }],
      })
    ).unbundle();

  const historyRow = async (status: RadiologyOrderStatus): Promise<{ performer?: string } | undefined> => {
    const response = await oystehrZambdas.zambda.execute({ id: 'radiology-order-list', serviceRequestId });
    const { orders } = response.output as GetRadiologyOrderListZambdaOutput;
    return orders[0]?.history?.find((row) => row.status === status);
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('radiology-performers.test.ts', M2MClientMockType.provider);
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
    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    orderingPractitionerId = serviceRequest.requester?.reference?.split('/')[1] as string;
    // What the PACS webhook does once the study has been performed: flip the status and stamp the time,
    // which is what puts a "performed" row in the history at all.
    await oystehrAdmin.fhir.patch<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
      operations: [
        { op: 'replace', path: '/status', value: 'completed' },
        {
          op: 'add',
          path: '/extension/-',
          value: { url: SERVICE_REQUEST_PERFORMED_ON_EXTENSION_URL, valueDateTime: new Date().toISOString() },
        },
      ],
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

  // Whether each row *renders* the right name is settled by the buildHistory unit tests; what only a real
  // round trip can show is that each write lands on its own resource, so walk the order once and check the
  // resources as it goes.
  it('records the study performer on the order, from its own save and with no read written', async () => {
    expect((await historyRow(RadiologyOrderStatus.performed))?.performer).toBe('');

    await oystehrZambdas.zambda.execute({
      id: 'radiology-update-order',
      serviceRequestId,
      update: { type: 'performed-by', performedById: orderingPractitionerId },
    });

    expect((await historyRow(RadiologyOrderStatus.performed))?.performer).toBeTruthy();
    // Still `performed` — recording the performer is not writing a read.
    expect(await getReports()).toHaveLength(0);
  });

  it('records the sender on the order when it goes for a final read', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-preliminary-report',
      serviceRequestId,
      report: 'Integration test preliminary report',
      diagnosisCodes: ['E11.9'],
    });
    await oystehrZambdas.zambda.execute({ id: 'radiology-send-for-final-read', serviceRequestId });

    const serviceRequest = await oystehrAdmin.fhir.get<ServiceRequest>({
      resourceType: 'ServiceRequest',
      id: serviceRequestId,
    });
    const sentBy = serviceRequest.extension?.find(
      (ext) => ext.url === SERVICE_REQUEST_SENT_FOR_FINAL_READ_BY_EXTENSION_URL
    );
    expect(sentBy?.valueReference?.reference).toBe(`Practitioner/${orderingPractitionerId}`);
    expect((await historyRow(RadiologyOrderStatus.pendingFinal))?.performer).toBeTruthy();
  });

  it('leaves each read carrying its own author once the final read is written', async () => {
    await oystehrZambdas.zambda.execute({
      id: 'radiology-save-final-report',
      serviceRequestId,
      report: 'Integration test final report',
    });

    // Finalizing must not have consumed the preliminary read's author along with its text.
    const reports = await getReports();
    expect(reports.find((report) => report.status === 'preliminary')?.performer?.[0]?.reference).toBe(
      `Practitioner/${orderingPractitionerId}`
    );
    expect(reports.find((report) => report.status === 'final')?.performer?.[0]?.reference).toBe(
      `Practitioner/${orderingPractitionerId}`
    );
  });
});
