import { APIGatewayProxyResult } from 'aws-lambda';
import { ActivityDefinition, ServiceRequest } from 'fhir/r4b';
import {
  APIError,
  CreateInHouseLabEnconuterResource,
  CreateInHouseLabOrderParameters,
  IN_HOUSE_LAB_ERROR,
  IN_HOUSE_LAB_LATEST_TAG_DEFINITION,
  IN_HOUSE_TEST_CODE_SYSTEM,
  isApiError,
  REFLEX_ARTIFACT_DISPLAY,
  repeatTestErrorMessage,
  Secrets,
  SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES,
  SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  parseCreatedResourcesBundle,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import {
  makeRequestsForCreateInHouseLabs,
  TestItemRequestData,
  TestItemResources,
} from '../../../../shared/in-house-lab/build-order';
import { gatherInHouseLabOrderContext } from '../../../../shared/in-house-lab/gather-context';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-in-house-lab-order';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`create-in-house-lab-order started, input: ${JSON.stringify(input)}`);
    let secrets = input.secrets;
    let validatedParameters: CreateInHouseLabOrderParameters & { secrets: Secrets | null; userToken: string };

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

    secrets = validatedParameters.secrets;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const { encounterId, testItems, diagnosesAll, diagnosesNew, notes } = validatedParameters;
    console.log('This is testItems in create-in-house-lab-order', JSON.stringify(testItems, undefined, 2));

    const testItemRequests = (): Promise<TestItemRequestData[]> => {
      return Promise.all(
        testItems.map(async (item) => {
          const activityDefs = await oystehr.fhir
            .search({
              resourceType: 'ActivityDefinition',
              params: [
                { name: 'url', value: item.adUrl },
                { name: 'status', value: 'active' },
                {
                  name: '_tag',
                  value: `${IN_HOUSE_LAB_LATEST_TAG_DEFINITION.system}|${IN_HOUSE_LAB_LATEST_TAG_DEFINITION.code}`, // we care less about the version and more that it is latest
                },
              ],
            })
            .then((result) => result.unbundle() as ActivityDefinition[]);

          if (activityDefs.length !== 1) {
            throw Error(
              `ActivityDefinition not found, results contain ${
                activityDefs.length
              } activity definitions, ids: ${activityDefs
                .map((resource) => `ActivityDefinition/${resource.id}`)
                .join(', ')}`
            );
          }

          const activityDefinition = activityDefs[0];

          let parentTestCanonicalUrl: string | undefined;
          activityDefinition.relatedArtifact?.forEach((artifact) => {
            const isDependent = artifact.type === 'depends-on';
            const isRelatedViaReflex = artifact.display === REFLEX_ARTIFACT_DISPLAY;

            if (isDependent && isRelatedViaReflex) {
              // todo labs this will take the last one it finds, so if we ever have a test be triggered by multiple parents, we'll need to update this
              parentTestCanonicalUrl = artifact.resource;
            }
          });

          let serviceRequests: ServiceRequest[] | undefined;

          if (item.orderMode === 'repeat') {
            console.log('run as repeat for', item.name);
            // tests being run as repeat need to be linked via basedOn to the original test that was run
            // so we are looking for a test with the same instantiatesCanonical that does not have any value in basedOn - this will be the initialServiceRequest
            serviceRequests = await oystehr.fhir
              .search({
                resourceType: 'ServiceRequest',
                params: [
                  { name: 'encounter', value: `Encounter/${encounterId}` },
                  { name: 'instantiates-canonical', value: `${item.adUrl}|${item.adVersion}` },
                  { name: 'status:not', value: 'revoked' },
                ],
              })
              .then((result) => result.unbundle() as ServiceRequest[]);
          } else if (parentTestCanonicalUrl) {
            console.log('searching for parent test', parentTestCanonicalUrl);
            // we should be able to search service request by this but looks like a fhir bug so will need to do some more round about searching here
            serviceRequests = (
              await oystehr.fhir.search<ServiceRequest>({
                resourceType: 'ServiceRequest',
                params: [
                  {
                    name: 'encounter',
                    value: `Encounter/${encounterId}`,
                  },
                  {
                    name: 'code',
                    value: `${IN_HOUSE_TEST_CODE_SYSTEM}|`,
                  },
                  {
                    name: '_sort',
                    value: '-_lastUpdated',
                  },
                  { name: 'status:not', value: 'revoked' },
                ],
              })
            ).unbundle();
          }

          return {
            activityDefinition,
            serviceRequests,
            orderMode: item.orderMode,
            parentTestCanonicalUrl,
          };
        })
      );
    };

    const encounterResourcesPromise = async (): Promise<CreateInHouseLabEnconuterResource[]> => {
      return (
        await oystehr.fhir.search<CreateInHouseLabEnconuterResource>({
          resourceType: 'Encounter',
          params: [
            { name: '_id', value: encounterId },
            { name: '_include', value: 'Encounter:patient' },
            { name: '_include', value: 'Encounter:location' },
            { name: '_revinclude:iterate', value: 'Coverage:patient' },
            { name: '_revinclude:iterate', value: 'Account:patient' },
          ],
        })
      ).unbundle();
    };

    const [encounterResources, testItemResources] = await Promise.all([
      encounterResourcesPromise(),
      testItemRequests(),
    ]);
    const context = await gatherInHouseLabOrderContext({
      oystehr,
      encounterId,
      encounterResources,
      userToken: validatedParameters.userToken,
      secrets: validatedParameters.secrets,
    });

    const testResources: TestItemResources[] = testItemResources.map((data) => {
      const { activityDefinition, serviceRequests, orderMode, parentTestCanonicalUrl } = data;

      if (activityDefinition.status !== 'active' || !activityDefinition.id || !activityDefinition.url) {
        throw Error(
          `ActivityDefinition is not active or has no id or is missing a canonical url, status: ${activityDefinition.status}, id: ${activityDefinition.id}, url: ${activityDefinition.url}`
        );
      }

      let initialServiceRequest: ServiceRequest | undefined;

      if (orderMode === 'repeat') {
        if (!serviceRequests || serviceRequests.length === 0) {
          // edge case: if a repeat test is ordered, then the version is updated, and the user clicks the "repeat" button from the order details screen
          // We still try to match SRs to the ad url and version, and so a match cannot be found. Alternative is to find too many matches
          throw IN_HOUSE_LAB_ERROR(repeatTestErrorMessage(activityDefinition.name || ''));
        }
        const possibleInitialSRs = serviceRequests.reduce((acc: ServiceRequest[], sr) => {
          if (!sr.basedOn) acc.push(sr);
          return acc;
        }, []);
        if (possibleInitialSRs.length > 1) {
          console.log(
            `More than one initial tests found for ${activityDefinition.name} for this Encounter/${encounterId}`
          );
          // this really shouldn't happen, something is misconfigured
          throw IN_HOUSE_LAB_ERROR(
            `Could not deduce which test is initial for ${activityDefinition.name} since more than one test has previously been run today`
          );
        }
        if (possibleInitialSRs.length === 0) {
          // this really shouldn't happen, something is misconfigured
          throw IN_HOUSE_LAB_ERROR(
            `No initial tests could be found for ${activityDefinition.name} for this encounter.`
          );
        }
        initialServiceRequest = possibleInitialSRs[0];
      } else if (parentTestCanonicalUrl && serviceRequests) {
        const parentRequest = serviceRequests.find((sr) => {
          const isParentTest = sr.instantiatesCanonical?.some((url) => url === parentTestCanonicalUrl);
          const hasPendingTestTag = sr.meta?.tag?.find(
            (t) =>
              t.system === SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM &&
              t.code === SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES.pending
          );
          return isParentTest && hasPendingTestTag;
        });
        console.log('parentRequest', parentRequest?.id);
        initialServiceRequest = parentRequest;
      }

      const testItemResources: TestItemResources = {
        activityDefinition,
        initialServiceRequest,
        orderMode,
      };

      return testItemResources;
    });

    const resourcePostRequests = makeRequestsForCreateInHouseLabs({
      diagnosesAll,
      notes,
      testResources,
      ...context,
    });

    const transactionResponse = await oystehr.fhir.transaction({ requests: resourcePostRequests });

    const serviceRequestIds: string[] = [];

    const resources = parseCreatedResourcesBundle(transactionResponse);
    resources.forEach((r) => {
      if (r.resourceType === 'ServiceRequest' && r.id) serviceRequestIds.push(r.id);
    });

    if (!transactionResponse.entry?.every((entry) => entry.response?.status[0] === '2')) {
      throw Error('Error creating in-house lab order in transaction');
    }

    // save chart data requires user token
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    const saveChartDataResponse = diagnosesNew.length
      ? await oystehrCurrentUser.zambda.execute({
          id: 'save-chart-data',
          encounterId,
          diagnosis: diagnosesNew,
        })
      : {};

    const response = {
      saveChartDataResponse,
      serviceRequestIds,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error creating in-house lab order:', JSON.stringify(error), error);
    let body = JSON.stringify({ message: `Error creating in-house lab order: ${error.message || error}` });
    let statusCode = 500;

    if (isApiError(error)) {
      const { code, message } = error as APIError;
      body = JSON.stringify({ message, code });
      statusCode = 400;
      return {
        statusCode,
        body,
      };
    }
    throw error;
  }
});
