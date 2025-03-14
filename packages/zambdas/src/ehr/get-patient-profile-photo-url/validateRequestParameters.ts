import { UpdatePatientPhotoInput } from '.';
import { ZambdaInput } from 'zambda-utils';

export function validateRequestParameters(input: ZambdaInput): UpdatePatientPhotoInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { patientId, action, z3PhotoUrl } = JSON.parse(input.body);

  if (!action) {
    throw new Error('There is missing required field: "action"');
  }

  const act = (action as string) ?? '';
  if (!['upload', 'download'].includes(act.toLowerCase())) {
    throw new Error('The field: "action" should has one of the values: "upload" OR "download"');
  }

  const resolvedAction = act.toLowerCase() === 'upload' ? 'upload' : 'download';

  if (resolvedAction === 'download') {
    if (!z3PhotoUrl) {
      throw new Error('"z3PhotoUrl" filed is required for the "download" action');
    }
  }

  if (resolvedAction === 'upload') {
    if (!patientId) {
      throw new Error('"patientId" filed is required for the "upload" action');
    }
  }

  return {
    secrets: input.secrets,
    patientID: patientId,
    action: resolvedAction,
    z3PhotoUrl: z3PhotoUrl,
  };
}
