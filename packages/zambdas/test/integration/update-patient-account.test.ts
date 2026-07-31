import Oystehr from '@oystehr/sdk';
import { Patient, QuestionnaireResponse } from 'fhir/r4b';
import { APIErrorCode, M2MClientMockType, PATIENT_HAS_MEDICAID_URL, PATIENT_RECORD_QUESTIONNAIRE } from 'utils';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// End-to-end coverage for the `onlyValidateProvidedFields` request parameter on
// update-patient-account. `patient-has-medicaid` lives in the
// `patient-additional-details-section`, which declares `patient-ethnicity` and
// `patient-race` as required. A single-field toggle submits only the Medicaid
// answer, so whole-section validation (the default, needed for atomic sections
// like insurance/coverage) rejects it for the untouched required siblings. The
// EHR Medicaid checkbox opts into `onlyValidateProvidedFields` to scope
// validation to just the field it changed. This test asserts both halves against
// the real zambda + FHIR backend: reject-by-default, accept-with-flag, and that
// the flagged path actually harvests the Patient extension.
describe('update-patient-account integration — onlyValidateProvidedFields', () => {
  let oystehrZambdas: Oystehr;
  let oystehrAdmin: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let cleanup: () => Promise<void>;

  const questionnaire = PATIENT_RECORD_QUESTIONNAIRE();

  // A QuestionnaireResponse carrying only the Medicaid flag in the
  // additional-details section — exactly what the EHR checkbox toggle sends.
  const medicaidOnlyQR = (patientId: string, value: boolean): QuestionnaireResponse => ({
    resourceType: 'QuestionnaireResponse',
    status: 'completed',
    questionnaire: `${questionnaire.url}|${questionnaire.version}`,
    subject: { reference: `Patient/${patientId}` },
    item: [
      {
        linkId: 'patient-additional-details-section',
        item: [{ linkId: 'patient-has-medicaid', answer: [{ valueBoolean: value }] }],
      },
    ],
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest('update-patient-account.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    oystehrAdmin = setup.oystehr;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('rejects a single-field submission by default (whole-section validation)', async () => {
    let caught: unknown;
    try {
      await oystehrZambdas.zambda.execute({
        id: 'update-patient-account',
        questionnaireResponse: medicaidOnlyQR(base.patient.id!, true),
      });
    } catch (e) {
      caught = e;
    }
    if (!caught) {
      throw new Error(
        'expected the default whole-section validation to reject the partial submission, but it succeeded'
      );
    }
    const err = caught as { code?: number; message?: string };
    expect(err.code).toBe(APIErrorCode.QUESTIONNAIRE_RESPONSE_INVALID);
    // The invalid-fields payload is keyed by page linkId; the untouched required
    // siblings live in the additional-details section.
    expect(err.message).toContain('patient-additional-details-section');
  });

  it('accepts the same submission with onlyValidateProvidedFields and harvests the Patient extension', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'update-patient-account',
      questionnaireResponse: medicaidOnlyQR(base.patient.id!, true),
      onlyValidateProvidedFields: true,
    });
    expect(response.output).toBeDefined();

    // Confirm the effect actually ran end-to-end, not just that validation passed.
    const patient = await oystehrAdmin.fhir.get<Patient>({ resourceType: 'Patient', id: base.patient.id! });
    const medicaidExt = patient.extension?.find((ext) => ext.url === PATIENT_HAS_MEDICAID_URL);
    expect(medicaidExt?.valueBoolean).toBe(true);
  });
});
