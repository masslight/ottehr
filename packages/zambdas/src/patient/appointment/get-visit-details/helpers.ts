import Oystehr from '@oystehr/sdk';
import { DocumentReference, MedicationRequest } from 'fhir/r4b';
import { FileURLs, getPresignedURL, MEDICATION_DISPENSABLE_DRUG_ID, PrescribedMedication } from 'utils';

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
  'statement-code': 'statement',
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

  // Group documents by type (excluding school-work-note) and find latest version
  const documentsByType: { [type: string]: DocumentReference[] } = {};

  documentReferenceResources.forEach((resource) => {
    const type = getDocumentType(resource);
    if (!type || type === 'school-work-note') return;

    if (!documentsByType[type]) {
      documentsByType[type] = [];
    }
    documentsByType[type].push(resource);
  });

  // For each type, find the document with the latest meta.lastUpdated time
  const latestDocumentsByType: { [type: string]: DocumentReference } = {};

  Object.entries(documentsByType).forEach(([type, documents]) => {
    const latestDocument = documents.reduce((latest, current) => {
      const latestTime = latest.meta?.lastUpdated ? new Date(latest.meta.lastUpdated).getTime() : 0;
      const currentTime = current.meta?.lastUpdated ? new Date(current.meta.lastUpdated).getTime() : 0;
      return currentTime > latestTime ? current : latest;
    });
    latestDocumentsByType[type] = latestDocument;
  });

  // Generate presigned URLs for latest documents (excluding school-work-note)
  await Promise.all(
    Object.entries(latestDocumentsByType).map(async ([type, resource]) => {
      presignedUrlObj[type] = {
        presignedUrl: await makePresignedURLFromDocumentReference(resource, oystehrToken),
      };
    })
  );

  // Handle school-work-note documents separately (keep existing logic)
  await Promise.all(
    documentReferenceResources.map(async (resource) => {
      const type = getDocumentType(resource);
      if (type !== 'school-work-note') return null;

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
