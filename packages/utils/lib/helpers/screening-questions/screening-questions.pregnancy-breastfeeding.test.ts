import { describe, expect, it } from 'vitest';
import { patientScreeningQuestionsConfig } from '../../ottehr-config/screening-questions';
import {
  PATIENT_BREASTFEEDING_STATUS,
  PATIENT_PREGNANCY_STATUS,
  PatientBreastfeedingKeys,
  PatientPregnancyKeys,
} from '../../types/data/screening-questions/constants';
import { formatScreeningQuestionValue, getScreeningQuestionText } from './screening-questions-formatting.helper';

describe('pregnancy and breastfeeding screening questions', () => {
  it('asks the pregnancy question with all of its answers', () => {
    expect(getScreeningQuestionText(PATIENT_PREGNANCY_STATUS)).toBe('Is there any chance you could be pregnant?');
    expect(
      Object.values(PatientPregnancyKeys).map((key) => formatScreeningQuestionValue(PATIENT_PREGNANCY_STATUS, key))
    ).toEqual(['Yes', 'No', 'Not sure', 'Not applicable']);
  });

  it('asks the breastfeeding question with all of its answers', () => {
    expect(getScreeningQuestionText(PATIENT_BREASTFEEDING_STATUS)).toBe('Are you currently breastfeeding?');
    expect(
      Object.values(PatientBreastfeedingKeys).map((key) =>
        formatScreeningQuestionValue(PATIENT_BREASTFEEDING_STATUS, key)
      )
    ).toEqual(['Yes', 'No', 'Not applicable']);
  });

  // Both questions are asked by staff in the EHR only. Marking them as questionnaire fields would
  // add them to intake paperwork, where only two-option radios are supported.
  it('keeps both questions out of the intake questionnaire', () => {
    const fields = patientScreeningQuestionsConfig.fields.filter((field) =>
      [PATIENT_PREGNANCY_STATUS, PATIENT_BREASTFEEDING_STATUS].includes(field.fhirField)
    );

    expect(fields).toHaveLength(2);
    fields.forEach((field) => expect(field.existsInQuestionnaire).toBeFalsy());
  });
});
