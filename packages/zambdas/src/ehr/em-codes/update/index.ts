import { APIGatewayProxyResult } from 'aws-lambda';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getEmCodes, getEmCodesFhirResources } from 'utils/lib/helpers/em-codes';
import { EmCodeOutput } from 'utils/lib/types/api/config/em-codes';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('update-em-code', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const { code, display } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { valueSet } = await getEmCodesFhirResources(oystehr);

  await patchWithOptimisticLock(oystehr, valueSet, (freshValueSet) => {
    const contains = freshValueSet.expansion?.contains ?? [];
    const index = contains.findIndex((entry) => entry.code === code);
    if (index === -1) {
      throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`E&M code '${code}' not found`);
    }

    return [
      {
        op: 'replace',
        path: `/expansion/contains/${index}/display`,
        value: display,
      },
    ];
  });

  const updatedCodes = await getEmCodes(oystehr);
  const response: EmCodeOutput = {
    codes: updatedCodes,
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
