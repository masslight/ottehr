import * as fs from 'fs';
import * as path from 'path';
import {
  BOOKING_CONFIG,
  BRANDING_CONFIG,
  createQuestionnaireItemFromConfig,
  IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE,
  PATIENT_RECORD_CONFIG,
  VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE,
} from 'utils';

// Note: The in-person-intake-questionnaire.json and virtual-intake-questionnaire.json files
// have been eliminated. Questionnaires are now generated dynamically from TypeScript config.
// Historical versions are stored in the *-archive.json files and updated via:
//   npm run validate-intake-questionnaire-archive <in-person|virtual> -- --update

// Regenerate test data files (only when running with default Ottehr branding)
if (BRANDING_CONFIG.projectName === 'Ottehr') {
  const testDataDir = path.join(__dirname, '../test/data');

  // Patient record questionnaire
  const patientRecordItems = createQuestionnaireItemFromConfig(PATIENT_RECORD_CONFIG);
  fs.writeFileSync(
    path.join(testDataDir, 'patient-record-questionnaire.json'),
    JSON.stringify(patientRecordItems, null, 2) + '\n'
  );
  console.log('Regenerated: patient-record-questionnaire.json');

  // Booking questionnaire
  const bookingItems = createQuestionnaireItemFromConfig(BOOKING_CONFIG.formConfig);
  const bookingQuestionnaire = { item: bookingItems };
  fs.writeFileSync(
    path.join(testDataDir, 'booking-questionnaire.json'),
    JSON.stringify(bookingQuestionnaire, null, 2) + '\n'
  );
  console.log('Regenerated: booking-questionnaire.json');

  // Intake paperwork questionnaire (full questionnaire for test comparison)
  const inPersonQuestionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
  fs.writeFileSync(
    path.join(testDataDir, 'intake-paperwork-questionnaire.json'),
    JSON.stringify(inPersonQuestionnaire, null, 2) + '\n'
  );
  console.log('Regenerated: intake-paperwork-questionnaire.json');

  // Virtual intake paperwork questionnaire items (just the items array for test comparison)
  const virtualQuestionnaire = VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE();
  fs.writeFileSync(
    path.join(testDataDir, 'virtual-intake-paperwork-questionnaire.json'),
    JSON.stringify(virtualQuestionnaire.item, null, 2) + '\n'
  );
  console.log('Regenerated: virtual-intake-paperwork-questionnaire.json');

  console.log('\nTest data files regenerated successfully!');
} else {
  console.log('Skipping test data regeneration (non-Ottehr branding)');
}
