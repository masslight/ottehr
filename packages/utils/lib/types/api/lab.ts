export interface LabQuestionnaireResponse {
  linkId: string;
  type:
    | 'group'
    | 'display'
    | 'question'
    | 'boolean'
    | 'decimal'
    | 'integer'
    | 'date'
    | 'dateTime'
    | 'time'
    | 'string'
    | 'text'
    | 'url'
    | 'choice'
    | 'open-choice'
    | 'attachment'
    | 'reference'
    | 'quantity';
  response: LabQuestionnaireResponseItem;
}

export type LabQuestionnaireResponseItem = (string | number | boolean | undefined)[] | undefined;

export interface LabOrderResultPDFConfig {
  name: string;
  url: string;
  orderNumber?: string;
}

export interface LabOrderResult extends LabOrderResultPDFConfig {
  reflexResults?: LabOrderResultPDFConfig[];
}

export interface EncounterLabResult {
  resultsPending: boolean;
  labOrderResults: LabOrderResult[];
}
