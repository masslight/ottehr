import { Page } from '@playwright/test';
import { BookingConfig } from 'utils';

/**
 * Page interaction helpers that are config-aware
 *
 * These helpers fill out forms based on what fields are visible in the config,
 * allowing tests to work across different configurations automatically.
 */

export class BookingFlowHelpers {
  /**
   * Fill patient info form based on visible fields in config
   */
  static async fillPatientInfo(page: Page, config: BookingConfig, patientData: Partial<PatientData>): Promise<void> {
    const section = config.formConfig.FormFields.patientInfo;
    const hiddenFields = section.hiddenFields || [];
    const items = section.items;

    if (!items) return;

    for (const [_key, field] of Object.entries(items)) {
      if (hiddenFields.includes(field.key)) {
        continue; // Skip hidden fields
      }

      const value = patientData[field.key as keyof PatientData];
      if (!value) continue;

      const input = page.getByTestId(field.key);
      // Fill based on field type
      if (field.type === 'string' || field.type === 'decimal') {
        await input.fill(String(value));
      } else if (field.type === 'date') {
        await input.fill(String(value));
      } else if (field.type === 'choice') {
        await input.selectOption(String(value));
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
  }

  /**
   * Navigate to homepage and click a booking option by its label text
   */
  static async startBookingFlow(page: Page, optionLabel: string): Promise<void> {
    await page.goto('/home');
    // Select button by its visible text label (user-facing)
    await page.getByRole('button', { name: optionLabel }).click();
  }

  /**
   * Complete the entire patient info step
   */
  static async completePatientInfoStep(
    page: Page,
    config: BookingConfig,
    patientData: Partial<PatientData>
  ): Promise<void> {
    await this.fillPatientInfo(page, config, patientData);
    await page.getByTestId('patient-info-continue').click();
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
   */
  static async confirmBooking(page: Page): Promise<void> {
    await page.getByTestId('confirm-booking').click();

    // Wait for confirmation page
    await page.waitForSelector('[data-testid="booking-confirmation"]');
  }

  /**
   * Get sample patient data for testing
   */
  static getSamplePatientData(): PatientData {
    return {
      'patient-first-name': 'John',
      'patient-middle-name': 'Michael',
      'patient-last-name': 'Doe',
      'patient-preferred-name': 'Johnny',
      'patient-birthdate': '1990-01-01',
      'patient-birth-sex': 'male',
      'patient-email': 'john.doe@example.com',
      'patient-weight': '180',
      'return-patient-check': 'no',
      'reason-for-visit': 'illness',
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
