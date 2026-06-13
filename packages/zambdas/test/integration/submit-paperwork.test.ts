import Oystehr from '@oystehr/sdk';
import { Questionnaire, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { M2MClientMockType, ServiceMode } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getCurrentQuestionnaireForServiceType } from '../../src/patient/appointment/helpers';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { generatePaperworkAnswers } from '../helpers/paperwork-answers';

// Happy path for submit-paperwork: submit the full set of intake answers for an
// in-progress paperwork QuestionnaireResponse. The questionnaire (and therefore
// the required answer set) is resolved from the running instance's config and
// the answers are synthesized from that definition, so this is valid for any
// instance regardless of questionnaire version/shape.
describe('submit-paperwork integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let questionnaire: Questionnaire;
  let answers: QuestionnaireResponseItem[];
  let questionnaireResponseId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('submit-paperwork.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    questionnaire = await getCurrentQuestionnaireForServiceType(ServiceMode['in-person'], oystehrAdmin);
    const qr = await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
      status: 'in-progress',
      item: [],
    });
    questionnaireResponseId = qr.id!;
    // Synthesize a complete, valid answer set from this instance's questionnaire.
    answers = generatePaperworkAnswers(questionnaire, qr);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('submits the full paperwork', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'submit-paperwork',
      questionnaireResponseId,
      appointmentId: base.appointment.id,
      answers,
    });
    expect(response.output).toBeDefined();
  });
});
