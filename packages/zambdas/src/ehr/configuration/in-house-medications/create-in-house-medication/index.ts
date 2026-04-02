import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT,
  CODE_SYSTEM_HCPCS,
  CODE_SYSTEM_NDC,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'admin-create-in-house-medication',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { name, ndc, medispanID, cptCodes, hcpcsCodes, secrets } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);

    const oystehr = createOystehrClient(m2mToken, secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, name, ndc, medispanID, cptCodes, hcpcsCodes);
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
  cptCodes?: { code: string; display: string }[],
  hcpcsCodes?: { code: string; display: string }[]
): Promise<Medication> => {
  const coding = [];
  if (ndc) {
    coding.push({ system: CODE_SYSTEM_NDC, code: ndc });
  }
  coding.push({
    system: MEDICATION_DISPENSABLE_DRUG_ID,
    code: medispanID,
  });
  for (const { code, display } of cptCodes ?? []) {
    coding.push({ system: CODE_SYSTEM_CPT, code, display });
  }
  for (const { code, display } of hcpcsCodes ?? []) {
    coding.push({ system: CODE_SYSTEM_HCPCS, code, display });
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
