/**
 * Configuration type contracts
 *
 * These types define the shape that configuration implementations must satisfy.
 * When ottehr-config is swizzled with instance-specific configs, TypeScript
 * will verify the replacement satisfies these contracts at build time.
 */

// Foundational types
export { DisplayTextSchema, LinkDefSchema } from './display-text';
export type { DisplayTextDef, LinkDef, TextWithLinkComposition } from './display-text';

// Homepage options enum
export { HomepageOptions } from './homepage-options';

// Booking config types
export { StrongCodingSchema, BookingOptionSchema, VisitType, BookingConfigSchema } from './booking';
export type { StrongCoding, BookingOption, CanonicalUrl, BookingConfig } from './booking';

// Questionnaire types
export {
  QuestionnaireDataTypes,
  QuestionnaireDataTypeSchema,
  QuestionnaireBaseSchema,
  TriggerEffectSchema,
  FormFieldTriggerSchema,
  FormFieldOptionSchema,
} from './questionnaire';
export type {
  QuestionnaireDataType,
  QuestionnaireBase,
  TriggerEffect,
  FormFieldTrigger,
  FormFieldOption,
} from './questionnaire';

// Value sets types
export { InsurancePlanTypeSchema, FormFieldOptionsSchema, ValueSetsConfigSchema } from './value-sets';
export type { InsurancePlanType, FormFieldOptions, ValueSetsConfig } from './value-sets';

// FHIR types
export { FhirResourceTypeSchema, AnswerOptionSourceSchema, AnswerLoadingOptionsSchema } from './fhir';
export type { FhirResourceType, AnswerOptionSource, AnswerLoadingOptions } from './fhir';

// Form field types
export {
  DynamicPopulationSchema,
  ReferenceDataSourceSchema,
  FormFieldsLogicalFieldSchema,
  FormFieldsDisplayFieldSchema,
  FormFieldsValueTypeBaseSchema,
  FormFieldsValueTypeSchema,
  FormFieldsAttachmentFieldSchema,
  FormFieldsGroupFieldSchema,
  FormFieldItemRecordSchema,
  FormFieldLogicalItemRecordSchema,
  ComplexValidationTriggerWhenSchema,
  ComplexValidationSchema,
  FormSectionSimpleSchema,
  FormSectionArraySchema,
  QuestionnaireConfigSchema,
} from './form-fields';
export type {
  DynamicPopulation,
  ReferenceDataSource,
  FormFieldsLogicalItem,
  FormFieldsDisplayItem,
  FormFieldsValueType,
  FormFieldsAttachmentItem,
  FormFieldsInputItem,
  FormFieldsGroupItem,
  FormFieldsItem,
  FormFieldItemRecord,
  FormFieldLogicalItemRecord,
  ComplexValidation,
  FormSectionSimple,
  FormSectionArray,
  FormFieldSection,
  QuestionnaireConfigType,
} from './form-fields';

// Legal config types
export { TextWithLinkCompositionSchema, LegalConfigSchema } from './legal';
export type { LegalConfig } from './legal';

// Location config types
export { LocationItemSchema, SupportScheduleGroupSchema, LocationConfigSchema } from './locations';
export type { LocationItem, SupportScheduleGroup, LocationConfig } from './locations';

// Branding config types
export {
  EmailPaletteSchema,
  EmailConfigSchema,
  LogoConfigSchema,
  IntakeBrandingSchema,
  BrandingConfigSchema,
} from './branding';
export type { EmailPalette, EmailConfig, LogoConfig, IntakeBranding, BrandingConfig } from './branding';

// Consent forms config types
export {
  ConsentFormCodingSchema,
  PathConfigSchema,
  ConsentFormSchema,
  ConsentFormsConfigSchema,
} from './consent-forms';
export type {
  ConsentFormCoding,
  PathConfig,
  ConsentFormConfig,
  ConsentFormsConfig,
  ResolvedConsentFormConfig,
} from './consent-forms';

// Paperwork config types (used by both in-person and virtual intake)
export { PaperworkFormFieldsSchema, PaperworkConfigSchema } from './intake-paperwork';
export type { PaperworkFormFields, PaperworkConfig } from './intake-paperwork';

// Patient record config types
export { PatientRecordFormFieldsSchema, PatientRecordConfigSchema } from './patient-record';
export type { PatientRecordFormFields, PatientRecordConfig } from './patient-record';

