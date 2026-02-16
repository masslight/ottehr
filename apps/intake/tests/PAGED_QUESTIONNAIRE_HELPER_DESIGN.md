# PagedQuestionnaireFlowHelper Design

## Core Concept

Instead of specific methods for each section (fillEmergencyContact, fillResponsibleParty), we need a **generic helper that works with the underlying FHIR Questionnaire structure**:

- Pages are identified by `linkId` (e.g., 'emergency-contact-page', 'responsible-party-page')
- Fields are `IntakeQuestionnaireItem` objects with:
  - `linkId` - unique identifier
  - `type` - string, integer, decimal, choice, date, group, display, etc.
  - `text` - label/question text  
  - `answerOption` - for choice fields (dropdown/radio)
  - `required` - is the field required
  - `enableWhen` - conditional visibility logic
  - etc.

## Proposed Architecture

### 1. PagedQuestionnaireFlowHelper (Main Class)

```typescript
class PagedQuestionnaireFlowHelper {
  constructor(page: Page)
  
  // Navigate to a page and wait for it to load
  async navigateToPage(pageLinkId: string): Promise<void>
  
  // Fill all fields on a page based on a value map
  async fillPage(valuemap: Record<string, any>): Promise<void>
  
  // Fill a single field by its linkId
  async fillField(linkId: string, value: any): Promise<void>
  
  // Click Continue button
  async clickContinue(): Promise<void>
  
  // Click Back button
  async clickBack(): Promise<void>
  
  // Get current page linkId
  async getCurrentPageLinkId(): Promise<string>
}
```

### 2. Field Type Handlers

Generic handlers based on `IntakeQuestionnaireItem.type`:

```typescript
interface FieldFiller {
  canHandle(item: IntakeQuestionnaireItem): boolean
  fill(locator: Locator, value: any, item: IntakeQuestionnaireItem): Promise<void>
}

class StringFieldFiller implements FieldFiller {
  canHandle(item) { return item.type === 'string' }
  async fill(locator, value, item) {
    await locator.fill(String(value))
  }
}

class ChoiceFieldFiller implements FieldFiller {
  canHandle(item) { return item.type === 'choice' }
  async fill(locator, value, item) {
    await locator.click()
    await page.getByRole('option', { name: value, exact: true }).click()
  }
}

class DateFieldFiller implements FieldFiller {
  canHandle(item) { return item.type === 'date' }
  async fill(locator, value, item) {
    // Handle date formatting MM/DD/YYYY
    await page.getByPlaceholder('MM/DD/YYYY').fill(formatDate(value))
  }
}

// etc for: decimal, integer, boolean, group, attachment...
```

### 3. Usage Pattern

```typescript
// Old way (too specific):
await paperworkHelper.fillEmergencyContact({
  relationship: 'Parent',
  firstName: 'Jane',
  lastName: 'Doe',
  // ...
})

// New way (generic):
await questionnaireHelper.fillPage({
  'emergency-contact-relationship': 'Parent',
  'emergency-contact-first-name': 'Jane',
  'emergency-contact-last-name': 'Doe',
  'emergency-contact-number': '1234567890',
  'emergency-contact-address': '123 Main St',
  'emergency-contact-city': 'Boston',
  'emergency-contact-state': 'Massachusetts',
  'emergency-contact-zip': '02101'
})
```

### 4. Integration with Existing Test Data

We can create **data template factories** that generate these value maps:

```typescript
// Test data factories
export const createEmergencyContactData = (overrides?: Partial<EmergencyContactData>) => ({
  'emergency-contact-relationship': overrides?.relationship || 'Parent',
  'emergency-contact-first-name': overrides?.firstName || 'Emergency',
  'emergency-contact-last-name': overrides?.lastName || 'Contact',
  'emergency-contact-number': overrides?.phone || '1234567890',
  'emergency-contact-address': overrides?.address || '123 EC Street',
  'emergency-contact-city': overrides?.city || 'ECCity',
  'emergency-contact-state': overrides?.state || 'CA',
  'emergency-contact-zip': overrides?.zip || '12345'
})

// Usage in tests:
const ecData = createEmergencyContactData({ firstName: 'Jane', lastName: 'Doe' })
await questionnaireHelper.fillPage(ecData)
```

### 5. Config-Aware Field Filling

The helper should check field visibility before filling:

```typescript
async fillPage(valueMap: Record<string, any>): Promise<void> {
  const pageItems = await this.getCurrentPageItems()
  
  for (const [linkId, value] of Object.entries(valueMap)) {
    const item = pageItems.find(i => i.linkId === linkId)
    
    if (!item) {
      console.log(`Field ${linkId} not found on page, skipping`)
      continue
    }
    
    // Check if field is hidden by config
    if (checkFieldHidden(linkId)) {
      console.log(`Field ${linkId} is hidden in config, skipping`)
      continue
    }
    
    // Check enableWhen conditions
    if (!isFieldEnabled(item)) {
      console.log(`Field ${linkId} is disabled by enableWhen, skipping`)
      continue
    }
    
    await this.fillField(linkId, value)
  }
}
```

### 6. Locator Strategy

Since fields are identified by `linkId`, we can use a consistent selector pattern:

```typescript
getFieldLocator(linkId: string): Locator {
  return this.page.locator(`[id="${linkId}"]`)
}

// Or for fields with aria-labelledby:
getFieldLocator(linkId: string): Locator {
  return this.page.locator(`[aria-labelledby="${linkId}-label"]`)
}
```

### 7. Page Navigation

Pages are also questionnaire items with specific linkIds:

```typescript
// Pages have predictable linkIds:
// - 'contact-information-page'
// - 'patient-details-page'
// - 'pcp-page'
// - 'pharmacy-page'
// - 'payment-page'
// - 'responsible-party-page'
// - 'emergency-contact-page'
// - 'employer-information-page'
// - 'photo-id-page'
// - 'consent-forms-page'
// - 'medical-history-page'
// etc.

async navigateToPage(pageLinkId: string): Promise<void> {
  // Wait for page heading
  await this.locators.flowHeading.waitFor({ state: 'visible' })
  
  // Verify we're on the right page (optional)
  const currentPage = await this.getCurrentPageLinkId()
  if (currentPage !== pageLinkId) {
    throw new Error(`Expected page ${pageLinkId}, got ${currentPage}`)
  }
}
```

## Benefits

1. **Generic & Reusable**: Works for any questionnaire structure
2. **Config-Aware**: Automatically handles hidden fields and enableWhen conditions
3. **Maintainable**: Changes to questionnaire structure don't require helper changes
4. **Type-Safe**: Field types drive behavior (string vs choice vs date)
5. **Flexible**: Easy to fill partial data or all fields on a page
6. **Testable**: Can test field filling logic independent of specific forms

## Migration Strategy

1. Create new `PagedQuestionnaireFlowHelper` class
2. Implement field type handlers
3. Create data template factories for common scenarios
4. Update tests to use new helper
5. Remove old specific helpers (PaperworkFlowHelpers, VirtualPaperworkFlowHelpers)

## Next Steps

1. Implement core PagedQuestionnaireFlowHelper
2. Implement field type handlers
3. Create data template factories
4. Test with a simple page (e.g., emergency contact)
5. Expand to cover all page types
