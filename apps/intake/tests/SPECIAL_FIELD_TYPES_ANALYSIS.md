# Special Field Types Analysis: Credit Card & Pharmacy

## Overview

Two special field types in the PagedQuestionnaire implementation require non-standard handling beyond basic field types:

1. **Credit Card Collection** - Stripe payment integration
2. **Pharmacy Collection** - Searchable pharmacy lookup with Places API

## 1. Credit Card Collection

### Questionnaire Structure
- **Type**: `group` with extension `group-type: "credit-card-collection"` (though rendered via inputType)
- **linkId**: `card-payment-page`
- **Primary Field**: `valid-card-on-file` (boolean) - indicates if valid card exists
- **Rendering**: Uses `CreditCardVerification` component
- **InputType in PagedQuestionnaire**: `'Credit Card'` (switch case)

### Implementation Details

**Test Implementation** (Paperwork.ts:855-874):
```typescript
async fillAndAddCreditCardIfDoesntExist(): Promise<void> {
  // Check if card already exists by looking for saved card
  const savedCard = this.page.getByTestId(dataTestIds.cardNumber).first();
  const isCardAlreadyAdded = await savedCard.isVisible().catch(() => false);

  if (isCardAlreadyAdded) {
    return; // Card already exists
  }

  // Fill Stripe iframe fields
  await this.locator.creditCardNumber.fill(CARD_NUMBER);
  await this.locator.creditCardCVC.fill(CARD_CVV);
  await this.locator.creditCardExpiry.fill(CARD_EXP_DATE);
  await this.locator.addCardButton.click();

  // Wait for saved card to appear (Stripe processing + backend save + UI update)
  await expect(this.page.getByTestId(dataTestIds.cardNumber).first()).toBeVisible({ timeout: 60000 });
}
```

**Key Locators** (locators.ts:391-397):
```typescript
// Credit card fields are inside Stripe iframe
const stripeIframe = page.frameLocator('iframe[title="Secure card payment input frame"]');
this.creditCardNumber = stripeIframe.locator('[data-elements-stable-field-name="cardNumber"]');
this.creditCardExpiry = stripeIframe.locator('[data-elements-stable-field-name="cardExpiry"]');
this.creditCardCVC = stripeIframe.locator('[data-elements-stable-field-name="cardCvc"]');
this.addCardButton = page.getByRole('button').filter({ hasText: 'Add card' });
```

**Component** (CreditCardVerification.tsx):
- Uses Stripe Elements for PCI-compliant card input
- Displays saved cards in radio group
- Allows adding new card or selecting existing
- Sets default payment method via mutation
- Updates `valid-card-on-file` boolean when card is selected

### Special Characteristics
1. **Iframe Context**: Card fields are in Stripe iframe, requires frameLocator
2. **Async Processing**: Card save involves Stripe → backend → UI update (60s timeout)
3. **Conditional Fill**: Only fill if no card exists (check visibility of saved card)
4. **Boolean Output**: Sets `valid-card-on-file: true` when card is added/selected
5. **Test Data**: Uses constants `CARD_NUMBER`, `CARD_CVV`, `CARD_EXP_DATE`

---

## 2. Pharmacy Collection

### Questionnaire Structure
- **Type**: `group` with extension `group-type: "pharmacy-collection"`
- **linkId**: `pharmacy-collection`
- **Hidden Fields** (populated by search):
  - `pharmacy-places-id` (string)
  - `pharmacy-places-name` (string)
  - `pharmacy-places-address` (string)
  - `pharmacy-places-saved` (boolean)
  - `erx-pharmacy-id` (string)
- **Rendering**: Uses `PharmacyCollection` component
- **InputType Detection**: `item.groupType == QuestionnaireItemGroupType.PharmacyCollection`

### Implementation Details

**Component** (PharmacyCollection.tsx):
- Renders `PharmacySearch` if no pharmacy selected
- Renders `PharmacyDisplay` if pharmacy already selected
- Loads existing pharmacy from QuestionnaireResponse items

