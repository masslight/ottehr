# Questionnaire Generation from Patient Record Config

## Overview

This document describes how the `PATIENT_RECORD_CONFIG` object is converted to a FHIR R4B Questionnaire resource with custom Oystehr extensions. The configuration provides a TypeScript-native way to define complex forms that get transformed into standards-compliant FHIR resources.

## Last Updated
January 7, 2025 - Updated to reflect trigger-based conditional logic and removal of dual enableWhen/extension system

## Key Learnings

### 1. Config as Source of Truth
The config object should be treated as the source of truth. When there are inconsistencies between the config and example FHIR Questionnaire JSON files, the config is authoritative and the JSON should be updated to match what the config generates.

**Important**: Never manually edit generated JSON files. Always:
1. Update the TypeScript config
2. Regenerate the JSON from config
3. Commit both together

### 2. Unified Trigger System (January 2025)
Previously, the system had two ways to specify conditional logic:
- `enableWhen` field at the section level (for group visibility)
- `triggers` array at the field/section level (for various effects)

This was simplified to use **only triggers**. The old `enableWhen` field was removed, and all conditional logic now uses the `triggers` array with explicit `effect` values. This provides:
- Single source of truth for conditional logic
- Clearer intent with explicit effects
- Consistent API across field and group levels

### 3. Structure Mapping

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

### 4. Important Patterns

#### Text Field Inclusion

Add the `text` property from field.label for most fields. This provides user-friendly labels in the questionnaire.

#### Trigger System (Conditional Logic)

The `triggers` array provides a unified way to handle all conditional logic:

**Trigger Effects:**
- `enable`: Field is hidden/disabled unless condition is met → generates `enableWhen`
- `require`: Field becomes required when condition is met → generates `require-when` extension
- `filter`: Filters available choice options based on another field → generates `filter-when` extension

**Trigger Configuration:**
```typescript
{
  targetQuestionLinkId: string,  // Question to watch
  effect: ['enable' | 'require' | 'filter'],
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'exists',
  answerBoolean?: boolean,
  answerString?: string,
  answerDateTime?: string
}
```

#### Extension Mapping

- `field.dataType` → `data-type` extension (e.g., "DOB", "SSN", "ZIP", "Email", "Phone Number")
- `field.triggers` with `effect: ['enable']` → `enableWhen` array
- `field.triggers` with `effect: ['require']` → `require-when` extension
- `field.triggers` with `effect: ['filter']` → `filter-when` extension
- `field.dynamicPopulation` → `fill-from-when-disabled` extension
- `field.disabledDisplay` → `disabled-display` extension (hidden/disabled/protected)
- `field.dataSource.answerSource` → `answer-loading-options` extension for dynamic data
- `field.enableBehavior` → controls how multiple enable triggers combine ('any' or 'all')

#### Group-Level Properties

Sections can have their own conditional logic and extensions:
- `triggers`: Array of triggers that control entire section visibility
- `enableBehavior`: 'any' or 'all' - how multiple triggers combine
- `reviewText`: Custom text shown on review page for this section
- `textWhen`: Conditional section titles based on other field values
- `element`: Preferred HTML element for section rendering (e.g., 'h3')
- `complexValidation`: Multi-field validation rules for the section

#### Special Cases
- **Logical Fields**: Hidden fields that exist only for conditional logic (e.g., `should-display-ssn-field` and `ssn-field-required`)
- **Array Sections**: The insurance section has multiple linkIds and item sets to support primary and secondary insurance
- **Reference Type**: Fields with `type: 'reference'` become `choice` type items with dynamic answer loading via `answer-loading-options` extension
- **Display Fields**: Read-only text elements for instructions or headings
- **Attachment Fields**: File upload fields with document type validation

### 5. Section Order
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

### 6. Testing Approach
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

These functions are defined in `shared-questionnaire.ts` and shared across all questionnaire configs.

