import { Page } from '@playwright/test';
import {
  BookingConfig,
  chooseJson,
  CreateAppointmentResponse,
  getReasonForVisitOptionsForServiceCategory,
  prepopulateBookingForm,
  selectBookingQuestionnaire,
  VALUE_SETS,
} from 'utils';

/**
 * Page interaction helpers that are config-aware
 *
 * These helpers fill out forms based on what fields are visible in the config,
 * allowing tests to work across different configurations automatically.
 */

export class BookingFlowHelpers {
  /**
   * Click a Continue button if present on the page
   * Uses the standard loading-button test ID that Continue buttons use
   * @param page - Playwright page
   * @param context - Optional description for logging (e.g., "after patient selection")
   * @param timeoutMs - Timeout in milliseconds (default 2000)
   */
  static async clickContinueButtonIfPresent(page: Page, context?: string, timeoutMs = 2000): Promise<boolean> {
    // Continue buttons use the 'loading-button' test ID
    const continueButton = page.getByTestId('loading-button');
    try {
      await continueButton.waitFor({ timeout: timeoutMs, state: 'visible' });
      await continueButton.click();
      const logContext = context ? ` ${context}` : '';
      console.log(`Continue button clicked${logContext}`);
      await page.waitForTimeout(500);
      return true;
    } catch {
      const logContext = context ? ` ${context}` : '';
      console.log(`No Continue button found${logContext} (may not be needed for this flow)`);
      return false;
    }
  }