**Search Component** (PharmacySearch.tsx:14-89):
```typescript
export const PharmacySearch: FC<PharmacySearchProps> = ({ onChange, setSelectedPlace }) => {
  // Autocomplete with debounced search (300ms)
  // Searches when input >= 3 characters
  // Calls api.searchPlaces with searchTerm
  // On select: calls api.searchPlaces with placesId
  // Returns structured answer set via makePharmacyCollectionAnswerSet
}
```

**Test Implementation** (Paperwork.ts:804-808):
```typescript
async skipPreferredPharmacy(): Promise<void> {
  // Simply clicks continue without filling
  await this.flowPageContinue();
}
// Note: No current test implementation for actually filling pharmacy
// TODO: "todo fill preferred pharmacy if not required only" (lines 309, 487)
```

### Special Characteristics
1. **API Integration**: Uses `api.searchPlaces` zambda function
2. **Debounced Search**: 300ms debounce, minimum 3 characters
3. **Two-Step Process**:
   - Search by term → get list of pharmacies
   - Select pharmacy → get full details by placesId
4. **Structured Output**: Populates 5 hidden fields via `makePharmacyCollectionAnswerSet`
5. **Autocomplete Widget**: Uses MUI Autocomplete with custom option rendering
6. **Optional**: Most tests skip this (not required only mode)

---

## Proposed Integration into PagedQuestionnaireFlowHelper

### Approach 1: Add Special Case Methods

Add specific methods to handle these non-standard interactions:

```typescript
// In PagedQuestionnaireFlowHelper class

/**
 * Fill credit card information (Stripe iframe interaction)
 */
async fillCreditCard(cardData: {
  number: string;
  expiry: string;
  cvc: string;
}): Promise<void> {
  // Check if card already exists
  const savedCard = this.page.getByTestId(dataTestIds.cardNumber).first();
  const isCardAlreadyAdded = await savedCard.isVisible().catch(() => false);

  if (isCardAlreadyAdded) {
    console.log('Credit card already on file, skipping entry');
    return;
  }

  // Enter card in Stripe iframe
  const stripeIframe = this.page.frameLocator('iframe[title="Secure card payment input frame"]');
  await stripeIframe.locator('[data-elements-stable-field-name="cardNumber"]').fill(cardData.number);
  await stripeIframe.locator('[data-elements-stable-field-name="cardExpiry"]').fill(cardData.expiry);
  await stripeIframe.locator('[data-elements-stable-field-name="cardCvc"]').fill(cardData.cvc);
  
  // Click add card button
  await this.page.getByRole('button', { name: 'Add card' }).click();
  
  // Wait for card to be saved and visible
  await expect(this.page.getByTestId(dataTestIds.cardNumber).first()).toBeVisible({ timeout: 60000 });
  
  console.log('Credit card added successfully');
}

/**
 * Search and select pharmacy
 */
async fillPharmacy(pharmacyName: string): Promise<void> {
  // Type in autocomplete to trigger search
  const autocomplete = this.page.getByRole('combobox', { name: /pharmacy/i });
  await autocomplete.click();
  await autocomplete.fill(pharmacyName);
  
  // Wait for search results to load (debounced 300ms + API call)
  await this.page.waitForTimeout(500);
  
  // Select first matching option
  const option = this.page.getByRole('option', { name: new RegExp(pharmacyName, 'i') }).first();
  await option.click();
  
  // Wait for selection to process (Places API call + form population)
  await this.page.waitForTimeout(1000);
  
  console.log(`Selected pharmacy: ${pharmacyName}`);
}

/**
 * Skip pharmacy selection (click continue without filling)
 */
async skipPharmacy(): Promise<void> {
  console.log('Skipping pharmacy selection (optional field)');
  // Pharmacy is optional, just continue
}
```

