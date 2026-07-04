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

// Happy path for submit-paperwork, exercised the way the intake app actually
// drives it: the QR starts as empty page skeletons, every page is saved through
// the real patch-paperwork endpoint (page-by-page, just like a patient filling
// out the form), and only then is submit-paperwork called to finalize. The
// questionnaire — and therefore the answer set — is resolved from the running
// instance's config and synthesized from that definition, so this is valid for
// any instance regardless of questionnaire version/shape.
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
      // Start from empty page skeletons so each page index exists for patch to target.
      item: (questionnaire.item ?? []).map((page) => ({ linkId: page.linkId, item: [] })),
    });
    questionnaireResponseId = qr.id!;
    answers = generatePaperworkAnswers(questionnaire, qr);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('fills out every page via patch-paperwork, then submits', async () => {
    // Save each page through the real save-page endpoint, serially (each call
    // patches the same QR, so concurrent writes would race on the version).
    for (const page of answers) {
      if (!page.item?.length) continue;
      const patchResponse = await oystehrPatient.zambda.executePublic({
        id: 'patch-paperwork',
        questionnaireResponseId,
        appointmentId: base.appointment.id,
        answers: page,
      });
      expect(patchResponse.output).toBeDefined();
    }

    const response = await oystehrPatient.zambda.executePublic({
      id: 'submit-paperwork',
      questionnaireResponseId,
      appointmentId: base.appointment.id,
      answers,
    });
    expect(response.output).toBeDefined();

    // The submission finalized the paperwork: the QR is no longer in-progress.
    const finalQr = await oystehrAdmin.fhir.get<QuestionnaireResponse>({
      resourceType: 'QuestionnaireResponse',
      id: questionnaireResponseId,
    });
    expect(['completed', 'amended']).toContain(finalQr.status);
  });
});
