import {
  FhirResource,
  QuestionnaireItem,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
} from 'fhir/r4b';
import z from 'zod';
import { AvailableLocationInformation, FileURLs, PatientBaseInfo } from '../../common';
import { PaperworkResponse } from '../paperwork.types';
import type { VisitType } from '../telemed/appointments/create-appointment.types';

export interface UpdatePaperworkInput {
  appointmentID: string;
  paperwork?: PaperworkResponse[];
  inProgress?: string;
  files: FileURLs;
  timezone: string;
}

export interface UpdatePaperworkResponse {
  message: string;
}

export interface QuestionnaireItemConditionDefinition {
  question: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'exists';
  answerString?: string;
  answerBoolean?: boolean;
  answerDate?: string;
  answerInteger?: number | string;
}
export interface ConditionKeyObject {
  extension: string;
  question: string;
  operator: string;
  answer: string;
}

export interface QuestionnaireItemTextWhen extends QuestionnaireItemConditionDefinition {
  substituteText: string;
}

const QuestionnaireDataTypes = [
  'ZIP',
  'Email',
  'Phone Number',
  'DOB',
  'Signature',
  'Image',
  'PDF',
  'Payment Validation',
  'Medical History',
  'Call Out',
  'SSN',
] as const;
export const QuestionnaireDataTypeSchema = z.enum(QuestionnaireDataTypes);
export type QuestionnaireDataType = typeof QuestionnaireDataTypeSchema._type;
export const validateQuestionnaireDataType = (str: any): QuestionnaireDataType | undefined => {
  if (str === undefined) {
    return undefined;
  }
  if (typeof str === 'string') {
    return QuestionnaireDataTypeSchema.safeParse(str).data;
  }
  return undefined;
};

export const FormDisplayElementList = ['p', 'h3', 'h4', 'h5'] as const;
export const FormSelectionElementList = ['Radio', 'Radio List', 'Select', 'Free Select', 'Button'] as const;
export type FormDisplayElement = (typeof FormDisplayElementList)[number];
export type FormSelectionElement = (typeof FormSelectionElementList)[number];
export type FormElement = FormDisplayElement | FormSelectionElement;

export enum QuestionnaireItemGroupType {
  ListWithForm = 'list-with-form',
  GrayContainedWidget = 'gray-contained-widget',
  CreditCardCollection = 'credit-card-collection',
}

export interface AnswerOptionSource {
  resourceType: FhirResource['resourceType'];
  query: string;
}

export interface AnswerLoadingOptions {
  strategy: 'prefetch' | 'dynamic';
  answerSource?: AnswerOptionSource; // required when Item.answerValueSet is not defined
}

export type InputWidthOption = 's' | 'm' | 'l' | 'max';
export interface QuestionnaireItemExtension {
  acceptsMultipleAnswers: boolean;
  alwaysFilter: boolean;

  answerLoadingOptions?: AnswerLoadingOptions;
  attachmentText?: string;
  autofillFromWhenDisabled?: string;
  categoryTag?: string;
  dataType?: QuestionnaireDataType;
  disabledDisplay?: 'hidden' | 'protected';
  filterWhen?: QuestionnaireItemConditionDefinition;
  groupType?: QuestionnaireItemGroupType;
  infoText?: string;
  inputWidth?: InputWidthOption;
  minRows?: number;
  preferredElement?: FormElement;
  requireWhen?: QuestionnaireItemConditionDefinition;
  secondaryInfoText?: string;
  textWhen?: QuestionnaireItemTextWhen;
  validateAgeOver?: number;
  complexValidation?: {
    type: string; // only 'insurance validation' is supported out of the box right now, but defining this as string to allow for easy customization for other use cases
    triggerWhen?: QuestionnaireItemConditionDefinition;
  };
  requiredBooleanValue?: boolean; // if the item is of type boolean and required, this indicates whether it must be true or false
  // permittedStringValues?: string[]; // todo when needed
}
export interface AppointmentSummary {
  id: string;
  start: string;
  location: AvailableLocationInformation;
  visitType: VisitType;
  serviceMode: string;
  status?: string;
  // otherOffices: { display: string; url: string }[];
  unconfirmedDateOfBirth?: string;
}

