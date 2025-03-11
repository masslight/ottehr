import { Questionnaire } from 'fhir/r4b';

export interface GetLabOrderDetailsInput {
  serviceRequestID: string;
}

export interface SubmitLabOrderInput {
  serviceRequestID: string;
  data: any;
}

export interface OrderDetails {
  diagnosis: string;
  patientName: string;
  orderName: string;
  orderingPhysician: string;
  orderDateTime: string;
  labName: string;
  sampleCollectionDateTime: string;
  labQuestions: Questionnaire;
}
