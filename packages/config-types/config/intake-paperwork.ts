import z from 'zod';
import {
  FormSectionSimple,
  FormSectionSimpleSchema,
  QuestionnaireConfigSchema,
  QuestionnaireConfigType,
} from './form-fields';

/**
 * PaperworkFormFields - A record of section names to form section definitions
 *
 * The specific section names (contactInformation, patientDetails, etc.) are
 * defined in the config implementation, not in this type contract. This allows
 * instance-specific configs to define their own sections while still satisfying
 * the type contract.
 *
 * Used by both in-person and virtual intake paperwork configurations.
 */
export type PaperworkFormFields = Record<string, FormSectionSimple>;

/**
 * Schema for validating PaperworkFormFields
 * Validates that each section conforms to FormSectionSimple structure
 */
export const PaperworkFormFieldsSchema = z.record(z.string(), FormSectionSimpleSchema);

/**
 * PaperworkConfig - Full paperwork configuration
 *
 * This is the type contract that paperwork configs must satisfy.
 * The specific sections are implementation details defined in the config.
 *
 * Used by both in-person and virtual intake paperwork configurations.
 */
export interface PaperworkConfig extends QuestionnaireConfigType {
  FormFields: PaperworkFormFields;
}

export const PaperworkConfigSchema = QuestionnaireConfigSchema.extend({
  FormFields: PaperworkFormFieldsSchema,
});

/**
 * Describes how a completed paperwork page should be harvested into the patient record.
 * Today the mapping from page linkId → strategy lives in code (see {@link pageHarvestStrategy}),
 * but this indirection exists so it can eventually be lifted into an extension on
 * the Questionnaire item definitions themselves.
 */
export type HarvestStrategy = 'master-record' | 'pharmacy' | 'account-coverage' | 'documents' | 'consent';

/**
 * Maps intake paperwork page linkIds to their harvest strategy.
 * Pages not present in this map require no incremental harvesting.
 */
export const pageHarvestStrategy: Record<string, HarvestStrategy> = {
  'contact-information-page': 'master-record',
  'patient-details-page': 'master-record',
  'primary-care-physician-page': 'master-record',
  'pharmacy-page': 'pharmacy',
  'payment-option-page': 'account-coverage',
  'payment-option-occ-med-page': 'account-coverage',
  'occupational-medicine-employer-information-page': 'account-coverage',
  'responsible-party-page': 'account-coverage',
  'employer-information-page': 'account-coverage',
  'emergency-contact-page': 'account-coverage',
  'attorney-mva-page': 'account-coverage',
  'photo-id-page': 'documents',
  'patient-condition-page': 'documents',
  'school-work-note-page': 'documents',
  'consent-forms-page': 'consent',
};
