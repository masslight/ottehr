/**
 * Screening Questions Configuration Types
 *
 * These types define the contract for patient screening question configurations,
 * supporting various field types with FHIR mappings and conditional logic.
 */

/**
 * Field types for screening questions
 */
export type ScreeningFieldType = 'radio' | 'text' | 'textarea' | 'select' | 'dateRange';

/**
 * Option for select/radio fields
 */
export interface ScreeningFieldOption {
  value: string;
  label: string;
  fhirValue: string;
}

/**
 * Note field for additional input
 */
export interface ScreeningNoteField {
  id: string;
  label: string;
  type: 'text' | 'textarea';
  placeholder?: string;
  fhirField: string;
  conditionalValue?: string;
}

/**
 * Conditional save configuration
 */
export interface ScreeningConditionalSave {
  waitForNote: string;
}

/**
 * Screening question field
 */
export interface ScreeningField {
  id: string;
  type: ScreeningFieldType;
  question: string;
  required?: boolean;
  options?: ScreeningFieldOption[];
  placeholder?: string;
  fhirField: string;
  noteField?: ScreeningNoteField;
  debounced?: boolean;
  canDelete?: boolean;
  conditionalSave?: ScreeningConditionalSave;
  existsInQuestionnaire?: boolean;
}

/**
 * Full screening questions configuration
 */
export interface ScreeningQuestionsConfig {
  title: string;
  fields: ScreeningField[];
}
