# Existing Paperwork Helper Architecture Analysis

> **Note**: This is temporary documentation for reference during the config-aware paperwork system implementation. Delete when work is complete.

## 📋 Core Abstractions

### 1. Main Paperwork Class (`utils/Paperwork.ts`)

**Purpose**: Orchestrates full paperwork flow execution

**Key Methods**:
- `fillPaperworkInPerson()` - Complete in-person flow (13 pages)
- `fillPaperworkTelemed()` - Complete virtual flow (17 pages including medical history)
- Generic form filling methods for each page type

**Pattern**:
```typescript
async fillPaperworkInPerson<P, RP, RO>({
  payment: 'card' | 'insurance',
  responsibleParty: 'self' | 'not-self',
  requiredOnly: boolean
}): Promise<InPersonPaperworkReturn<P, RP, RO>>
```

### 2. Specialized Telemed Class (`utils/telemed/Paperwork.ts`)

**Purpose**: Virtual-specific forms (medications, allergies, medical/surgical history, flags)

**Pattern**: `fillAndCheck{Section}()` methods that both fill and validate

**Key Methods**:
- `fillAndCheckEmptyCurrentMedications()` - "No medications" path
- `fillAndCheckFilledCurrentMedications()` - "Has medications" path
- `fillAndCheckEmptyCurrentAllergies()` / `fillAndCheckFilledCurrentAllergies()`
- `fillAndCheckEmptyMedicalHistory()` / `fillAndCheckFilledMedicalHistory()`
- `fillAndCheckEmptySurgicalHistory()` / `fillAndCheckFilledSurgicalHistory()`
- `fillAndCheckAdditionalQuestions()` - Flags (COVID, testing, travel)
- `fillAndCheckSchoolWorkNoteAsNone()` - School/work note request

**Key Feature**: Handles empty vs filled states for optional medical history sections

### 3. FillingInfo Classes

**Locations**:
- `utils/telemed/FillingInfo.ts` - Virtual-specific
- `utils/in-person/FillingInfo.ts` - In-person specific

**Purpose**: Data generation and form field population

**Pattern**: One method per form section

**Example Methods**:
- `fillNewPatientInfo()` - Patient name, sex, email, reason
- `fillContactInformation()` - Address, phone, email
- `fillPatientDetails()` - Ethnicity, race, language
- `fillCurrentMedications()` - Medication list
- `fillCurrentAllergies()` - Allergy list
- `fillMedicalHistory()` - Medical conditions
- `fillSurgicalHistory()` - Surgical procedures

### 4. Locators Class (`utils/locators.ts`)

**Purpose**: Centralized element selectors

**Pattern**: Page-specific locators as class properties

**Coverage**: ~150+ locators for all form fields

**Examples**:
```typescript
streetAddress: Locator
patientEmail: Locator
insuranceCarrier: Locator
responsiblePartyFirstName: Locator
currentMedicationsAbsent: Locator
```

### 5. UploadDocs Class (`utils/UploadDocs.ts`)

**Purpose**: File upload handling

**Methods**:
- `fillInsuranceFront()` / `fillInsuranceBack()`
- `fillSecondaryInsuranceFront()` / `fillSecondaryInsuranceBack()`
- `fillPhotoFrontID()` / `fillPhotoBackID()`
- `fillPatientConditionPhotoPaperwork()` - Virtual only

## 🗂️ Data Structure Patterns

### Return Type Pattern

Conditional types based on test parameters:

```typescript
type InPersonPaperworkReturn<
  PaperworkPayment extends 'card' | 'insurance',
  PaperworkResponsibleParty extends 'self' | 'not-self',
  PaperworkRequiredOnly extends boolean = false
> = {
  state: string;
  patientDetailsData: PaperworkRequiredOnly extends true 
    ? PatientDetailsRequiredData 
    : PatientDetailsData;
  pcpData: PaperworkRequiredOnly extends true ? null : PrimaryCarePhysicianData;
  insuranceData: PaperworkPayment extends 'insurance' ? {...} : null;
  // etc...
}
```

### Interface Pattern

One interface per form section:

