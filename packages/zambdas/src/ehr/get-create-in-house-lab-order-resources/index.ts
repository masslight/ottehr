import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Secrets,
  GetCreateInHouseLabOrderResourcesParameters,
  GetCreateInHouseLabOrderResourcesResponse,
  IN_HOUSE_TAG_DEFINITION,
  TestItemsType,
  convertActivityDefinitionToTestItem,
  PRACTITIONER_CODINGS,
  getFullestAvailableName,
} from 'utils';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { ActivityDefinition, Encounter, Practitioner } from 'fhir/r4b';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`get-create-in-house-lab-order-resources started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: GetCreateInHouseLabOrderResourcesParameters & { secrets: Secrets | null; userToken: string };

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    secrets = validatedParameters.secrets;

    console.log('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const attendingPractitionerName: string = await (async () => {
      const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

      const [myPractitionerId, encounter] = await Promise.all([
        getMyPractitionerId(oystehrCurrentUser),
        oystehr.fhir.get<Encounter>({
          resourceType: 'Encounter',
          id: validatedParameters.encounterId,
        }),
      ]);

      const practitionerId = encounter.participant
        ?.find(
          (participant) =>
            participant.type?.find(
              (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
            )
        )
        ?.individual?.reference?.replace('Practitioner/', '');

      if (!practitionerId) {
        return '';
      }

      if (practitionerId === myPractitionerId) {
        return ''; // show name only if it's not the current user
      }

      const attendingPractitioner = await oystehr.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: practitionerId,
      });

      const name = getFullestAvailableName(attendingPractitioner);

      return name || '';
    })();

    const activityDefinitions = (
      await oystehr.fhir.search<ActivityDefinition>({
        resourceType: 'ActivityDefinition',
        params: [
          { name: '_tag', value: IN_HOUSE_TAG_DEFINITION.code },
          { name: 'status', value: 'active' },
        ],
      })
    ).unbundle();

    console.log(`Found ${activityDefinitions.length} ActivityDefinition resources`);

    const testItems: TestItemsType = {} as TestItemsType;

    for (const activeDefenition of activityDefinitions) {
      const testItem = convertActivityDefinitionToTestItem(activeDefenition);
      const key = testItem.name.replace(/\s+/g, '_') as keyof TestItemsType;
      testItems[key] = testItem;
    }

    const response: GetCreateInHouseLabOrderResourcesResponse = {
      labs: testItems,
      providerName: attendingPractitionerName,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error processing in-house lab order resources:', error);
    await topLevelCatch('get-create-in-house-lab-order-resources', error, secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
};
