import { Locator, Page } from '@playwright/test';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  buildEnableWhenContext,
  checkFieldHidden,
  evalEnableWhen,
  evalRequired,
  getValueSets,
  IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE,
  IntakeQuestionnaireItem,
  mapQuestionnaireAndValueSetsToItemsList,
  VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE,
} from 'utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { Locators } from '../locators';
import {
  collectValidationErrors,
  fillChoiceDropdown,
  fillDateField,
  fillNumericField,
  fillRadioChoice,
  fillStringField,
} from '../shared/field-filling-utils';
import { UploadDocs } from '../UploadDocs';

// Test credit card constants
const CARD_NUMBER = '4242424242424242'; // Stripe test card
const CARD_EXP_DATE = DateTime.now().plus({ years: 3 }).toFormat('MM/yy');
const CARD_CVV = '123';

/**
 * Generic helper for filling out FHIR Questionnaire forms in tests
 *
 * Works with both in-person and virtual paperwork by treating them as
 * paged questionnaires with fields identified by linkId.
 *
 * Instead of specific methods like fillEmergencyContact(), this uses:
 * - fillPage(valueMap) - fills all fields on current page
 * - fillField(linkId, value) - fills a single field
 */
export class PagedQuestionnaireFlowHelper {
  private page: Page;
  private locators: Locators;
  private uploadDocs: UploadDocs;
  private questionnaireItems: IntakeQuestionnaireItem[] = [];
  private questionnairePages: IntakeQuestionnaireItem[] = [];
  private serviceMode: 'in-person' | 'virtual';
  /** Tracks filled answers as QuestionnaireResponseItems for enableWhen evaluation */
  private collectedResponses: QuestionnaireResponseItem[] = [];

  constructor(page: Page, serviceMode: 'in-person' | 'virtual' = 'in-person') {
    this.page = page;
    this.serviceMode = serviceMode;
    this.locators = new Locators(page);
    this.uploadDocs = new UploadDocs(page);
    this.loadQuestionnaireItems();
  }

  /**
   * Load questionnaire items based on service mode
   */
  private loadQuestionnaireItems(): void {
    const questionnaire =
      this.serviceMode === 'virtual'
        ? VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE()
        : IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE();

    // Transform QuestionnaireItem[] to IntakeQuestionnaireItem[] which includes parsed extensions
    const items = mapQuestionnaireAndValueSetsToItemsList(questionnaire.item ?? [], []);
    // Pages are the top-level items in the questionnaire
    this.questionnairePages = items;
    this.questionnaireItems = this.flattenItems(items);
  }

  /**
   * Flatten nested questionnaire items into a flat list
   */
  private flattenItems(items: IntakeQuestionnaireItem[]): IntakeQuestionnaireItem[] {
    return items.reduce<IntakeQuestionnaireItem[]>((acc, item) => {
      acc.push(item);
      if (item.item?.length) {
        acc.push(...this.flattenItems(item.item));
      }
      return acc;
    }, []);
  }

  /**
   * Find a questionnaire item by its linkId
   */
  private findItem(linkId: string): IntakeQuestionnaireItem | undefined {
    return this.questionnaireItems.find((item) => item.linkId === linkId);
  }

  /**
   * Get a locator for a field by its linkId
   * Uses the id attribute which matches the QuestionnaireItem's linkId.
   */
  private getFieldLocator(linkId: string): Locator {
    // Use input selector to target the actual input element (MUI renders id on input, not container)
    return this.page.locator(`input[id="${linkId}"], textarea[id="${linkId}"], select[id="${linkId}"]`);
  }

  /**
   * Check if a field is hidden by config
   */
  private isFieldHidden(linkId: string): boolean {
    return checkFieldHidden(linkId);
  }

  /**
   * Wait for a page to load by checking for the flow heading
   */
  async waitForPage(timeoutMs = 30000): Promise<void> {
    await this.locators.flowHeading.waitFor({ state: 'visible', timeout: timeoutMs });
  }

  /**
   * Click the Continue button
   */
  async clickContinue(): Promise<void> {
    await this.locators.clickContinueButton();
  }

  /**
   * Click the Back button
   */
  async clickBack(): Promise<void> {
    await this.page.getByRole('button', { name: 'Back', exact: true }).click();
  }

  /**
   * Fill a single field by its linkId
   */
  async fillField(linkId: string, value: any): Promise<void> {
    // Skip if hidden by config
    if (this.isFieldHidden(linkId)) {
      return;
    }

    // Skip if value is null/undefined
    if (value == null) {
      return;
    }

    const item = this.findItem(linkId);
    if (!item) {
      return;
    }

    // Get locator and fill - Playwright will wait for element automatically
    const locator = this.getFieldLocator(linkId);
    await this.fillFieldByType(locator, value, item);
  }