### Extension Creators
- `createDataTypeExtension(dataType)`: Creates data-type extensions (DOB, SSN, ZIP, etc.)
- `createDisabledDisplayExtension(display)`: Creates disabled-display extensions
- `createFillFromWhenDisabledExtension(sourceLinkId)`: Creates dynamic population extensions
- `createRequireWhenExtension(trigger)`: Creates conditional requirement extensions
- `createFilterWhenExtension(trigger)`: Creates option filtering extensions
- `createAnswerLoadingOptionsExtension(dataSource)`: Creates dynamic answer loading extensions
- `createInputWidthExtension(width)`: Creates input width styling extensions
- `createAutocompleteExtension(autocomplete)`: Creates browser autocomplete hint extensions
- `createPreferredElementExtension(element)`: Creates preferred HTML element extensions
- `createPermissibleValueExtension(value)`: Creates single-value restriction extensions
- `createPlaceholderExtension(placeholder)`: Creates placeholder text extensions
- `createInfoTextSecondaryExtension(infoText)`: Creates helper text extensions
- `createTextWhenExtension(textWhen)`: Creates conditional text extensions
- `createReviewTextExtension(reviewText)`: Creates review page text extensions
- `createComplexValidationExtension(validation)`: Creates multi-field validation extensions
- `createAttachmentTextExtension(text)`: Creates attachment field text extensions
- `createDocumentTypeExtension(type)`: Creates document type validation extensions

### Item Converters
- `createEnableWhen(trigger)`: Converts trigger with 'enable' effect to FHIR enableWhen condition
- `convertFormFieldToQuestionnaireItem(field, isRequired)`: Main converter for input fields
- `convertDisplayFieldToQuestionnaireItem(field)`: Converts display/text fields
- `convertAttachmentFieldToQuestionnaireItem(field, isRequired)`: Converts file upload fields
- `convertGroupFieldToQuestionnaireItem(field, requiredFields)`: Converts nested field groups
- `convertLogicalItemToQuestionnaireItem(field)`: Converts hidden logical fields
- `applyGroupLevelProperties(groupItem, section)`: Applies section-level configuration (triggers, extensions)

## Shared Architecture

The questionnaire generation logic is shared across multiple configs via `shared-questionnaire.ts`:

- **Patient Record Config** (`patient-record/index.ts`): Patient demographic updates
- **Intake Paperwork Config** (`intake-paperwork/index.ts`): Pre-visit paperwork forms
- **Screening Questions Config** (`screening-questions/index.ts`): Appointment screening
- **Booking Config** (`booking/index.ts`): Appointment booking forms

All use the same:
- Schemas: `FormFieldsItemSchema`, `FormSectionSimpleSchema`, `QuestionnaireConfigSchema`
- Converters: `createQuestionnaireFromConfig()`, `createQuestionnaireItemFromConfig()`
- Extension creators: All `create*Extension()` functions
- Trigger system: Unified conditional logic handling

### Benefits of Shared Logic

1. **Consistency**: Same conditional logic patterns across all forms
2. **Maintainability**: Fix/enhance in one place, applies everywhere
3. **Type Safety**: Zod schemas validate config at build time
4. **Testability**: Shared test utilities for all questionnaires

### Config-Specific Differences

While the generation logic is shared, each config has unique:
- **Section structure**: Different page flow and groupings
- **Field types**: Specialized fields for each use case
- **Validation rules**: Domain-specific requirements
- **Conditional logic**: Custom trigger configurations

## Related Documentation

For a more comprehensive guide to the questionnaire generation system, see:
- **Intake Paperwork Generation**: `../intake-paperwork/QUESTIONNAIRE_GENERATION.md` (detailed guide)
- **Shared Questionnaire Source**: `../shared-questionnaire.ts`
- **FHIR R4B Questionnaire Spec**: http://hl7.org/fhir/R4B/questionnaire.html

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
