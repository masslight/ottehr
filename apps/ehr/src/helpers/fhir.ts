import { BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { FhirResource, Patient } from 'fhir/r4b';
import { PATIENT_INDIVIDUAL_PRONOUNS_URL } from 'utils';

export interface GetPatchBinaryInput {
  resourceId: string;
  resourceType: string;
  patchOperations: Operation[];
}

export function getPatchBinary<F extends FhirResource>(input: GetPatchBinaryInput): BatchInputRequest<F> {
  const { resourceId, resourceType, patchOperations } = input;
  return {
    method: 'PATCH',
    url: `/${resourceType}/${resourceId}`,
    resource: {
      resourceType: 'Binary',
      data: btoa(unescape(encodeURIComponent(JSON.stringify(patchOperations)))),
      contentType: 'application/json-patch+json',
    },
  };
}

// helper function to get pronouns display value from extension
export const getPronounsFromExtension = (patient: Patient): string => {
  const pronounsExtension = patient.extension?.find(
    (ext: { url: string }) => ext.url === PATIENT_INDIVIDUAL_PRONOUNS_URL
  );
  if (!pronounsExtension?.valueCodeableConcept?.coding?.[0]) return '';
  return pronounsExtension.valueCodeableConcept.coding[0].display || '';
};