  /**
   * Get a valid value from a config-defined value set
   * Returns the first value from the appropriate value set
   */
  static getValidValueFromConfig(fieldKey: string, serviceCategory?: string): string | undefined {
    switch (fieldKey) {
      case 'patient-birth-sex':
        return VALUE_SETS.birthSexOptions[0].value; // 'Male'
      case 'return-patient-check':
        return VALUE_SETS.yesNoOptions[1].value; // 'No' (assuming new patient for tests)
      case 'reason-for-visit':
      case 'reason-for-visit-om':
      case 'reason-for-visit-wc':
        if (serviceCategory) {
          const options = getReasonForVisitOptionsForServiceCategory(serviceCategory);
          return options[0]?.value;
        }
        // Default to urgent-care if no category specified
        return VALUE_SETS.reasonForVisitOptions[0].value; // 'Cough and/or congestion'
      default:
        return undefined;
    }
  }
  /**
   * Fill patient info form based on visible fields in config
   * Uses prepopulateBookingForm to understand which fields will be visible based on logical field values
   */
  static async fillPatientInfo(
    page: Page,
    config: BookingConfig,
    patientData: Partial<PatientData>,
    context: { serviceMode: 'in-person' | 'virtual'; serviceCategory: string }
  ): Promise<void> {
    const section = config.formConfig.FormFields.patientInfo;
    const hiddenFields = section.hiddenFields || [];
    const items = section.items;

    if (!items) return;

    // Wait a moment for the form to initialize and evaluate logical field conditions
    await page.waitForTimeout(500);
    // Wait for at least one basic field to be visible (indicates form is ready)
    const firstNameField = page.locator('#patient-first-name');
    await firstNameField.waitFor({ state: 'visible', timeout: 5000 });
    console.log('Patient info form is ready (first name field visible)');

    // Get prepopulated form values to understand logical field values
    // For new patient tests, we don't pass a patient, so existing-patient-id will be undefined
    const { templateQuestionnaire } = selectBookingQuestionnaire();
    const prepopulatedItems = prepopulateBookingForm({
      questionnaire: templateQuestionnaire,
      context: {
        serviceMode: context.serviceMode,
        serviceCategoryCode: context.serviceCategory,
      },
      // No patient = new patient flow, so triggered fields with PatientDoesntExistTrigger should be enabled
    });
    console.log('Prepopulated form items:', JSON.stringify(prepopulatedItems, null, 2));

    // Extract logical field values from prepopulated items for trigger evaluation
    const logicalFieldValues = new Map<string, any>();
    prepopulatedItems.forEach((section) => {
      section.item?.forEach((item) => {
        const value = item.answer?.[0]?.valueString ?? item.answer?.[0]?.valueBoolean;
        if (value !== undefined) {
          logicalFieldValues.set(item.linkId, value);
        }
      });
    });
    console.log('Logical field values:', Object.fromEntries(logicalFieldValues));

    // Helper to evaluate if a field should be enabled based on its triggers
    const shouldFieldBeEnabled = (field: any): boolean => {
      if (!field.triggers || field.triggers.length === 0) {
        return true; // No triggers = always enabled
      }

      const enableBehavior = field.enableBehavior || 'all'; // default is 'all'
      const results = field.triggers.map((trigger: any) => {
        const targetValue = logicalFieldValues.get(trigger.targetQuestionLinkId);

        if (trigger.operator === 'exists') {
          const exists = targetValue !== undefined;
          return exists === trigger.answerBoolean;
        } else if (trigger.operator === '=') {
          if (trigger.answerString !== undefined) {
            return targetValue === trigger.answerString;
          } else if (trigger.answerBoolean !== undefined) {
            return targetValue === trigger.answerBoolean;
          }
        }
        return false;
      });

      // Only check triggers with 'enable' effect
      const enableResults = field.triggers
        .map((trigger: any, index: number) => (trigger.effect?.includes('enable') ? results[index] : null))
        .filter((r: boolean | null) => r !== null);

      if (enableResults.length === 0) {
        return true; // No enable triggers = always enabled
      }

      return enableBehavior === 'any' ? enableResults.some((r: boolean) => r) : enableResults.every((r: boolean) => r);
    };

    for (const [_key, field] of Object.entries(items)) {
      if (hiddenFields.includes(field.key)) {
        continue; // Skip hidden fields
      }

      const value = patientData[field.key as keyof PatientData];
      if (!value) {
        console.log(`Skipping field '${field.key}' - no value provided in patientData`);
        continue;
      }

      console.log(`Processing field '${field.key}' with value:`, value);

      // Evaluate if field should be enabled based on triggers and logical field values
      const shouldBeEnabled = shouldFieldBeEnabled(field);
      console.log(`Field '${field.key}' should be enabled (based on triggers): ${shouldBeEnabled}`);

      // Fields with disabledDisplay: 'hidden' won't be rendered when disabled
      const willBeHiddenIfDisabled = field.disabledDisplay === 'hidden';

      if (!shouldBeEnabled && willBeHiddenIfDisabled) {
        console.log(`Skipping field '${field.key}' - disabled by triggers and hidden when disabled`);
        continue;
      }

      const fieldLocator = page.locator(`#${field.key}`);

      // If the field should be enabled, wait for it to be visible
      // For fields without disabledDisplay: 'hidden', they should always be rendered
      if (shouldBeEnabled || !willBeHiddenIfDisabled) {
        console.log(`Waiting for field '${field.key}' to become visible (should be enabled: ${shouldBeEnabled})...`);
        try {
          // For date fields, use the placeholder selector like existing tests do
          if (field.type === 'date') {
            const dateInput = page.getByPlaceholder('MM/DD/YYYY');
            await dateInput.waitFor({ state: 'visible', timeout: 5000 });
            console.log(`Date field '${field.key}' is visible and ready to fill`);
          } else {
            await fieldLocator.waitFor({ state: 'visible', timeout: 5000 });
            console.log(`Field '${field.key}' is visible and ready to fill`);
          }
        } catch {
          if (shouldBeEnabled && !willBeHiddenIfDisabled) {
            // This field should be visible - it's a bug if it's not
            throw new Error(
              `Expected field '${field.key}' to be visible (should be enabled: ${shouldBeEnabled}, ` +
                `disabledDisplay: ${field.disabledDisplay}), but it's not rendered. ` +
                `This indicates a bug in the form rendering logic.`
            );
          } else {
            console.log(`Field '${field.key}' not visible - skipping`);
            continue;
          }
        }
      } else {
        console.log(`Field '${field.key}' should not be visible (disabled and hidden), skipping`);
        continue;
      }

      // Fill based on field type
      if (field.type === 'string' || field.type === 'decimal') {
        await fieldLocator.fill(String(value));
        console.log(`Filled ${field.type} field '${field.key}' with value: ${value}`);
      } else if (field.type === 'date') {
        // Date fields: convert YYYY-MM-DD to MM/DD/YYYY format
        const dateValue = String(value);
        const formattedDate = dateValue.includes('-')
          ? dateValue
              .split('-')
              .reverse()
              .join('/')
              .replace(/\/(\d)\//, '/0$1/')
              .replace(/\/(\d)$/, '/0$1')
          : dateValue;
        console.log(
          `Filling date field '${field.key}' with formatted value: ${formattedDate} (original: ${dateValue})`
        );
        // Use placeholder selector like existing tests do
        await page.getByPlaceholder('MM/DD/YYYY').fill(formattedDate);
        console.log(`Successfully filled date field '${field.key}'`);
      } else if (field.type === 'choice') {
        // Choice fields: click to open dropdown, then select option
        await fieldLocator.click();
        await page.getByRole('option', { name: String(value), exact: true }).click();
        console.log(`Selected choice option '${value}' for field '${field.key}'`);
      }
    }
  }

  /**
   * Select a service category if multiple are available
   */
  static async selectServiceCategoryIfNeeded(
    page: Page,
    config: BookingConfig,
    preferredCategory: string
  ): Promise<void> {
    const categories = config.serviceCategories;

    if (categories.length <= 1) {
      // Only one category, no selection needed
      return;
    }

    // Find the category by code to get its display label
    const category = categories.find((cat) => cat.code === preferredCategory);
    if (!category) {
      throw new Error(`Service category '${preferredCategory}' not found in config`);
    }

    // Select by the user-visible label text
    await page.getByRole('button', { name: category.display }).click();

    // For walk-in flows, handle the Continue button on the walk-in landing page
    await this.clickContinueButtonIfPresent(page, 'on walk-in landing page');
  }

  /**
   * Navigate to homepage and click a booking option by its label text
   * @param page - Playwright page
   * @param optionLabel - The visible label of the homepage option button
   */
  static async startBookingFlow(page: Page, optionLabel: string): Promise<void> {
    // Navigate to homepage
    await page.goto('/home', { waitUntil: 'networkidle' });

    // Wait for any redirects to settle
    await page.waitForTimeout(1000);
    console.log('Current URL after navigation:', page.url());

    // If we got redirected away from /home, something is wrong
    if (!page.url().includes('/home')) {
      console.error('Unexpected redirect away from /home to:', page.url());
      // Try navigating back
      await page.goto('/home', { waitUntil: 'networkidle' });
      await page.waitForTimeout(500);
      console.log('URL after second navigation attempt:', page.url());
    }

    // Wait for the page to be ready - look for any booking button
    await page.waitForSelector('button', { timeout: 10000 });

    const testConfig = await page.evaluate(() => {
      return (window as any).__TEST_BOOKING_CONFIG__;
    });
    console.log('__TEST_BOOKING_CONFIG__:', JSON.stringify(testConfig, null, 2));

    // Wait for the specific button to be visible
    const bookingButton = page.getByRole('button', { name: optionLabel });
    await bookingButton.waitFor({ state: 'visible', timeout: 5000 });

    // Click the booking option
    await bookingButton.click();

    // Debug: check URL after click
    await page.waitForTimeout(1000);
    const url = page.url();
    console.log('URL after click:', url);
  }

  /**
   * Complete the entire patient info step
   */
  static async completePatientInfoStep(
    page: Page,
    config: BookingConfig,
    patientData: Partial<PatientData>,
    context: { serviceMode: 'in-person' | 'virtual'; serviceCategory: string }
  ): Promise<void> {
    // First, check if we're on a patient selection screen (for authenticated users with existing patients)
    // Look for "Different family member" button by its test ID
    const addNewPatientButton = page.getByTestId('Different family member');
    try {
      await addNewPatientButton.waitFor({ timeout: 2000 });
      console.log('Patient selection screen detected, clicking "Different family member"...');
      await addNewPatientButton.click();
      await page.waitForTimeout(500);

      // After selecting "Different family member", click the Continue button to proceed
      await this.clickContinueButtonIfPresent(page, 'after patient selection');
    } catch {
      console.log('No patient selection screen (user may not have existing patients)');
    }
    await this.fillPatientInfo(page, config, patientData, context);
    // Click the continue button after filling patient info
    await this.clickContinueButtonIfPresent(page, 'after filling patient info');
  }

  /**
   * Select the first available location
   */
  static async selectFirstAvailableLocation(page: Page): Promise<void> {
    // Wait for locations to load
    await page.waitForSelector('[data-testid^="location-"]');

    // Click first location
    const firstLocation = page.locator('[data-testid^="location-"]').first();
    await firstLocation.click();
  }

  /**
   * Select the first available time slot (for prebook flows)
   */
  static async selectFirstAvailableTimeSlot(page: Page): Promise<void> {
    // Wait for time slots to load
    await page.waitForSelector('[data-testid^="time-slot-"]');

    // Click first available slot
    const firstSlot = page.locator('[data-testid^="time-slot-"]').first();
    await firstSlot.click();
  }

  /**
   * Complete final booking confirmation
   * Handles both walk-in and prebook button texts
   * Verifies confirmation page loads successfully
   * Captures and returns the appointment creation response
   */
  static async confirmBooking(page: Page, visitType: 'walk-in' | 'prebook'): Promise<CreateAppointmentResponse> {
    // Button text differs between walk-in and prebook flows
    const buttonText = visitType === 'walk-in' ? 'Confirm this walk-in time' : 'Reserve this check-in time';

    const confirmButton = page.getByRole('button', { name: buttonText });
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });

