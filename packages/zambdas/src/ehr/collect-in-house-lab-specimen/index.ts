import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Secrets,
  CollectInHouseLabSpecimenParameters,
  IN_HOUSE_LAB_TASK,
  PRACTITIONER_CODINGS,
  SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM,
} from 'utils';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { ServiceRequest, Specimen, Task, FhirResource, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { BatchInputRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`collect-in-house-lab-specimen started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: CollectInHouseLabSpecimenParameters & { secrets: Secrets | null; userToken: string };

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
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);

    const { encounterId, serviceRequestId, data } = validatedParameters;

    const [serviceRequestResources, tasksCSTResources, userPractitionerId, encounter] = await Promise.all([
      oystehr.fhir.get<ServiceRequest>({
        resourceType: 'ServiceRequest',
        id: serviceRequestId,
      }),
      oystehr.fhir
        .search<Task>({
          resourceType: 'Task',
          params: [
            {
              name: 'based-on',
              value: `ServiceRequest/${serviceRequestId}`,
            },
            {
              name: 'code',
              value: `${IN_HOUSE_LAB_TASK.system}|${IN_HOUSE_LAB_TASK.code.collectSampleTask}`,
            },
          ],
        })
        .then((bundle) => bundle.unbundle()),
      getMyPractitionerId(oystehrCurrentUser),
      oystehr.fhir.get<Encounter>({
        resourceType: 'Encounter',
        id: encounterId,
      }),
    ]);

    const practitionerFromEncounterId = encounter.participant
      ?.find(
        (participant) =>
          participant.type?.find(
            (type) => type.coding?.some((c) => c.system === PRACTITIONER_CODINGS.Attender[0].system)
          )
      )
      ?.individual?.reference?.replace('Practitioner/', '');

    if (
      practitionerFromEncounterId !== validatedParameters.data.specimen.collectedBy.id &&
      userPractitionerId !== validatedParameters.data.specimen.collectedBy.id
    ) {
      // todo: not sure about this check, but looks better to have it, without this any participant may be setted with custom request
      throw Error('Practitioner mismatch');
    }

    const serviceRequestEncounterId = serviceRequestResources?.encounter?.reference?.replace('Encounter/', '');

    if (!serviceRequestEncounterId || serviceRequestEncounterId !== encounterId) {
      throw Error(`ServiceRequest with id ${serviceRequestId} is not associated with encounter ${encounterId}`);
    }

    const serviceRequest = serviceRequestResources as ServiceRequest;

    if (tasksCSTResources.length !== 1) {
      throw Error(`Expected 1 collection task, found ${tasksCSTResources.length}`);
    }

    const collectionTask = tasksCSTResources[0];

    if (!collectionTask.id) {
      throw Error('Collection task has no ID');
    }

    const specimenFullUrl = `urn:uuid:${randomUUID()}`;

    const specimenConfig: Specimen = {
      resourceType: 'Specimen',
      status: 'available',
      request: [
        {
          reference: `ServiceRequest/${serviceRequestId}`,
        },
      ],
      subject: {
        reference: serviceRequest.subject?.reference || '',
      },
      collection: {
        collector: {
          reference: `Practitioner/${data.specimen.collectedBy.id}`,
          display: data.specimen.collectedBy.name,
        },
        collectedDateTime: data.specimen.collectionDate,
        bodySite: {
          coding: [
            {
              // todo when we have a standardize input we should switch this system
              system: SPECIMEN_COLLECTION_CUSTOM_SOURCE_SYSTEM,
              display: data.specimen.source,
            },
          ],
        },
      },
      ...(data.notes && { note: [{ text: data.notes }] }),
    };

    const serviceRequestUpdateConfig: ServiceRequest = {
      ...serviceRequest,
      status: 'active',
      specimen: [{ reference: specimenFullUrl }],
    };

    const collectionTaskUpdateConfig: Task = {
      ...collectionTask,
      status: 'completed',
    };

    const inputResultTaskConfig: Task = {
      resourceType: 'Task',
      status: 'ready',
      intent: 'order',
      code: {
        coding: [
          {
            system: IN_HOUSE_LAB_TASK.system,
            code: IN_HOUSE_LAB_TASK.code.inputResultsTask,
          },
        ],
      },
      basedOn: [{ reference: `ServiceRequest/${serviceRequestId}` }],
      encounter: { reference: `Encounter/${encounterId}` },
      authoredOn: DateTime.now().toISO(),
      ...(collectionTask.location && { location: collectionTask.location }),
    };

    const transactionResponse = await oystehr.fhir.transaction({
      requests: [
        {
          method: 'POST',
          url: '/Specimen',
          resource: specimenConfig,
          fullUrl: specimenFullUrl,
        },
        {
          method: 'PUT',
          url: `/ServiceRequest/${serviceRequestId}`,
          resource: serviceRequestUpdateConfig,
        },
        {
          method: 'PUT',
          url: `/Task/${collectionTask.id}`,
          resource: collectionTaskUpdateConfig,
        },
        {
          method: 'POST',
          url: '/Task',
          resource: inputResultTaskConfig,
        },
      ] as BatchInputRequest<FhirResource>[],
    });

    if (!transactionResponse.entry?.every((entry) => entry.response?.status[0] === '2')) {
      throw Error('Error collecting in-house lab specimen in transaction');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully collected in-house lab specimen.',
        transactionResponse,
      }),
    };
  } catch (error: any) {
    console.error('Error collecting in-house lab specimen:', error);
    await topLevelCatch('collect-in-house-lab-specimen', error, secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
};
