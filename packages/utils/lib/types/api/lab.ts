import { Questionnaire } from 'fhir/r4b';

export interface GetLabOrderDetailsInput {
  serviceRequestID: string;
}

export interface SubmitLabOrderInput {
  serviceRequestID: string;
  accountNumber: string;
  data: any;
}

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

type LabQuestionnaireResponseItem = (string | number | boolean | undefined)[] | undefined;

export interface OrderDetails {
  diagnosis: string;
  patientName: string;
  orderName: string;
  orderTypeDetail: string;
  orderingPhysician: string;
  orderDateTime: string;
  labName: string;
  accountNumber: string;
  sampleCollectionDateTime: string;
  labQuestions: Questionnaire;
  labQuestionnaireResponses: LabQuestionnaireResponse[] | undefined;
}
