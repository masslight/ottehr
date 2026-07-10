import { describe, expect, it } from 'vitest';
import { PATIENT_RECORD_QUESTIONNAIRE } from '../../ottehr-config/patient-record';
import { mapQuestionnaireAndValueSetsToItemsList } from './paperwork';
import { makeValidationSchema } from './validation';

// Regression coverage for the EHR Medicaid-toggle bug: the patient-account update
// zambda submits only the changed field, but `patient-has-medicaid` lives in the
// `patient-additional-details-section`, which declares `patient-ethnicity` and
// `patient-race` as required. Whole-section validation rejected the partial
// submission for those untouched siblings. `onlyValidateProvidedFields` scopes
// validation to just the submitted fields to fix this, without weakening the
// intake page-save path that relies on whole-section required-field checks.
describe('makeValidationSchema — onlyValidateProvidedFields', () => {
  const items = mapQuestionnaireAndValueSetsToItemsList(PATIENT_RECORD_QUESTIONNAIRE().item ?? [], []);

  // A QuestionnaireResponse.item array carrying only the Medicaid flag in the
  // additional-details section — exactly what the EHR checkbox toggle sends.
  const medicaidOnlySubmission = [
    {
      linkId: 'patient-additional-details-section',
      item: [{ linkId: 'patient-has-medicaid', answer: [{ valueBoolean: true }] }],
    },
  ];

  it('rejects a single-field submission that omits required siblings by default', async () => {
    const schema = makeValidationSchema(items, undefined);
    await expect(schema.validate(medicaidOnlySubmission, { abortEarly: false })).rejects.toBeDefined();
  });

  it('accepts the same submission when only validating provided fields', async () => {
    const schema = makeValidationSchema(items, undefined, undefined, { onlyValidateProvidedFields: true });
    await expect(schema.validate(medicaidOnlySubmission, { abortEarly: false })).resolves.toBeDefined();
  });

  it('still enforces a required field that IS submitted but left blank', async () => {
    // The full section-save path submits blank fields as bare `{ linkId }` items.
    // Provided-fields-only must keep enforcing required fields the caller actually
    // included — it only relaxes enforcement for fields entirely absent from the QR.
    const blankRequiredSubmission = [
      {
        linkId: 'patient-additional-details-section',
        item: [{ linkId: 'patient-has-medicaid', answer: [{ valueBoolean: true }] }, { linkId: 'patient-ethnicity' }],
      },
    ];
    const schema = makeValidationSchema(items, undefined, undefined, { onlyValidateProvidedFields: true });
    await expect(schema.validate(blankRequiredSubmission, { abortEarly: false })).rejects.toBeDefined();
  });
});
