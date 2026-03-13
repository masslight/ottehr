import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Bundle, BundleEntry, DocumentReference, Encounter, Patient } from 'fhir/r4b';
import {
  DocumentInfo,
  DocumentType,
  FHIR_RESOURCE_NOT_FOUND,
  getPatchBinary,
  getPaymentVariantFromEncounter,
  getPresignedURL,
  getSecret,
  INSURANCE_CARD_CODE,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  LOINC_SYSTEM,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PAPERWORK_CONSENT_CODE_UNIQUE,
  PAPERWORK_CONSENT_CODING_LOINC,
  PaymentVariant,
  PHOTO_ID_CARD_CODE,
  PRIVACY_POLICY_CODE,
  Secrets,
  SecretsKeys,
  VisitDocuments,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'get-visit-files';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedParameters));
    const { secrets, userToken } = validatedParameters;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const effectInput = await complexValidation(validatedParameters, oystehr);

    const files = await getFileResources(effectInput, oystehr, userToken);

    return {
      statusCode: 200,
      body: JSON.stringify(files),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

interface GetFilesInput {
  patientId: string;
  appointmentId: string;
}
async function getFileResources(input: GetFilesInput, oystehr: Oystehr, userToken: string): Promise<VisitDocuments> {
  const { patientId, appointmentId } = input;
  const documents: VisitDocuments = {
    photoIdCards: [],
    insuranceCards: [],
    insuranceCardsSecondary: [],
    fullCardPdfs: [],
    consentPdfUrls: [],
  };

  const documentReferenceResources = await searchDocumentReferencesForVisit(oystehr, patientId, appointmentId);

  // Get document info
  const z3Documents: DocumentInfo[] = [];

  for (const docRef of documentReferenceResources) {
    const docRefCode = docRef.type?.coding?.[0].code;

    if (
      docRefCode &&
      ([
        PHOTO_ID_CARD_CODE,
        PAPERWORK_CONSENT_CODE_UNIQUE.code,
        PAPERWORK_CONSENT_CODING_LOINC.code,
        PRIVACY_POLICY_CODE,
      ].includes(docRefCode) ||
        docRefCode === INSURANCE_CARD_CODE)
    ) {
      for (const content of docRef.content) {
        const title = content.attachment.title;
        const z3Url = content.attachment.url;

        if (z3Url && title) {
          if (
            [PHOTO_ID_CARD_CODE, INSURANCE_CARD_CODE].includes(docRefCode) &&
            (!title || !Object.values<string>(DocumentType).includes(title))
          ) {
            continue;
          }

          const presignedUrl = await getPresignedURL(z3Url, userToken);

          if (presignedUrl) {
            z3Documents.push({
              id: docRef.id!,
              z3Url: z3Url,
              presignedUrl: presignedUrl,
              type: title as DocumentType,
              code: docRefCode,
            });
          }
        }
      }
    }
  }

  if (!z3Documents) {
    return documents;
  }

  if (z3Documents.length) {
    documents.photoIdCards = [
      z3Documents.find((doc) => doc.type === DocumentType.PhotoIdFront),
      z3Documents.find((doc) => doc.type === DocumentType.PhotoIdBack),
    ].filter((doc): doc is DocumentInfo => doc !== undefined);
    documents.insuranceCards = [
      z3Documents.find((doc) => doc.type === DocumentType.InsuranceFront),
      z3Documents.find((doc) => doc.type === DocumentType.InsuranceBack),
    ].filter((doc): doc is DocumentInfo => doc !== undefined);
    documents.insuranceCardsSecondary = [
      z3Documents.find((doc) => doc.type === DocumentType.InsuranceFrontSecondary),
      z3Documents.find((doc) => doc.type === DocumentType.InsuranceBackSecondary),
    ].filter((doc): doc is DocumentInfo => doc !== undefined);
    documents.fullCardPdfs = z3Documents.filter((doc) =>
      [DocumentType.FullInsurance, DocumentType.FullInsuranceSecondary, DocumentType.FullPhotoId].includes(doc.type)
    );
    documents.consentPdfUrls = z3Documents
      .filter(
        (doc) =>
          doc.code === PAPERWORK_CONSENT_CODING_LOINC.code ||
          doc.code === PAPERWORK_CONSENT_CODE_UNIQUE.code ||
          doc.code === PRIVACY_POLICY_CODE
      )
      .flatMap((doc) => (doc.presignedUrl ? [doc.presignedUrl] : []));
  }
  return documents;
}

export async function searchDocumentReferencesForVisit(
  oystehr: Oystehr,
  patientId: string,
  appointmentId: string
): Promise<DocumentReference[]> {
  const documentReferenceResources: DocumentReference[] = [];
  const duplicateResources: DocumentReference[] = [];

  const docRefBundle = await oystehr.fhir.batch<DocumentReference>({
    requests: [
      {
        // Consent
        method: 'GET',
        url: `/DocumentReference?status=current&_sort=-_lastUpdated&subject=Patient/${patientId}&related=Appointment/${appointmentId}&type=${PAPERWORK_CONSENT_CODE_UNIQUE.system}|${PAPERWORK_CONSENT_CODE_UNIQUE.code},${LOINC_SYSTEM}|${PRIVACY_POLICY_CODE}`,
      },
      {
        // Photo IDs
        method: 'GET',
        url: `/DocumentReference?_sort=-_lastUpdated&status=current&related=Patient/${patientId}&type=${LOINC_SYSTEM}|${PHOTO_ID_CARD_CODE}`,
      },
      {
        // Insurance Cards
        method: 'GET',
        url: `/DocumentReference?_sort=-_lastUpdated&status=current&related=Patient/${patientId}&type=${LOINC_SYSTEM}|${INSURANCE_CARD_CODE}`,
      },
    ],
  });

  const bundleEntries = docRefBundle?.entry;

  // clean up duplicates
  const z3UrlToDocRef = new Map<string, DocumentReference>();
  bundleEntries?.forEach((bundleEntry: BundleEntry) => {
    const bundleResource = bundleEntry.resource as Bundle;
    bundleResource.entry?.forEach((entry) => {
      const docRefResource = entry.resource as DocumentReference;
      if (!docRefResource) return;
      const hasDuplicate = docRefResource.content.some((content) => {
        const z3Url = content.attachment.url;
        if (!z3Url) return false;
        if (z3UrlToDocRef.has(z3Url)) {
          console.warn(
            `Duplicate DocumentReference found for z3Url ${z3Url}. DocumentReference IDs: ${z3UrlToDocRef.get(z3Url)
              ?.id} and ${docRefResource.id}. Marking ${docRefResource.id} as duplicate and superseded.`
          );
          return true;
        }
        z3UrlToDocRef.set(z3Url, docRefResource);
        return false;
      });
      if (hasDuplicate) {
        duplicateResources.push(docRefResource);
      } else {
        documentReferenceResources.push(docRefResource);
      }
    });
  });
  if (duplicateResources.length > 0) {
    try {
      await oystehr.fhir.batch({
        requests: duplicateResources.map((docRef) =>
          getPatchBinary({
            resourceType: 'DocumentReference',
            resourceId: docRef.id!,
            patchOperations: [
              {
                op: 'replace',
                path: '/status',
                value: 'superseded',
              },
            ],
          })
        ),
      });
    } catch (error) {
      console.error('Failed to mark duplicate DocumentReferences as superseded:', error);
    }
  }

  return documentReferenceResources;
}

interface EffectInput {
  appointmentId: string;
  patientId: string;
  selfPay: boolean;
}

const complexValidation = async (input: Input, oystehr: Oystehr): Promise<EffectInput> => {
  const { appointmentId } = input;
  const patient = await oystehr.fhir.search<Appointment | Patient | Encounter>({
    resourceType: 'Appointment',
    params: [
      { name: '_id', value: appointmentId },
      { name: '_include', value: 'Appointment:patient' },
      { name: '_revinclude', value: 'Encounter:appointment' },
    ],
  });
  const appointment = patient.entry?.find((entry) => entry.resource?.resourceType === 'Appointment')
    ?.resource as Appointment;
  const patientResource = patient.entry?.find((entry) => entry.resource?.resourceType === 'Patient')
    ?.resource as Patient;
  const encounterResource = patient.entry?.find((entry) => entry.resource?.resourceType === 'Encounter')
    ?.resource as Encounter;

  if (!appointment) {
    throw FHIR_RESOURCE_NOT_FOUND('Appointment');
  }
  if (!patientResource || !patientResource.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Patient');
  }
  if (!encounterResource || !encounterResource.id) {
    throw FHIR_RESOURCE_NOT_FOUND('Encounter');
  }

  const selfPay = getPaymentVariantFromEncounter(encounterResource) === PaymentVariant.selfPay;

  return {
    appointmentId,
    patientId: patientResource.id,
    selfPay,
  };
};

interface Input {
  userToken: string;
  appointmentId: string;
  secrets: Secrets | null;
}

const validateRequestParameters = (input: ZambdaInput): Input => {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  // not doing anything with the userToken right now, but we may want to write an AuditEvent for viewing these resources
  // at some point and it should always be available, so throwing it in the input interface anticipatorily
  const userToken = input.headers.Authorization.replace('Bearer ', '');

  if (!userToken) {
    throw new Error('user token unexpectedly missing');
  }

  console.log('input', JSON.stringify(input, null, 2));
  const { secrets } = input;
  const { appointmentId } = JSON.parse(input.body);

  if (!appointmentId) {
    throw MISSING_REQUIRED_PARAMETERS(['appointmentId']);
  }

  if (isValidUUID(appointmentId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('appointmentId');
  }

  return {
    secrets,
    userToken,
    appointmentId,
  };
};
