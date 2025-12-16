import { createQuestionnaireItemFromPatientRecordConfig, PATIENT_RECORD_CONFIG } from 'utils';
import PatientRecordQuestionnaire from './data/patient-record-questionnaire.json' assert { type: 'json' };

describe('testing Questionnaire generation from config objects', () =>
  test.concurrent('min age greater than max age on some alert threshold causes parsing failure', async () => {
    const questionnaireItems = createQuestionnaireItemFromPatientRecordConfig(PATIENT_RECORD_CONFIG);
    expect(questionnaireItems).toBeDefined();
    expect(JSON.stringify(questionnaireItems)).toEqual(JSON.stringify(PatientRecordQuestionnaire.item));
  }));
