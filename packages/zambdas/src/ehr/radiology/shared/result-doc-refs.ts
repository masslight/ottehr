import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils/lib/fhir/radiology';

export const searchRadiologyResultDocRefs = async (
  serviceRequestId: string,
  oystehr: Oystehr
): Promise<DocumentReference[]> =>
  (
    await oystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'related', value: `ServiceRequest/${serviceRequestId}` },
        {
          name: 'type',
          value: `${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.system}|${RADIOLOGY_RESULT_DOC_REF_DOCTYPE.code}`,
        },
        { name: 'status', value: 'current' },
      ],
    })
  ).unbundle();
