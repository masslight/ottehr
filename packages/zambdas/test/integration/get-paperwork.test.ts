import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse } from 'fhir/r4b';
import { M2MClientMockType, ServiceMode } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCurrentQuestionnaireForServiceType } from '../../src/patient/appointment/helpers';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-paperwork: returns the intake questionnaire (merged with
// value sets) and the patient's answers for an appointment. The questionnaire is
// resolved from the running instance's config (getCurrentQuestionnaireForServiceType)
// rather than hardcoded, so this is valid for any instance.
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
    // Point the seed QR at this instance's active in-person intake questionnaire
    // (a QR is treated as "paperwork" when it references that canonical).
    const questionnaire = await getCurrentQuestionnaireForServiceType(ServiceMode['in-person'], oystehrAdmin);
    await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
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
