import { Questionnaire, Encounter } from 'fhir/r4b';

export interface GetLabOrderDetailsInput {
  serviceRequestID: string;
}

export interface SubmitLabOrderInput {
  serviceRequestID: string;
  accountNumber: string;
  data: any;
}

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
}

export interface GetLabOrderResultsParams {
  encounter: Encounter;
}

export interface LabOrderResultPDFConfig {
  name: string;
  url: string;
  orderNumber?: string;
}
export interface GetLabOrderResultRes {
  resultsPending: boolean;
  labOrderResults: (LabOrderResultPDFConfig & { reflexResults?: LabOrderResultPDFConfig[] })[];
}
