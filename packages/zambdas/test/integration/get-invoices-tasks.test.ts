import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Appointment, Encounter, Patient, Task as FhirTask } from 'fhir/r4b';
import {
  createInvoiceTaskInput,
  GET_INVOICES_TASKS_ZAMBDA_KEY,
  GetInvoicesTasksResponse,
  InvoiceSortDirectionValues,
  InvoiceSortFieldValues,
  mapDisplayToInvoiceTaskStatus,
  RcmTaskCodings,
  ZERO_BALANCE_BUSINESS_STATUS,
} from 'utils';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { AUTH0_CLIENT_TESTS, AUTH0_SECRET_TESTS } from '../../.env/local.json';
import { getAuth0Token } from '../../src/shared';
import { SECRETS } from '../data/secrets';
import { ensureM2MPractitionerProfile } from '../helpers/configureTestM2MClient';

describe.skip('get-invoices-tasks integration tests', () => {
  let oystehr: Oystehr;
  let token: string;

  const createdTaskIds: string[] = [];
  const createdEncounterIds: string[] = [];
  const createdAppointmentIds: string[] = [];
  const createdPatientIds: string[] = [];

  // Sorting test fixtures (3 tasks for 1 patient with deliberately cross-ordered dates)
  let sortingPatientId: string;
  let taskId1: string; // finalizationDate=2024-01-01, appointmentDate=2024-03-15 (earliest fin, latest appt)
  let taskId2: string; // finalizationDate=2024-02-01, appointmentDate=2024-01-15 (middle fin, earliest appt)
  let taskId3: string; // finalizationDate=2024-03-01, appointmentDate=2024-02-15 (latest fin, middle appt)

  // Zero-balance filter fixtures (2 tasks for 1 patient: 1 zero-balance, 1 non-zero)
  let filterPatientId: string;
  let zeroBalanceTaskId: string;
  let nonZeroTaskId: string;

  const callGetInvoicesTasks = async (params: Record<string, unknown>): Promise<GetInvoicesTasksResponse> => {
    const response = await oystehr.zambda.execute({ id: GET_INVOICES_TASKS_ZAMBDA_KEY, ...params });
    return response.output as GetInvoicesTasksResponse;
  };

  const createPatient = async (): Promise<Patient> => {
    const patient = await oystehr.fhir.create<Patient>({
      resourceType: 'Patient',
      name: [{ given: ['InvoiceTest'], family: randomUUID().slice(0, 8) }],
      birthDate: '1990-01-01',
    });
    createdPatientIds.push(patient.id!);
    return patient;
  };

  const createEncounterWithAppointment = async (
    patientId: string,
    appointmentDate: string
  ): Promise<{ encounter: Encounter; appointment: Appointment }> => {
    const appointment = await oystehr.fhir.create<Appointment>({
      resourceType: 'Appointment',
      status: 'fulfilled',
      start: `${appointmentDate}T10:00:00.000Z`,
      end: `${appointmentDate}T11:00:00.000Z`,
      participant: [{ actor: { reference: `Patient/${patientId}` }, status: 'accepted' }],
    });
    createdAppointmentIds.push(appointment.id!);

    const encounter = await oystehr.fhir.create<Encounter>({
      resourceType: 'Encounter',
      status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
      subject: { reference: `Patient/${patientId}` },
      appointment: [{ reference: `Appointment/${appointment.id}` }],
      period: { start: `${appointmentDate}T10:00:00.000Z` },
    });
    createdEncounterIds.push(encounter.id!);

    return { encounter, appointment };
  };

  const createInvoiceTask = async ({
    patientId,
    encounterId,
    appointmentDate,
    finalizationDate,
    amountCents,
    isZeroBalance = false,
  }: {
    patientId: string;
    encounterId: string;
    appointmentDate: string;
    finalizationDate: string;
    amountCents: number;
    isZeroBalance?: boolean;
  }): Promise<FhirTask> => {
    const finalizationDateISO = `${finalizationDate}T00:00:00.000Z`;
    const appointmentDateISO = `${appointmentDate}T10:00:00.000Z`;

    const task = await oystehr.fhir.create<FhirTask>({
      resourceType: 'Task',
      status: mapDisplayToInvoiceTaskStatus('ready'),
      intent: 'order',
      code: RcmTaskCodings.sendInvoiceToPatient,
      for: { reference: `Patient/${patientId}` },
      encounter: { reference: `Encounter/${encounterId}` },
      authoredOn: finalizationDateISO,
      executionPeriod: { start: appointmentDateISO, end: appointmentDateISO },
      ...(isZeroBalance ? { businessStatus: ZERO_BALANCE_BUSINESS_STATUS } : {}),
      input: createInvoiceTaskInput({
        amountCents,
        dueDate: '2025-12-31',
        memo: 'Integration test invoice',
        smsTextMessage: 'Test SMS',
        claimId: randomUUID(),
        finalizationDate: finalizationDateISO,
      }),
    });
    createdTaskIds.push(task.id!);
    return task;
  };

  beforeAll(async () => {
    const { AUTH0_ENDPOINT, AUTH0_AUDIENCE, FHIR_API, PROJECT_ID } = SECRETS;
    const EXECUTE_ZAMBDA_URL = inject('EXECUTE_ZAMBDA_URL');
    expect(EXECUTE_ZAMBDA_URL).toBeDefined();

    token = await getAuth0Token({
      AUTH0_ENDPOINT,
      AUTH0_CLIENT: AUTH0_CLIENT_TESTS,
      AUTH0_SECRET: AUTH0_SECRET_TESTS,
      AUTH0_AUDIENCE,
    });

    oystehr = new Oystehr({
      accessToken: token,
      fhirApiUrl: FHIR_API,
      projectApiUrl: EXECUTE_ZAMBDA_URL,
      services: {
        zambdaApiUrl: EXECUTE_ZAMBDA_URL,
      },
      projectId: PROJECT_ID,
    });

    await ensureM2MPractitionerProfile(token);

    // --- Sorting fixtures ---
    // 3 tasks for 1 patient with cross-ordered finalization vs appointment dates so that
    // each sort direction/field produces a distinct order.
    //
    // | task | finalizationDate | appointmentDate |
    // |------|-----------------|-----------------|
    // |  1   |   2024-01-01    |   2024-03-15    |  earliest fin, latest appt
    // |  2   |   2024-02-01    |   2024-01-15    |  middle fin,  earliest appt
    // |  3   |   2024-03-01    |   2024-02-15    |  latest fin,  middle appt
    const sortingPatient = await createPatient();
    sortingPatientId = sortingPatient.id!;

    const { encounter: enc1 } = await createEncounterWithAppointment(sortingPatientId, '2024-03-15');
    const { encounter: enc2 } = await createEncounterWithAppointment(sortingPatientId, '2024-01-15');
    const { encounter: enc3 } = await createEncounterWithAppointment(sortingPatientId, '2024-02-15');

    const t1 = await createInvoiceTask({
      patientId: sortingPatientId,
      encounterId: enc1.id!,
      appointmentDate: '2024-03-15',
      finalizationDate: '2024-01-01',
      amountCents: 1000,
    });
    taskId1 = t1.id!;

    const t2 = await createInvoiceTask({
      patientId: sortingPatientId,
      encounterId: enc2.id!,
      appointmentDate: '2024-01-15',
      finalizationDate: '2024-02-01',
      amountCents: 2000,
    });
    taskId2 = t2.id!;

    const t3 = await createInvoiceTask({
      patientId: sortingPatientId,
      encounterId: enc3.id!,
      appointmentDate: '2024-02-15',
      finalizationDate: '2024-03-01',
      amountCents: 3000,
    });
    taskId3 = t3.id!;

    // --- hideZeroBalance filter fixtures ---
    const filterPatient = await createPatient();
    filterPatientId = filterPatient.id!;

    const { encounter: zbEnc } = await createEncounterWithAppointment(filterPatientId, '2024-06-01');
    const zbTask = await createInvoiceTask({
      patientId: filterPatientId,
      encounterId: zbEnc.id!,
      appointmentDate: '2024-06-01',
      finalizationDate: '2024-06-01',
      amountCents: 0,
      isZeroBalance: true,
    });
    zeroBalanceTaskId = zbTask.id!;

    const { encounter: nzbEnc } = await createEncounterWithAppointment(filterPatientId, '2024-06-02');
    const nzbTask = await createInvoiceTask({
      patientId: filterPatientId,
      encounterId: nzbEnc.id!,
      appointmentDate: '2024-06-02',
      finalizationDate: '2024-06-02',
      amountCents: 5000,
    });
    nonZeroTaskId = nzbTask.id!;
  });

  afterAll(async () => {
    if (!oystehr) return;

    const deleteRequests = [
      ...createdTaskIds.map((id) => ({ method: 'DELETE' as const, url: `Task/${id}` })),
      ...createdEncounterIds.map((id) => ({ method: 'DELETE' as const, url: `Encounter/${id}` })),
      ...createdAppointmentIds.map((id) => ({ method: 'DELETE' as const, url: `Appointment/${id}` })),
      ...createdPatientIds.map((id) => ({ method: 'DELETE' as const, url: `Patient/${id}` })),
    ];

    if (deleteRequests.length > 0) {
      try {
        await oystehr.fhir.batch({ requests: deleteRequests });
      } catch (error) {
        console.error('Error cleaning up get-invoices-tasks test resources:', error);
      }
    }
  });

  // ============================================================================
  // Sorting
  // ============================================================================

  describe('sorting by finalizationDate', () => {
    it('returns results in descending finalizationDate order', async () => {
      const result = await callGetInvoicesTasks({
        patientId: sortingPatientId,
        sortField: InvoiceSortFieldValues.finalizationDate,
        sortDirection: InvoiceSortDirectionValues.desc,
      });

      const ids = result.reports.map((r) => r.task.id);
      // task3 (2024-03-01) > task2 (2024-02-01) > task1 (2024-01-01)
      expect(ids.indexOf(taskId3)).toBeLessThan(ids.indexOf(taskId2));
      expect(ids.indexOf(taskId2)).toBeLessThan(ids.indexOf(taskId1));
    });

    it('returns results in ascending finalizationDate order', async () => {
      const result = await callGetInvoicesTasks({
        patientId: sortingPatientId,
        sortField: InvoiceSortFieldValues.finalizationDate,
        sortDirection: InvoiceSortDirectionValues.asc,
      });

      const ids = result.reports.map((r) => r.task.id);
      // task1 (2024-01-01) < task2 (2024-02-01) < task3 (2024-03-01)
      expect(ids.indexOf(taskId1)).toBeLessThan(ids.indexOf(taskId2));
      expect(ids.indexOf(taskId2)).toBeLessThan(ids.indexOf(taskId3));
    });
  });

  describe('sorting by appointmentDate', () => {
    it('returns results in descending appointmentDate order', async () => {
      const result = await callGetInvoicesTasks({
        patientId: sortingPatientId,
        sortField: InvoiceSortFieldValues.appointmentDate,
        sortDirection: InvoiceSortDirectionValues.desc,
      });

      const ids = result.reports.map((r) => r.task.id);
      // task1 (2024-03-15) > task3 (2024-02-15) > task2 (2024-01-15)
      expect(ids.indexOf(taskId1)).toBeLessThan(ids.indexOf(taskId3));
      expect(ids.indexOf(taskId3)).toBeLessThan(ids.indexOf(taskId2));
    });

    it('returns results in ascending appointmentDate order', async () => {
      const result = await callGetInvoicesTasks({
        patientId: sortingPatientId,
        sortField: InvoiceSortFieldValues.appointmentDate,
        sortDirection: InvoiceSortDirectionValues.asc,
      });

      const ids = result.reports.map((r) => r.task.id);
      // task2 (2024-01-15) < task3 (2024-02-15) < task1 (2024-03-15)
      expect(ids.indexOf(taskId2)).toBeLessThan(ids.indexOf(taskId3));
      expect(ids.indexOf(taskId3)).toBeLessThan(ids.indexOf(taskId1));
    });
  });

  // ============================================================================
  // hideZeroBalance filter
  // ============================================================================

  describe('hideZeroBalance filter', () => {
    it('excludes zero-balance tasks when hideZeroBalance is true', async () => {
      const result = await callGetInvoicesTasks({
        patientId: filterPatientId,
        hideZeroBalance: true,
      });

      const ids = result.reports.map((r) => r.task.id);
      expect(ids).not.toContain(zeroBalanceTaskId);
      expect(ids).toContain(nonZeroTaskId);
    });

    it('includes zero-balance tasks when hideZeroBalance is false', async () => {
      const result = await callGetInvoicesTasks({
        patientId: filterPatientId,
        hideZeroBalance: false,
      });

      const ids = result.reports.map((r) => r.task.id);
      expect(ids).toContain(zeroBalanceTaskId);
      expect(ids).toContain(nonZeroTaskId);
    });
  });

  // ============================================================================
  // Response shape
  // ============================================================================

  describe('response shape', () => {
    it('returns required fields on each report', async () => {
      const result = await callGetInvoicesTasks({ patientId: sortingPatientId });

      expect(result.reports.length).toBeGreaterThanOrEqual(3);
      expect(result.totalCount).toBeGreaterThanOrEqual(3);

      for (const report of result.reports) {
        expect(report.task).toBeDefined();
        expect(report.task.id).toBeDefined();
        expect(report.patient.patientId).toBe(sortingPatientId);
        expect(report.patient.fullName).toBeTruthy();
        expect(report.amountInvoiceable).toBeGreaterThanOrEqual(0);
        expect(report.claimId).toBeTruthy();
        expect(report.finalizationDateISO).toBeTruthy();
      }
    });
  });
});
