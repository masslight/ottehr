import { Questionnaire } from 'fhir/r4';
import { createQuestionnaireItemFromPatientRecordConfig, PATIENT_RECORD_CONFIG } from 'utils';
import patientRecordQuestionnaireFile from '../../../config/oystehr/ehr-insurance-update-questionnaire.json' assert { type: 'json' };

const PatientRecordQuestionnaire = Object.values(patientRecordQuestionnaireFile.fhirResources)![0]
  .resource as Questionnaire;

describe('testing Questionnaire generation from config objects', () =>
  test.concurrent('min age greater than max age on some alert threshold causes parsing failure', async () => {
    const questionnaireItems = createQuestionnaireItemFromPatientRecordConfig(PATIENT_RECORD_CONFIG);
    expect(questionnaireItems).toBeDefined();
    expect(JSON.stringify(questionnaireItems)).toEqual(JSON.stringify(PatientRecordQuestionnaire.item));
  }));
