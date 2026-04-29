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

// The previous version of this script also wrote
//   config/oystehr/in-person-intake-questionnaire.json
//   config/oystehr/virtual-intake-questionnaire.json
// That flow is retired — those standalone files are no longer the source of
// truth for the current intake questionnaire. The archive JSON + TS config
// are now canonical, and HOB's scripts/questionnaire/* own archive updates.
//
// This script now only regenerates the fixture files under test/data/ used
// by the Ottehr-scoped questionnaire-generation.test.ts specs.

if (BRANDING_CONFIG.projectName !== 'Ottehr') {
  console.log('Skipping test data regeneration (non-Ottehr branding)');
  process.exit(0);
}

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
const inPersonQuestionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
fs.writeFileSync(
  path.join(testDataDir, 'intake-paperwork-questionnaire.json'),
  JSON.stringify(inPersonQuestionnaire, null, 2) + '\n'
);
console.log('Regenerated: intake-paperwork-questionnaire.json');

// Virtual intake paperwork questionnaire items (just the items array)
const virtualQuestionnaire = VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE();
fs.writeFileSync(
  path.join(testDataDir, 'virtual-intake-paperwork-questionnaire.json'),
  JSON.stringify(virtualQuestionnaire.item, null, 2) + '\n'
);
console.log('Regenerated: virtual-intake-paperwork-questionnaire.json');

console.log('\nTest data files regenerated successfully!');
