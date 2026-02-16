import { expect, Locator, Page } from '@playwright/test';
import { QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  buildEnableWhenContext,
  checkFieldHidden,
  evalEnableWhen,
  getValueSets,
  IN_PERSON_INTAKE_PAPERWORK_QUESTIONNAIRE,
  IntakeQuestionnaireItem,
  mapQuestionnaireAndValueSetsToItemsList,
  VIRTUAL_INTAKE_PAPERWORK_QUESTIONNAIRE,
} from 'utils';
import { dataTestIds } from '../../../src/helpers/data-test-ids';
import { Locators } from '../locators';
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
        await this.fillStringField(locator, value, item);
        break;

      case 'integer':
      case 'decimal':
        await this.fillNumericField(locator, value, item);
        break;

      case 'date':
        await this.fillDateField(value, item);
        break;

      case 'choice':
        await this.fillChoiceField(locator, value, item);
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
        await locator.fill(String(value));
    }

    console.log(`Filled field ${item.linkId} with value:`, value);
  }

  /**
   * Fill a string/text field
   */
  private async fillStringField(locator: Locator, value: string, _item: IntakeQuestionnaireItem): Promise<void> {
    await locator.fill(String(value));
  }

  /**
   * Fill a numeric field (integer or decimal)
   */
  private async fillNumericField(
    locator: Locator,
    value: number | string,
    _item: IntakeQuestionnaireItem
  ): Promise<void> {
    await locator.fill(String(value));
  }

  /**
   * Fill a date field
   */
  private async fillDateField(value: string, _item: IntakeQuestionnaireItem): Promise<void> {
    // Date fields use a common placeholder
    const dateInput = this.page.getByPlaceholder('MM/DD/YYYY');

    // Format date if needed (convert YYYY-MM-DD to MM/DD/YYYY)
    let formattedDate = value;
    if (value.includes('-') && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = value.split('-');
      formattedDate = `${month}/${day}/${year}`;
    }

    await dateInput.fill(formattedDate);
  }

  /**
   * Fill a choice field (dropdown/radio)
   */
  private async fillChoiceField(locator: Locator, value: string, item: IntakeQuestionnaireItem): Promise<void> {
    const isRadio = item.preferredElement === 'Radio' || item.preferredElement === 'Radio List';
    if (isRadio) {
      // For radio buttons, scope to the specific radio group using aria-labelledby, then select by value
      const radioGroup = this.page.locator(`[aria-labelledby="${item.linkId}-label"]`);
      await radioGroup.locator(`input[value="${value}"]`).check();
    } else if (item.answerLoadingOptions?.answerSource) {
      // select the first option
      await locator.click();
      console.log('filling choice field with answer source, selecting first option');
      const firstOption = this.page.locator(`[id='${item.linkId}-option-0']`);
      await firstOption.click();
    } else {
      // For dropdowns, click to open then select option
      await locator.click();
      await this.page.getByRole('option', { name: value, exact: true }).click();
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
    // Check if card is already added by looking for saved card in radio group
    const savedCard = this.page.getByTestId(dataTestIds.cardNumber).first();
    const isCardAlreadyAdded = await savedCard.isVisible({ timeout: 1000 }).catch(() => false);

    if (isCardAlreadyAdded) {
      return;
    }

    // Use defaults if not provided
    const number = cardData?.number || CARD_NUMBER;
    const expiry = cardData?.expiry || CARD_EXP_DATE;
    const cvc = cardData?.cvc || CARD_CVV;

    // Card doesn't exist, fill form and add it
    // Fields are inside Stripe iframe
    const stripeIframe = this.page.frameLocator('iframe[title="Secure card payment input frame"]');
    await stripeIframe.locator('[data-elements-stable-field-name="cardNumber"]').fill(number);
    await stripeIframe.locator('[data-elements-stable-field-name="cardExpiry"]').fill(expiry);
    await stripeIframe.locator('[data-elements-stable-field-name="cardCvc"]').fill(cvc);

    // Click add card button and wait for Stripe processing + backend save + UI update
    await this.page.getByRole('button', { name: 'Add card' }).click();
    await expect(this.page.getByTestId(dataTestIds.cardNumber).first()).toBeVisible({ timeout: 60000 });
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
      (response) => response.url().includes('/patch-paperwork/execute') && response.status() === 200,
      { timeout: 60000 }
    );

    await this.clickContinue();

    // Wait for and capture the PATCH response
    const response = await responsePromise;
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