// it's pretty tedious to have this one-property interface and have to drill down to get the bits you're really after
// but code written already accounts for this cruft so this can be a todo for a later time
export interface AppointmentData {
  appointment: AppointmentSummary | undefined;
}

export type PaperworkPatient = PatientBaseInfo & {
  firstName: string | undefined;
  sex?: string;
};
export interface PaperworkSupportingInfo {
  appointment: AppointmentSummary;
  patient: PatientBaseInfo;
}

export type FullAccessPaperworkSupportingInfo = Omit<PaperworkSupportingInfo, 'patient'> & {
  patient: PaperworkPatient;
  updateTimestamp: number | undefined;
};

export interface QAndQRResponse {
  allItems: IntakeQuestionnaireItem[];
  questionnaireResponse: QuestionnaireResponse;
}

export interface UCGetPaperworkResponse extends QAndQRResponse {
  appointment: AppointmentSummary;
  patient: PaperworkPatient;
  updateTimestamp: number | undefined;
}
export interface IntakeQuestionnaireItem
  extends QuestionnaireItemExtension,
    Omit<QuestionnaireItem, 'item' | 'extension'> {
  item?: IntakeQuestionnaireItem[];
}

export const flattenIntakeQuestionnaireItems = (items: IntakeQuestionnaireItem[]): IntakeQuestionnaireItem[] => {
  return items.flatMap((item) => {
    if (item.item) {
      return [item, ...flattenIntakeQuestionnaireItems(item.item)];
    } else {
      return item;
    }
  });
};

export const flattenQuestionnaireAnswers = (items: QuestionnaireResponseItem[]): QuestionnaireResponseItem[] => {
  let level = 0;
  return items.flatMap((item) => {
    if (item.item && level === 0) {
      level += 1;
      return [...flattenQuestionnaireAnswers(item.item)];
    } else if (item.item) {
      level = 0;
      return [item, ...flattenQuestionnaireAnswers(item.item)];
    } else {
      level = 0;
      return item;
    }
  });
};

// be warned that if you have items with same linkId under different parent items,
// this will return the first it finds
export const findQuestionnaireResponseItemLinkId = (
  linkId: string,
  rootItem: QuestionnaireResponseItem[]
): QuestionnaireResponseItem | undefined => {
  return flattenQuestionnaireAnswers(rootItem).find((item) => {
    return item.linkId === linkId;
  });
};

export type QuestionnaireFormFields = { [itemLinkId: string]: QuestionnaireResponseItem };

export interface SubmitPaperworkParameters {
  answers: QuestionnaireResponseItem[];
  questionnaireResponseId: string;
  appointmentId?: string;
}
export interface PatchPaperworkParameters {
  answers: QuestionnaireResponseItem;
  questionnaireResponseId: string;
}

interface ComplexValidationBaseCase {
  valueEntries: Record<string, QuestionnaireResponseItemAnswer[]>;
}

export interface ComplexValidationResultFailureCase extends ComplexValidationBaseCase {
  type: 'failure';
  title: string;
  canProceed: boolean;
  message: string;
  attemptCureAction?: string;
}
export interface ComplexValidationResultSuccessCase extends ComplexValidationBaseCase {
  type: 'success';
}
export type ComplexValidationResult = ComplexValidationResultFailureCase | ComplexValidationResultSuccessCase;

export enum InsuranceEligibilityCheckStatus {
  eligibilityConfirmed = 'eligibility-confirmed', // patient's insurance info was verified as eligible
  eligibilityCheckNotSupported = 'eligibility-check-not-supported', // not done because not supported by payer
  eligibilityNotChecked = 'eligibility-not-checked', // not done or some system failure occurred
  eligibilityNotConfirmed = 'eligibility-not-confirmed', // eligibility check was done and the patient's insurance info was deemed not eligible
}
