import { APIGatewayProxyResult } from 'aws-lambda';
import {
  Bundle,
  DiagnosticReport,
  Task,
  Provenance,
  ServiceRequest,
  Reference,
  Encounter,
  Observation,
  FhirResource,
  Specimen,
} from 'fhir/r4b';
import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import { getPatchBinary, PROVENANCE_ACTIVITY_CODING_ENTITY, Secrets, UpdateLabOrderResourcesParameters } from 'utils';
import { Operation } from 'fast-json-patch';
import { BatchInputPostRequest } from '@oystehr/sdk';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
import { DateTime } from 'luxon';
import { createLabResultPDF } from '../../shared/pdf/external-labs-results-form-pdf';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`update-lab-order-resources started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: UpdateLabOrderResourcesParameters & { secrets: Secrets | null; userToken: string };

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
    const practitionerIdFromCurrentUser = await getMyPractitionerId(oystehrCurrentUser);

    switch (validatedParameters.event) {
      case 'reviewed': {
        const { taskId, serviceRequestId, diagnosticReportId } = validatedParameters;

        const updateTransactionRequest = await handleReviewedEvent({
          oystehr,
          practitionerIdFromCurrentUser,
          taskId,
          serviceRequestId,
          diagnosticReportId,
          secrets,
        });

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Successfully updated Task/${taskId}. Status set to 'completed' and Practitioner set.`,
            transaction: updateTransactionRequest,
          }),
        };
      }

      case 'specimenDateChanged': {
        const { serviceRequestId, specimenId, date } = validatedParameters;

        const updateTransactionRequest = await handleSpecimenDateChangedEvent({
          oystehr,
          serviceRequestId,
          specimenId,
          date,
        });

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Successfully updated Specimen/${specimenId}. Date set to '${date}'.`,
            transaction: updateTransactionRequest,
          }),
        };
      }
    }
  } catch (error: any) {
    console.error('Error updating lab order resource:', error);
    await topLevelCatch('update-lab-order-resources', error, secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error handling ${validatedParameters.event} event: ${error.message || error}`,
      }),
    };
  }
};

const handleReviewedEvent = async ({
  oystehr,
  practitionerIdFromCurrentUser,
  taskId,
  serviceRequestId,
  diagnosticReportId,
  secrets,
}: {
  oystehr: Oystehr;
  practitionerIdFromCurrentUser: string;
  taskId: string;
  serviceRequestId: string;
  diagnosticReportId: string;
  secrets: Secrets | null;
}): Promise<Bundle<FhirResource>> => {
  const resources = (
    await oystehr.fhir.search<Task | Encounter | DiagnosticReport | Observation | Provenance | ServiceRequest>({
      resourceType: 'DiagnosticReport',
      params: [
        { name: '_id', value: diagnosticReportId }, // diagnostic report
        { name: '_include', value: 'DiagnosticReport:based-on' }, // service request
        { name: '_revinclude', value: 'Task:based-on' }, // tasks
        { name: '_include', value: 'DiagnosticReport:result' }, // observation
      ],
    })
  ).unbundle();

  const serviceRequest = resources.find(
    (r) => r.resourceType === 'ServiceRequest' && r.id === serviceRequestId
  ) as ServiceRequest;

  const diagnosticReport = resources.find(
    (r) => r.resourceType === 'DiagnosticReport' && r.id === diagnosticReportId
  ) as DiagnosticReport;

  const task = resources.find((r) => r.resourceType === 'Task' && r.id === taskId) as Task;

  if (!serviceRequest) {
    throw new Error(`ServiceRequest/${serviceRequestId} not found`);
  }

  if (!diagnosticReport) {
    throw new Error(`DiagnosticReport/${diagnosticReportId} not found`);
  }

  if (!task) {
    throw new Error(`Task/${taskId} not found`);
  }

  const observationId = diagnosticReport.result?.[0]?.reference?.split('/').pop();

  if (!observationId) {
    throw new Error(`Observation Id not found in DiagnosticReport/${diagnosticReportId}`);
  }

  const locationReference = serviceRequest.locationReference?.[0];

  const tempProvenanceUuid = `urn:uuid:${crypto.randomUUID()}`;

  const provenanceRequest: BatchInputPostRequest<Provenance> = {
    method: 'POST',
    url: '/Provenance',
    resource: {
      resourceType: 'Provenance',
      target: [
        { reference: `ServiceRequest/${serviceRequest.id}` },
        { reference: `DiagnosticReport/${diagnosticReport.id}` },
        { reference: `Observation/${observationId}` },
      ],
      recorded: DateTime.now().toUTC().toISO(),
      location: locationReference as Reference, // TODO: should we throw error if locationReference is not present?
      agent: [
        {
          who: {
            reference: `Practitioner/${practitionerIdFromCurrentUser}`,
          },
        },
      ],
      activity: {
        coding: [PROVENANCE_ACTIVITY_CODING_ENTITY.review],
      },
    },
    fullUrl: tempProvenanceUuid,
  };

  const isPreliminary = diagnosticReport.status === 'preliminary';
  const shouldAddRelevantHistory = !isPreliminary; // no tracking of preliminary results reviewed date

  const taskPatchOperations: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: 'completed',
    },
    {
      op: 'add',
      path: '/owner',
      value: {
        reference: `Practitioner/${practitionerIdFromCurrentUser}`,
      },
    },
    ...(shouldAddRelevantHistory
      ? [
          {
            op: 'add',
            path: '/relevantHistory',
            value: [
              {
                reference: tempProvenanceUuid,
              },
            ],
          } as const,
        ]
      : []),
  ];

  const taskPatchRequest = getPatchBinary({
    resourceType: 'Task',
    resourceId: taskId,
    patchOperations: taskPatchOperations,
  });

  const requests = shouldAddRelevantHistory ? [provenanceRequest, taskPatchRequest] : [taskPatchRequest];

  const updateTransactionRequest = await oystehr.fhir.transaction({
    requests,
  });

  await createLabResultPDF(oystehr, serviceRequestId, diagnosticReport, true, secrets, m2mtoken);

  return updateTransactionRequest;
};

const handleSpecimenDateChangedEvent = async ({
  oystehr,
  serviceRequestId,
  specimenId,
  date,
}: {
  oystehr: Oystehr;
  serviceRequestId: string;
  specimenId: string;
  date: string;
}): Promise<Bundle<FhirResource>> => {
  if (!DateTime.fromISO(date).isValid) {
    throw new Error(`Invalid date value: ${date}`);
  }

  const resources = (
    await oystehr.fhir.search<ServiceRequest | Specimen>({
      resourceType: 'ServiceRequest',
      params: [
        { name: '_id', value: serviceRequestId },
        { name: '_include', value: 'ServiceRequest:specimen' },
      ],
    })
  ).unbundle();

  const specimen = resources.find((r): r is Specimen => r.resourceType === 'Specimen' && r.id === specimenId);

  if (!specimen?.id) {
    throw new Error(`Specimen/${specimenId} not found in ServiceRequest/${serviceRequestId}`);
  }

  const hasSpecimenDateTime = specimen.collection?.collectedDateTime;

  const specimenPatchRequest = getPatchBinary({
    resourceType: 'Specimen',
    resourceId: specimen.id,
    patchOperations: [
      {
        op: hasSpecimenDateTime ? 'replace' : 'add',
        path: '/collection/collectedDateTime',
        value: date,
      },
    ],
  });

  const updateTransactionRequest = await oystehr.fhir.transaction({
    requests: [specimenPatchRequest],
  });

  return updateTransactionRequest;
};
