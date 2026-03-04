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
