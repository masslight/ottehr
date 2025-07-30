import { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import {
  Account,
  ActivityDefinition,
  Coverage,
  Encounter,
  FhirResource,
  Location,
  Patient,
  Practitioner,
  Provenance,
  ServiceRequest,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  APIError,
  CreateInHouseLabOrderParameters,
  FHIR_IDC10_VALUESET_SYSTEM,
  getAttendingPractitionerId,
  getFullestAvailableName,
  IN_HOUSE_LAB_ERROR,
  IN_HOUSE_LAB_TASK,
  isApiError,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  Secrets,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  parseCreatedResourcesBundle,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getPrimaryInsurance } from '../shared/labs';
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

    const {
      encounterId,
      testItem,
      cptCode: cptCode,
      diagnosesAll,
      diagnosesNew,
      isRepeatTest,
      notes,
    } = validatedParameters;

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

    const activeDefinitionRequest = async (): Promise<ActivityDefinition[]> =>
      (
        await oystehr.fhir.search({
          resourceType: 'ActivityDefinition',
          params: [
            {
              name: 'url',
              value: testItem.adUrl,
            },
            {
              name: 'version',
              value: testItem.adVersion,
            },
          ],
        })
      ).unbundle() as ActivityDefinition[];

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

    const requests: any[] = [encounterResourcesRequest(), activeDefinitionRequest(), userPractitionerIdRequest()];

    if (isRepeatTest) {
      console.log('run as repeat for', cptCode, testItem.name);
      // tests being run as repeat need to be linked via basedOn to the original test that was run
      // so we are looking for a test with the same cptCode that does not have any value in basedOn - this will be the initialServiceRequest
      const initialServiceRequestSearch = async (): Promise<ServiceRequest[]> =>
        (
          await oystehr.fhir.search({
            resourceType: 'ServiceRequest',
            params: [
              {
                name: 'encounter',
                value: `Encounter/${encounterId}`,
              },
              {
                name: 'instantiates-canonical',
                value: `${testItem.adUrl}|${testItem.adVersion}`,
              },
            ],
          })
        ).unbundle() as ServiceRequest[];
      requests.push(initialServiceRequestSearch());
    }

    const results = await Promise.all(requests);
    const [
      encounterResources,
      activeDefinitionResources,
      userPractitionerId,
      initialServiceRequestResources, // only exists if runAsRepeat is true
    ] = results as [
      (Encounter | Patient | Location | Coverage | Account)[],
      ActivityDefinition[],
      string,
      ServiceRequest[]?,
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

        if (resource.resourceType === 'Account' && resource.status === 'active')
          acc.accountSearchResults.push(resource as Account);

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

    const activityDefinition = (() => {
      if (activeDefinitionResources.length !== 1) {
        throw Error(
          `ActivityDefinition not found, results contain ${
            activeDefinitionResources.length
          } activity definitions, ids: ${activeDefinitionResources
            .map((resource) => `ActivityDefinition/${resource.id}`)
            .join(', ')}`
        );
      }

      const activeDefinition = activeDefinitionResources[0];

      if (activeDefinition.status !== 'active' || !activeDefinition.id || !activeDefinition.url) {
        throw Error(
          `ActivityDefinition is not active or has no id or is missing a canonical url, status: ${activeDefinition.status}, id: ${activeDefinition.id}, url: ${activeDefinition.url}`
        );
      }

      return activeDefinition;
    })();

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

    const initialServiceRequest = (() => {
      if (isRepeatTest) {
        if (!initialServiceRequestResources || initialServiceRequestResources.length === 0) {
          throw IN_HOUSE_LAB_ERROR(
            'You cannot run this as repeat, no initial tests could be found for this encounter.'
          );
        }
        const possibleInitialSRs = initialServiceRequestResources.reduce((acc: ServiceRequest[], sr) => {
          if (!sr.basedOn) acc.push(sr);
          return acc;
        }, []);
        if (possibleInitialSRs.length > 1) {
          console.log('More than one initial tests found for this encounter');
          // this really shouldn't happen, something is misconfigured
          throw IN_HOUSE_LAB_ERROR(
            'Could not deduce which test is initial since more than one test has previously been run today'
          );
        }
        if (possibleInitialSRs.length === 0) {
          // this really shouldn't happen, something is misconfigured
          throw IN_HOUSE_LAB_ERROR('No initial tests could be found for this encounter.');
        }
        const initialSR = possibleInitialSRs[0];
        return initialSR;
      }
      return;
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

    const serviceRequestFullUrl = `urn:uuid:${randomUUID()}`;

    const serviceRequestConfig: ServiceRequest = {
      resourceType: 'ServiceRequest',
      status: 'draft',
      intent: 'order',
      subject: {
        reference: `Patient/${patient.id}`,
      },
      encounter: {
        reference: `Encounter/${encounterId}`,
      },
      requester: {
        reference: `Practitioner/${attendingPractitionerId}`,
      },
      authoredOn: DateTime.now().toISO() || undefined,
      priority: 'stat',
      code: {
        coding: activityDefinition.code?.coding,
        text: activityDefinition.name,
      },
      reasonCode: [...diagnosesAll].map((diagnosis) => {
        return {
          coding: [
            {
              system: FHIR_IDC10_VALUESET_SYSTEM,
              code: diagnosis?.code,
              display: diagnosis?.display,
            },
          ],
          text: diagnosis?.display,
        };
      }),
      ...(location && {
        locationReference: [
          {
            type: 'Location',
            reference: `Location/${location.id}`,
          },
        ],
      }),
      ...(notes && { note: [{ text: notes }] }),
      ...(coverage && { insurance: [{ reference: `Coverage/${coverage.id}` }] }),
      instantiatesCanonical: [`${activityDefinition.url}|${activityDefinition.version}`],
    };
    // if an initialServiceRequest is defined, the test being ordered is repeat and should be linked to the
    // original test represented by initialServiceRequest
    if (initialServiceRequest) {
      serviceRequestConfig.basedOn = [
        {
          reference: `ServiceRequest/${initialServiceRequest.id}`,
        },
      ];
    }

    const taskConfig: Task = {
      resourceType: 'Task',
      status: 'ready',
      code: {
        coding: [
          {
            system: IN_HOUSE_LAB_TASK.system,
            code: IN_HOUSE_LAB_TASK.code.collectSampleTask,
          },
        ],
      },
      basedOn: [{ reference: serviceRequestFullUrl }],
      encounter: { reference: `Encounter/${encounterId}` },
      authoredOn: DateTime.now().toISO(),
      intent: 'order',
      ...(location && { location: { reference: `Location/${location.id}` } }),
    };

    const provenanceConfig: Provenance = {
      resourceType: 'Provenance',
      activity: {
        coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder],
      },
      target: [{ reference: serviceRequestFullUrl }],
      ...(location && { location: { reference: `Location/${location.id}` } }),
      recorded: DateTime.now().toISO(),
      agent: [
        {
          who: {
            reference: `Practitioner/${userPractitionerId}`,
            display: currentUserPractitionerName,
          },
          onBehalfOf: {
            reference: `Practitioner/${attendingPractitionerId}`,
            display: attendingPractitionerName,
          },
        },
      ],
    };

    const transactionResponse = await oystehr.fhir.transaction({
      requests: [
        {
          method: 'POST',
          url: '/ServiceRequest',
          resource: serviceRequestConfig,
          fullUrl: serviceRequestFullUrl,
        },
        {
          method: 'POST',
          url: '/Task',
          resource: taskConfig,
        },
        {
          method: 'POST',
          url: '/Provenance',
          resource: provenanceConfig,
        },
      ] as BatchInputRequest<FhirResource>[],
    });

    const resources = parseCreatedResourcesBundle(transactionResponse);
    const newServiceRequest = resources.find((r) => r.resourceType === 'ServiceRequest');

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
      transactionResponse,
      saveChartDataResponse,
      ...(newServiceRequest && { serviceRequestId: newServiceRequest.id }),
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
    }

    return {
      statusCode,
      body,
    };
  }
});
