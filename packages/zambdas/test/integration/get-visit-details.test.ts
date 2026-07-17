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

// Happy path for get-visit-details: returns the full visit detail bundle for an
// appointment (appointment/patient/encounter/consents/intake QR/etc.). The endpoint
// requires an intake QuestionnaireResponse, so the seed QR is pointed at the
// instance's active intake questionnaire (resolved from config — instance-agnostic).
describe('get-visit-details integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-visit-details.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    const questionnaire = await getCurrentQuestionnaireForServiceType(ServiceMode['in-person'], oystehrAdmin);
    await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the visit details for an appointment', async () => {
    const response = await oystehrProvider.zambda.execute({
      id: 'get-visit-details',
      appointmentId: base.appointment.id,
    });
    expect(response.output).toBeDefined();
  });
});
