import { DocumentReference } from 'fhir/r4b';
import { LabOrderResultPDFConfig, getPresignedURL } from 'utils';

export const getLabOrderResultPDFConfig = async (
  docRef: DocumentReference,
  formattedName: string,
  m2mtoken: string,
  orderNumber?: string
): Promise<LabOrderResultPDFConfig[]> => {
  const results: LabOrderResultPDFConfig[] = [];
  for (const content of docRef.content) {
    const z3Url = content.attachment.url;
    if (z3Url) {
      const url = await getPresignedURL(z3Url, m2mtoken);
      const labResult: LabOrderResultPDFConfig = {
        name: formattedName,
        url,
        orderNumber,
      };
      results.push(labResult);
    }
  }

  return results;
};
