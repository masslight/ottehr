import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { getSecret, INVENTORY_MEDICATION_TYPE_CODE, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-get-in-house-medications',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { secrets } = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('Created Oystehr client');

      const response = await performEffect(oystehr);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-get-in-house-medications', error, ENVIRONMENT);
    }
  }
);

export const performEffect = async (oystehr: Oystehr): Promise<Medication[]> => {
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        {
          name: 'identifier',
          value: INVENTORY_MEDICATION_TYPE_CODE,
        },
      ],
    })
  ).unbundle();
  return medications;
};
