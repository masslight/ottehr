import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Coding, Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_NDC,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-create-in-house-medication',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { name, ndc, medispanID, medispanIDForInteractions, secrets } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, name, ndc, medispanID, medispanIDForInteractions);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  }
);

export const performEffect = async (
  oystehr: Oystehr,
  name: string,
  ndc: string | undefined,
  medispanID: string,
  medispanIDForInteractions?: string
): Promise<Medication> => {
  const coding: Coding[] = [];
  if (ndc) {
    coding.push({ system: CODE_SYSTEM_NDC, code: ndc });
  }
  coding.push({
    system: MEDICATION_DISPENSABLE_DRUG_ID,
    code: medispanID,
  });
  if (medispanIDForInteractions) {
    coding.push({
      system: MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS,
      code: medispanIDForInteractions,
    });
  }
  const medication = await oystehr.fhir.create<Medication>({
    resourceType: 'Medication',
    identifier: [
      {
        system: MEDICATION_TYPE_SYSTEM,
        value: INVENTORY_MEDICATION_TYPE_CODE,
      },
      {
        system: MEDICATION_IDENTIFIER_NAME_SYSTEM,
        value: name,
      },
    ],
    status: 'active',
    code: { coding: coding },
  });
  return medication;
};
