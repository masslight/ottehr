import { DocumentReference, QuestionnaireResponseItem } from 'fhir/r4b';
import { INTAKE_PAPERWORK_CONFIG } from 'utils/lib/ottehr-config/intake-paperwork';
import { MIME_TYPES } from 'utils/lib/utils/file';
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

const TEST_INSURANCE_CARD_URLS: Record<string, string> = {
  'insurance-card-front':
    'https://testing.project-api.zapehr.com/v1/z3/local-insurance-cards/2bc5ab8d-c1c2-4ca3-804b-c61066a62cb4/1721330510132-insurance-card-front.jpeg',
  'insurance-card-back':
    'https://testing.project-api.zapehr.com/v1/z3/local-insurance-cards/2bc5ab8d-c1c2-4ca3-804b-c61066a62cb4/1721330518576-insurance-card-back.jpeg',
};

export function addRequiredInsuranceCardAnswers(page: QuestionnaireResponseItem): QuestionnaireResponseItem {
  const items = Object.values(INTAKE_PAPERWORK_CONFIG.FormFields.paymentOption.items) as {
    key: string;
    triggers?: { effect: string[] }[];
  }[];
  const cardItems = Object.keys(TEST_INSURANCE_CARD_URLS)
    .filter(
      (key) => items.find((item) => item.key === key)?.triggers?.some((trigger) => trigger.effect.includes('require'))
    )
    .map((key) => ({
      linkId: key,
      answer: [
        {
          // `creation` becomes the harvested DocumentReference.date — FHIR rejects it when missing.
          valueAttachment: {
            url: TEST_INSURANCE_CARD_URLS[key],
            contentType: MIME_TYPES.JPEG,
            title: key,
            creation: new Date().toISOString(),
          },
        },
      ],
    }));
  if (cardItems.length === 0) return page;
  return { ...page, item: [...(page.item ?? []), ...cardItems] };
}
