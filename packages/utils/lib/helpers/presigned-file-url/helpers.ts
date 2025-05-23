import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, DocumentReference } from 'fhir/r4b';

export async function getPresignedURL(url: string, zapehrToken: string): Promise<string> {
  console.log('getting presigned url');
  const presignedURLRequest = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${zapehrToken}`,
    },
    body: JSON.stringify({ action: 'download' }),
  });
  const presignedURLResponse = await presignedURLRequest.json();
  const presignedUrl = presignedURLResponse.signedUrl;
  return presignedUrl;
}

export const fetchDocumentReferencesForDiagnosticReports = async (
  oystehr: Oystehr,
  diagnosticReports: DiagnosticReport[]
): Promise<DocumentReference[]> => {
  const reportIds = diagnosticReports.map((report) => report.id).filter(Boolean);

  if (!reportIds.length) {
    return [];
  }

  const documentReferencesResponse = await oystehr.fhir.search<DocumentReference>({
    resourceType: 'DocumentReference',
    params: [
      {
        name: 'related',
        value: reportIds.map((id) => `DiagnosticReport/${id}`).join(','),
      },
      {
        name: 'status',
        value: 'current',
      },
    ],
  });

  return documentReferencesResponse.unbundle();
};

export type LabOrderPDF = {
  url: string;
  diagnosticReportId: string;
};

export const fetchLabOrderPDFs = async (
  documentReferences: DocumentReference[],
  m2mtoken: string
): Promise<LabOrderPDF[]> => {
  if (!documentReferences.length) {
    return [];
  }

  const pdfPromises: Promise<LabOrderPDF | null>[] = [];

  for (const docRef of documentReferences) {
    const diagnosticReportReference = docRef.context?.related?.find(
      (rel) => rel.reference?.startsWith('DiagnosticReport/')
    )?.reference;

    const diagnosticReportId = diagnosticReportReference?.split('/')[1];

    if (!diagnosticReportId) {
      continue;
    }

    for (const content of docRef.content) {
      const z3Url = content.attachment?.url;
      if (z3Url) {
        pdfPromises.push(
          getPresignedURL(z3Url, m2mtoken)
            .then((url) => ({
              url,
              diagnosticReportId,
            }))
            .catch((error) => {
              console.error(`Failed to get presigned URL for document ${docRef.id}:`, error);
              return null;
            })
        );
      }
    }
  }

  const results = await Promise.allSettled(pdfPromises);

  return results
    .filter(
      (result): result is PromiseFulfilledResult<LabOrderPDF> => result.status === 'fulfilled' && result.value !== null
    )
    .map((result) => result.value as LabOrderPDF);
};
