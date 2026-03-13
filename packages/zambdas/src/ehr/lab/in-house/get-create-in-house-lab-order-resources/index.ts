import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition, Encounter, List, Practitioner } from 'fhir/r4b';
import {
  convertActivityDefinitionToTestItem,
  getAttendingPractitionerId,
  GetCreateInHouseLabOrderResourcesInput,
  GetCreateInHouseLabOrderResourcesOutput,
  getFullestAvailableName,
  getSecret,
  LAB_LIST_CODE_CODING,
  LabListsDTO,
  Secrets,
  SecretsKeys,
  TestItem,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  sendErrors,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { formatLabListDTOs } from '../../shared/helpers';
import { fetchActiveInHouseLabActivityDefinitions } from '../../shared/in-house-labs';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-create-in-house-lab-order-resources';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let secrets = input.secrets;
  let validatedParameters: GetCreateInHouseLabOrderResourcesInput & { secrets: Secrets | null; userToken: string };

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

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const testItems: TestItem[] = [];
    let providerName: string | undefined;
    let labSets: LabListsDTO[] | undefined;

    if (validatedParameters.encounterId) {
      const [attendingPractitionerName, activeActivityDefinitions, labLists] = await Promise.all([
        (async () => {
          if (!validatedParameters.encounterId) return '';

          const encounter = await oystehr.fhir.get<Encounter>({
            resourceType: 'Encounter',
            id: validatedParameters.encounterId,
          });

          if (!encounter) return '';

          const practitionerId = getAttendingPractitionerId(encounter);

          if (!practitionerId) return '';

          const practitioner = await oystehr.fhir.get<Practitioner>({
            resourceType: 'Practitioner',
            id: practitionerId,
          });

          return getFullestAvailableName(practitioner) || '';
        })(),
        fetchActiveInHouseLabActivityDefinitions(oystehr),
        (async () => {
          return (
            await oystehr.fhir.search<List>({
              resourceType: 'List',
              params: [
                { name: 'code', value: `${LAB_LIST_CODE_CODING.inHouse.system}|${LAB_LIST_CODE_CODING.inHouse.code}` },
              ],
            })
          ).unbundle();
        })(),
      ]);

      console.log(`Found ${activeActivityDefinitions.length} active ActivityDefinition resources`);

      for (const activeDefinition of activeActivityDefinitions) {
        const testItem = convertActivityDefinitionToTestItem(activeDefinition);
        testItems.push(testItem);
      }

      labSets = formatLabListDTOs(labLists);

      providerName = attendingPractitionerName;
    } else if (validatedParameters.selectedLabSet) {
      const { selectedLabSet } = validatedParameters;
      const activityDefinitionIds = selectedLabSet.labs.map((lab) => lab.activityDefinitionId);
      const labSetActivityDefinitions = (
        await oystehr.fhir.search<ActivityDefinition>({
          resourceType: 'ActivityDefinition',
          params: [
            {
              name: '_id',
              value: activityDefinitionIds.join(','),
            },
          ],
        })
      ).unbundle();

      console.log(
        `Found ${labSetActivityDefinitions.length} active ActivityDefinition resources for the labSet List/${selectedLabSet.listId}`
      );

      for (const activityDefinition of labSetActivityDefinitions) {
        const testItem = convertActivityDefinitionToTestItem(activityDefinition);
        testItems.push(testItem);

        // notify the dev team that something is misconfigured
        if (activityDefinition.status !== 'active') {
          const errorMessage = `There is an INACTIVE Activity Definition (ActivityDefinition/${activityDefinition.id}) linked to the current working Lab Set List/${selectedLabSet.listId}`;
          const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
          console.log(errorMessage);
          await sendErrors(errorMessage, ENVIRONMENT);
        }
      }
    } else {
      // patient record case, no params are passed - just need to fetch available tests for filter
      const activeActivityDefinitions = await fetchActiveInHouseLabActivityDefinitions(oystehr);

      for (const activeDefinition of activeActivityDefinitions) {
        const testItem = convertActivityDefinitionToTestItem(activeDefinition);
        testItems.push(testItem);
      }
    }

    const response: GetCreateInHouseLabOrderResourcesOutput = {
      labs: testItems.sort((a, b) => a.name.localeCompare(b.name)),
      providerName,
      labSets,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error processing in-house lab order resources:', error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-create-in-house-lab-order-resources', error, ENVIRONMENT);
  }
});
