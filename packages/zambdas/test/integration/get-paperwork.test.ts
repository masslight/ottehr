import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// A QuestionnaireResponse counts as "paperwork" when it references the intake
// paperwork Questionnaire canonical. The seed encounter's QR is pointed at the
// in-person intake questionnaire so get-paperwork resolves it.
const INTAKE_QUESTIONNAIRE = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.2.1';

// Happy path for get-paperwork: returns the intake questionnaire (merged with
// value sets) and the patient's in-progress answers for an appointment.
describe('get-paperwork integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-paperwork.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: INTAKE_QUESTIONNAIRE,
      status: 'in-progress',
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the intake paperwork for an appointment', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'get-paperwork',
      appointmentID: base.appointment.id,
      dateOfBirth: '2002-07-07',
    });
    expect(response.output).toBeDefined();
  });
});
