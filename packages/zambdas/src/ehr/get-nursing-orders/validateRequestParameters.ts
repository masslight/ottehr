import { z } from 'zod';
import { GetNursingOrdersInputValidated, NursingOrdersSearchBySchema } from 'utils';
import { ZambdaInput } from '../../shared';

const RequestBodySchema = z.object({
  encounterId: z.string().uuid(),
  searchBy: NursingOrdersSearchBySchema.optional(),
});

export function validateRequestParameters(input: ZambdaInput): GetNursingOrdersInputValidated {
  console.group('validateRequestParameters');

  if (!input.body) {
    throw new Error('No request body provided');
  }

  const parsedJSON = JSON.parse(input.body) as unknown;

  const { encounterId, searchBy } = RequestBodySchema.parse(parsedJSON);

  console.groupEnd();
  console.debug('validateRequestParameters success');
  return {
    searchBy,
    encounterId,
    secrets: input.secrets,
  };
}
