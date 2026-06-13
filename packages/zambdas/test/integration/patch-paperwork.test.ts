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
import { firstAnswerablePageLinkId, generatePageAnswers } from '../helpers/paperwork-answers';

// Happy path for patch-paperwork: save a single page of intake answers into the
// in-progress paperwork QuestionnaireResponse. Both the page targeted and its
// answers are derived from the questionnaire the running instance resolves from
// config, so this is valid for any instance.
describe('patch-paperwork integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let questionnaire: Questionnaire;
  let pageAnswers: QuestionnaireResponseItem | undefined;
  let questionnaireResponseId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('patch-paperwork.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);

    questionnaire = await getCurrentQuestionnaireForServiceType(ServiceMode['in-person'], oystehrAdmin);
    const qr = await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: `${questionnaire.url}|${questionnaire.version}`,
      status: 'in-progress',
      // Seed the QR with empty page skeletons so patch can target an existing page index.
      item: (questionnaire.item ?? []).map((page) => ({ linkId: page.linkId, item: [] })),
    });
    questionnaireResponseId = qr.id!;

    // Patch the first enabled page that has answerable fields, with answers
    // synthesized from this instance's questionnaire.
    const pageLinkId = firstAnswerablePageLinkId(questionnaire);
    pageAnswers = pageLinkId ? generatePageAnswers(questionnaire, pageLinkId, qr) : undefined;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('patches a page of paperwork answers', async () => {
    expect(pageAnswers).toBeDefined();
    const response = await oystehrPatient.zambda.executePublic({
      id: 'patch-paperwork',
      questionnaireResponseId,
      appointmentId: base.appointment.id,
      answers: pageAnswers,
    });
    expect(response.output).toBeDefined();
  });
});
