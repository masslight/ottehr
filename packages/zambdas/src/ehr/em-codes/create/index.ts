import { APIGatewayProxyResult } from 'aws-lambda';
import { CPT_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { patchWithOptimisticLock } from 'utils/lib/fhir/helpers';
import { getEmCodes, getEmCodesFhirResources } from 'utils/lib/helpers/em-codes';
import { EmCodeOutput } from 'utils/lib/types/api/config/em-codes';
import { ALREADY_EXISTS_WITH_MESSAGE } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('create-em-code', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets } = input;
  const { code, display } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const { valueSet } = await getEmCodesFhirResources(oystehr);

  await patchWithOptimisticLock(oystehr, valueSet, (freshValueSet) => {
    const contains = freshValueSet.expansion?.contains ?? [];
    if (contains.some((entry) => entry.code === code)) {
      throw ALREADY_EXISTS_WITH_MESSAGE(`E&M code '${code}' already exists`);
    }

    const newEntry = { system: CPT_CODE_SYSTEM, code, display };

    if (!freshValueSet.expansion?.contains) {
      return [{ op: 'add', path: '/expansion/contains', value: [newEntry] }];
    }

    return [{ op: 'add', path: '/expansion/contains/-', value: newEntry }];
  });

  const updatedCodes = await getEmCodes(oystehr);
  const response: EmCodeOutput = {
    codes: updatedCodes,
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});
