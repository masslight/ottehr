import { FormFieldSection, FormFieldsInputItem, IntakePaperworkConfig, VALUE_SETS } from 'utils';

/**
 * Configuration-aware test helper utilities
 *
 * These helpers derive test expectations from configuration rather than
 * hardcoded values, allowing tests to adapt automatically to config changes.
 *
 * All methods accept a config instance as a parameter, making them pure functions
 * that enable parallel test execution without shared state.
 */

export class ConfigHelper {
  /**
   * Get the title of a page/section from config
   */
  static getPageTitle(pageKey: string, config: IntakePaperworkConfig): string {
    const section = config.FormFields[pageKey] as FormFieldSection;
    return section.title;
  }

  /**
   * Get all fields that should be visible in a section
   * (not in hiddenFields array)
   */
  static getVisibleFields(section: FormFieldSection): Array<FormFieldsInputItem & { key: string }> {
    const hiddenFields = section.hiddenFields || [];
    const items = section.items;

    if (!items || typeof items !== 'object') {
      return [];
    }

    return Object.entries(items)
      .filter(([_objectKey, field]) => !hiddenFields.includes(field.key))
      .map(([_objectKey, field]) => ({ ...field, key: field.key }) as FormFieldsInputItem & { key: string });
  }

  /**
   * Get all fields that are required in a section
   */
  static getRequiredFields(section: FormFieldSection): string[] {
    return section.requiredFields || [];
  }

  /**
   * Check if a field should be hidden
   *
   * @param fieldKey - The field key to check
   * @param section - The section containing the field
   * @param _formValues - Current form values (for trigger evaluation)
   */
  static isFieldHidden(fieldKey: string, section: FormFieldSection, _formValues?: Record<string, any>): boolean {
    const hiddenFields = section.hiddenFields || [];

    // Check static hiding first
    if (hiddenFields.includes(fieldKey)) {
      return true;
    }

    // TODO: Add trigger evaluation when needed for pilot
    // For now, static hiding is sufficient for proof of concept

    return false;
  }

  /**
   * Check if an entire page/section is enabled
   *
   * @param _pageKey - The page key to check
   * @param _config - The config instance to check against
   * @param _formValues - Current form values (for trigger evaluation)
   */
  static isPageEnabled(
    _pageKey: keyof IntakePaperworkConfig,
    _config: IntakePaperworkConfig,
    _formValues?: Record<string, any>
  ): boolean {
    // TODO: Add section-level trigger evaluation when needed
    // For pilot, assume all pages are enabled
    return true;
  }

  /**
   * Get dropdown options for a value set
   */
  static getDropdownOptions(valueSetKey: keyof typeof VALUE_SETS): Array<{ value: string; label: string }> {
    const options = VALUE_SETS[valueSetKey];
    if (!Array.isArray(options)) {
      throw new Error(`Value set ${valueSetKey} is not an array`);
    }
    return options as Array<{ value: string; label: string }>;
  }

  /**
   * Get all field keys from a section (both visible and hidden)
   */
  static getAllFieldKeys(section: FormFieldSection): string[] {
    const items = section.items;
    if (!items || typeof items !== 'object') {
      return [];
    }
    return Object.keys(items);
  }
}
