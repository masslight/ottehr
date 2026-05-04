import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { AdminAddLabSetOutput, getSecret, LAB_LIST_CODE_CODING, LabSetNoIdDTO, LabType, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { formatListEntry } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-add-lab-set';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  try {
    const validatedParameters = validateRequestParameters(input);

    const { labSet, secrets } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const response = await createLabSet(labSet, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error(`Error in ${ZAMBDA_NAME}`, error);

    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

async function createLabSet(labSet: LabSetNoIdDTO, oystehr: Oystehr): Promise<AdminAddLabSetOutput> {
  console.log('configuring the list resource for the new lab set');

  const entry = formatListEntry(labSet);

  const labSetList: List = {
    resourceType: 'List',
    status: 'current',
    mode: 'working',
    title: labSet.listName,
    code: {
      coding: [labSet.listType === LabType.inHouse ? LAB_LIST_CODE_CODING.inHouse : LAB_LIST_CODE_CODING.external],
    },
    entry,
  };

  console.log('sending request to fhir to create the list');

  const fhirList = await oystehr.fhir.create<List>(labSetList);

  const res: AdminAddLabSetOutput = {
    labSetId: fhirList.id,
  };

  console.log('success', JSON.stringify(res));

  return res;
}
