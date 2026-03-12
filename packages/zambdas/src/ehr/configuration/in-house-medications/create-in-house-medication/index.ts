import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import { CODE_SYSTEM_NDC, getSecret, MEDICATION_DISPENSABLE_DRUG_ID, SecretsKeys } from 'utils';
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
  'admin-create-in-house-medication',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      const { name, ndc, medispanID, secrets } = validateRequestParameters(input);
      m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

      const oystehr = createOystehrClient(m2mToken, secrets);
      console.log('Created Oystehr client');

      const response = await performEffect(oystehr, name, ndc, medispanID);
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: any) {
      const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
      return topLevelCatch('admin-create-in-house-medication', error, ENVIRONMENT);
    }
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  name: string,
  ndc: string,
  medispanID: string
): Promise<Medication> => {
  const coding = [];
  coding.push({
    system: CODE_SYSTEM_NDC,
    code: ndc,
  });
  coding.push({
    system: MEDICATION_DISPENSABLE_DRUG_ID,
    code: medispanID,
  });
  const medication = await oystehr.fhir.create<Medication>({
    resourceType: 'Medication',
    identifier: [
      {
        system: 'virtual-medication-type',
        value: 'virtual-medication-inventory',
      },
      {
        system: 'virtual-medication-identifier-name-system',
        value: name,
      },
    ],
    status: 'active',
    code: { coding: coding },
  });
  return medication;
};
