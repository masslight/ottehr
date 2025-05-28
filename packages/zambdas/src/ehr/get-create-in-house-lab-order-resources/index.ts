import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Secrets,
  GetCreateInHouseLabOrderResourcesParameters,
  GetCreateInHouseLabOrderResourcesResponse,
  IN_HOUSE_TAG_DEFINITION,
  convertActivityDefinitionToTestItem,
  PRACTITIONER_CODINGS,
  getFullestAvailableName,
  TestItem,
  getTimezone,
} from 'utils';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { ActivityDefinition, Encounter, Practitioner, Location } from 'fhir/r4b';
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

    const {
      attendingPractitionerName,
      // not sure if we need these
      // currentPractitionerName,
      // attendingPractitionerId,
      // currentPractitionerId,
      // timezone,
    } = await (async () => {
      const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

      const [myPractitionerId, { encounter, timezone }] = await Promise.all([
        getMyPractitionerId(oystehrCurrentUser),
        validatedParameters.encounterId
          ? oystehr.fhir
              .search<Encounter | Location>({
                resourceType: 'Encounter',
                params: [
                  { name: '_id', value: validatedParameters.encounterId },
                  { name: '_include', value: 'Encounter:location' },
                ],
              })
              .then((bundle) => {
                const resources = bundle.unbundle();
                const encounter = resources.find((r): r is Encounter => r.resourceType === 'Encounter');
                const location = resources.find((r): r is Location => r.resourceType === 'Location');
                const timezone = location && getTimezone(location);
                return { encounter, timezone };
              })
          : Promise.resolve({ encounter: null, timezone: undefined }),
      ]);

      if (!encounter) {
        // todo: we dont have encounter in patient page, this zambda should return the test items only,
        // the rest of data should be fetched from the get-orders zambda
        return {
          attendingPractitionerName: '',
          currentPractitionerName: '',
          attendingPractitionerId: '',
          currentPractitionerId: '',
          timezone: undefined,
        };
      }

      const practitionerId = encounter.participant
        ?.find(
          (participant) =>
            participant.type?.find(
              (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
            )
        )
        ?.individual?.reference?.replace('Practitioner/', '');

      const attendingPractitionerPromise = practitionerId
        ? oystehr.fhir.get<Practitioner>({
            resourceType: 'Practitioner',
            id: practitionerId,
          })
        : Promise.resolve(null);

      const currentPractitionerPromise = myPractitionerId
        ? oystehr.fhir.get<Practitioner>({
            resourceType: 'Practitioner',
            id: myPractitionerId,
          })
        : Promise.resolve(null);

      const [attendingPractitioner, currentPractitioner] = await Promise.all([
        attendingPractitionerPromise,
        currentPractitionerPromise,
      ]);

      const attendingPractitionerName = attendingPractitioner
        ? getFullestAvailableName(attendingPractitioner) || ''
        : '';

      const currentPractitionerName = currentPractitioner ? getFullestAvailableName(currentPractitioner) || '' : '';

      const attendingPractitionerId = attendingPractitioner?.id || '';
      const currentPractitionerId = currentPractitioner?.id || '';

      return {
        attendingPractitionerName,
        currentPractitionerName,
        attendingPractitionerId,
        currentPractitionerId,
        timezone,
      };
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

    const testItems: TestItem[] = [];

    for (const activeDefinition of activityDefinitions) {
      const testItem = convertActivityDefinitionToTestItem(activeDefinition);
      testItems.push(testItem);
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
