import { DocumentReference } from 'fhir/r4b';

export enum LabelType {
  label = 'label',
  xmlLabel = 'xml-label',
}

// this is a general type not specific to labs
export interface LabelPdf {
  type: 'label';
  documentReference: DocumentReference;
  presignedURL: string;
}

export interface LabelXml extends Omit<LabelPdf, 'type'> {
  type: 'xml-label';
}
