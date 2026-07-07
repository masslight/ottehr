import { QuestionnaireDataTypes } from 'config-types';
import { Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import z from 'zod';
import { PRIVATE_EXTENSION_BASE_URL } from '../../../fhir';
import {
  GetAllPracticeManagedPaperworkInputSchema,
  GetStandAlonePaperworkInputSchema,
  PracticeManagedQuestionnaireItemSchema,
  PracticeManagedQuestionnaireSchema,
  PracticeManagedQuestionnaireUpdateStatusSchema,
} from './practice-managed-questionnaire.schema';

// todo sarah these are defined in OTTEHR_QUESTIONNAIRE_EXTENSION_KEYS
export const DATA_TYPE_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/data-type`;
export const INPUT_WIDTH_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/input-width`;

export type QuestionnaireItemType = Exclude<
  QuestionnaireItem['type'],
  'question' | 'time' | 'dateTime' | 'quantity' | 'reference' | 'url'
>;

export const QUESTIONNAIRE_ITEM_TYPES = [
  'string',
  'text',
  'decimal',
  'boolean',
  'display',
  'choice',
  'open-choice',
  'date',
  'group',
  'attachment',
  'integer',
] as const satisfies readonly QuestionnaireItemType[];

export const OTTEHR_DATA_TYPES = QuestionnaireDataTypes.filter(
  (t) => t !== 'Payment Validation' && t !== 'Medical History'
) as unknown as readonly ['ZIP', 'Email', 'Phone Number', 'DOB', 'Signature', 'Image', 'PDF', 'Call Out', 'SSN'];

export type OttehrDataType = (typeof OTTEHR_DATA_TYPES)[number];

// Which OttehrDataType are valid for each FHIR QuestionnaireItemType
// Used to validate fields TODO SARAH - need to double check the difference between leaving these validations black or selecting one of the below
// like what happens if i just add a date field with no DOB validation? what about vice versa
export const DATA_TYPES_BY_ITEM_TYPE: Partial<Record<QuestionnaireItemType, OttehrDataType[]>> = {
  string: ['Phone Number', 'Email', 'ZIP', 'SSN', 'Signature'],
  date: ['DOB'],
  attachment: ['Image', 'PDF'],
  display: ['Call Out'],
};
export const OTTEHR_INPUT_WIDTHS = ['s', 'm', 'l'] as const;
export type OttehrInputWidth = (typeof OTTEHR_INPUT_WIDTHS)[number];

export type PracticeManagedQuestionnaireItem = Omit<QuestionnaireItem, 'item'> &
  z.infer<typeof PracticeManagedQuestionnaireItemSchema> & {
    item?: PracticeManagedQuestionnaireItem[];
  };

export type PracticeManagedQuestionnaire = Questionnaire & z.infer<typeof PracticeManagedQuestionnaireSchema>;

export type PracticeManagedQuestionnaireUpdateStatusData = z.infer<
  typeof PracticeManagedQuestionnaireUpdateStatusSchema
>;

export type PracticeManagedPaperworkDTO = {
  questionnaireTitle: string;
  questionnaireId: string;
  questionnaireItems: QuestionnaireItem[]; // todo sarah update
  questionnaireResponse: QuestionnaireResponse;
};

// ============= api input / output types ===============

// get managed questionnaire
export type PracticeManagedQuestionnaireDetailInput = {
  questionnaireId: string;
};
export type PracticeManagedQuestionnaireDetailOutput = {
  practiceManagedQuestionnaires: PracticeManagedQuestionnaire;
};
export type PracticeManagedQuestionnaireListOutput = {
  practiceManagedQuestionnaires: PracticeManagedQuestionnaire[];
};

// update managed questionnaire
export type PracticeManagedQuestionnaireUpdateStatus = {
  updateType: 'update-status';
  data: PracticeManagedQuestionnaireUpdateStatusData;
};
export type PracticeManagedQuestionnaireUpdateQuestionnaire = {
  updateType: 'update-questionnaire';
  data: PracticeManagedQuestionnaire;
};
export type PracticeManagedQuestionnaireUpdateInput =
  | PracticeManagedQuestionnaireUpdateStatus
  | PracticeManagedQuestionnaireUpdateQuestionnaire;

// create managed questionnaire
export type PracticeManagedQuestionnaireCreateInput = {
  practiceManagedQuestionnaire: PracticeManagedQuestionnaire;
};
export type PracticeManagedQuestionnaireCreateOutput = {
  questionnaireId: string;
};

// get standalone paperwork
// todo sarah this is getting replaced
export type GetAllPracticeManagedPaperworkInput = z.infer<typeof GetAllPracticeManagedPaperworkInputSchema>;
export type GetAllPracticeManagedPaperworkOutput = {
  practiceManagedPaperwork: PracticeManagedPaperworkDTO[]; // might make more sense to use QAndQRResponse
};

// used for patient app rendering custom, standalone forms
// return is type UCGetPaperworkResponse which is the same as get-paperwork
export type GetStandAlonePaperworkInput = z.infer<typeof GetStandAlonePaperworkInputSchema>;
