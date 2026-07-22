import Oystehr from '@oystehr/sdk';
import { DocumentReference } from 'fhir/r4b';
import { RADIOLOGY_RESULT_DOC_REF_DOCTYPE } from 'utils';

// The single definition of "this radiology order has an uploaded result": a current DocumentReference
// with the radiology-result type coding, related to the ServiceRequest. The edit lock (update-order),
// results listing (list-results), and external status derivation (order-list) must all agree on it.

export const isCurrentRadiologyResultDocRef = (docRef: DocumentReference, serviceRequestId: string): boolean =>
  docRef.status === 'current' &&
  !!docRef.type?.coding?.some(
    (coding) =>
      coding.system === RADIOLOGY_RESULT_DOC_REF_DOCTYPE.system && coding.code === RADIOLOGY_RESULT_DOC_REF_DOCTYPE.code
  ) &&
  !!docRef.context?.related?.some((related) => related.reference === `ServiceRequest/${serviceRequestId}`);

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
