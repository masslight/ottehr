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

export interface ExternalLabOrderResultPDFConfig {
  name: string;
  url: string;
  orderNumber?: string;
}

export interface ExternalLabOrderResult extends ExternalLabOrderResultPDFConfig {
  reflexResults?: ExternalLabOrderResultPDFConfig[];
}

export interface EncounterExternalLabResult {
  resultsPending: boolean;
  labOrderResults: ExternalLabOrderResult[];
}
