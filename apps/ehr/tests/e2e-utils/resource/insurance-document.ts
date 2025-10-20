import { DocumentReference } from 'fhir/r4b';
import { MIME_TYPES } from 'utils';
// import { INSURANCE_CARD_CODE, OTTEHR_MODULE } from 'utils';

interface DocumentReferenceParams {
  status?: DocumentReference['status'];
  date?: string;
  patientId: string;
  appointmentId: string;
  frontUrl?: string;
  backUrl?: string;
  frontContentType?: string;
  backContentType?: string;
  tagCode?: string;
  type?: {
    system?: string;
    code?: string;
    display?: string;
    text?: string;
  };
}

export function createDocumentReference({
  status = 'superseded',
  date = new Date().toISOString(),
  patientId,
  appointmentId,
  frontUrl = 'https://testing.project-api.zapehr.com/v1/z3/local-insurance-cards/2bc5ab8d-c1c2-4ca3-804b-c61066a62cb4/1721330510132-insurance-card-front.jpeg',
  backUrl = 'https://testing.project-api.zapehr.com/v1/z3/local-insurance-cards/2bc5ab8d-c1c2-4ca3-804b-c61066a62cb4/1721330518576-insurance-card-back.jpeg',
  frontContentType = MIME_TYPES.JPEG,
  backContentType = MIME_TYPES.JPEG,
  tagCode = 'IN-PERSON',
  type = {
    system: 'http://loinc.org',
    code: '64290-0',
    display: 'Health insurance card',
    text: 'Insurance cards',
  },
}: DocumentReferenceParams): DocumentReference {
  return {
    resourceType: 'DocumentReference',
    meta: {
      tag: [
        {
          code: tagCode, // these are not module-scoped resources; this tag should be unnecessary
        },
      ],
    },
    status,
    type: {
      coding: [
        {
          system: type.system,
          code: type.code,
          display: type.display,
        },
      ],
      text: type.text,
    },
    date,
    content: [
      {
        attachment: {
          url: frontUrl,
          contentType: frontContentType,
          title: 'insurance-card-front',
        },
      },
      ...(backUrl
        ? [
            {
              attachment: {
                url: backUrl,
                contentType: backContentType,
                title: 'insurance-card-back',
              },
            },
          ]
        : []),
    ],
    context: {
      related: [
        {
          reference: `Patient/${patientId}`,
        },
        {
          reference: `Appointment/${appointmentId}`,
        },
      ],
    },
  };
}