    // Set up response capture before clicking the confirm button
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/create-appointment/execute') && response.status() === 200,
      { timeout: 30000 }
    );

    await confirmButton.click();

    // Wait for and capture the appointment creation response
    const response = await responsePromise;
    const appointmentResponse = chooseJson(await response.json()) as CreateAppointmentResponse;
    console.log('Captured appointment creation response:', appointmentResponse.appointmentId);

    // Wait for and verify the confirmation page elements
    console.log('Waiting for confirmation page to load...');

    // Check for either "You are checked in!" (walk-in) or thank you heading (prebook)
    // Both should have "Proceed to paperwork" button
    const proceedButton = page.getByRole('button', { name: 'Proceed to paperwork' });
    await proceedButton.waitFor({ state: 'visible', timeout: 10000 });
    console.log('Successfully reached confirmation page with "Proceed to paperwork" button');

    // Log final URL for debugging
    console.log('Final URL:', page.url());

    return appointmentResponse;
  }

  /**
   * Get sample patient data for testing
   * Includes all possible fields - fillPatientInfo will only interact with visible ones
   * Values are derived from config value sets where applicable
   * Names and DOB are randomized to avoid duplicate patient detection
   */
  static getSamplePatientData(serviceCategory?: string): PatientData {
    // Generate random timestamp suffix to ensure uniqueness
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 1000);

    // Generate random DOB (age between 18 and 65)
    const today = new Date();
    const year = today.getFullYear() - (18 + Math.floor(Math.random() * 47)); // 18-65 years old
    const month = String(Math.floor(Math.random() * 12) + 1).padStart(2, '0');
    const day = String(Math.floor(Math.random() * 28) + 1).padStart(2, '0'); // 1-28 to avoid invalid dates
    const birthdate = `${month}/${day}/${year}`;

    return {
      'patient-first-name': `Test${timestamp}`,
      'patient-middle-name': 'Michael',
      'patient-last-name': `Patient${randomSuffix}`,
      'patient-preferred-name': `Test${timestamp}`,
      'patient-birthdate': birthdate,
      'patient-birth-sex': this.getValidValueFromConfig('patient-birth-sex'),
      'patient-email': `test.patient.${timestamp}@example.com`,
      'patient-weight': '180', // Only shown for virtual visits
      'return-patient-check': this.getValidValueFromConfig('return-patient-check'),
      'reason-for-visit': this.getValidValueFromConfig('reason-for-visit', serviceCategory),
      'reason-for-visit-om': this.getValidValueFromConfig('reason-for-visit-om', 'occupational-medicine'),
      'reason-for-visit-wc': this.getValidValueFromConfig('reason-for-visit-wc', 'workers-comp'),
    };
  }
}

/**
 * Type for patient data - keys match field keys from config
 */
export interface PatientData {
  'patient-first-name'?: string;
  'patient-middle-name'?: string;
  'patient-last-name'?: string;
  'patient-preferred-name'?: string;
  'patient-birthdate'?: string;
  'patient-birth-sex'?: string;
  'patient-email'?: string;
  'patient-weight'?: string;
  'patient-ssn'?: string;
  'return-patient-check'?: string;
  'reason-for-visit'?: string;
  'reason-for-visit-om'?: string;
  'reason-for-visit-wc'?: string;
}
