import { Page } from '@playwright/test';
import { CONFIG_INJECTION_KEYS, type ConsentFormsConfig, type QuestionnaireConfigType } from 'utils';

/**
 * Configuration-aware paperwork test helper utilities
 *
 * These helpers inject paperwork configurations at runtime and provide utilities
 * for deriving test expectations from config, similar to BookingConfigHelper.
 *
 * All methods accept config instances as parameters, making them pure functions
 * that enable parallel test execution without shared state.
 */

export class PaperworkConfigHelper {
  /**
   * Inject a test intake paperwork config into the page's runtime environment.
   * This must be called BEFORE navigating to the page.
   *
   * The config is injected via window.__TEST_PAPERWORK_CONFIG__ which is then
   * picked up by the INTAKE_PAPERWORK_CONFIG Proxy in the application.
   *
   * @param page - Playwright page instance
   * @param config - Intake paperwork config to inject (partial overrides)
   */
  static async injectIntakePaperworkConfig(page: Page, config: Partial<QuestionnaireConfigType>): Promise<void> {
    await page.addInitScript(
      ({ key, overrides }) => {
        (window as any)[key] = overrides;
      },
      { key: CONFIG_INJECTION_KEYS.INTAKE_PAPERWORK, overrides: config }
    );
  }

  /**
   * Inject a test virtual intake paperwork config into the page's runtime environment.
   * This must be called BEFORE navigating to the page.
   *
   * The config is injected via window.__TEST_VIRTUAL_PAPERWORK_CONFIG__ which is then
   * picked up by the VIRTUAL_INTAKE_PAPERWORK_CONFIG Proxy in the application.
   *
   * @param page - Playwright page instance
   * @param config - Virtual intake paperwork config to inject (partial overrides)
   */
  static async injectVirtualPaperworkConfig(page: Page, config: Partial<QuestionnaireConfigType>): Promise<void> {
    await page.addInitScript(
      ({ key, overrides }) => {
        (window as any)[key] = overrides;
      },
      { key: CONFIG_INJECTION_KEYS.VIRTUAL_INTAKE_PAPERWORK, overrides: config }
    );
  }

  /**
   * Inject test value sets into the page's runtime environment.
   * This must be called BEFORE navigating to the page.
   *
   * The config is injected via window.__TEST_VALUE_SETS__ which is then
   * picked up by the VALUE_SETS Proxy in the application.
   *
   * @param page - Playwright page instance
   * @param valueSets - Value sets to inject (partial overrides)
   */
  static async injectValueSets(page: Page, valueSets: Partial<any>): Promise<void> {
    await page.addInitScript(
      ({ key, overrides }) => {
        (window as any)[key] = overrides;
      },
      { key: CONFIG_INJECTION_KEYS.VALUE_SETS, overrides: valueSets }
    );
  }

  /**
   * Inject test consent forms config into the page's runtime environment.
   * This must be called BEFORE navigating to the page.
   *
   * The config is injected via window.__TEST_CONSENT_FORMS_CONFIG__ which is then
   * picked up by the CONSENT_FORMS_CONFIG Proxy in the application.
   *
   * @param page - Playwright page instance
   * @param config - Consent forms config to inject (partial overrides)
   */
  static async injectConsentFormsConfig(page: Page, config: Partial<ConsentFormsConfig>): Promise<void> {
    await page.addInitScript(
      ({ key, overrides }) => {
        (window as any)[key] = overrides;
      },
      { key: CONFIG_INJECTION_KEYS.CONSENT_FORMS, overrides: config }
    );
  }

  /**
   * Get visible fields for a form section based on hiddenFields config
   *
   * @param section - The form section config (e.g., config.FormFields.contactInformation)
   * @param allFields - Array of all possible field names for this section
   * @returns Array of field names that should be visible
   */
  static getVisibleFields(section: { hiddenFields?: string[] }, allFields: string[]): string[] {
    const hiddenFields = section.hiddenFields || [];
    return allFields.filter((field) => !hiddenFields.includes(field));
  }

  /**
   * Get hidden fields for a form section
   *
   * @param section - The form section config
   * @returns Array of field names that should be hidden
   */
  static getHiddenFields(section: { hiddenFields?: string[] }): string[] {
    return section.hiddenFields || [];
  }

  /**
   * Check if a specific field is hidden in the config
   *
   * @param config - The intake paperwork config
   * @param fieldKey - The field key to check (e.g., 'patient-previous-name')
   * @returns True if the field is hidden
   */
  static isFieldHidden(config: QuestionnaireConfigType, fieldKey: string): boolean {
    return Object.values(config.FormFields)
      .flatMap((section: any) => section.hiddenFields || [])
      .includes(fieldKey);
  }

  /**
   * Get page title from config
   *
   * @param section - The form section config
   * @returns The page title
   */
  static getPageTitle(section: { title?: string }): string {
    return section.title || '';
  }

  /**
   * Get required fields for a form section
   *
   * @param section - The form section config
   * @returns Array of required field names
   */
  static getRequiredFields(section: { required?: string[] }): string[] {
    return section.required || [];
  }

  /**
   * Determine which paperwork config to use based on service mode
   *
   * @param serviceMode - 'in-person' or 'virtual'
   * @returns The appropriate config type identifier
   */
  static selectPaperworkConfigType(serviceMode: 'in-person' | 'virtual'): 'in-person' | 'virtual' {
    return serviceMode;
  }
}
