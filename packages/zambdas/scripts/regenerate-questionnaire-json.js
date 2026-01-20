"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var fs = require("fs");
var path = require("path");
var utils_1 = require("utils");
var rootDir = path.resolve(__dirname, '../../..');
// Regenerate in-person intake questionnaire config file
var inPersonQuestionnaire = (0, utils_1.IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE)();
var inPersonConfigPath = path.join(rootDir, 'config/oystehr/in-person-intake-questionnaire.json');
var inPersonConfig = JSON.parse(fs.readFileSync(inPersonConfigPath, 'utf-8'));
var inPersonKey = Object.keys(inPersonConfig.fhirResources)[0];
inPersonConfig.fhirResources[inPersonKey].resource = inPersonQuestionnaire;
fs.writeFileSync(inPersonConfigPath, JSON.stringify(inPersonConfig, null, 2) + '\n');
console.log('Regenerated:', inPersonConfigPath);
// Regenerate virtual intake questionnaire config file
var virtualQuestionnaire = (0, utils_1.VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE)();
var virtualConfigPath = path.join(rootDir, 'config/oystehr/virtual-intake-questionnaire.json');
var virtualConfig = JSON.parse(fs.readFileSync(virtualConfigPath, 'utf-8'));
var virtualKey = Object.keys(virtualConfig.fhirResources)[0];
virtualConfig.fhirResources[virtualKey].resource = virtualQuestionnaire;
fs.writeFileSync(virtualConfigPath, JSON.stringify(virtualConfig, null, 2) + '\n');
console.log('Regenerated:', virtualConfigPath);
// Regenerate test data files
var testDataDir = path.join(__dirname, '../test/data');
// Patient record questionnaire
var patientRecordItems = (0, utils_1.createQuestionnaireItemFromConfig)(utils_1.PATIENT_RECORD_CONFIG);
fs.writeFileSync(path.join(testDataDir, 'patient-record-questionnaire.json'), JSON.stringify(patientRecordItems, null, 2) + '\n');
console.log('Regenerated: patient-record-questionnaire.json');
// Booking questionnaire
var bookingItems = (0, utils_1.createQuestionnaireItemFromConfig)(utils_1.BOOKING_CONFIG.formConfig);
var bookingQuestionnaire = { item: bookingItems };
fs.writeFileSync(path.join(testDataDir, 'booking-questionnaire.json'), JSON.stringify(bookingQuestionnaire, null, 2) + '\n');
console.log('Regenerated: booking-questionnaire.json');
// Intake paperwork questionnaire (full questionnaire)
fs.writeFileSync(path.join(testDataDir, 'intake-paperwork-questionnaire.json'), JSON.stringify(inPersonQuestionnaire, null, 2) + '\n');
console.log('Regenerated: intake-paperwork-questionnaire.json');
// Virtual intake paperwork questionnaire items (just the items array)
fs.writeFileSync(path.join(testDataDir, 'virtual-intake-paperwork-questionnaire.json'), JSON.stringify(virtualQuestionnaire.item, null, 2) + '\n');
console.log('Regenerated: virtual-intake-paperwork-questionnaire.json');
console.log('\nAll questionnaire JSON files regenerated successfully!');
