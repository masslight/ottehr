import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import {
  SignAppointmentInput,
  SignAppointmentResponse,
  getVisitStatus,
  getEncounterStatusHistoryUpdateOp,
  getPatchBinary,
  VisitStatusLabel,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
  getCriticalUpdateTagOp,
  progressNoteChartDataRequestedFields,
  OTTEHR_MODULE,
  telemedProgressNoteChartDataRequestedFields,
} from 'utils';

import { validateRequestParameters } from './validateRequestParameters';
import { getChartData } from '../get-chart-data';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { VideoResourcesAppointmentPackage } from '../shared/pdf/visit-details-pdf/types';
import { getVideoResources } from '../shared/pdf/visit-details-pdf/get-video-resources';
import { composeAndCreateVisitNotePdf } from '../shared/pdf/visit-details-pdf/visit-note-pdf-creation';
import { makeVisitNotePdfDocumentReference } from '../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, createCandidEncounter } from '../shared/candid';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mtoken, validatedParameters.secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, oystehrCurrentUser, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Stringified error: ' + JSON.stringify(error));
    console.error('Error: ' + error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error changing appointment status and creating a charge.' }),
    };
  }
};

export const performEffect = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  params: SignAppointmentInput
): Promise<SignAppointmentResponse> => {
  const { appointmentId, secrets } = params;

  const newStatus = 'completed';

  const visitResources = await getVideoResources(oystehr, appointmentId, true);

  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }
  const { encounter, patient, appointment, listResources } = visitResources;

  if (encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
  }

  const candidEncounterId = await createCandidEncounter(visitResources, secrets, oystehr);

  console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);
  const currentStatus = getVisitStatus(appointment, encounter);
  if (currentStatus) {
    await changeStatus(oystehr, oystehrCurrentUser, visitResources, newStatus, candidEncounterId);
  }
  console.debug(`Status has been changed.`);

  const isInPersonAppointment = !!visitResources.appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

  const chartDataPromise = getChartData(oystehr, visitResources.encounter.id!);
  const additionalChartDataPromise = getChartData(
    oystehr,
    visitResources.encounter.id!,
    isInPersonAppointment ? progressNoteChartDataRequestedFields : telemedProgressNoteChartDataRequestedFields
  );

  const [chartData, additionalChartData] = (await Promise.all([chartDataPromise, additionalChartDataPromise])).map(
    (promise) => promise.response
  );

  console.log('Chart data received');
  const pdfInfo = await composeAndCreateVisitNotePdf(
    { chartData, additionalChartData },
    visitResources,
    secrets,
    m2mtoken
  );
  if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
  console.log(`Creating visit note pdf docRef`);
  await makeVisitNotePdfDocumentReference(oystehr, pdfInfo, patient.id, appointmentId, encounter.id!, listResources);

  return {
    message: 'Appointment status successfully changed.',
  };
};

const changeStatus = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  resourcesToUpdate: VideoResourcesAppointmentPackage,
  status: VisitStatusLabel,
  candidEncounterId: string | undefined
): Promise<void> => {
  if (!resourcesToUpdate.appointment || !resourcesToUpdate.appointment.id) {
    throw new Error('Appointment is not defined');
  }
  if (!resourcesToUpdate.encounter || !resourcesToUpdate.encounter.id) {
    throw new Error('Encounter is not defined');
  }

  const appointmentStatus = visitStatusToFhirAppointmentStatusMap[status];
  const encounterStatus = visitStatusToFhirEncounterStatusMap[status];

  const patchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: appointmentStatus,
    },
  ];

  const user = await oystehrCurrentUser.user.me();

  const updateTag = getCriticalUpdateTagOp(
    resourcesToUpdate.appointment,
    `Staff ${user?.email ? user.email : `(${user?.id})`}`
  );
  patchOps.push(updateTag);

  const encounterPatchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: encounterStatus,
    },
  ];

  if (candidEncounterId != null) {
    const identifier = {
      system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
      value: candidEncounterId,
    };
    encounterPatchOps.push({
      op: 'add',
      path: resourcesToUpdate.encounter.identifier != null ? '/identifier/-' : '/identifier',
      value: resourcesToUpdate.encounter.identifier != null ? identifier : [identifier],
    });
  }

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(
    resourcesToUpdate.encounter,
    encounterStatus
  );
  encounterPatchOps.push(encounterStatusHistoryUpdate);

  const appointmentPatch = getPatchBinary({
    resourceType: 'Appointment',
    resourceId: resourcesToUpdate.appointment.id,
    patchOperations: patchOps,
  });
  const encounterPatch = getPatchBinary({
    resourceType: 'Encounter',
    resourceId: resourcesToUpdate.encounter.id,
    patchOperations: encounterPatchOps,
  });

  await oystehr.fhir.transaction({
    requests: [appointmentPatch, encounterPatch],
  });
};
