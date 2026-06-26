import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import { LabSetDTO } from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../../../shared';
import { formatListEntry } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'admin-update-lab-set';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`${ZAMBDA_NAME} started, input: ${JSON.stringify(input)}`);
  const validatedParameters = validateRequestParameters(input);

  const { updateType, data, secrets } = validatedParameters;

  console.log('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  if (updateType === 'edit') {
    await updateLabSetData(data, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  } else if (updateType === 'toggle-status') {
    await toggleLabSetStatus(data.labSetId, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify({}),
    };
  } else {
    throw new Error(`Error parsing updateType: ${updateType}. Expected 'edit' or 'toggle-status'.`);
  }
});

async function updateLabSetData(labSet: LabSetDTO, oystehr: Oystehr): Promise<void> {
  console.log('updating the list resource for an existing lab set');

  const entry = formatListEntry(labSet);

  console.log(`getting the existing list resource with id ${labSet.listId}`);
  const existingList = await oystehr.fhir.get<List>({ resourceType: 'List', id: labSet.listId });

  console.log(`obtained the existing list resource`);

  const labSetList: List = {
    ...existingList,
    title: labSet.listName,
    entry,
  };

  console.log('sending request to fhir to update the list');

  const fhirList = await oystehr.fhir.update<List>(labSetList);

  console.log('success', JSON.stringify(fhirList));
}

async function toggleLabSetStatus(labSetId: string, oystehr: Oystehr): Promise<void> {
  console.log(`getting the existing list resource with id ${labSetId}`);
  const existingList = await oystehr.fhir.get<List>({ resourceType: 'List', id: labSetId });

  if (existingList.status === 'current') {
    console.log('setting status to retired');
    await oystehr.fhir.update<List>({ ...existingList, status: 'retired' });
  } else {
    console.log('setting status to current');
    await oystehr.fhir.update<List>({ ...existingList, status: 'current' });
  }

  console.log('success');
}