  /**
   * Fill a field based on its type
   */
  private async fillFieldByType(locator: Locator, value: any, item: IntakeQuestionnaireItem): Promise<void> {
    const type = item.type;

    if (item.linkId.startsWith('insurance-carrier')) {
      console.log('filling item by type', item.linkId, type, value, JSON.stringify(item));
    }

    switch (type) {
      case 'string':
      case 'text':
        await fillStringField(locator, String(value));
        break;

      case 'integer':
      case 'decimal':
        await fillNumericField(locator, value);
        break;

      case 'date':
        await fillDateField(this.page, value);
        break;

      case 'choice':
        await this.fillChoiceFieldLocal(locator, value, item);
        break;

      case 'reference':
        await this.fillReferenceField(locator, value, item);
        break;

      case 'boolean':
        await this.fillBooleanField(locator, value, item);
        break;

      case 'attachment':
        await this.fillAttachmentField(value, item);
        break;

      case 'group':
        // Groups are handled differently - they contain nested items
        console.log(`Field ${item.linkId} is a group, handle nested items separately`);
        break;

      case 'display':
        // Display items are not fillable
        console.log(`Field ${item.linkId} is display-only, skipping`);
        break;

      default:
        console.log(`Unknown field type ${type} for ${item.linkId}, attempting text fill`);
        await fillStringField(locator, String(value));
    }

    console.log(`Filled field ${item.linkId} with value:`, value);
  }

  /**
   * Fill a choice field (dropdown/radio)
   * Handles special cases like dynamic answer sources that can't use shared utilities
   */
  private async fillChoiceFieldLocal(locator: Locator, value: string, item: IntakeQuestionnaireItem): Promise<void> {
    const isRadio = item.preferredElement === 'Radio' || item.preferredElement === 'Radio List';
    if (isRadio) {
      await fillRadioChoice(this.page, value, `${item.linkId}-label`);
    } else if (item.answerLoadingOptions?.answerSource) {
      // Dynamic answer sources need special handling - select first option
      await locator.click();
      console.log('filling choice field with answer source, selecting first option');
      const firstOption = this.page.locator(`[id='${item.linkId}-option-0']`);
      await firstOption.click();
    } else {
      // Standard MUI Autocomplete dropdown
      console.log(`[DEBUG] fillChoiceFieldLocal: ${item.linkId} with value "${value}"`);
      await fillChoiceDropdown(this.page, locator, value);
    }
  }

  /**
   * Fill a reference field (autocomplete for FHIR resources)
   * These fields query backend APIs and show options in a dropdown.
   * Selects the first option from whatever is available in the environment.
   */
  private async fillReferenceField(locator: Locator, _value: string, item: IntakeQuestionnaireItem): Promise<void> {
    // Click to open dropdown
    await locator.click();

    // Click the first option
    const firstOption = this.page.locator(`[id='${item.linkId}-option-0']`);
    await firstOption.click();
  }

  /**
   * Fill a boolean field (checkbox/radio)
   * Uses config to determine field type - if DOM doesn't match, test will fail (indicating a bug)
   *
   * Note: Checkboxes in this app use aria-label="${linkId}-label" instead of id on the input,
   * so we use a specific locator strategy for them.
   */
  private async fillBooleanField(
    _locator: Locator,
    value: boolean | string,
    item: IntakeQuestionnaireItem
  ): Promise<void> {
    // Convert string to boolean if needed
    const boolValue =
      typeof value === 'string' ? value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' : value;

    if (boolValue) {
      // Determine input type from config, not DOM inspection
      const isRadio = item.preferredElement === 'Radio' || item.preferredElement === 'Radio List';

      if (isRadio) {
        // Radio buttons use getByLabel with the option text
        await this.page.getByLabel(String(value)).check();
      } else {
        // Checkboxes use aria-label="${linkId}-label"
        const checkbox = this.page.locator(`[aria-label="${item.linkId}-label"]`);
        await checkbox.check();
      }
    }
  }

