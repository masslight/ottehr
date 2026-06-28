import { Questionnaire, QuestionnaireItem, QuestionnaireResponse } from 'fhir/r4b';
import z from 'zod';
import { PRIVATE_EXTENSION_BASE_URL } from '../../../fhir';
import {
  GetAllManagedPaperworkInputSchema,
  GetManagedPaperworkForQuestionnaire,
  ManagedQuestionnaireItemSchema,
  ManagedQuestionnaireSchema,
  ManagedQuestionnaireUpdateStatusSchema,
  SaveManagedPaperworkResponseInputSchema,
} from './managed-questionnaire.schema';

export const DATA_TYPE_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/data-type`;
export const INPUT_WIDTH_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/input-width`;

export type QuestionnaireItemType = Exclude<QuestionnaireItem['type'], 'question'>;

export const QUESTIONNAIRE_ITEM_TYPES = [
  'attachment',
  'boolean',
  'choice',
  'date',
  'dateTime',
  'decimal',
  'display',
  'group',
  'integer',
  'open-choice',
  'quantity',
  'reference',
  'string',
  'text',
  'time',
  'url',
] as const satisfies readonly QuestionnaireItemType[];

export const OTTEHR_DATA_TYPES = [
  'Phone Number',
  'Email',
  'ZIP',
  'DOB',
  'SSN',
  'Signature',
  'Image',
  'PDF',
  'Call Out',
] as const;

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

export type ManagedQuestionnaireItem = Omit<QuestionnaireItem, 'item'> &
  z.infer<typeof ManagedQuestionnaireItemSchema> & {
    item?: ManagedQuestionnaireItem[];
  };

export type ManagedQuestionnaire = Questionnaire & z.infer<typeof ManagedQuestionnaireSchema>;

export type ManagedQuestionnaireUpdateStatusData = z.infer<typeof ManagedQuestionnaireUpdateStatusSchema>;

export type ManagedPaperworkDTO = {
  questionnaireTitle: string;
  questionnaireId: string;
  questionnaireItems: QuestionnaireItem[];
  questionnaireResponse: QuestionnaireResponse | undefined;
};

// ============= api input / output types ===============

// get managed questionnaire
export type ManagedQuestionnaireDetailInput = {
  questionnaireId: string;
};
export type ManagedQuestionnaireDetailOutput = {
  managedQuestionnaires: ManagedQuestionnaire;
};
export type ManagedQuestionnaireListOutput = {
  managedQuestionnaires: ManagedQuestionnaire[];
};

// update managed questionnaire
export type ManagedQuestionnaireUpdateStatus = {
  updateType: 'update-status';
  data: ManagedQuestionnaireUpdateStatusData;
};
export type ManagedQuestionnaireUpdateQuestionnaire = {
  updateType: 'update-questionnaire';
  data: ManagedQuestionnaire;
};
export type ManagedQuestionnaireUpdateInput =
  | ManagedQuestionnaireUpdateStatus
  | ManagedQuestionnaireUpdateQuestionnaire;

// create managed questionnaire
export type ManagedQuestionnaireCreateInput = {
  managedQuestionnaire: ManagedQuestionnaire;
};
export type ManagedQuestionnaireCreateOutput = {
  questionnaireId: string;
};

// get managed paperwork
export type GetAllManagedPaperworkInput = z.infer<typeof GetAllManagedPaperworkInputSchema>;
export type GetManagedPaperworkForQuestionnaireInput = z.infer<typeof GetManagedPaperworkForQuestionnaire>;
export type GetManagedPaperworkInput = GetAllManagedPaperworkInput | GetManagedPaperworkForQuestionnaireInput;

export type GetAllManagedPaperworkOutput = {
  managedPaperwork: (ManagedPaperworkDTO & { questionnaireResponse: QuestionnaireResponse })[];
};
export type GetManagedPaperworkForQuestionnaireOutput = {
  managedPaperwork: ManagedPaperworkDTO;
};
export type GetManagedPaperworkOutput = GetAllManagedPaperworkOutput | GetManagedPaperworkForQuestionnaireOutput;

// save manged paperwork
export type SaveManagedPaperworkResponseInput = z.infer<typeof SaveManagedPaperworkResponseInputSchema>;
export type SaveManagedPaperworkResponseOutput = {
  questionnaireResponse: QuestionnaireResponse;
};
