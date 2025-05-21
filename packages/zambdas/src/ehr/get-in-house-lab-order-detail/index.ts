import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Secrets,
  InHouseLabDTO,
  convertActivityDefinitionToTestItem,
  PRACTITIONER_CODINGS,
  getFullestAvailableName,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  TestStatus,
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
  Location,
  FhirResource,
  Specimen,
} from 'fhir/r4b';
import { determineOrderStatus } from '../shared/inhouse-labs';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`get-in-house-lab-order-detail started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: { serviceRequestId: string; secrets: Secrets | null; userToken: string };

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
    const { serviceRequestId } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const {
      serviceRequest,
      sepcimen,
      tasks,
      provenances,
      attendingPractitionerName,
      currentPractitionerName,
      attendingPractitionerId,
      currentPractitionerId,
      timezone,
    } = await (async () => {
      const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

      const [myPractitionerId, { serviceRequest, encounter, sepcimen, timezone, tasks, provenances }] =
        await Promise.all([
          getMyPractitionerId(oystehrCurrentUser),
          oystehr.fhir
            .search<ServiceRequest | Encounter | Location>({
              resourceType: 'ServiceRequest',
              params: [
                { name: '_id', value: serviceRequestId },
                { name: '_include', value: 'ServiceRequest:encounter' },
                { name: '_include:iterate', value: 'Encounter:location' },
                { name: '_revinclude', value: 'Task:based-on' },
                { name: '_revinclude', value: 'Provenance:target' },
                { name: '_include', value: 'ServiceRequest:specimen' },
              ],
            })
            .then((bundle) => {
              const resources = bundle.unbundle();
              return parseResources(resources);
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
        serviceRequest,
        sepcimen,
        tasks,
        provenances,
        attendingPractitionerName,
        currentPractitionerName,
        attendingPractitionerId,
        currentPractitionerId,
        timezone,
      };
    })();

    if (!serviceRequest || !serviceRequest.id) throw new Error('service request is missing');

    const adCanonicalUrl = serviceRequest?.instantiatesCanonical?.join('');
    if (!adCanonicalUrl) {
      // todo better error
      throw new Error('service request is missing instantiatesCanonical');
    }

    const activityDefinitionSearch = (
      await oystehr.fhir.search<ActivityDefinition>({
        resourceType: 'ActivityDefinition',
        params: [
          { name: 'url', value: adCanonicalUrl },
          { name: 'status', value: 'active' },
        ],
      })
    ).unbundle();

    if (activityDefinitionSearch.length !== 1)
      throw new Error(`Found ${activityDefinitionSearch.length} ActivityDefinition resources, there should only be 1`);

    const testItem = convertActivityDefinitionToTestItem(activityDefinitionSearch[0]);

    // Determine order status, info, and history
    const orderStatus = determineOrderStatus(serviceRequest, tasks);

    const diagnoses: DiagnosisDTO[] =
      serviceRequest?.reasonCode?.map((reason) => ({
        code: reason.coding?.[0]?.code || '',
        display: reason.coding?.[0]?.display || reason.text || '',
        isPrimary: false, // todo: we don't show this info in the UI, but better to have it here
      })) || [];

    const testName = serviceRequest?.code?.text || '';

    const notes = serviceRequest?.note?.[0]?.text;

    const orderHistory = buildOrderHistory(
      serviceRequest,
      provenances
      // attendingPractitionerName,
      // currentPractitionerName
    );

    const response: InHouseLabDTO = {
      serviceRequestId,
      name: testItem.name,
      status: orderStatus,
      diagnosis: diagnoses.map((d) => `${d.code} ${d.display}`).join(', '),
      diagnosisDTO: diagnoses,
      labDetails: testItem,
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
      specimen: sepcimen ? getSpecimenDetails(sepcimen) : undefined,

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

const parseResources = (
  resources: FhirResource[]
): {
  serviceRequest: ServiceRequest;
  encounter: Encounter;
  location?: Location;
  sepcimen?: Specimen;
  timezone: string;
  tasks: Task[];
  provenances: Provenance[];
} => {
  let serviceRequest: ServiceRequest | undefined;
  let encounter: Encounter | undefined;
  let location: Location | undefined;
  let sepcimen: Specimen | undefined;
  const tasks: Task[] = [];
  const provenances: Provenance[] = [];

  resources.forEach((r) => {
    if (r.resourceType === 'ServiceRequest') serviceRequest = r;
    if (r.resourceType === 'Encounter') encounter = r;
    if (r.resourceType === 'Specimen') sepcimen = r;
    if (r.resourceType === 'Location') location = r;
    if (r.resourceType === 'Task') tasks.push(r);
    if (r.resourceType === 'Provenance') provenances.push(r);
  });

  const missingResources: string[] = [];
  if (!serviceRequest) missingResources.push('service request');
  if (!encounter) missingResources.push('encounter');
  if (tasks.length === 0) missingResources.push('task');
  if (!serviceRequest || !encounter || tasks.length === 0) {
    throw new Error(`Missing resources: ${missingResources.join(',')}`);
  }

  // todo figure this out
  const timezone = location ? getTimezone(location) : 'America/New_York';

  return { serviceRequest, encounter, location, sepcimen, timezone, tasks, provenances };
};

// todo finish this
const getSpecimenDetails = (specimen: Specimen): InHouseLabDTO['specimen'] => {
  const specimenCollection = specimen.collection;
  if (specimenCollection) {
    const specimenDetails = {
      source:
        specimenCollection.bodySite?.coding?.find((c) => c.system === 'https://hl7.org/fhir/R4B/valueset-body-site')
          ?.display || '',
      collectedBy: 'Samanta Brooks',
      collectionDate: '2024-10-21',
      collectionTime: '9:20 AM',
    };
    return specimenDetails;
  }
  throw new Error(`missing specimen details for specimen ${specimen.id}`);
};
