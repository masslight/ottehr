import Oystehr from '@oystehr/sdk';
import { DocumentReference, MedicationRequest } from 'fhir/r4b';
import {
  FileURLs,
  getPresignedURL,
  MEDICATION_DISPENSABLE_DRUG_ID,
  PaymentDataResponse,
  PrescribedMedication,
} from 'utils';

async function makePresignedURLFromDocumentReference(
  resource: DocumentReference,
  oystehrToken: string
): Promise<string | undefined> {
  const documentBaseUrl = resource.content?.[0].attachment.url;
  if (!documentBaseUrl) throw new Error("Attached DocumentReference don't have attached base file URL");

  const presignedUrl = await getPresignedURL(documentBaseUrl, oystehrToken);

  return presignedUrl;
}

const PdfDocumentReferencePublishedStatuses: { [key: string]: 'final' | 'preliminary' } = {
  published: 'final',
  unpublished: 'preliminary',
};

const loincCodeToDocumentTypeMap: { [code: string]: string } = {
  '34105-7': 'receipt',
  '75498-6': 'visit-note',
  '47420-5': 'school-work-note',
};

function getDocumentTypeFromLoincCode(code: string | undefined): string | null {
  if (!code) {
    return null;
  }
  return loincCodeToDocumentTypeMap[code] || null;
}

export function getDocumentType(resource: DocumentReference): string | null {
  if (resource.resourceType !== 'DocumentReference') {
    return null;
  }

  const typeInfo = resource.type || {};
  const codingList = typeInfo.coding || [];

  for (const coding of codingList) {
    if (coding.system === 'http://loinc.org') {
      return getDocumentTypeFromLoincCode(coding.code);
    }
  }

  return null;
}

export function isDocumentPublished(documentReference: DocumentReference): boolean {
  return documentReference.docStatus === PdfDocumentReferencePublishedStatuses.published;
}

export async function getPaymentDataRequest(
  apiUrl: string,
  token: string,
  encounterId?: string
): Promise<PaymentDataResponse> {
  const serviceUrl = `${apiUrl}/payment/charge/status`;

  console.debug(`Getting payment data at ${serviceUrl} for encounter ${encounterId}`);

  if (encounterId === undefined) {
    throw new Error('Encounter ID must be specified for payments.');
  }

  return fetch(serviceUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
    body: JSON.stringify({ encounterId: encounterId }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Error getting charge status for the encounter. Status: ${response.statusText}`);
    }
    return response.json();
  });
}

export async function getMedications(oystehr: Oystehr, encounterId?: string): Promise<PrescribedMedication[]> {
  if (encounterId === undefined) {
    throw new Error('Encounter ID must be specified for payments.');
  }

  const medicationRequestSearch = await oystehr.fhir.search<MedicationRequest>({
    resourceType: 'MedicationRequest',
    params: [
      {
        name: 'encounter',
        value: encounterId,
      },
    ],
  });
  const medications: PrescribedMedication[] = [];
  medicationRequestSearch.entry?.forEach((entry) => {
    if (entry.resource?.resourceType === 'MedicationRequest')
      medications.push(makePrescribedMedicationDTO(entry.resource as MedicationRequest));
  });
  return medications;
}

function makePrescribedMedicationDTO(medRequest: MedicationRequest): PrescribedMedication {
  return {
    resourceId: medRequest.id,
    name: medRequest.medicationCodeableConcept?.coding?.find(
      (coding) => coding.system === MEDICATION_DISPENSABLE_DRUG_ID
    )?.display,
    instructions: medRequest.dosageInstruction?.[0]?.patientInstruction,
  };
}

export async function getPresignedURLs(
  oystehr: Oystehr,
  oystehrToken: string,
  encounterId?: string
): Promise<FileURLs> {
  if (encounterId === undefined) {
    throw new Error('Encounter ID must be specified for payments.');
  }

  const documentReferenceResources = (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        {
          name: 'encounter',
          value: encounterId,
        },
      ],
    })
  ).unbundle();

  const presignedUrlObj: FileURLs = {};

  await Promise.all(
    documentReferenceResources.map(async (resource) => {
      const type = getDocumentType(resource);
      if (!type) return null;
      if (type !== 'school-work-note') {
        presignedUrlObj[type] = { presignedUrl: await makePresignedURLFromDocumentReference(resource, oystehrToken) };
        return null;
      }
      if (!isDocumentPublished(resource)) return undefined;
      const noteType = resource.meta?.tag?.find((tag) => tag.system === 'school-work-note/type')?.code;
      if (!noteType) return undefined;
      presignedUrlObj[noteType] = {
        presignedUrl: await makePresignedURLFromDocumentReference(resource, oystehrToken),
      };
      return null;
    })
  );

  return presignedUrlObj;
}
