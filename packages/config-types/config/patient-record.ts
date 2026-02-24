import z from 'zod';
import { FormSectionArray, FormSectionArraySchema, FormSectionSimple, FormSectionSimpleSchema } from './form-fields';
import { QuestionnaireBase, QuestionnaireBaseSchema } from './questionnaire';

/**
 * PatientRecordFormFields - Defines the sections that make up patient record forms
 *
 * Unlike PaperworkFormFields which uses a generic Record type, PatientRecordFormFields
 * has specific known keys because the core repo accesses these directly (e.g.,
 * PATIENT_RECORD_CONFIG.FormFields.patientDetails).
 */
export interface PatientRecordFormFields {
  [key: string]: FormSectionSimple | FormSectionArray;
  patientSummary: FormSectionSimple;
  patientDetails: FormSectionSimple;
  patientContactInformation: FormSectionSimple;
  insurance: FormSectionArray;
  primaryCarePhysician: FormSectionSimple;
  responsibleParty: FormSectionSimple;
  emergencyContact: FormSectionSimple;
  preferredPharmacy: FormSectionSimple;
  employerInformation: FormSectionSimple;
  occupationalMedicineEmployerInformation: FormSectionSimple;
  attorneyInformation: FormSectionSimple;
}

/**
 * PatientRecordConfig - Full patient record configuration
 * Composed from base questionnaire properties plus specific FormFields
 */
export interface PatientRecordConfig {
  questionnaireBase: QuestionnaireBase;
  hiddenFormSections: string[];
  FormFields: PatientRecordFormFields;
}

/**
 * Schema for PatientRecordFormFields
 *
 * Uses z.ZodType with explicit type parameters to avoid TypeScript serialization issues (TS7056).
 * - Output type: PatientRecordFormFields (what you get after parsing)
 * - Input type: unknown (accepts any input, validation happens at runtime)
 */
export const PatientRecordFormFieldsSchema: z.ZodType<PatientRecordFormFields, z.ZodTypeDef, unknown> = z.object({
  patientSummary: FormSectionSimpleSchema,
  patientDetails: FormSectionSimpleSchema,
  patientContactInformation: FormSectionSimpleSchema,
  insurance: FormSectionArraySchema,
  primaryCarePhysician: FormSectionSimpleSchema,
  responsibleParty: FormSectionSimpleSchema,
  emergencyContact: FormSectionSimpleSchema,
  preferredPharmacy: FormSectionSimpleSchema,
  employerInformation: FormSectionSimpleSchema,
  occupationalMedicineEmployerInformation: FormSectionSimpleSchema,
  attorneyInformation: FormSectionSimpleSchema,
});

/**
 * Schema for PatientRecordConfig - composed from base schemas
 */
export const PatientRecordConfigSchema: z.ZodType<PatientRecordConfig, z.ZodTypeDef, unknown> = z.object({
  questionnaireBase: QuestionnaireBaseSchema,
  hiddenFormSections: z.array(z.string()),
  FormFields: PatientRecordFormFieldsSchema,
});
