import Oystehr from '@oystehr/sdk';
import { ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
    orderingPractitionerId = serviceRequest.requester?.reference?.split('/')[1] as string;
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

  it('rejects a preliminary radiology report without a diagnosis', async () => {
    // Diagnosis is required when saving a preliminary read (it is optional at order time).
    await expect(
      oystehrZambdas.zambda.execute({
        id: 'radiology-save-preliminary-report',
        serviceRequestId,
        report: 'Integration test preliminary report',
      })
    ).rejects.toThrow();
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
});