// SendGrid config types
export { EmailTemplateBaseSchema, SendgridTemplatesSchema, SendgridConfigSchema } from './sendgrid';
export type {
  SendgridTemplateIdSecretName,
  EmailTemplateBase,
  SendgridTemplates,
  SendgridConfig,
  DynamicTemplateDataRecord,
  EmailTemplate,
} from './sendgrid';

// Vitals config types
export {
  VitalAlertCriticalitySchema,
  VitalVisionComponentSchema,
  VitalBloodPressureComponentSchema,
  AgeUnitSchema,
  AgeSchema,
  ConstraintTypeSchema,
  VitalTypeSchema,
} from './vitals';
export type {
  VitalAlertCriticality,
  VitalVisionComponent,
  VitalBloodPressureComponent,
  AgeUnit,
  Age,
  ConstraintType,
  BaseConstraint,
  ValueConstraint,
  AgeFunctionConstraint,
  AgeSexFunctionConstraint,
  AlertConstraint,
  AlertThreshold,
  VitalsObject,
  VitalsWeight,
  VitalsWithComponents,
  VitalsBloodPressure,
  VitalsVision,
  VitalsConfig,
  VitalType,
} from './vitals';

// Examination config types
export {
  ExamCodeableConceptSchema,
  ExamCardCheckboxComponentSchema,
  ExamCardDropdownOptionSchema,
  ExamCardDropdownComponentSchema,
  ExamCardTextComponentSchema,
  ExamCardColumnComponentSchema,
  ExamCardFormFieldOptionSchema,
  ExamCardFormFieldSchema,
  ExamCardFormElementSchema,
  ExamCardFormComponentSchema,
  ExamCardMultiSelectOptionSchema,
  ExamCardMultiSelectComponentSchema,
  ExamCardNonTextComponentSchema,
  ExamCardComponentSchema,
  ExamCardSchema,
  ExamItemConfigSchema,
  ExamTypeInstanceSchema,
  ExaminationConfigSchema,
  HexHashSchema,
  validateExaminationConfig,
} from './examination';
export type {
  ExamCodeableConcept,
  ExamComponentWithCode,
  ExamCardCheckboxComponent,
  ExamCardDropdownOption,
  ExamCardDropdownComponent,
  ExamCardTextComponent,
  ExamCardColumnComponent,
  ExamCardFormFieldOption,
  ExamCardFormField,
  ExamCardFormElement,
  ExamCardFormComponent,
  ExamCardMultiSelectOption,
  ExamCardMultiSelectComponent,
  ExamCardNonTextComponent,
  ExamCardComponent,
  ExamCard,
  ExamItemConfig,
  ExamTypeInstance,
  ExaminationConfig,
  ExamTypeValue,
} from './examination';

// Screening questions config types
export type {
  ScreeningFieldType,
  ScreeningFieldOption,
  ScreeningNoteField,
  ScreeningConditionalSave,
  ScreeningField,
  ScreeningQuestionsConfig,
} from './screening-questions';

// Medical history config types
export {
  MedicalConditionQuickPickSchema,
  AllergyQuickPickSchema,
  MedicationQuickPickSchema,
  InHouseMedicationQuickPickSchema,
  MedicalHistoryConfigSchema,
} from './medical-history';
export type {
  MedicalConditionQuickPick,
  AllergyQuickPick,
  MedicationQuickPick,
  InHouseMedicationQuickPick,
  MedicalConditionsSection,
  AllergiesSection,
  MedicationsSection,
  InHouseMedicationsSection,
  MedicalHistoryConfig,
} from './medical-history';

// Texting config types
export { I18nQuickTextSchema, TextingConfigSchema } from './texting';
export type {
  QuickTextWhen,
  I18nQuickText,
  TextingInvoicingConfig,
  TextingTelemedConfig,
  TextingInPersonConfig,
  TextingConfig,
} from './texting';

// Forms config types
export { FormItemSchema, FormsConfigSchema } from './forms';
export type { FormItem, FormsConfig } from './forms';

// Procedures config types
export { PrepopulationEntrySchema, ProceduresConfigSchema } from './procedures';
export type { PrepopulationValue, PrepopulationEntry, ProceduresConfig } from './procedures';

// Radiology config types
export type { RadiologyStudy, RadiologyConfig } from './radiology';
