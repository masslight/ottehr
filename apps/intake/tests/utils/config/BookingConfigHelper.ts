import { BookingConfig, HomepageOptionConfig } from 'utils';

/**
 * Configuration-aware booking test helper utilities
 *
 * These helpers derive test expectations from booking configuration rather than
 * hardcoded values, allowing tests to adapt automatically to config changes.
 *
 * All methods accept a config instance as a parameter, making them pure functions
 * that enable parallel test execution without shared state.
 */

export class BookingConfigHelper {
  /**
   * Get enabled service modes (in-person, virtual)
   */
  static getEnabledServiceModes(config: BookingConfig): string[] {
    return config.serviceCategoriesEnabled.serviceModes;
  }

  /**
   * Get enabled visit types (prebook, walk-in)
   */
  static getEnabledVisitTypes(config: BookingConfig): string[] {
    return config.serviceCategoriesEnabled.visitType;
  }

  /**
   * Get available homepage options
   */
  static getHomepageOptions(config: BookingConfig): HomepageOptionConfig[] {
    return config.homepageOptions;
  }

  /**
   * Get label for a specific homepage option by ID
   */
  static getHomepageOptionLabel(optionId: string, config: BookingConfig): string | undefined {
    return config.homepageOptions.find((opt) => opt.id === optionId)?.label;
  }

  /**
   * Get available service categories
   */
  static getServiceCategories(config: BookingConfig): Array<{ code: string; display: string }> {
    return config.serviceCategories;
  }

  /**
   * Check if a specific service mode is enabled
   */
  static isServiceModeEnabled(serviceMode: string, config: BookingConfig): boolean {
    return config.serviceCategoriesEnabled.serviceModes.includes(serviceMode);
  }

  /**
   * Check if a specific visit type is enabled
   */
  static isVisitTypeEnabled(visitType: string, config: BookingConfig): boolean {
    return config.serviceCategoriesEnabled.visitType.includes(visitType);
  }

  /**
   * Check if a homepage option is available
   */
  static isHomepageOptionAvailable(optionId: string, config: BookingConfig): boolean {
    return config.homepageOptions.some((opt) => opt.id === optionId);
  }

  /**
   * Get patient info fields that should be visible
   */
  static getVisiblePatientFields(config: BookingConfig): string[] {
    const section = config.formConfig.FormFields.patientInfo;
    const hiddenFields = section.hiddenFields || [];
    const items = section.items;

    if (!items || typeof items !== 'object') {
      return [];
    }

    return Object.entries(items)
      .filter(([_key, field]) => !hiddenFields.includes(field.key))
      .map(([_key, field]) => field.key);
  }

  /**
   * Check if a patient field should be hidden
   */
  static isPatientFieldHidden(fieldKey: string, config: BookingConfig): boolean {
    const hiddenFields = config.formConfig.FormFields.patientInfo.hiddenFields || [];
    return hiddenFields.includes(fieldKey);
  }

  /**
   * Determine which flows should be testable based on config
   * Returns flow identifiers like 'in-person-walk-in', 'virtual-prebook', etc.
   */
  static getTestableFlows(config: BookingConfig): string[] {
    const flows: string[] = [];
    const serviceModes = this.getEnabledServiceModes(config);
    const visitTypes = this.getEnabledVisitTypes(config);

    for (const mode of serviceModes) {
      for (const type of visitTypes) {
        flows.push(`${mode}-${type}`);
      }
    }

    return flows;
  }
}