```typescript
interface InsuranceRequiredData { ... }
interface InsuranceOptionalData { ... }
interface PatientDetailsRequiredData { ... }
interface PatientDetailsData extends PatientDetailsRequiredData { ... }
interface PrimaryCarePhysicianData { ... }
interface ResponsiblePartyData { ... }
interface EmployerInformationData { ... }
interface EmergencyContactData { ... }
interface AttorneyInformation { ... }
interface TelemedPaperworkData {
  filledValue: string;
  selectedValue: string;
}
interface FlagsData {
  covid: string;
  test: string;
  travel: string;
}
```

## 🎲 Test Data Generation

### Current Approach

**Hardcoded Arrays** (needs to use VALUE_SETS config):
```typescript
private language = ['English', 'Spanish'];
private relationshipResponsiblePartyNotSelf = ['Legal Guardian', 'Parent', 'Other', 'Spouse'];
private birthSex = ['Male', 'Female', 'Intersex'];
private pronouns = ['He/him', 'She/her', 'They/them', 'My pronouns are not listed'];
```

**Random Selection**:
```typescript
getRandomElement(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

getRandomString(): string {
  return Math.random().toString().slice(2, 7);
}
```

**Date Generation**:
- `fillDOBless18()` - Random date for minor (1-17 years old)
- `fillDOBgreater18()` - Random date for adult (19-25 years old)

**Formatted Data**:
```typescript
formatPhoneNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, '');
  return digits.replace(/^1?(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3') || phoneNumber;
}
```

### Test Constants

```typescript
PATIENT_ZIP = '12345'
PATIENT_ADDRESS = 'Patient address'
PATIENT_ADDRESS_LINE_2 = 'Patient address line 2'
PATIENT_CITY = 'PatientCity'
RELATIONSHIP_RESPONSIBLE_PARTY_SELF = 'Self'
PHONE_NUMBER = '1234567890'
EMAIL = 'ibenham+knownothing@masslight.com'
CARD_NUMBER = '4242424242424242'  // Stripe test card
CARD_CVV = '123'
CARD_EXP_DATE = '11/30'
CARD_NUMBER_OBSCURED = 'XXXX - XXXX - XXXX - 4242'
```

## 🔀 Flow Control Patterns

### Page Navigation

```typescript
// 1. Wait for expected page
await this.checkCorrectPageOpens('Contact information');

// 2. Fill section with typed method
const contactData = await this.fillContactInformationAllFields();

// 3. Progress to next page
await this.locator.clickContinueButton();
```

### Conditional Pages

**Workers Comp Employer Information**:
- Only shown for `workers-comp` service category
- Check after responsible party page:
  ```typescript
  const currentPageTitle = await this.locator.flowHeading.textContent();
  const employerInformation = currentPageTitle === 'Workers compensation employer information'
    ? await (async () => { ... })()
    : null;
  ```

**Attorney Information**:
- Conditional based on reason for visit
- Uses `QuestionnaireHelper.inPersonAttorneyPageIsVisible()`

**Emergency Contact**:
- Different for in-person vs virtual
- Virtual checks: `QuestionnaireHelper.virtualQuestionnaireHasItem('emergency-contact-page')`

**School/Work Note** (Virtual only):
- Conditional: `QuestionnaireHelper.hasVirtualSchoolWorkNotePage()`

**Patient Condition Photo** (Virtual only):
- Conditional: `QuestionnaireHelper.hasVirtualPatientConditionPage()`

### Payment Flow Branching

```typescript
if (!requiredOnly && payment === 'insurance') {
  await this.selectInsurancePayment();
  insuranceData = await this.fillInsuranceAllFieldsWithoutCards();
  await this.uploadPhoto.fillInsuranceFront();
  await this.uploadPhoto.fillInsuranceBack();
  
  await this.locator.addSecondaryInsurance.click();
  secondaryInsuranceData = await this.fillSecondaryInsuranceAllFieldsWithoutCards();
  await this.uploadPhoto.fillSecondaryInsuranceFront();
  await this.uploadPhoto.fillSecondaryInsuranceBack();
} else {
  await this.selectSelfPayPayment();
}
```

### Back-and-Forward Validation

Pattern for testing field persistence:

