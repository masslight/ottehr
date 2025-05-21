import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Secrets,
  GetCreateInHouseLabOrderResourcesParameters,
  GetCreateInHouseLabOrderResourcesResponse,
  IN_HOUSE_TAG_DEFINITION,
  convertActivityDefinitionToTestItem,
  PRACTITIONER_CODINGS,
  getFullestAvailableName,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  TestStatus,
  IN_HOUSE_LAB_TASK,
  IN_HOUSE_LAB_DOCREF_CATEGORY,
  TestItem,
  DiagnosisDTO,
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
import {
  Task,
  ActivityDefinition,
  Encounter,
  Practitioner,
  Provenance,
  ServiceRequest,
  Coding,
  Location,
} from 'fhir/r4b';
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
      currentPractitionerName,
      attendingPractitionerId,
      currentPractitionerId,
      timezone,
    } = await (async () => {
      const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

      const [myPractitionerId, { encounter, timezone }] = await Promise.all([
        getMyPractitionerId(oystehrCurrentUser),
        oystehr.fhir
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
          }),
      ]);

      if (!encounter) {
        throw new Error('Encounter not found');
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

    const serviceRequests = validatedParameters.serviceRequestId
      ? (
          await oystehr.fhir.search<ServiceRequest>({
            resourceType: 'ServiceRequest',
            params: [{ name: '_id', value: validatedParameters.serviceRequestId }],
          })
        ).unbundle()
      : [];

    const tasks =
      serviceRequests.length > 0
        ? (
            await oystehr.fhir.search<Task>({
              resourceType: 'Task',
              params: [
                {
                  name: 'based-on',
                  value: serviceRequests.map((sr) => `ServiceRequest/${sr.id}`).join(','),
                },
              ],
            })
          ).unbundle()
        : [];

    const provenances =
      serviceRequests.length > 0
        ? (
            await oystehr.fhir.search<Provenance>({
              resourceType: 'Provenance',
              params: [
                {
                  name: 'target',
                  value: serviceRequests.map((sr) => `ServiceRequest/${sr.id}`).join(','),
                },
              ],
            })
          ).unbundle()
        : [];

    // Determine order status, info, and history
    const orderStatus = determineOrderStatus(serviceRequests[0], tasks);

    const diagnoses: DiagnosisDTO[] =
      serviceRequests[0]?.reasonCode?.map((reason) => ({
        code: reason.coding?.[0]?.code || '',
        display: reason.coding?.[0]?.display || reason.text || '',
        isPrimary: false, // todo: we don't show this info in the UI, but better to have it here
      })) || [];

    const testName = serviceRequests[0]?.code?.text || '';

    const notes = serviceRequests[0]?.note?.[0]?.text;

    const orderHistory = buildOrderHistory(
      serviceRequests[0],
      provenances
      // attendingPractitionerName,
      // currentPractitionerName
    );

    const response: GetCreateInHouseLabOrderResourcesResponse = {
      id: serviceRequests[0]?.id || '',
      type: 'MIXED', // todo: what the logic for determine type?
      name: testItems[0]?.name || '',
      status: orderStatus,
      diagnosis: diagnoses.map((d) => `${d.code} ${d.display}`).join(', '),
      diagnosisDTO: diagnoses,
      labs: testItems,
      providerName: attendingPractitionerName,
      providerId: attendingPractitionerId,
      currentUserName: currentPractitionerName,
      currentUserId: currentPractitionerId,
      orderInfo: {
        diagnosis: diagnoses,
        testName,
        notes,
        status: orderStatus,
      },
      orderHistory,

      // todo: implement specimen retrieval
      specimen: {
        source: 'Blood',
        collectedBy: 'Samanta Brooks',
        collectionDate: '2024-10-21',
        collectionTime: '9:20 AM',
      },

      notes: notes || '',
      timezone,
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

function determineOrderStatus(serviceRequest: any, tasks: any[]): TestStatus {
  if (!serviceRequest) return 'ORDERED';

  const collectSampleTask = tasks.find(
    (task) =>
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.collectSampleTask
      )
  );

  const interpretResultsTask = tasks.find(
    (task) =>
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_TASK.system && coding.code === IN_HOUSE_LAB_TASK.code.inputResultsTask // todo: is it valid?
      )
  );

  const documentReference = tasks.find(
    (task) =>
      task.code?.coding?.some(
        (coding: Coding) =>
          coding.system === IN_HOUSE_LAB_DOCREF_CATEGORY.system &&
          coding.code === IN_HOUSE_LAB_DOCREF_CATEGORY.code.resultForm
      )
  );

  // Status Derivation:
  // Ordered: SR.status = draft & Task(CST).status = ready
  if (serviceRequest.status === 'draft' && collectSampleTask?.status === 'ready') {
    return 'ORDERED';
  }

  // Collected: SR.status = active & Task(CST).status = completed & Task(IRT).status = ready
  if (
    serviceRequest.status === 'active' &&
    collectSampleTask?.status === 'completed' &&
    interpretResultsTask?.status === 'ready'
  ) {
    return 'COLLECTED';
  }

  // Final: SR.status = completed && DR.status = 'final'
  if (
    serviceRequest.status === 'completed' &&
    (documentReference?.status === 'final' || documentReference?.status === 'amended')
  ) {
    return 'FINAL';
  }

  return 'UNKNOWN' as 'ORDERED'; // todo: maybe add separate type for unknown status?
}

function buildOrderHistory(
  serviceRequest: ServiceRequest,
  provenances: Provenance[]
  // providerName: string,
  // currentPractitionerName: string
): {
  status: TestStatus;
  providerName: string;
  date: string;
}[] {
  const history: {
    status: TestStatus;
    providerName: string;
    date: string;
  }[] = [];

  // todo: it seems that adding from provenances is enough, so we can remove this
  // Add order creation entry if we have a service request
  // if (serviceRequest?.authoredOn) {
  //   history.push({
  //     status: 'ORDERED',
  //     providerName,
  //     date: serviceRequest.authoredOn,
  //   });
  // }

  // Add entries from provenances
  provenances.forEach((provenance) => {
    const activityCode = provenance.activity?.coding?.[0]?.code;

    // Map activity codes to statuses
    let status: TestStatus | undefined;

    if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.createOrder.code) {
      status = 'ORDERED';
    } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.collectSpecimen?.code) {
      status = 'COLLECTED';
    } else if (activityCode === PROVENANCE_ACTIVITY_CODING_ENTITY.submit?.code) {
      status = 'FINAL';
    }

    if (status && provenance.recorded) {
      const agentName = provenance.agent?.[0]?.who?.display || '';

      history.push({
        status,
        providerName: agentName,
        date: provenance.recorded,
      });
    }
  });

  history.sort((a, b) => {
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return history;
}
