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

interface LabOrderPDFDetail {
  name: string;
  url: string;
}

export enum NonNormalResult {
  Abnormal = 'abnormal',
  Inconclusive = 'inconclusive',
  Neutral = 'neutral',
}
export type NonNormalResultContained = NonNormalResult[] | undefined;
export interface ExternalLabOrderResultConfig extends LabOrderPDFDetail {
  nonNormalResultContained: NonNormalResultContained;
  orderNumber?: string;
}

export interface ExternalLabOrderResult extends ExternalLabOrderResultConfig {
  reflexResults?: ExternalLabOrderResultConfig[];
}

export interface EncounterExternalLabResult {
  resultsPending: boolean;
  labOrderResults: ExternalLabOrderResult[];
}

export interface InHouseLabResult extends LabOrderPDFDetail {
  nonNormalResultContained: NonNormalResultContained;
  // if the test has one result, we can display what was recorded
  // if more than one result (like Urinalysis) no result value will be displayed
  // todo not implemented, displaying this is a post mvp feature
  simpleResultValue?: string;
}
export interface EncounterInHouseLabResult {
  resultsPending: boolean;
  labOrderResults: InHouseLabResult[];
}