### Approach 2: Detect and Handle Automatically in fillField

Extend `fillField` to detect special groups:

```typescript
async fillField(linkId: string, value: any): Promise<void> {
  const item = this.findItem(linkId);
  
  if (!item) {
    console.log(`Field ${linkId} not found in questionnaire`);
    return;
  }

  // Check for special group types
  if (item.type === 'group' && item.groupType) {
    switch (item.groupType) {
      case QuestionnaireItemGroupType.CreditCardCollection:
        if (typeof value === 'object' && 'number' in value) {
          await this.fillCreditCard(value);
        }
        return;
      
      case QuestionnaireItemGroupType.PharmacyCollection:
        if (typeof value === 'string') {
          await this.fillPharmacy(value);
        }
        return;
    }
  }

  // Check for special inputType (Credit Card as boolean)
  if (linkId === 'valid-card-on-file' && typeof value === 'object') {
    await this.fillCreditCard(value);
    return;
  }

  // Regular field filling logic...
}
```

### Approach 3: Hybrid (Recommended)

1. **Explicit methods** for credit card and pharmacy (clear, documented, easy to use)
2. **Auto-detection** in `fillPage` when it encounters known linkIds
3. **Data template support** for both special cases

```typescript
// Data templates
export const createCreditCardData = (): FieldTestData => ({
  valid: {
    'valid-card-on-file': {
      number: CARD_NUMBER,
      expiry: CARD_EXP_DATE,
      cvc: CARD_CVV,
    },
  },
  invalid: {
    'valid-card-on-file': {
      number: '4242424242424242', // Invalid test card
      expiry: '12/20', // Expired
      cvc: '12', // Invalid length
    },
  },
});

export const createPharmacyData = (pharmacyName?: string): FieldTestData => ({
  valid: {
    'pharmacy-collection': pharmacyName || 'CVS Pharmacy',
  },
  // Pharmacy is optional, skip if needed
});
```

## Recommendation

**Implement Approach 3** with:

1. **Add special methods** to PagedQuestionnaireFlowHelper:
   - `fillCreditCard(cardData)` - handles Stripe iframe interaction
   - `fillPharmacy(name)` - handles search and selection
   - `skipPharmacy()` - explicitly skip (for readability)

2. **Add detection** in `fillField`:
   - When `linkId === 'valid-card-on-file'` and value is object → call `fillCreditCard`
   - When `linkId === 'pharmacy-collection'` and value is string → call `fillPharmacy`
   - When `linkId === 'pharmacy-collection'` and value is null/undefined → `skipPharmacy`

3. **Add data templates** for both:
   - `createCreditCardData()` - returns valid/invalid card info
   - `createPharmacyData(name?)` - returns pharmacy name or skip

4. **Benefits**:
   - Clear explicit API for special cases
   - Works with generic `fillPage()` approach
   - Type-safe with proper interfaces
   - Easy to test both success and failure cases
   - Maintains consistency with generic field approach

## Implementation Notes

### Credit Card
- **Import needed**: `dataTestIds` from test helpers
- **Constants**: Define `CARD_NUMBER`, `CARD_EXP_DATE`, `CARD_CVV` test constants
- **Timeout**: 60s wait for Stripe processing is critical
- **Frame context**: Must use `frameLocator` for Stripe iframe

### Pharmacy  
- **Optional field**: Most configs skip this (not required)
- **API dependency**: Requires zambda client and Places API
- **Timing**: Need proper waits for debounce (300ms) and API calls
- **Selection**: Uses MUI Autocomplete, select by option role
- **Alternative**: "Can't find? Add manually" boolean for manual entry (separate linkId)

### Testing Strategy
1. **Happy path**: Card added successfully, pharmacy found and selected
2. **Skip path**: Card exists (no-op), pharmacy skipped (optional)
3. **Error handling**: Stripe timeout, pharmacy not found
4. **Validation**: Invalid card data, empty pharmacy search
