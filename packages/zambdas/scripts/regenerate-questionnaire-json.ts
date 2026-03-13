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

const rootDir = path.resolve(__dirname, '../../..');

// Regenerate in-person intake questionnaire config file
const inPersonQuestionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
const inPersonConfigPath = path.join(rootDir, 'config/oystehr/in-person-intake-questionnaire.json');
const inPersonConfig = JSON.parse(fs.readFileSync(inPersonConfigPath, 'utf-8'));
const inPersonKey = Object.keys(inPersonConfig.fhirResources)[0];
inPersonConfig.fhirResources[inPersonKey].resource = inPersonQuestionnaire;
fs.writeFileSync(inPersonConfigPath, JSON.stringify(inPersonConfig, null, 2) + '\n');
console.log('Regenerated:', inPersonConfigPath);

// Regenerate virtual intake questionnaire config file
const virtualQuestionnaire = VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE();
const virtualConfigPath = path.join(rootDir, 'config/oystehr/virtual-intake-questionnaire.json');
const virtualConfig = JSON.parse(fs.readFileSync(virtualConfigPath, 'utf-8'));
const virtualKey = Object.keys(virtualConfig.fhirResources)[0];
virtualConfig.fhirResources[virtualKey].resource = virtualQuestionnaire;
fs.writeFileSync(virtualConfigPath, JSON.stringify(virtualConfig, null, 2) + '\n');
console.log('Regenerated:', virtualConfigPath);

// Regenerate test data files
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

  // Intake paperwork questionnaire (full questionnaire)
  fs.writeFileSync(
    path.join(testDataDir, 'intake-paperwork-questionnaire.json'),
    JSON.stringify(inPersonQuestionnaire, null, 2) + '\n'
  );
  console.log('Regenerated: intake-paperwork-questionnaire.json');

  // Virtual intake paperwork questionnaire items (just the items array)
  fs.writeFileSync(
    path.join(testDataDir, 'virtual-intake-paperwork-questionnaire.json'),
    JSON.stringify(virtualQuestionnaire.item, null, 2) + '\n'
  );
  console.log('Regenerated: virtual-intake-paperwork-questionnaire.json');
}

console.log('\nAll questionnaire JSON files regenerated successfully!');
