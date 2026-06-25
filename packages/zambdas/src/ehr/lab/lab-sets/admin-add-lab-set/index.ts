import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { AdminAddLabSetOutput, LabSetDTO } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { configFhirListForLabSet } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-add-lab-set';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  const validatedParameters = validateRequestParameters(input);

  const { labSet, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const response = await createLabSet(labSet, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

async function createLabSet(labSet: LabSetDTO, oystehr: Oystehr): Promise<AdminAddLabSetOutput> {
  console.log('configuring the list resource for the new lab set');

  const labSetList = configFhirListForLabSet(labSet);

  console.log('sending request to fhir to create the list');

  const fhirList = await oystehr.fhir.create<List>(labSetList);

  const res: AdminAddLabSetOutput = {
    labSetId: fhirList.id,
  };

  console.log('success', JSON.stringify(res));

  return res;
}
