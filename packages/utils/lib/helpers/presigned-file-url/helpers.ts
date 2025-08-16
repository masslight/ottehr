import Oystehr from '@oystehr/sdk';
import { DiagnosticReport, DocumentReference } from 'fhir/r4b';

export async function getPresignedURL(url: string, oystehrToken: string): Promise<string | undefined> {
  console.log('getting presigned url');

  if (!url) {
    return;
  }

  const presignedURLResponse = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${oystehrToken}`,
    },
    body: JSON.stringify({ action: 'download' }),
  });

  if (!presignedURLResponse.ok) {
    console.error(`failed to fetch presigned url for ${url}`);
    return;
  }

  const { signedUrl: presignedUrl } = await presignedURLResponse.json();
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
