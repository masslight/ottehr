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

// Pin to the questionnaire version the sample QR (base-qr.json) targets so its
// full answer set validates as a complete submission.
const INTAKE_QUESTIONNAIRE = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson|1.0.9';

// The sample QR omits a couple of fields the project's questionnaire requires;
// augment those pages so the submission validates.
const ANSWERS: QuestionnaireResponseItem[] = (baseQr.item as QuestionnaireResponseItem[]).map((page) => {
  if (page.linkId === 'patient-details-page') {
    return {
      ...page,
      item: [
        ...(page.item ?? []),
        { linkId: 'patient-point-of-discovery', answer: [{ valueString: 'Friend/Family' }] },
      ],
    };
  }
  if (page.linkId === 'consent-forms-page') {
    // base-qr leaves this page empty; the questionnaire requires the consent
    // checkboxes + signature/full-name/relationship.
    return {
      linkId: 'consent-forms-page',
      item: [
        { linkId: 'hipaa-acknowledgement', answer: [{ valueBoolean: true }] },
        { linkId: 'consent-to-treat', answer: [{ valueBoolean: true }] },
        { linkId: 'signature', answer: [{ valueString: 'Jon Snow' }] },
        { linkId: 'full-name', answer: [{ valueString: 'Jon Snow' }] },
        { linkId: 'consent-form-signer-relationship', answer: [{ valueString: 'Self' }] },
      ],
    };
  }
  return page;
});

// Happy path for submit-paperwork: submit the full set of intake answers for an
// in-progress paperwork QuestionnaireResponse.
describe('submit-paperwork integration — happy path', () => {
  let oystehrAdmin: Oystehr;
  let oystehrPatient: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let questionnaireResponseId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('submit-paperwork.test.ts', M2MClientMockType.patient);
    oystehrAdmin = setup.oystehr;
    oystehrPatient = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    const qr = await oystehrAdmin.fhir.update<QuestionnaireResponse>({
      ...base.questionnaireResponse,
      questionnaire: INTAKE_QUESTIONNAIRE,
      status: 'in-progress',
      item: ANSWERS,
    });
    questionnaireResponseId = qr.id!;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('submits the full paperwork', async () => {
    const response = await oystehrPatient.zambda.executePublic({
      id: 'submit-paperwork',
      questionnaireResponseId,
      appointmentId: base.appointment.id,
      answers: ANSWERS,
    });
    expect(response.output).toBeDefined();
  });
});
