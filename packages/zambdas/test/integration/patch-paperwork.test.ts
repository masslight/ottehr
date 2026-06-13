import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { M2MClientMockType } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import baseQr from '../data/base-qr.json';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// A complete contact-information page (all required fields) from the sample QR,
// so the page passes patch validation.
const CONTACT_PAGE = (baseQr.item as QuestionnaireResponseItem[]).find(
  (i) => i.linkId === 'contact-information-page'
) as QuestionnaireResponseItem;

// Pin to the same questionnaire version the sample QR (base-qr.json) was built
// against, so its page answers validate exactly.
const INTAKE_QUESTIONNAIRE = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.0.9';

// Happy path for patch-paperwork: save a page of intake answers into the
// in-progress paperwork QuestionnaireResponse. Patches the contact-information
// page with a couple of text fields.
describe('patch-paperwork integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let questionnaireResponseId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('patch-paperwork.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    // Seed the QR with the sample paperwork's page skeleton so patch can target
    // an existing page item.
    const qr = await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: INTAKE_QUESTIONNAIRE,
      status: 'in-progress',
      item: baseQr.item as QuestionnaireResponseItem[],
    });
    questionnaireResponseId = qr.id!;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('patches a page of paperwork answers', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'patch-paperwork',
      questionnaireResponseId,
      appointmentId: base.appointment.id,
      answers: CONTACT_PAGE,
    });
    expect(response.output).toBeDefined();
  });
});
