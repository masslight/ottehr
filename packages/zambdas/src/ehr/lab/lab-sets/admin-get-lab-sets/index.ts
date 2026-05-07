import Oystehr, { SearchParam } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { AdminGetLabSetDetailOutput, AdminGetLabSetListOutput, LAB_LIST_CODE_CODING } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { formatLabListDTOs } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-get-lab-sets';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  const validatedParameters = validateRequestParameters(input);

  const { type, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createOystehrClient(m2mToken, secrets);

  if (type === 'detail') {
    const labSetId = validatedParameters.labSetId;
    const response = await getLabSets(oystehr, labSetId);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } else if (type === 'list') {
    const response = await getLabSets(oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } else {
    throw new Error(`Error parsing validated parameters type: ${type}`);
  }
});

function getLabSets(oystehr: Oystehr): Promise<AdminGetLabSetListOutput>;

function getLabSets(oystehr: Oystehr, labSetId: string): Promise<AdminGetLabSetDetailOutput>;

async function getLabSets(
  oystehr: Oystehr,
  labSetId?: string
): Promise<AdminGetLabSetListOutput | AdminGetLabSetDetailOutput> {
  const searchParams: SearchParam[] = labSetId ? [{ name: '_id', value: labSetId }] : [];

  const lists = (
    await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'code', value: `${LAB_LIST_CODE_CODING.inHouse.system}|` }, ...searchParams],
    })
  ).unbundle();

  const labSetDTO = formatLabListDTOs(lists);

  if (labSetId) {
    if (labSetDTO?.length !== 1) {
      throw new Error(
        `There was an issue getting the lab set with id ${labSetId} - ${labSetDTO?.length} lab set(s) were returned`
      );
    }

    const res: AdminGetLabSetDetailOutput = {
      labSetDTO: labSetDTO[0],
    };

    return res;
  } else {
    if (lists.length === 0) {
      console.log('No lab sets exist for this project');
      return {
        labSetDTO: [],
      };
    } else if (labSetDTO === undefined) {
      throw new Error(
        `Lab set lists were found but no labSetDTO was returned, something is up. Resources returned: ${lists.map(
          (list) => `List/${list.id}`
        )}`
      );
    }

    const res: AdminGetLabSetListOutput = {
      labSetDTO,
    };

    return res;
  }
}
