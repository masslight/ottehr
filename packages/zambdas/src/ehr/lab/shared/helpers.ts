import { BatchInputPatchRequest } from '@oystehr/sdk';
import {
  Communication,
  DiagnosticReport,
  DocumentReference,
  QuestionnaireResponse,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';

type SoftDeleteLabResourceTypes =
  | 'ServiceRequest'
  | 'QuestionnaireResponse'
  | 'Task'
  | 'Communication'
  | 'DocumentReference'
  | 'DiagnosticReport'
  | 'Specimen';

export const makeSoftDeleteStatusPatchRequest = (
  resourceType: SoftDeleteLabResourceTypes,
  id: string
): BatchInputPatchRequest<
  ServiceRequest | QuestionnaireResponse | Task | Communication | DocumentReference | DiagnosticReport | Specimen
> => {
  const getStatus = (resourceType: SoftDeleteLabResourceTypes): string => {
    switch (resourceType) {
      case 'Communication':
      case 'DiagnosticReport':
      case 'DocumentReference':
      case 'QuestionnaireResponse':
      case 'Specimen':
        return 'entered-in-error';
      case 'ServiceRequest':
        return 'revoked';
      case 'Task':
        return 'cancelled';
      default:
        throw new Error(`cannot determine soft delete status for unrecognized resourceType: ${resourceType}`);
    }
  };

  return {
    method: 'PATCH',
    url: `${resourceType}/${id}`,
    operations: [
      {
        op: 'replace',
        path: '/status',
        value: getStatus(resourceType),
      },
    ],
  };
};
