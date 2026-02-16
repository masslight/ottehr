# Paperwork Capability Configs Design

## Overview

This document defines capability-based paperwork configurations for automated testing. Each config represents a different paperwork flow variation to ensure comprehensive test coverage without exploding test count.

## Design Principles

1. **Capability-based**: Each config exercises specific paperwork capabilities
2. **Non-permutative**: Avoid factorial explosion by selecting representative combinations
3. **Service mode aware**: Different configs for in-person vs virtual
4. **Conditional page testing**: Exercise enableWhen logic (workers comp, attorney, etc.)
5. **Field visibility**: Test both full forms and minimal required-only
6. **Payment variations**: Insurance vs self-pay paths
7. **Medical history states**: Virtual-specific variations (empty, partially filled, complete)

## Config Categories

### In-Person Configs

#### 1. `baseline-in-person`
**Purpose**: Complete happy path with all fields visible and filled

**Characteristics**:
- All non-conditional pages shown
- All fields filled (not just required)
- Payment: Insurance
- Responsible party: Not self (exercises full responsible party form)
- Emergency contact: Full information
- Tests: Complete data entry, all field types

**Data Strategy**:
- Use all data template factories
- Fill valid values for all fields
- Test credit card entry
- Test pharmacy search

---

#### 2. `required-only-in-person`
**Purpose**: Minimal required fields, self-pay

**Characteristics**:
- Only required fields filled
- Payment: Self-pay (skips insurance pages)
- Responsible party: Self (minimal form)
- Emergency contact: Required fields only
- PCP: Skipped if optional
- Tests: Minimal valid submission path

**Data Strategy**:
- Use data templates but only required fields
- Skip optional sections where possible
- Test credit card with defaults

---

#### 3. `workers-comp-in-person`
**Purpose**: Workers compensation flow with employer info

**Characteristics**:
- Service category: Workers compensation
- Employer information: Required
- Attorney information: Conditional (test both with/without)
- Payment: Workers comp billing
- Tests: Conditional page logic, employer data validation

**Data Strategy**:
- Use `createEmployerInformationData()`
- Test attorney conditional (enableWhen logic)
- May skip insurance depending on workers comp flow

---

#### 4. `occ-med-in-person`
**Purpose**: Occupational medicine with employer requirements

**Characteristics**:
- Service category: Occupational medicine
- Employer information: Required
- Work/school note: Requested
- Payment: May be employer-paid
- Tests: Occupational-specific fields

**Data Strategy**:
- Use `createEmployerInformationData()`
- Use `createSchoolWorkNoteData()`
- Test employer-paid vs other payment methods

---

#### 5. `photo-id-in-person`
**Purpose**: Test attachment upload with photo ID

**Characteristics**:
- Photo ID: Both front and back
- Insurance cards: Front and back
- Tests: File upload functionality, attachment fields

**Data Strategy**:
- Use fillAttachmentField for all photo uploads
- Test reupload functionality
- Verify upload completion states

---

### Virtual Configs

#### 6. `baseline-virtual`
**Purpose**: Virtual visit happy path with medical history

**Characteristics**:
- Service mode: Virtual
- Medical history: Complete
- Current medications: Listed
- Current allergies: Listed
- Surgical history: Provided
- Payment: Insurance
- Tests: Virtual-specific pages, medical data entry

**Data Strategy**:
- Use `createCurrentMedicationsData()` with multiple medications
- Use `createCurrentAllergiesData()` with multiple allergies
- Use `createMedicalHistoryData()` fully filled
- Use `createSurgicalHistoryData()` with history

---

#### 7. `minimal-virtual`
**Purpose**: Virtual visit with no medical history

**Characteristics**:
- Service mode: Virtual
- Medical history: None
- Current medications: None
- Current allergies: None
- Surgical history: None
- Payment: Self-pay
- Tests: Handling empty medical sections, virtual self-pay

**Data Strategy**:
- Skip or mark "None" for all medical history
- Use boolean fields to indicate no history
- Minimal contact information only

---

#### 8. `virtual-with-secondary-insurance`
**Purpose**: Complex insurance scenario (virtual)

**Characteristics**:
- Service mode: Virtual
- Insurance: Primary + Secondary
- Tests: Multiple insurance cards, secondary insurance workflow

**Data Strategy**:
- Use `createInsuranceData()` twice (primary and secondary)
- Upload 4 insurance card images (2 front + 2 back)
- Test secondary insurance enableWhen conditions

---

### Edge Case / Validation Configs

#### 9. `hidden-fields-test`
**Purpose**: Test config-based field hiding

**Characteristics**:
- Specific fields hidden via paperwork config
- Tests: checkFieldHidden(), conditional rendering

**Implementation Note**: Requires injecting modified paperwork config with specific fields in hiddenFields array

**Data Strategy**:
- Attempt to fill hidden fields (should be skipped)
- Verify form submission works without hidden fields
- Use `isFieldHidden()` to validate behavior

---

#### 10. `validation-test`
**Purpose**: Test field validation with invalid data

**Characteristics**:
- Submit invalid data to trigger validation errors
- Tests: Error message display, validation rules

**Data Strategy**:
- Use `invalid` property from FieldTestData
- Submit invalid email, phone, ZIP, dates
- Verify error messages appear
- Correct and resubmit

---

## Config Implementation Structure

