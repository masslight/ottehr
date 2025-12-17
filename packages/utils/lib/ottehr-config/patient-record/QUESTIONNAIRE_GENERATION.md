# Questionnaire Generation from Patient Record Config

## Overview

This document describes the implementation of `createQuestionnaireItemFromPatientRecordConfig`, which generates FHIR Questionnaire items from the `PATIENT_RECORD_CONFIG` object.

## Implementation Date

December 13, 2024

## Key Learnings

### 1. Config as Source of Truth

The `PATIENT_RECORD_CONFIG` object should be treated as the source of truth. When there are inconsistencies between the config and example FHIR Questionnaire JSON files, the config is authoritative and the JSON should be updated to match what the config generates.

### 2. Structure Mapping

#### Form Sections → Questionnaire Groups

Each section in `FormFields` becomes a FHIR Questionnaire item of type "group":

- `linkId`: from section.linkId
- `type`: "group"
- `text`: from section.title
- `item`: array of converted field items

#### Form Fields → Questionnaire Items

Each field in a section becomes a Questionnaire item with:

- `linkId`: from field.key
- `type`: from field.type (with special handling for "reference" → "choice")
- `text`: from field.label (when present and appropriate)
- `required`: determined by section.requiredFields array
- `answerOption`: from field.options for choice types
- `extension`: various FHIR extensions based on field properties

### 3. Important Patterns

#### Text Field Inclusion

Add the `text` property from field.label for most fields. This provides user-friendly labels in the questionnaire.

#### Extension Mapping

- `field.dataType` → `data-type` extension (e.g., "DOB", "SSN", "ZIP", "Email", "Phone Number")
- `field.triggers` with 'enable' effect → `enableWhen` array
- `field.triggers` with 'require' effect → `require-when` extension
- `field.dynamicPopulation` → `fill-from-when-disabled` extension
- `field.disabledDisplay` → `disabled-display` extension
- `field.dataSource.answerSource` → `answer-loading-options` extension for dynamic data

#### Special Cases

- **Logical Fields**: The patient-info-section includes two special boolean fields (`should-display-ssn-field` and `ssn-field-required`) that control SSN field visibility and requirements
- **Array Sections**: The insurance section has multiple linkIds and item sets to support primary and secondary insurance
- **Reference Type**: Fields with `type: 'reference'` become `choice` type items with dynamic answer loading

### 4. Section Order

Sections must be generated in this specific order to match the expected Questionnaire structure:

1. patientSummary
2. patientContactInformation
3. patientDetails
4. primaryCarePhysician
5. insurance (generates multiple groups)
6. responsibleParty
7. employerInformation
8. emergencyContact
9. attorneyInformation
10. preferredPharmacy
11. user-settings-section (hardcoded empty group at the end)

### 5. Testing Approach

For complex questionnaire generation:

1. Read the expected JSON structure to understand the target format
2. Implement helper functions for creating extensions and sub-structures
3. Implement the main conversion logic
4. Create a debug script to compare generated vs expected output
5. Update the reference JSON to match config-generated output when inconsistencies exist

## Files Modified

### Implementation

- `packages/utils/lib/ottehr-config/patient-record/index.ts` (lines 805-1066)
  - Added helper functions for creating FHIR extensions
  - Implemented `createQuestionnaireItemFromPatientRecordConfig` function

### Updated for Consistency

- `config/oystehr/ehr-insurance-update-questionnaire.json`
  - Updated item array to match config-generated output
  - Ensured all fields have appropriate text properties
  - Aligned section titles and field order with config

### Test

- `packages/zambdas/test/questionnaire-generation.test.ts`
  - Validates that generated items match expected structure

## Helper Functions

### Extension Creators

- `createDataTypeExtension(dataType)`: Creates data-type extensions
- `createDisabledDisplayExtension(display)`: Creates disabled-display extensions
- `createFillFromWhenDisabledExtension(sourceLinkId)`: Creates dynamic population extensions
- `createRequireWhenExtension(trigger)`: Creates conditional requirement extensions
- `createAnswerLoadingOptionsExtension(dataSource)`: Creates dynamic answer loading extensions

### Item Converters

- `createEnableWhen(trigger)`: Converts trigger to enableWhen condition
- `convertFormFieldToQuestionnaireItem(field, isRequired)`: Converts a single form field to questionnaire item
- `createLogicalFields()`: Creates special SSN-related logical fields

## Future Considerations

### For More Complex Questionnaires

1. **Nested Groups**: May need to handle multi-level section nesting
2. **Conditional Sections**: Support for entire sections that appear conditionally
3. **Calculated Fields**: Support for fields whose values are calculated from other fields
4. **Custom Extensions**: Additional FHIR extensions specific to different questionnaire types
5. **Validation Rules**: More complex field validation beyond simple required/optional
6. **Skip Logic**: Advanced branching and skip patterns based on multiple conditions

### Performance

- For very large questionnaires, consider caching or memoization of generated structures
- Profile the generation process if performance becomes an issue

### Maintenance

- Keep this documentation updated as the implementation evolves
- Document any new extension types or special cases discovered
- Maintain test coverage for all supported field types and configurations
