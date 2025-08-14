import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  Bundle,
  DiagnosticReport,
  Encounter,
  FhirResource,
  Observation,
  Provenance,
  QuestionnaireResponse,
  Reference,
  ServiceRequest,
  Specimen,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DYMO_30334_LABEL_CONFIG,
  getAccountNumberFromOrganization,
  getOrderNumber,
  getPatchBinary,
  getPatientFirstName,
  getPatientLastName,
  getSecret,
  isPSCOrder,
  PROVENANCE_ACTIVITY_CODING_ENTITY,
  SaveOrderCollectionData,
  Secrets,
  SecretsKeys,
  UpdateLabOrderResourcesParameters,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createExternalLabsLabelPDF, ExternalLabsLabelConfig } from '../../shared/pdf/external-labs-label-pdf';
import { createExternalLabResultPDF } from '../../shared/pdf/labs-results-form-pdf';
import { getExternalLabOrderResources } from '../shared/labs';
import {
  getSpecimenPatchAndMostRecentCollectionDate,
  makePstCompletePatchRequests,
  makeQrPatchRequest,
  makeSpecimenPatchRequest,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'update-lab-order-resources';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
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
          practitionerIdFromCurrentUser,
        });

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Successfully updated Specimen/${specimenId}. Date set to '${date}'.`,
            transaction: updateTransactionRequest,
          }),
        };
      }

      case 'saveOrderCollectionData': {
        const { serviceRequestId, data, specimenCollectionDates } = validatedParameters;
        const { presignedLabelURL } = await handleSaveCollectionData(
          oystehr,
          m2mToken,
          secrets,
          practitionerIdFromCurrentUser,
          {
            serviceRequestId,
            data,
            specimenCollectionDates,
          }
        );

        return {
          statusCode: 200,
          body: JSON.stringify({
            message: `Successfully updated saved order collection data`,
            presignedLabelURL,
          }),
        };
      }
    }
  } catch (error: any) {
    console.error('Error updating external lab order resource:', error);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('update-lab-order-resources', error, ENVIRONMENT);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error handling ${validatedParameters.event} event: ${error.message || error}`,
      }),
    };
  }
});

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
    (r: any) => r.resourceType === 'ServiceRequest' && r.id === serviceRequestId
  ) as ServiceRequest;

  const diagnosticReport = resources.find(
    (r: any) => r.resourceType === 'DiagnosticReport' && r.id === diagnosticReportId
  ) as DiagnosticReport;

  const task = resources.find((r: any) => r.resourceType === 'Task' && r.id === taskId) as Task;

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

  await createExternalLabResultPDF(oystehr, serviceRequestId, diagnosticReport, true, secrets, m2mToken);

  return updateTransactionRequest;
};

const handleSpecimenDateChangedEvent = async ({
  oystehr,
  serviceRequestId,
  specimenId,
  date,
  practitionerIdFromCurrentUser,
}: {
  oystehr: Oystehr;
  serviceRequestId: string;
  specimenId: string;
  date: string;
  practitionerIdFromCurrentUser: string;
}): Promise<Bundle<Specimen>> => {
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

  const specimenPatchRequest = makeSpecimenPatchRequest(
    specimen,
    DateTime.fromISO(date),
    practitionerIdFromCurrentUser
  );

  const updateTransactionRequest = await oystehr.fhir.transaction<Specimen>({
    requests: [specimenPatchRequest],
  });

  return updateTransactionRequest;
};

/**
 * saves sample collection dates
 * saves aoe question entry & marks QR as complete
 * update pre-submission task to complete and create provenance for who did that
 *  makes specimen label
 */
const handleSaveCollectionData = async (
  oystehr: Oystehr,
  m2mToken: string,
  secrets: Secrets | null,
  practitionerIdFromCurrentUser: string,
  input: SaveOrderCollectionData
): Promise<{ presignedLabelURL: string | undefined }> => {
  console.log('double check input', JSON.stringify(input));
  const { serviceRequestId, data, specimenCollectionDates } = input;
  const now = DateTime.now();

  console.log('getting resources needed for saving collection data');
  const {
    serviceRequest,
    patient,
    questionnaireResponse,
    preSubmissionTask: pstTask,
    encounter,
    labOrganization,
    specimens: specimenResources,
  } = await getExternalLabOrderResources(oystehr, serviceRequestId);
  console.log('resources retrieved');

  const orderNumber = getOrderNumber(serviceRequest);
  console.log('orderNumber', orderNumber);
  if (!orderNumber) throw Error(`order number could not be parsed from the service request ${serviceRequest.id}`);

  const requests: BatchInputRequest<Specimen | QuestionnaireResponse | Provenance | Task>[] = [];

  // if there are specimen dates passed update those specimens collection dateTimes
  let mostRecentSampleCollectionDate: undefined | DateTime; // needed for label
  console.log('specimenResources', JSON.stringify(specimenResources));
  console.log('specimenCollectionDates', JSON.stringify(specimenCollectionDates));
  if (specimenResources.length > 0 && specimenCollectionDates) {
    const { specimenPatchRequests, mostRecentCollectionDate } = getSpecimenPatchAndMostRecentCollectionDate(
      specimenResources,
      specimenCollectionDates,
      practitionerIdFromCurrentUser
    );
    requests.push(...specimenPatchRequests);
    mostRecentSampleCollectionDate = mostRecentCollectionDate;
  }

  // if aoe answers (data) are passed, patch the QR & make QR completed
  // not every order will have an AOE
  if (questionnaireResponse !== undefined && questionnaireResponse.id) {
    const qrPatchRequest = await makeQrPatchRequest(questionnaireResponse, data, m2mToken);
    requests.push(qrPatchRequest);
  }

  let presignedLabelURL: string | undefined = undefined;
  // update pst task to complete, add agent and relevant history (provenance created)
  // and create provenance with activity PROVENANCE_ACTIVITY_CODING_ENTITY.completePstTask
  const pstCompletedRequests = makePstCompletePatchRequests(
    pstTask,
    serviceRequest,
    practitionerIdFromCurrentUser,
    now
  );
  requests.push(...pstCompletedRequests);
  // make specimen label
  if (!isPSCOrder(serviceRequest)) {
    const labelConfig: ExternalLabsLabelConfig = {
      labelConfig: DYMO_30334_LABEL_CONFIG,
      content: {
        patientId: patient.id!,
        patientFirstName: getPatientFirstName(patient) ?? '',
        patientLastName: getPatientLastName(patient) ?? '',
        patientDateOfBirth: patient.birthDate ? DateTime.fromISO(patient.birthDate) : undefined,
        sampleCollectionDate: mostRecentSampleCollectionDate,
        orderNumber: orderNumber,
        accountNumber: (labOrganization && getAccountNumberFromOrganization(labOrganization)) || '',
      },
    };

    console.log('creating labs order label and getting url');
    presignedLabelURL = (
      await createExternalLabsLabelPDF(labelConfig, encounter.id!, serviceRequest.id!, secrets, m2mToken, oystehr)
    ).presignedURL;
  }

  console.log('making fhir requests');
  await oystehr.fhir.transaction({ requests });

  return { presignedLabelURL };
};