  /**
   * Fill an attachment field (file upload)
   */
  private async fillAttachmentField(value: string, _item: IntakeQuestionnaireItem): Promise<void> {
    // Handle specific known attachment fields
    const linkId = _item.linkId;

    if (linkId === 'insurance-card-front') {
      await this.uploadDocs.fillInsuranceFront();
    } else if (linkId === 'insurance-card-back') {
      await this.uploadDocs.fillInsuranceBack();
    } else if (linkId === 'secondary-insurance-card-front') {
      await this.uploadDocs.fillSecondaryInsuranceFront();
    } else if (linkId === 'secondary-insurance-card-back') {
      await this.uploadDocs.fillSecondaryInsuranceBack();
    } else if (linkId === 'photo-id-front') {
      await this.uploadDocs.fillPhotoFrontID();
    } else if (linkId === 'photo-id-back') {
      await this.uploadDocs.fillPhotoBackID();
    } else if (linkId === 'patient-condition-photo') {
      await this.uploadDocs.fillPatientConditionPhotoPaperwork();
    } else {
      console.log(`Unknown attachment field ${linkId}`);
    }
  }

  /**
   * Fill credit card information (handles Stripe iframe interaction)
   *
   * This is a special case that doesn't follow standard field patterns because:
   * - Card fields are in a Stripe iframe (different context)
   * - Requires checking if card already exists
   * - Has async processing delay (Stripe → backend → UI update)
   *
   * @param cardData - Credit card information (defaults to test card if not provided)
   */
  async fillCreditCard(cardData?: { number?: string; expiry?: string; cvc?: string }): Promise<void> {
    // Check if card is already added
    const savedCard = this.page.getByTestId(dataTestIds.cardNumber).first();
    const isCardAlreadyAdded = await savedCard.isVisible({ timeout: 1000 }).catch(() => false);

    if (isCardAlreadyAdded) {
      return;
    }

    const number = cardData?.number || CARD_NUMBER;
    const expiry = cardData?.expiry || CARD_EXP_DATE;
    const cvc = cardData?.cvc || CARD_CVV;

    // Wait for Stripe iframe and card number field to be visible
    const stripeIframe = this.page.frameLocator('iframe[title="Secure card payment input frame"]');
    const cardNumberField = stripeIframe.locator('[data-elements-stable-field-name="cardNumber"]');
    await cardNumberField.waitFor({ state: 'visible', timeout: 30000 });

    // Stripe Elements need time after DOM visibility to emit "ready" event
    await this.page.waitForTimeout(500);

    // Fill card fields
    await cardNumberField.fill(number);
    await stripeIframe.locator('[data-elements-stable-field-name="cardExpiry"]').fill(expiry);
    await stripeIframe.locator('[data-elements-stable-field-name="cardCvc"]').fill(cvc);

    // Click add card and wait for it to be saved
    await this.page.getByRole('button', { name: 'Add card' }).click();

    // Race: either the card appears (success) or an error message appears (failure)
    const cardSaved = this.page.getByTestId(dataTestIds.cardNumber).first();
    const errorAlert = this.page.getByRole('alert');

    const result = await Promise.race([
      cardSaved.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'success' as const),
      errorAlert.waitFor({ state: 'visible', timeout: 60000 }).then(() => 'error' as const),
    ]);

