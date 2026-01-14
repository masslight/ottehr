# Questionnaire Generation from Intake Paperwork Config

## Overview

This document describes how the `IN_PERSON_INTAKE_PAPERWORK_CONFIG` object is converted to a FHIR R4B Questionnaire resource with custom Oystehr extensions. The configuration provides a TypeScript-native way to define complex forms that get transformed into standards-compliant FHIR resources.

## Architecture

### Config → FHIR Transformation Pipeline

```
TypeScript Config Object
    ↓
createQuestionnaireFromConfig()
    ↓
FHIR Questionnaire with Extensions
    ↓
Used by Frontend & Backend
```

### Key Files

- **`intake-paperwork/index.ts`**: Defines the config object structure
- **`shared-questionnaire.ts`**: Contains the transformation logic and extension creators
- **`/config/oystehr/in-person-intake-questionnaire.json`**: Generated FHIR resource (auto-generated, don't edit directly)

## Configuration Structure

### Top-Level Config Schema

```typescript
{
  questionnaireBase: {
    resourceType: 'Questionnaire',
    url: string,
    version: string,
    name: string,
    title: string,
    status: 'draft' | 'active' | 'retired' | 'unknown'
  },
  hiddenFormSections: string[],  // Section keys to hide from UI
  FormFields: {
    [sectionKey: string]: FormSection
  }
}
```

### Form Section Types

#### Simple Section
```typescript
{
  linkId: string,                    // FHIR group linkId
  title: string,                     // Display title
  items: Record<string, FormField>,  // Field definitions
  logicalItems?: Record<string, LogicalField>,  // Hidden fields for logic
  hiddenFields?: string[],           // Fields hidden in UI
  requiredFields?: string[],         // Required field keys
  triggers?: FormFieldTrigger[],     // Group-level conditional logic
  enableBehavior?: 'all' | 'any',   // How multiple triggers combine
  reviewText?: string,               // Text shown on review page
  element?: string,                  // Preferred UI element (e.g., 'h3')
  textWhen?: TextWhen[],            // Conditional title text
  complexValidation?: ComplexValidation  // Multi-field validation
}
```

#### Array Section (for repeating groups like insurance)
```typescript
{
  linkId: string[],                  // Multiple linkIds for instances
  title: string,
  items: Record<string, FormField>[] | Record<string, FormField>,
  // ... same optional fields as Simple Section
}
```

## Field Types and Mappings

### Form Field → Questionnaire Item

Each field type maps to a FHIR Questionnaire item type:

| Config Type | FHIR Type | Use Case |
|------------|-----------|----------|
| `string` | `string` | Text input |
| `date` | `date` | Date picker |
| `boolean` | `boolean` | Checkbox |
| `choice` | `choice` | Radio buttons, select dropdown |
| `reference` | `choice` | Dynamic data lookup (e.g., locations) |
| `attachment` | `attachment` | File upload |
| `display` | `display` | Read-only text/headings |
| `group` | `group` | Nested field grouping |

### Field Configuration Properties

```typescript
interface FormFieldsInputItem {
  key: string,                       // → linkId
  label?: string,                    // → text
  type: FieldType,                   // → type
  dataType?: DataType,              // → data-type extension
  options?: { label: string, value: string }[],  // → answerOption
  triggers?: FormFieldTrigger[],    // → enableWhen + require-when
  enableBehavior?: 'all' | 'any',  // → enableBehavior
  disabledDisplay?: 'hidden' | 'disabled' | 'protected',  // → disabled-display ext
  dynamicPopulation?: {              // → fill-from-when-disabled ext
    sourceLinkId: string
  },
  inputWidth?: string,               // → input-width extension
  placeholder?: string,              // → placeholder extension
  autocomplete?: string,             // → autocomplete extension
  permissibleValue?: boolean | string,  // → permissible-value ext
  infoTextSecondary?: string,       // → information-text-secondary ext
  element?: string,                  // → preferred-element extension
  textWhen?: TextWhen[],            // → text-when extensions
  initialValue?: string | boolean,   // → initial value
  extension?: Extension[]            // Custom FHIR extensions
}
```

### Logical Fields

Special fields that exist only for conditional logic, not displayed to users:

```typescript
interface FormFieldsLogicalItem {
  key: string,
  type: 'string' | 'date' | 'boolean',
  initialValue?: string | boolean
}
```

**Example**: `patient-will-be-18` boolean field that controls age-based logic

## Trigger System (Conditional Logic)

### Trigger Configuration

Triggers replace the previous dual system of `enableWhen` and custom extensions. They provide a unified way to handle conditional logic:

```typescript
interface FormFieldTrigger {
  targetQuestionLinkId: string,      // Question to watch
  effect: ('enable' | 'require' | 'filter')[],  // What happens when condition is met
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'exists',
  answerBoolean?: boolean,           // Expected boolean answer
  answerString?: string,             // Expected string answer
  answerDateTime?: string            // Expected date answer
}
```

### Trigger Effects

#### `enable` Effect
- **Config**: Added to `triggers` array with `effect: ['enable']`
- **Generated FHIR**: `enableWhen` array on the item
- **Behavior**: Field is hidden/disabled unless condition is met

#### `require` Effect
- **Config**: Added to `triggers` array with `effect: ['require']`
- **Generated FHIR**: `require-when` extension
- **Behavior**: Field becomes required when condition is met

#### `filter` Effect
- **Config**: Added to `triggers` array with `effect: ['filter']`
- **Generated FHIR**: `filter-when` extension
- **Behavior**: Filters available options based on another field's value

### Enable Behavior

When multiple `enable` triggers exist:
- `enableBehavior: 'any'` (default): Show if ANY condition is met (OR logic)
- `enableBehavior: 'all'`: Show only if ALL conditions are met (AND logic)

### Example: Complex Conditional Logic

```typescript
// Field shown when either condition is met
employerInformationPage: {
  linkId: 'employer-information-page',
  title: 'Employer Information',
  triggers: [
    {
      targetQuestionLinkId: 'contact-information-page.appointment-service-category',
      effect: ['enable'],
      operator: '=',
      answerString: 'workers-comp'
    },
    {
      targetQuestionLinkId: 'contact-information-page.appointment-service-category',
      effect: ['enable'],
      operator: '=',
      answerString: 'occupational-medicine'
    }
  ],
  enableBehavior: 'any',  // Show if EITHER condition is true
  items: { /* ... */ }
}
```

## Custom FHIR Extensions

All extensions use the `https://fhir.zapehr.com/r4/StructureDefinitions/` base URL.

### Field-Level Extensions

| Extension | Config Property | Purpose |
|-----------|----------------|---------|
| `data-type` | `dataType` | Special formatting (DOB, SSN, ZIP, Email, Phone) |
| `disabled-display` | `disabledDisplay` | How to show disabled fields (hidden/disabled/protected) |
| `fill-from-when-disabled` | `dynamicPopulation.sourceLinkId` | Auto-populate from another field when disabled |
| `require-when` | `triggers` with `effect: ['require']` | Conditional field requirement |
| `filter-when` | `triggers` with `effect: ['filter']` | Filter choice options dynamically |
| `input-width` | `inputWidth` | CSS width for input field |
| `placeholder` | `placeholder` | Placeholder text |
| `autocomplete` | `autocomplete` | Browser autocomplete hint |
| `permissible-value` | `permissibleValue` | Single allowed value |
| `information-text-secondary` | `infoTextSecondary` | Helper text below field |
| `preferred-element` | `element` | HTML element to use (h3, p, etc.) |
| `text-when` | `textWhen` | Conditional field labels |
| `answer-loading-options` | `dataSource.answerSource` | Dynamic option loading |
| `attachment-text` | `attachmentText` | Text for attachment fields |
| `document-type` | `documentType` | Expected document type |

### Group-Level Extensions

| Extension | Config Property | Purpose |
|-----------|----------------|---------|
| `review-text` | `reviewText` | Custom text shown on review page |
| `complex-validation` | `complexValidation` | Multi-field validation rules |
| `text-when` | `textWhen` | Conditional section titles |

### Data Types

Special `dataType` values trigger specific UI behavior:

- **`DOB`**: Date of birth picker with age calculation
- **`SSN`**: Social security number with masking
- **`ZIP`**: Zip code validation
- **`Email`**: Email validation
- **`Phone Number`**: Phone number formatting
- **`State`**: US state validation
- **`Select`**: Dropdown instead of radio buttons

## Section Order and Structure

Sections are generated in the order they appear in the `FormFields` object. Common sections in intake paperwork:

1. **contact-information-page**: Patient demographics and address
2. **patient-information-page**: Patient details (pronouns, ethnicity, etc.)
3. **primary-care-physician-page**: PCP information
4. **payment-option-page**: Payment method selection
5. **insurance-page**: Insurance details (can be array section)
6. **responsible-party-page**: Guardian information
7. **employer-information-page**: Employer details (workers comp)
8. **occupational-medicine-employer-information-page**: Occ med employer
9. **consent-forms-page**: Legal consents
10. **additional-questions-page**: Custom questions

## Special Patterns

### Repeating Groups (Insurance Example)

Array sections generate multiple group items with `repeats: true`:

```typescript
insurance: {
  linkId: ['insurance-page.primary-insurance', 'insurance-page.secondary-insurance'],
  title: 'Insurance',
  items: [
    { /* Primary insurance fields */ },
    { /* Secondary insurance fields */ }
  ],
  requiredFields: ['insurance-carrier']
}
```

Generates two separate groups, both marked as repeatable.

### Dynamic Population Pattern

Auto-fill a field from another source when it's disabled:

```typescript
{
  key: 'responsible-party-first-name',
  label: 'First name',
  type: 'string',
  dynamicPopulation: {
    sourceLinkId: 'contact-information-page.patient-first-name'
  },
  disabledDisplay: 'protected'  // Shows value but prevents editing
}
```

### Conditional Text (TextWhen)

Change field/section labels based on other field values:

```typescript
textWhen: [
  {
    question: 'patient-information-page.patient-pronouns',
    operator: '=',
    answerString: 'he-him-his',
    text: 'His Guardian Information'
  },
  {
    question: 'patient-information-page.patient-pronouns',
    operator: '=',
    answerString: 'she-her-hers',
    text: 'Her Guardian Information'
  }
]
```

### Reference Fields (Dynamic Data Loading)

Load options from an API:

```typescript
{
  key: 'preferred-location',
  label: 'Preferred location',
  type: 'reference',
  dataSource: {
    answerSource: {
      resourceType: 'Location',
      query: 'status=active&_tag=urgent-care'
    }
  }
}
```

Generates:
- FHIR type: `choice`
- Extension: `answer-loading-options` with FHIR query expression

## Generation Process

### Step-by-Step Transformation

1. **Parse Config**: Validate config against `QuestionnaireConfigSchema`
2. **Iterate Sections**: Process each section in order
3. **Create Group Items**:
   - Set linkId, type ('group'), title
   - Add logical items first (if any)
   - Convert each field to QuestionnaireItem
4. **Apply Field-Level Logic**:
   - Map config properties to FHIR properties
   - Convert triggers to enableWhen and extensions
   - Add all applicable extensions
5. **Apply Group-Level Logic**:
   - Process section-level triggers
   - Add group-level extensions
6. **Assemble Questionnaire**:
   - Combine questionnaireBase with generated items
   - Return complete FHIR Questionnaire

### Helper Functions

Core transformation functions in `shared-questionnaire.ts`:

- `createQuestionnaireFromConfig()`: Main entry point
- `createQuestionnaireItemFromConfig()`: Generates item array
- `convertFormFieldToQuestionnaireItem()`: Converts single field
- `convertDisplayFieldToQuestionnaireItem()`: Handles display fields
- `convertAttachmentFieldToQuestionnaireItem()`: Handles file uploads
- `convertGroupFieldToQuestionnaireItem()`: Handles nested groups
- `applyGroupLevelProperties()`: Applies section-level config
- `createEnableWhen()`: Converts trigger to enableWhen
- `create*Extension()`: Family of extension creator functions

## Testing and Validation

### Test Files

- `packages/zambdas/test/questionnaire-generation.test.ts`: Validates generation
- `packages/zambdas/test/data/intake-paperwork-questionnaire.json`: Expected output

### Validation Test

```typescript
test('intake paperwork config JSON matches generated questionnaire', () => {
  const generatedQuestionnaire = IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();
  const actualConfigQuestionnaire = InPersonIntakeQuestionnaireConfig
    .fhirResources['questionnaire-in-person-previsit-paperwork'].resource;

  expect(generatedQuestionnaire).toEqual(actualConfigQuestionnaire);
});
```

### Regenerating JSON Files

When config changes:

1. Config is the source of truth
2. Regenerate JSON file from config
3. Update tests to match new output
4. Never manually edit the generated JSON

## Common Patterns in Intake Paperwork

### Age-Based Logic

```typescript
// Logical field tracking if patient will be 18+ at appointment
logicalItems: {
  patientWillBe18: {
    key: 'patient-will-be-18',
    type: 'boolean'
  }
}

// Field shown only for minors
responsiblePartySection: {
  triggers: [{
    targetQuestionLinkId: 'contact-information-page.patient-will-be-18',
    effect: ['enable'],
    operator: '=',
    answerBoolean: false
  }]
}
```

### Payment Method Conditional Fields

```typescript
// Insurance fields shown only when insurance is selected
insuranceSection: {
  triggers: [{
    targetQuestionLinkId: 'payment-option-page.payment-option',
    effect: ['enable'],
    operator: '=',
    answerString: INSURANCE_PAY_OPTION
  }]
}
```

### Service Category Conditionals

```typescript
// Employer info required only for workers comp
employerInformationPage: {
  triggers: [{
    targetQuestionLinkId: 'contact-information-page.appointment-service-category',
    effect: ['enable'],
    operator: '=',
    answerString: 'workers-comp'
  }]
}
```

## Best Practices

### 1. Use Triggers Consistently
- Always use the `triggers` array for conditional logic
- Specify effects clearly: `enable`, `require`, or `filter`
- Set `enableBehavior` when using multiple enable triggers

### 2. Logical Items for Calculations
- Use logical fields for derived values (age calculations, etc.)
- Keep them in `logicalItems` separate from user-facing `items`
- Set appropriate initial values

### 3. Field Naming Conventions
- Use kebab-case for linkIds: `patient-first-name`
- Prefix with section: `contact-information-page.patient-city`
- Be descriptive: `appointment-service-category` not `service`

### 4. Required Fields
- List in `requiredFields` array at section level
- Use `require` effect in triggers for conditional requirements
- Never set both `required: true` and require-when

### 5. Extensions vs Direct Properties
- Use direct FHIR properties when available (`required`, `enableWhen`)
- Use extensions for Oystehr-specific behavior (`data-type`, `disabled-display`)
- Keep extension usage consistent across similar fields

### 6. Testing
- Always validate generated output matches expected structure
- Test conditional logic thoroughly
- Verify all extensions are properly created

## Troubleshooting

### Field Not Showing
- Check if section has `triggers` with `enable` effect
- Verify target question linkId is correct (include section prefix)
- Check `disabledDisplay` - might be hidden vs disabled
- Look for conflicting `hiddenFields` or `hiddenFormSections`

### Validation Not Working
- Ensure field is in `requiredFields` array OR has require-when extension
- Check trigger operator and answer value match exactly
- Verify `enableBehavior` setting for multiple conditions

### Dynamic Data Not Loading
- Confirm `type: 'reference'` (not 'choice')
- Verify `dataSource.answerSource` is properly configured
- Check FHIR query syntax in generated extension

### Generated JSON Doesn't Match Config
- Regenerate JSON from config (config is source of truth)
- Check for manual edits to JSON file (not allowed)
- Verify test expectations are up to date


## Related Documentation

- **FHIR R4B Questionnaire**: http://hl7.org/fhir/R4B/questionnaire.html
- **Patient Record Generation**: `../patient-record/QUESTIONNAIRE_GENERATION.md`
- **Shared Questionnaire Logic**: `../shared-questionnaire.ts`
- **Booking Config**: `../booking/README.md` (if exists)

## Maintenance

### When to Update This Document

- New field types are added
- New extensions are created
- Trigger effects are added or modified
- Generation logic changes significantly
- New special patterns emerge in usage

### Keeping JSON in Sync

The authoritative flow is:

```
Config (TypeScript) → Generation Function → JSON File → Frontend/Backend
```

Never edit the JSON directly. Always:
1. Edit the config in `intake-paperwork/index.ts`
2. Run tests to regenerate JSON
3. Commit both config and generated JSON together
