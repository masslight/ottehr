import { Questionnaire } from 'fhir/r4b';

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
