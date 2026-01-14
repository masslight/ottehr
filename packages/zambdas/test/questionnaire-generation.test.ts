import { BOOKING_CONFIG, createQuestionnaireItemFromConfig, PATIENT_RECORD_CONFIG } from 'utils';
import BookingQuestionnaire from './data/booking-questionnaire.json' with { type: 'json' };
import PatientRecordQuestionnaire from './data/patient-record-questionnaire.json' with { type: 'json' };
// this is for testing the generation logic with a specific reference Q resource. this will almost always break
// downstream so this will be commented out and exist here only as a local dev tool
describe.skip('testing Questionnaire generation from config objects', () => {
  test.concurrent('patient record questionnaire config generates expected questionnaire items', async () => {
    const questionnaireItems = createQuestionnaireItemFromConfig(PATIENT_RECORD_CONFIG);
    expect(questionnaireItems).toBeDefined();
    expect(JSON.stringify(questionnaireItems)).toEqual(JSON.stringify(PatientRecordQuestionnaire));
  });
  test.concurrent('booking questionnaire config generates expected questionnaire items', async () => {
    const questionnaireItems = createQuestionnaireItemFromConfig(BOOKING_CONFIG.formConfig);
    expect(questionnaireItems).toBeDefined();
    expect(JSON.stringify(questionnaireItems)).toEqual(JSON.stringify(BookingQuestionnaire.item));
  });
});
