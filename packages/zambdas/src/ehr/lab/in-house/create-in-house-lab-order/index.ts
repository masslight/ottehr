import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Account,
  ActivityDefinition,
  Coverage,
  Encounter,
  Location,
  Patient,
  Practitioner,
  ServiceRequest,
} from 'fhir/r4b';
import {
  APIError,
  CreateInHouseLabOrderParameters,
  getAttendingPractitionerId,
  getFullestAvailableName,
  getSecret,
  IN_HOUSE_LAB_ERROR,
  IN_HOUSE_TEST_CODE_SYSTEM,
  isApiError,
  REFLEX_ARTIFACT_DISPLAY,
  Secrets,
  SecretsKeys,
  SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_CODES,
  SERVICE_REQUEST_REFLEX_TRIGGERED_TAG_SYSTEM,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  parseCreatedResourcesBundle,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../../shared';
import { accountIsPatientBill, getPrimaryInsurance } from '../../shared/labs';
import {
  CreateInHouseLabResources,
  makeRequestsForCreateInHouseLabs,
  TestItemRequestData,
  TestItemResources,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'create-in-house-lab-order';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

  try {
    secrets = validatedParameters.secrets;

    console.log('validateRequestParameters success');

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

    const { encounterId, testItems, diagnosesAll, diagnosesNew, notes } = validatedParameters;

    const encounterResourcesRequest = async (): Promise<(Encounter | Patient | Location | Coverage | Account)[]> =>
      (
        await oystehr.fhir.search({
          resourceType: 'Encounter',
          params: [
            {
              name: '_id',
              value: encounterId,
            },
            {
              name: '_include',
              value: 'Encounter:patient',
            },
            {
              name: '_include',
              value: 'Encounter:location',
            },
            {
              name: '_revinclude:iterate',
              value: 'Coverage:patient',
            },
            {
              name: '_revinclude:iterate',
              value: 'Account:patient',
            },
          ],
        })
      ).unbundle() as (Encounter | Patient | Location | Coverage | Account)[];

    const testItemRequests = (): Promise<TestItemRequestData[]> => {
      return Promise.all(
        testItems.map(async (item) => {
          const activityDefs = await oystehr.fhir
            .search({
              resourceType: 'ActivityDefinition',
              params: [
                { name: 'url', value: item.adUrl },
                { name: 'version', value: item.adVersion },
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

          if (item.orderedAsRepeat) {
            console.log('run as repeat for', item.name);
            // tests being run as repeat need to be linked via basedOn to the original test that was run
            // so we are looking for a test with the same instantiatesCanonical that does not have any value in basedOn - this will be the initialServiceRequest
            serviceRequests = await oystehr.fhir
              .search({
                resourceType: 'ServiceRequest',
                params: [
                  { name: 'encounter', value: `Encounter/${encounterId}` },
                  { name: 'instantiates-canonical', value: `${item.adUrl}|${item.adVersion}` },
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
                ],
              })
            ).unbundle();
          }

          return { activityDefinition, serviceRequests, orderedAsRepeat: item.orderedAsRepeat, parentTestCanonicalUrl };
        })
      );
    };

    const userPractitionerIdRequest = async (): Promise<string> => {
      try {
        const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
        return await getMyPractitionerId(oystehrCurrentUser);
      } catch {
        throw Error(
          'Resource configuration error - user creating this in-house lab order must have a Practitioner resource linked'
        );
      }
    };

    const requests: any[] = [encounterResourcesRequest(), testItemRequests(), userPractitionerIdRequest()];

    const results = await Promise.all(requests);
    const [encounterResources, testItemResources, userPractitionerId] = results as [
      (Encounter | Patient | Location | Coverage | Account)[],
      TestItemRequestData[],
      string,
    ];

    const {
      encounterSearchResults,
      coverageSearchResults,
      accountSearchResults,
      patientsSearchResults,
      locationsSearchResults,
    } = encounterResources.reduce(
      (acc, resource) => {
        if (resource.resourceType === 'Encounter') acc.encounterSearchResults.push(resource as Encounter);
        if (resource.resourceType === 'Patient') acc.patientsSearchResults.push(resource as Patient);
        if (resource.resourceType === 'Location') acc.locationsSearchResults.push(resource as Location);

        if (resource.resourceType === 'Coverage' && resource.status === 'active')
          acc.coverageSearchResults.push(resource as Coverage);

        if (resource.resourceType === 'Account' && resource.status === 'active') {
          if (accountIsPatientBill(resource)) acc.accountSearchResults.push(resource);
        }

        return acc;
      },
      {
        encounterSearchResults: [] as Encounter[],
        patientsSearchResults: [] as Patient[],
        coverageSearchResults: [] as Coverage[],
        accountSearchResults: [] as Account[],
        locationsSearchResults: [] as Location[],
      }
    );

    const testResources: TestItemResources[] = testItemResources.map((data) => {
      const { activityDefinition, serviceRequests, orderedAsRepeat, parentTestCanonicalUrl } = data;

      if (activityDefinition.status !== 'active' || !activityDefinition.id || !activityDefinition.url) {
        throw Error(
          `ActivityDefinition is not active or has no id or is missing a canonical url, status: ${activityDefinition.status}, id: ${activityDefinition.id}, url: ${activityDefinition.url}`
        );
      }

      let initialServiceRequest: ServiceRequest | undefined;
      let testDetailType: TestItemResources['testDetailType'];

      if (orderedAsRepeat) {
        if (!serviceRequests || serviceRequests.length === 0) {
          throw IN_HOUSE_LAB_ERROR(
            `You cannot run ${activityDefinition.name} as repeat, no initial tests could be found for this encounter.`
          );
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
        testDetailType = 'repeat';
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
        testDetailType = 'reflex';
      }

      const testItemResources: TestItemResources = {
        activityDefinition,
        initialServiceRequest,
        testDetailType,
      };

      return testItemResources;
    });

    const encounter = (() => {
      const targetEncounter = encounterSearchResults.find((encounter) => encounter.id === encounterId);
      if (!targetEncounter) throw Error('Encounter not found');
      return targetEncounter;
    })();

    const patient = (() => {
      if (patientsSearchResults.length !== 1) {
        throw Error(`Patient not found, results contain ${patientsSearchResults.length} patients`);
      }
      return patientsSearchResults[0];
    })();

    const account = (() => {
      if (accountSearchResults.length !== 1) {
        throw Error(`Account not found, results contain ${accountSearchResults.length} accounts`);
      }
      return accountSearchResults[0];
    })();

    const attendingPractitionerId = getAttendingPractitionerId(encounter);
    if (!attendingPractitionerId) throw Error('Attending practitioner not found');

    const { currentUserPractitionerName, attendingPractitionerName } = await Promise.all([
      oystehrCurrentUser.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: userPractitionerId,
      }),
      oystehrCurrentUser.fhir.get<Practitioner>({
        resourceType: 'Practitioner',
        id: attendingPractitionerId,
      }),
    ]).then(([currentUserPractitioner, attendingPractitioner]) => {
      return {
        currentUserPractitionerName: getFullestAvailableName(currentUserPractitioner),
        attendingPractitionerName: getFullestAvailableName(attendingPractitioner),
      };
    });

    const coverage = getPrimaryInsurance(account, coverageSearchResults);

    const location: Location | undefined = locationsSearchResults[0];

    const resourcesToCreateAllRequests: CreateInHouseLabResources = {
      diagnosesAll,
      notes,
      testResources,
      encounter,
      patient,
      coverage,
      location,
      currentUserPractitionerName,
      currentUserPractitionerId: userPractitionerId,
      attendingPractitionerName,
      attendingPractitionerId,
    };

    const resourcePostRequests = makeRequestsForCreateInHouseLabs(resourcesToCreateAllRequests);

    const transactionResponse = await oystehr.fhir.transaction({ requests: resourcePostRequests });

    const serviceRequestIds: string[] = [];

    const resources = parseCreatedResourcesBundle(transactionResponse);
    resources.forEach((r) => {
      if (r.resourceType === 'ServiceRequest' && r.id) serviceRequestIds.push(r.id);
    });

    if (!transactionResponse.entry?.every((entry) => entry.response?.status[0] === '2')) {
      throw Error('Error creating in-house lab order in transaction');
    }

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
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
