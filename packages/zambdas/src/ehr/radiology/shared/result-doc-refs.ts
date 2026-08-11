import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils/lib/fhir/radiology';

// Predicate now lives in shared/radiology (so src/shared can reuse it without depending on src/ehr);
// re-exported here to keep existing import paths stable.
export { isCurrentRadiologyResultDocRef } from '../../../shared/radiology';

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