```typescript
private async nextBackClick(waitFor?: () => Promise<void>) {
  await this.page.getByRole('button', { name: 'Continue', exact: true }).click();
  
  if (waitFor) {
    await waitFor();
  }
  
  await expect(this.page.getByRole('button', { name: 'Continue', exact: true }))
    .toBeEnabled({ timeout: 15000 });
  await this.page.getByRole('button', { name: 'Back', exact: true }).click();
}
```

## 🔧 Config Integration Points

### Currently Config-Aware ✅

1. **Field visibility** - Uses `checkFieldHidden(fieldKey)` from INTAKE_PAPERWORK_CONFIG
2. **Page titles** - Uses config page titles for validation
3. **Page existence** - `QuestionnaireHelper` checks questionnaire structure

### Needs Config Awareness ❌

1. **Dropdown options** - Hardcoded arrays need to use `VALUE_SETS`
2. **Required vs optional fields** - Manual `requiredOnly` parameter
3. **Field validation rules** - Not config-driven yet
4. **Conditional page logic** - Needs config injection for QuestionnaireHelper

## 🛠️ Key Utilities in Use

**QuestionnaireHelper** (from utils):
- `inPersonAttorneyPageIsVisible()`
- `virtualQuestionnaireHasItem(linkId)`
- `hasVirtualPatientConditionPage()`
- `hasVirtualSchoolWorkNotePage()`
- `hasVirtualAdditionalPage()`
- `inPersonIsPhotoIdFrontRequired()`
- `inPersonIsPhotoIdBackRequired()`

**Test Utilities**:
- `waitForResponseWithData(page, urlPattern)` - Waits for API responses
- `expect()` assertions - Validates field values after filling
- `checkFieldHidden(fieldKey)` - Checks INTAKE_PAPERWORK_CONFIG

## 🎯 In-Person vs Virtual Flow Differences

### In-Person Flow (13 pages)
1. Contact information
2. Patient details
3. Primary Care Physician
4. Preferred pharmacy
5. Payment option
6. Credit card details
7. Responsible party
8. **(Conditional)** Workers comp employer info
9. Emergency contact
10. **(Conditional)** Attorney info
11. Photo ID
12. Consent forms
13. Medical history

### Virtual Flow (17 pages)
1. Contact information
2. Patient details
3. Primary Care Physician
4. Preferred pharmacy
5. **Current medications** ⭐
6. **Current allergies** ⭐
7. **Medical history** ⭐
8. **Surgical history** ⭐
9. **Additional questions (flags)** ⭐
10. Payment option
11. Credit card details
12. Responsible party
13. **(Conditional)** Emergency contact
14. **(Conditional)** Attorney info
15. Photo ID
16. **(Conditional)** Patient condition photo ⭐
17. **(Conditional)** School/work note ⭐

⭐ = Virtual-specific pages

## 🔄 Reusable Patterns for New Config-Aware System

### Keep ✅

- **Page Object Pattern**: One helper method per paperwork page
- **Typed Return Values**: Return filled data for verification
- **File Upload Abstraction**: Dedicated class for document handling
- **Data Generation Utilities**: Random string, element selection, etc.
- **Conditional Page Checks**: Test for page existence before interaction

### Adapt 🔄

- **Replace hardcoded arrays** with `VALUE_SETS` config access
- **Make field interactions config-aware** (check visibility, required, etc.)
- **Generate test data from config schemas** (fields, validation rules)
- **Inject configs before navigation** using `PaperworkConfigHelper`

### Add ➕

- **PaperworkFlowHelpers** similar to `BookingFlowHelpers` (config-aware helpers)
- **Config-driven test data factories** (generate data based on config structure)
- **Capability configs for paperwork variations** (hidden fields, payment types, etc.)
- **Integration with BookingTestFactory** for end-to-end flows

## 📝 Implementation Strategy

Based on this analysis, the config-aware paperwork system should:

1. **Preserve existing abstractions** - The Paperwork/FillingInfo/Locators pattern works well
2. **Add config layer** - Wrap existing methods with config-aware logic
3. **Use composition** - New `PaperworkFlowHelpers` calls existing methods conditionally
4. **Inject configs** - Use `PaperworkConfigHelper` before page navigation
5. **Generate test data** - Create factories that read config to know what data to generate
6. **Map flows to configs** - Associate each booking scenario with appropriate paperwork config

The existing code is well-structured - we can build on it rather than replace it!
