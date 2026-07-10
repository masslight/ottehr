import { QuestionnaireDataTypes } from 'config-types';
import { Questionnaire, QuestionnaireItem } from 'fhir/r4b';
import z from 'zod';
import { QAndQRResponse } from '../paperwork';
import {
  GetStandAlonePaperworkInputSchema,
  PracticeManagedQuestionnaireItemSchema,
  PracticeManagedQuestionnaireSchema,
  PracticeManagedQuestionnaireUpdateStatusSchema,
} from './practice-managed-questionnaire.schema';

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

export type StandaloneFormDTO = Omit<QAndQRResponse, 'questionnaireTitle'> & {
  questionnaireId: string;
  questionnaireTitle: string;
};

// ============= api input / output types ===============

// get practice managed questionnaire
export type PracticeManagedQuestionnaireDetailInput = {
  questionnaireId: string;
};
export type PracticeManagedQuestionnaireDetailOutput = {
  practiceManagedQuestionnaires: PracticeManagedQuestionnaire;
};
export type PracticeManagedQuestionnaireListOutput = {
  practiceManagedQuestionnaires: PracticeManagedQuestionnaire[];
};

// update practice managed questionnaire
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

// updating a questionnaire's content creates a new resource (a new version), so the
// caller needs the new id back; updating status patches in place, so there is no new id
export type PracticeManagedQuestionnaireUpdateOutput = {
  questionnaireId: string | undefined;
};

// create managed questionnaire
export type PracticeManagedQuestionnaireCreateInput = {
  practiceManagedQuestionnaire: PracticeManagedQuestionnaire;
};
export type PracticeManagedQuestionnaireCreateOutput = {
  questionnaireId: string;
};

// used for patient app rendering custom, standalone forms
// return is type UCGetPaperworkResponse which is the same as get-paperwork
export type GetStandAlonePaperworkInput = z.infer<typeof GetStandAlonePaperworkInputSchema>;