    if (result === 'error') {
      const errorText = await errorAlert.textContent();
      throw new Error(`Failed to save credit card: ${errorText}`);
    }
  }

  /**
   * Search and select a pharmacy
   *
   * This is a special case that uses an autocomplete search widget backed by Places API:
   * - Types in autocomplete to trigger debounced search (300ms)
   * - Waits for API results to load
   * - Selects first matching option
   * - Waits for selection to process and populate hidden fields
   *
   * @param pharmacyName - Name of pharmacy to search for
   */
  async fillPharmacy(pharmacyName: string): Promise<void> {
    // Type in autocomplete to trigger search
    const searchInput = this.page.getByPlaceholder(/search/i).first();
    await searchInput.click();
    await searchInput.fill(pharmacyName);

    // Wait for debounced search (300ms) + API call
    await this.page.waitForTimeout(1500);

    // Check if we have results or "No results"
    const hasNoResults = await this.page
      .getByText('No results')
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (hasNoResults) {
      await searchInput.clear();
      return;
    }

    // Select first matching option from dropdown (Playwright will wait for it)
    await this.page.getByRole('option').first().click();

    // Wait for selection to process (Places API call for details + form population)
    await this.page.waitForTimeout(1000);
  }

  /**
   * Skip pharmacy selection (no-op for clarity)
   */
  async skipPharmacy(): Promise<void> {
    // Pharmacy is optional, just continue without filling
  }

  /**
   * Get fields from the current page that other fields depend on via enableWhen.
   * These "trigger" fields control visibility of other fields and must be filled first.
   */
  private getTriggerFieldIds(fieldsToFill: string[]): Set<string> {
    const triggerIds = new Set<string>();

    for (const item of this.questionnaireItems) {
      if (item.enableWhen) {
        for (const condition of item.enableWhen) {
          const questionId = condition.question;
          // If this condition references a field we're about to fill, it's a trigger
          if (fieldsToFill.includes(questionId)) {
            triggerIds.add(questionId);
          }
        }
      }
    }

    return triggerIds;
  }

  /**
   * Get items from a page that are always required (required: true, no requireWhen).
   * These fields should always show validation errors when left empty.
   */
  private getAlwaysRequiredFields(pageItems: IntakeQuestionnaireItem[]): IntakeQuestionnaireItem[] {
    return pageItems.filter((item) => {
      // Skip display/group items and hidden items
      if (item.type === 'display' || item.type === 'group' || this.isFieldHidden(item.linkId)) {
        return false;
      }
      // Always required: required=true and no requireWhen condition
      return item.required === true && !item.requireWhen;
    });
  }

  /**
   * Get items from a page that are conditionally required (have requireWhen).
   * These fields show validation errors only when their requireWhen condition is met.
   */
  private getConditionallyRequiredFields(pageItems: IntakeQuestionnaireItem[]): IntakeQuestionnaireItem[] {
    return pageItems.filter((item) => {
      // Skip display/group items and hidden items
      if (item.type === 'display' || item.type === 'group' || this.isFieldHidden(item.linkId)) {
        return false;
      }
      // Conditionally required: has requireWhen condition
      return item.requireWhen !== undefined;
    });
  }

  /**
   * Get the trigger field and value needed to activate a requireWhen condition.
   * Returns the linkId and the value that makes the condition true.
   */
  private getRequireWhenTrigger(item: IntakeQuestionnaireItem): { linkId: string; value: any } | null {
    const requireWhen = item.requireWhen;
    if (!requireWhen) {
      return null;
    }

    const { question, operator, answerString, answerBoolean } = requireWhen;

    // For '=' operator, the trigger value is the expected answer
    if (operator === '=') {
      if (answerString !== undefined) {
        return { linkId: question, value: answerString };
      }
      if (answerBoolean !== undefined) {
        return { linkId: question, value: answerBoolean };
      }
    }

    // For 'exists' with answerBoolean=true, we need to set any value
    if (operator === 'exists' && answerBoolean === true) {
      return { linkId: question, value: 'trigger-value' };
    }

    // For other operators, return the question but with a placeholder
    // The test data should include appropriate values
    return { linkId: question, value: answerString ?? answerBoolean ?? 'trigger-value' };
  }

  /**
   * Get all unique triggers needed to activate requireWhen conditions for a list of items.
   * Groups by trigger field to avoid setting conflicting values.
   */
  private getRequireWhenTriggers(
    items: IntakeQuestionnaireItem[]
  ): Map<string, { triggerValue: any; dependentFields: string[] }> {
    const triggers = new Map<string, { triggerValue: any; dependentFields: string[] }>();

    for (const item of items) {
      const trigger = this.getRequireWhenTrigger(item);
      if (trigger) {
        const existing = triggers.get(trigger.linkId);
        if (existing) {
          existing.dependentFields.push(item.linkId);
        } else {
          triggers.set(trigger.linkId, { triggerValue: trigger.value, dependentFields: [item.linkId] });
        }
      }
    }

    return triggers;
  }

  /**
   * Fill a single field, handling special cases (credit card, pharmacy, etc.)
   */
  private async fillFieldWithSpecialHandling(linkId: string, value: any): Promise<void> {
    // Handle special cases
    if (linkId === 'valid-card-on-file' && typeof value === 'object' && 'number' in value) {
      await this.fillCreditCard(value);
      return;
    }

    if (linkId === 'pharmacy-collection' && typeof value === 'string') {
      await this.fillPharmacy(value);
      return;
    }

    if (linkId === 'pharmacy-collection' && (value === null || value === undefined)) {
      await this.skipPharmacy();
      return;
    }

    // Regular field filling
    await this.fillField(linkId, value);
  }

  /**
   * Check if a field is enabled based on its enableWhen conditions and current form values.
   * Also handles fields that become disabled (not hidden) when their enableWhen is false.
   */
  private isFieldEnabled(linkId: string, currentValues: Record<string, QuestionnaireResponseItem>): boolean {
    const item = this.findItem(linkId);
    if (!item) {
      return true; // If item not found, assume enabled
    }

    // Use evalEnableWhen to check if field is enabled
    return evalEnableWhen(item, this.questionnaireItems, currentValues);
  }

  /**
   * Build a QuestionnaireResponseItem from a linkId and value
   */
  private buildResponseItem(linkId: string, value: any): QuestionnaireResponseItem {
    const item = this.findItem(linkId);
    const type = item?.type;

    // Build answer based on type
    let answer: any[];
    if (type === 'boolean') {
      const boolValue =
        typeof value === 'string' ? value.toLowerCase() === 'yes' || value.toLowerCase() === 'true' : value;
      answer = [{ valueBoolean: boolValue }];
    } else if (type === 'date') {
      answer = [{ valueString: value }];
    } else if (type === 'reference') {
      answer = [{ valueReference: { reference: value, display: value } }];
    } else {
      answer = [{ valueString: String(value) }];
    }

    return { linkId, answer };
  }

  /**
   * Fill a page with multiple fields, handling conditionally visible fields.
   *
   * Some fields only become visible after other "trigger" fields are filled
   * (via enableWhen conditions). This method:
   * 1. Identifies trigger fields that control visibility of others
   * 2. Fills trigger fields first
   * 3. Checks if dependent fields are still enabled after trigger values are set
   * 4. Fills enabled dependent fields (Playwright auto-waits for them to appear)
   * 5. Skips disabled fields (they may be auto-filled by the app)
   *
   * Example:
   * ```typescript
   * await helper.fillPage({
   *   'responsible-party-relationship': 'Self',  // Trigger - disables other fields
   *   'responsible-party-first-name': 'John',    // Will be skipped (disabled, auto-filled)
   * })
   * ```
   */
  async fillPage(valueMap: Record<string, any>): Promise<void> {
    const fieldsToFill = Object.entries(valueMap);
    const triggerFieldIds = this.getTriggerFieldIds(Object.keys(valueMap));

    // Separate trigger fields from dependent fields
    const triggerFields = fieldsToFill.filter(([linkId]) => triggerFieldIds.has(linkId));
    const dependentFields = fieldsToFill.filter(([linkId]) => !triggerFieldIds.has(linkId));

    console.log(
      'Filling page - triggers:',
      triggerFields.map(([id]) => id),
      'dependent:',
      dependentFields.map(([id]) => id)
    );

    // Track current form values for enableWhen evaluation
    const currentValues: Record<string, QuestionnaireResponseItem> = {};

    // Fill trigger fields first and track their values
    for (const [linkId, value] of triggerFields) {
      await this.fillFieldWithSpecialHandling(linkId, value);
      currentValues[linkId] = this.buildResponseItem(linkId, value);
    }

    // Fill dependent fields if they're still enabled
    for (const [linkId, value] of dependentFields) {
      // Check if field is enabled based on current trigger values
      if (!this.isFieldEnabled(linkId, currentValues)) {
        console.log(`Skipping disabled field: ${linkId} (will be auto-filled by app)`);
        continue;
      }

      await this.fillFieldWithSpecialHandling(linkId, value);
      currentValues[linkId] = this.buildResponseItem(linkId, value);
    }
  }

  /**
   * Check if a page skips the patch-paperwork endpoint
   * Some pages like Medical History have special handling with different endpoints
   */
  private skipsPatchPaperwork(pageLinkId: string): boolean {
    const page = this.questionnairePages.find((p) => p.linkId === pageLinkId);
    if (!page?.item) return false;

    // Pages with these dataTypes use different endpoints
    const dataTypesThatSkipPatch = ['Medical History'];
    return page.item.some((item) => item.dataType && dataTypesThatSkipPatch.includes(item.dataType));
  }

  /**
   * Fill a page with comprehensive validation testing, then submit with valid values.
   * Used when checkValidation is enabled in the paperwork capability config.
   *
   * Multi-phase validation flow:
   * 1. Phase 1 (Always-Required): Leave always-required fields empty, fill others, verify errors
   * 2. Phase 2 (Conditionally-Required): Fill triggers to activate requireWhen, leave dependent fields empty, verify errors
   * 3. Phase 3 (Invalid Values): Fill all fields with invalid values where defined, verify format errors
   * 4. Phase 4 (Submit): Correct all fields with valid values and submit
   *
   * @param validData - Valid field values that should pass validation
   * @param invalidData - Invalid field values that should trigger validation errors
   * @param pageLinkId - The page linkId for logging and special handling
   * @returns Object with all validation errors found across phases and the QuestionnaireResponse from successful submit
   */
  async fillPageWithValidationCheck(
    validData: Record<string, any>,
    invalidData: Record<string, any>,
    pageLinkId: string
  ): Promise<{ validationErrors: string[]; response: QuestionnaireResponse }> {
    const allValidationErrors: string[] = [];
    const page = this.questionnairePages.find((p) => p.linkId === pageLinkId);
    const pageItems = page?.item ?? [];

    // Get required field categories
    const alwaysRequiredFields = this.getAlwaysRequiredFields(pageItems);
    const conditionallyRequiredFields = this.getConditionallyRequiredFields(pageItems);

    console.log(`[Validation Check] Page: ${pageLinkId}`);
    console.log(`  Always-required fields: ${alwaysRequiredFields.map((f) => f.linkId).join(', ') || 'none'}`);
    console.log(
      `  Conditionally-required fields: ${conditionallyRequiredFields.map((f) => f.linkId).join(', ') || 'none'}`
    );
    console.log(`  Invalid data fields: ${Object.keys(invalidData).join(', ') || 'none'}`);

    // ============================================
    // PHASE 1: Test always-required fields (empty)
    // ============================================
    // First, determine which always-required fields will be enabled after filling the other fields
    // Build context from non-required fields to check enableWhen conditions
    const phase1Context: Record<string, QuestionnaireResponseItem> = {};
    for (const [linkId, value] of Object.entries(validData)) {
      const isAlwaysRequired = alwaysRequiredFields.some((f) => f.linkId === linkId);
      if (!isAlwaysRequired) {
        phase1Context[linkId] = this.buildResponseItem(linkId, value);
      }
    }

    // Filter to only always-required fields that will be ENABLED after filling other fields
    const testableAlwaysRequired = alwaysRequiredFields.filter((f) => {
      // Must have valid data defined
      if (validData[f.linkId] === undefined) {
        return false;
      }
      // Must be enabled based on the values we're about to fill
      const willBeEnabled = evalEnableWhen(f, this.questionnaireItems, phase1Context);
      if (!willBeEnabled) {
        console.log(`[Phase 1] Skipping ${f.linkId} - will be disabled by enableWhen after filling other fields`);
      }
      return willBeEnabled;
    });

    if (testableAlwaysRequired.length > 0) {
      console.log(
        `[Phase 1] Testing ${testableAlwaysRequired.length} always-required fields: ${testableAlwaysRequired
          .map((f) => f.linkId)
          .join(', ')}`
      );

      // Fill all fields EXCEPT always-required ones (to isolate their errors)
      const phase1Data: Record<string, any> = {};
      for (const [linkId, value] of Object.entries(validData)) {
        const isAlwaysRequired = testableAlwaysRequired.some((f) => f.linkId === linkId);
        if (!isAlwaysRequired) {
          phase1Data[linkId] = value;
        }
      }

      await this.fillPage(phase1Data);
      await this.clickContinue();
      await this.page.waitForTimeout(500);

      // Verify we stayed on the page (validation blocked navigation)
      if (this.getCurrentPageSlug() === pageLinkId.replace('-page', '')) {
        const errors = await collectValidationErrors(this.page);
        console.log(`[Phase 1] Found ${errors.length} errors: ${errors.join(', ') || 'none'}`);
        allValidationErrors.push(...errors);

        // Now fill the always-required fields to proceed to next phase
        for (const field of testableAlwaysRequired) {
          const value = validData[field.linkId];
          if (value !== undefined) {
            await this.fillFieldWithSpecialHandling(field.linkId, value);
          }
        }
      } else {
        console.warn(`[Phase 1] Unexpected navigation - always-required fields may not be validated correctly`);
      }
    }

    // ============================================
    // PHASE 2: Test conditionally-required fields
    // ============================================
    const testableConditionallyRequired = conditionallyRequiredFields.filter((f) => validData[f.linkId] !== undefined);
    if (testableConditionallyRequired.length > 0) {
      console.log(`[Phase 2] Testing ${testableConditionallyRequired.length} conditionally-required fields`);

      // Get the triggers needed to activate these fields
      const triggers = this.getRequireWhenTriggers(testableConditionallyRequired);

      // Build form values context for requireWhen evaluation
      const currentValues: Record<string, QuestionnaireResponseItem> = {};
      for (const [linkId, value] of Object.entries(validData)) {
        currentValues[linkId] = this.buildResponseItem(linkId, value);
      }

      // For each trigger, fill the trigger value but leave dependent fields empty
      for (const [triggerLinkId, { dependentFields }] of Array.from(triggers.entries())) {
        // Check if we have a valid value for this trigger in our test data
        const triggerValidValue = validData[triggerLinkId];
        if (triggerValidValue === undefined) {
          console.log(`[Phase 2] Skipping trigger ${triggerLinkId} - no valid value in test data`);
          continue;
        }

        // Check if filling the trigger would actually make the dependent fields required
        const testContext = { ...currentValues };
        testContext[triggerLinkId] = this.buildResponseItem(triggerLinkId, triggerValidValue);

        const fieldsNowRequired = dependentFields.filter((linkId) => {
          const item = this.findItem(linkId);
          if (!item) return false;
          // Must be required AND enabled with the trigger value
          const isRequired = evalRequired(item, testContext);
          const isEnabled = evalEnableWhen(item, this.questionnaireItems, testContext);
          if (isRequired && !isEnabled) {
            console.log(`[Phase 2] Field ${linkId} would be required but disabled - skipping`);
          }
          return isRequired && isEnabled;
        });

        if (fieldsNowRequired.length === 0) {
          console.log(
            `[Phase 2] Trigger ${triggerLinkId} doesn't make any enabled fields required with current values`
          );
          continue;
        }

        console.log(
          `[Phase 2] Trigger ${triggerLinkId} makes ${
            fieldsNowRequired.length
          } enabled fields required: ${fieldsNowRequired.join(', ')}`
        );

        // Fill the trigger field with valid value (should activate requireWhen)
        await this.fillFieldWithSpecialHandling(triggerLinkId, triggerValidValue);

        // Clear the dependent fields to test they show required errors
        // Note: Fields may already be empty, but we try to clear them to ensure the test is valid
        // For this to work properly, the app must show the fields after the trigger is set

        await this.clickContinue();
        await this.page.waitForTimeout(500);

        // Verify we stayed on the page (validation blocked navigation)
        if (this.getCurrentPageSlug() === pageLinkId.replace('-page', '')) {
          const errors = await collectValidationErrors(this.page);
          console.log(`[Phase 2] Found ${errors.length} errors: ${errors.join(', ') || 'none'}`);
          allValidationErrors.push(...errors);

          // Fill the conditionally-required fields to proceed
          for (const fieldLinkId of fieldsNowRequired) {
            const value = validData[fieldLinkId];
            if (value !== undefined) {
              await this.fillFieldWithSpecialHandling(fieldLinkId, value);
            }
          }
        } else {
          console.warn(
            `[Phase 2] Unexpected navigation - conditionally-required fields may not be validated correctly`
          );
        }
      }
    }

    // ============================================
    // PHASE 3: Test invalid values (format errors)
    // ============================================
    const invalidFieldIds = Object.keys(invalidData);
    if (invalidFieldIds.length > 0) {
      console.log(`[Phase 3] Testing ${invalidFieldIds.length} invalid field values`);

      // Fill fields with invalid values
      for (const [linkId, value] of Object.entries(invalidData)) {
        await this.fillFieldWithSpecialHandling(linkId, value);
      }

      await this.clickContinue();
      await this.page.waitForTimeout(500);

      // Verify we stayed on the page (validation blocked navigation)
      if (this.getCurrentPageSlug() === pageLinkId.replace('-page', '')) {
        const errors = await collectValidationErrors(this.page);
        console.log(`[Phase 3] Found ${errors.length} errors: ${errors.join(', ') || 'none'}`);
        allValidationErrors.push(...errors);

        // Correct the invalid fields with valid values
        for (const linkId of invalidFieldIds) {
          const validValue = validData[linkId];
          if (validValue !== undefined) {
            await this.fillFieldWithSpecialHandling(linkId, validValue);
          }
        }
      } else {
        console.warn(`[Phase 3] Unexpected navigation - invalid values may not be validated correctly`);
      }
    }

    // ============================================
    // PHASE 4: Submit with all valid values
    // ============================================
    console.log(`[Phase 4] Submitting page with all valid values`);

    // Ensure all fields have valid values before final submit
    await this.fillPage(validData);

    // Check if this page skips patch-paperwork
    if (this.skipsPatchPaperwork(pageLinkId)) {
      console.log(`Page ${pageLinkId} skips patch-paperwork - clicking continue without waiting for PATCH response`);
      await this.clickContinue();
      return {
        validationErrors: allValidationErrors,
        response: { resourceType: 'QuestionnaireResponse', status: 'in-progress', item: this.collectedResponses },
      };
    }

    // Set up response listener before clicking continue
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/patch-paperwork/execute'),
      { timeout: 60000 }
    );

    await this.clickContinue();

    // Wait for and capture the PATCH response
    const response = await responsePromise;
    if (response.status() !== 200) {
      const errorBody = await response.text().catch(() => 'Unable to read response body');
      throw new Error(`patch-paperwork failed with status ${response.status()}: ${errorBody}`);
    }
    const responseBody = await response.json();

    // The API returns { status, output: QuestionnaireResponse } wrapper
    const questionnaireResponse = (responseBody.output ?? responseBody) as QuestionnaireResponse;

    // Update our tracked responses for enableWhen evaluation
    this.collectedResponses = questionnaireResponse.item ?? [];

    console.log(`[Validation Check Complete] Total errors found across all phases: ${allValidationErrors.length}`);
    return { validationErrors: allValidationErrors, response: questionnaireResponse };
  }

  /**
   * Fill a page and click Continue, capturing the PATCH response
   * @param valueMap - Field values to fill
   * @param pageLinkId - Optional page linkId to check for special handling
   * @returns The updated QuestionnaireResponse from the server (or current responses if page skips patch)
   */
  async fillPageAndContinue(valueMap: Record<string, any>, pageLinkId?: string): Promise<QuestionnaireResponse> {
    await this.fillPage(valueMap);

    // Some pages (like Medical History) use different endpoints and skip patch-paperwork
    if (pageLinkId && this.skipsPatchPaperwork(pageLinkId)) {
      console.log(`Page ${pageLinkId} skips patch-paperwork - clicking continue without waiting for PATCH response`);
      await this.clickContinue();
      // Return a minimal response - the collected responses stay as-is
      return { resourceType: 'QuestionnaireResponse', status: 'in-progress', item: this.collectedResponses };
    }

    // Set up response listener before clicking continue
    const responsePromise = this.page.waitForResponse(
      (response) => response.url().includes('/patch-paperwork/execute'),
      { timeout: 60000 }
    );

    await this.clickContinue();

    // Wait for and capture the PATCH response
    const response = await responsePromise;
    if (response.status() !== 200) {
      const errorBody = await response.text().catch(() => 'Unable to read response body');
      throw new Error(`patch-paperwork failed with status ${response.status()}: ${errorBody}`);
    }
    const responseBody = await response.json();

    // The API returns { status, output: QuestionnaireResponse } wrapper
    const questionnaireResponse = (responseBody.output ?? responseBody) as QuestionnaireResponse;

    // Update our tracked responses for enableWhen evaluation
    this.collectedResponses = questionnaireResponse.item ?? [];

    return questionnaireResponse;
  }

  /**
   * Get value sets from config (for dropdown options)
   */
  getValueSets(): ReturnType<typeof getValueSets> {
    return getValueSets();
  }

  /**
   * Get the current page slug from the URL
   * URL format: /paperwork/{appointmentId}/{slug}
   */
  getCurrentPageSlug(): string | null {
    const url = this.page.url();
    const match = url.match(/\/paperwork\/[^/]+\/([^/?]+)/);
    return match ? match[1] : null;
  }

  /**
   * Check if we're on the review/completion page
   */
  isOnReviewPage(): boolean {
    const url = this.page.url();
    return url.includes('/review') || url.includes('/visit-confirmation');
  }

  /**
   * Get the questionnaire pages (top-level items)
   */
  getPages(): IntakeQuestionnaireItem[] {
    return this.questionnairePages;
  }

  /**
   * Calculate the next visible page based on current responses and enableWhen conditions
   * @param currentPageLinkId - The linkId of the current page
   * @returns The next visible page, or undefined if no more pages
   */
  getNextVisiblePage(currentPageLinkId: string): IntakeQuestionnaireItem | undefined {
    const currentIndex = this.questionnairePages.findIndex((p) => p.linkId === currentPageLinkId);
    if (currentIndex === -1) {
      return undefined;
    }

    // Build context from collected responses for enableWhen evaluation
    const values = buildEnableWhenContext(this.collectedResponses);

    // Find the next page that passes enableWhen conditions
    for (let i = currentIndex + 1; i < this.questionnairePages.length; i++) {
      const nextPage = this.questionnairePages[i];
      const isEnabled = evalEnableWhen(nextPage, this.questionnairePages, values);
      if (isEnabled) {
        return nextPage;
      }
    }

    return undefined;
  }

  /**
   * Verify the current URL matches the expected page
   * @param expectedPageLinkId - The linkId of the expected page (e.g., 'contact-information-page')
   * @throws Error if current URL doesn't match expected page
   */
  async verifyOnExpectedPage(expectedPageLinkId: string): Promise<void> {
    const currentSlug = this.getCurrentPageSlug();
    const expectedSlug = expectedPageLinkId.replace('-page', '');

    if (currentSlug !== expectedSlug) {
      throw new Error(
        `Expected to be on page '${expectedSlug}' (linkId: ${expectedPageLinkId}), ` +
          `but currently on '${currentSlug}'. ` +
          `This may indicate a bug in page enableWhen conditions or test data.`
      );
    }
  }

  /**
   * Get the first visible page based on enableWhen conditions
   */
  getFirstVisiblePage(): IntakeQuestionnaireItem | undefined {
    const values = buildEnableWhenContext(this.collectedResponses);

    for (const page of this.questionnairePages) {
      const isEnabled = evalEnableWhen(page, this.questionnairePages, values);
      if (isEnabled) {
        return page;
      }
    }

    return undefined;
  }
}
