import z from 'zod';
import { FormFieldOptionSchema } from './questionnaire';

/**
 * InsurancePlanType - Insurance type with Candid Health integration
 * Maps to Candid's NetworkType codes for claims processing
 */
export const InsurancePlanTypeSchema = z.object({
  candidCode: z.string(), // NetworkType from candidhealth - using string to avoid dependency
  label: z.string(),
  coverageCoding: z
    .object({
      system: z.string(),
      code: z.string(),
      display: z.string().optional(),
    })
    .optional(),
});

export type InsurancePlanType = z.infer<typeof InsurancePlanTypeSchema>;

/**
 * FormFieldOptions - Array of label/value option pairs
 * Used throughout value sets for dropdown/select options
 */
export const FormFieldOptionsSchema = z.array(FormFieldOptionSchema);
export type FormFieldOptions = z.infer<typeof FormFieldOptionsSchema>;

/**
 * ValueSetsConfig - Configuration for all form value sets
 * Defines the available options for various form fields throughout the application
 *
 * Each property is an array of { label, value } pairs that populate
 * dropdown menus, radio buttons, and other selection controls.
 */
export const ValueSetsConfigSchema = z.object({
  // Demographics
  birthSexOptions: FormFieldOptionsSchema,
  ethnicityOptions: FormFieldOptionsSchema,
  genderIdentityOptions: FormFieldOptionsSchema,
  languageOptions: FormFieldOptionsSchema,
  pronounOptions: FormFieldOptionsSchema,
  raceOptions: FormFieldOptionsSchema,
  sexualOrientationOptions: FormFieldOptionsSchema,
  stateOptions: FormFieldOptionsSchema,

  // Visit & Scheduling
  cancelReasonOptionsInPersonPatient: FormFieldOptionsSchema,
  cancelReasonOptionsInPersonProvider: FormFieldOptionsSchema,
  cancelReasonOptionsVirtualPatient: FormFieldOptionsSchema,
  cancelReasonOptionsVirtualProvider: FormFieldOptionsSchema,
  reasonForVisitOptions: FormFieldOptionsSchema,
  reasonForVisitOptionsOccMed: FormFieldOptionsSchema,
  reasonForVisitOptionsWorkersComp: FormFieldOptionsSchema,
  schoolWorkNoteOptions: FormFieldOptionsSchema,

  // Relationships
  emergencyContactRelationshipOptions: FormFieldOptionsSchema,
  relationshipOptions: FormFieldOptionsSchema,
  relationshipToInsuredOptions: FormFieldOptionsSchema,
  patientFillingOutAsOptions: FormFieldOptionsSchema,

  // Insurance & Payment
  insurancePriorityOptions: FormFieldOptionsSchema,
  insuranceTypeOptions: z.array(InsurancePlanTypeSchema),
  patientPaymentPageOptions: FormFieldOptionsSchema,
  patientOccMedPaymentPageOptions: FormFieldOptionsSchema,

  // Medical History
  allergiesYesNoOptions: FormFieldOptionsSchema,
  allergyMedicationOptions: FormFieldOptionsSchema,
  allergyOtherOptions: FormFieldOptionsSchema,
  allergyTypeOptions: FormFieldOptionsSchema,
  currentMedicationsOptions: FormFieldOptionsSchema,
  currentMedicationsYesNoOptions: FormFieldOptionsSchema,
  medicalConditionOptions: FormFieldOptionsSchema,
  medicalHistoryYesNoOptions: FormFieldOptionsSchema,
  surgeryTypeOptions: FormFieldOptionsSchema,
  surgicalHistoryYesNoOptions: FormFieldOptionsSchema,

  // Consent & Communication
  preferredCommunicationMethodOptions: FormFieldOptionsSchema,
  pointOfDiscoveryOptions: FormFieldOptionsSchema,
  rxHistoryConsentOptions: FormFieldOptionsSchema,
  yesNoOptions: FormFieldOptionsSchema,

  // Workers Comp / Legal
  attorneyOptions: FormFieldOptionsSchema,

  // Virtual Visit
  inviteFromAnotherDeviceOptions: FormFieldOptionsSchema,
  inviteContactOptions: FormFieldOptionsSchema,

  // External Labs
  externalLabCptCodesToAddPerEncounter: FormFieldOptionsSchema,
});

export type ValueSetsConfig = z.infer<typeof ValueSetsConfigSchema>;