```typescript
export type PaperworkConfigName =
  | 'baseline-in-person'
  | 'required-only-in-person'
  | 'workers-comp-in-person'
  | 'occ-med-in-person'
  | 'photo-id-in-person'
  | 'baseline-virtual'
  | 'minimal-virtual'
  | 'virtual-with-secondary-insurance'
  | 'hidden-fields-test'
  | 'validation-test';

export interface PaperworkCapabilityConfig {
  name: PaperworkConfigName;
  description: string;
  serviceMode: 'in-person' | 'virtual';
  
  // Data generation hints
  dataOptions: {
    fillAllFields: boolean; // true = all fields, false = required only
    paymentMethod: 'insurance' | 'self-pay' | 'workers-comp';
    responsibleParty: 'self' | 'not-self';
    hasSecondaryInsurance: boolean;
    
    // Medical history (virtual only)
    hasMedications?: boolean;
    hasAllergies?: boolean;
    hasMedicalHistory?: boolean;
    hasSurgicalHistory?: boolean;
    
    // Attachments
    includePhotoID?: boolean;
    includeInsuranceCards?: boolean;
    
    // Service-specific
    serviceCategory?: 'urgent-care' | 'workers-comp' | 'occ-med';
    hasEmployerInfo?: boolean;
    hasAttorney?: boolean;
    needsWorkNote?: boolean;
  };
  
  // Config injection (if needed)
  configOverrides?: {
    hiddenFields?: string[];
    requiredFields?: string[];
  };
}
```

## Config Factory Function

```typescript
export function createPaperworkCapabilityConfig(
  name: PaperworkConfigName
): PaperworkCapabilityConfig {
  // Returns appropriate config based on name
  // Used by BookingTestFactory to determine how to fill paperwork
}
```

## Usage in BookingTestFactory

```typescript
async function executeBookingScenario(
  scenario: BookingTestScenario,
  paperworkConfig: PaperworkConfigName
): Promise<BookingResult> {
  // ... booking flow ...
  
  // After confirmBooking()
  const paperworkCapability = createPaperworkCapabilityConfig(paperworkConfig);
  
  // Inject config if needed
  if (paperworkCapability.configOverrides) {
    await injectPaperworkConfig(paperworkCapability.configOverrides);
  }
  
  // Create helper
  const helper = new PagedQuestionnaireFlowHelper(
    page, 
    paperworkCapability.serviceMode
  );
  
  // Generate data based on config
  const paperworkData = generatePaperworkDataFromConfig(paperworkCapability);
  
  // Fill each page
  for (const pageData of paperworkData) {
    await helper.fillPageAndContinue(pageData);
  }
  
  return { appointment, paperworkCompleted: true };
}
```

## Page Sequencing Strategy

Two approaches:

### Option A: Hard-coded sequence (simpler, more explicit)
```typescript
const pageSequence = [
  'contact-information',
  'patient-details',
  'primary-care-physician',
  'pharmacy',
  'payment-selection',
  // ... conditional pages ...
];
```

### Option B: Dynamic discovery (more robust to changes)
```typescript
// Navigate page by page, detect current page, fill it
// Continue until completion page reached
while (!isCompletionPage()) {
  const currentPage = await detectCurrentPage();
  const pageData = getDataForPage(currentPage, paperworkCapability);
  await helper.fillPageAndContinue(pageData);
}
```

**Recommendation**: Start with Option A for predictability, move to Option B if questionnaire structure changes frequently.

## Mapping Booking Scenarios to Paperwork Configs

To avoid permutation explosion, we map booking flows to specific paperwork configs:

| Booking Scenario | Paperwork Config | Rationale |
|------------------|------------------|-----------|
| Urgent care in-person walk-in | `baseline-in-person` | Most common path |
| Urgent care in-person prebook | `required-only-in-person` | Quick checkout |
| Urgent care virtual walk-in | `baseline-virtual` | Common virtual with history |
| Urgent care virtual prebook | `minimal-virtual` | Minimal virtual |
| Workers comp in-person | `workers-comp-in-person` | Service-specific |
| Occ med in-person | `occ-med-in-person` | Service-specific |
| Self-pay walk-in | `required-only-in-person` | Self-pay test |
| Insurance walk-in | `baseline-in-person` | Insurance test |
| Virtual with history | `baseline-virtual` | Medical data test |
| Photo ID required | `photo-id-in-person` | Attachment test |

## Implementation Phases

### Phase 1: Core Configs (MVP)
- `baseline-in-person`
- `baseline-virtual`
- `required-only-in-person`

### Phase 2: Service-Specific
- `workers-comp-in-person`
- `occ-med-in-person`

### Phase 3: Edge Cases
- `hidden-fields-test`
- `validation-test`

### Phase 4: Advanced
- `virtual-with-secondary-insurance`
- `minimal-virtual`
- `photo-id-in-person`

## Testing Validation

Each config should validate:
1. ✅ Form completes successfully
2. ✅ All required fields filled
3. ✅ Conditional pages appear/don't appear as expected
4. ✅ Data persists correctly in FHIR Questionnaire Response
5. ✅ Appointment status updates to "ready" after completion

## Open Questions

1. Should we test page navigation (back button)?
2. Should we test saving partial progress (if supported)?
3. How to handle timeout/session expiration during long forms?
4. Should validation testing be separate spec or integrated?
