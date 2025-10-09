import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { FhirResource, Provenance } from 'fhir/r4b';
import {
  extractExtensionValue,
  findExtensionIndex,
  getAppointmentLockMetaTagOperations,
  getAppointmentMetaTagOpForStatusUpdate,
  getEncounterStatusHistoryUpdateOp,
  getInPersonVisitStatus,
  getPatchBinary,
  getTaskResource,
  SignAppointmentInput,
  SignAppointmentResponse,
  TaskIndicator,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createProvenanceForEncounter } from '../../shared/createProvenanceForEncounter';
import { createPublishExcuseNotesOps } from '../../shared/createPublishExcuseNotesOps';
import { createOystehrClient } from '../../shared/helpers';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { FullAppointmentResourcePackage } from '../../shared/pdf/visit-details-pdf/types';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'sign-appointment';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
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
});

export const performEffect = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  params: SignAppointmentInput
): Promise<SignAppointmentResponse> => {
  const { appointmentId, timezone, supervisorApprovalEnabled } = params;

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true);
  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }
  if (timezone) {
    // if the timezone is provided, it will be taken as the tz to use here rather than the location's schedule
    // this allows the provider to specify their working location in the case of virtual encounters
    visitResources.timezone = timezone;
  }
  const { encounter, patient, appointment } = visitResources;

  if (encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
  }
  if (!patient) {
    throw new Error(`No patient found for encounter ${encounter.id}`);
  }

  console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);
  const currentStatus = getInPersonVisitStatus(appointment, encounter);
  if (currentStatus) {
    await changeStatusToCompleted(oystehr, oystehrCurrentUser, visitResources, supervisorApprovalEnabled);
  }
  console.debug(`Status has been changed.`);

  if (appointment.id === undefined) {
    throw new Error('Appointment ID is not defined');
  }

  // Create Task that will kick off subscription to send the claim
  const sendClaimTaskResource = getTaskResource(TaskIndicator.sendClaim, appointment.id);
  const sendClaimTaskPromise = oystehr.fhir.create(sendClaimTaskResource);

  // Create Task that will kick off subscription to create visit-note PDF and send an email to the patient
  const visitNoteAndEmailTaskResource = getTaskResource(TaskIndicator.visitNotePDFAndEmail, appointment.id);
  const visitNoteTaskPromise = oystehr.fhir.create(visitNoteAndEmailTaskResource);

  const taskCreationResults = await Promise.all([sendClaimTaskPromise, visitNoteTaskPromise]);
  console.log('Task creation results ', taskCreationResults);

  return {
    message: 'Appointment status successfully changed.',
  };
};

const changeStatusToCompleted = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  resourcesToUpdate: FullAppointmentResourcePackage,
  supervisorApprovalEnabled?: boolean
): Promise<void> => {
  if (!resourcesToUpdate.appointment || !resourcesToUpdate.appointment.id) {
    throw new Error('Appointment is not defined');
  }
  if (!resourcesToUpdate.encounter || !resourcesToUpdate.encounter.id) {
    throw new Error('Encounter is not defined');
  }

  const appointmentStatus = visitStatusToFhirAppointmentStatusMap['completed'];
  const encounterStatus = visitStatusToFhirEncounterStatusMap['completed'];

  const patchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: appointmentStatus,
    },
  ];

  const user = await oystehrCurrentUser.user.me();

  patchOps.push(...getAppointmentMetaTagOpForStatusUpdate(resourcesToUpdate.appointment, 'completed', { user }));

  // Add locked meta tag when appointment is signed/completed
  patchOps.push(...getAppointmentLockMetaTagOperations(resourcesToUpdate.appointment, true));

  const encounterPatchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: encounterStatus,
    },
  ];

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(
    resourcesToUpdate.encounter,
    encounterStatus
  );
  encounterPatchOps.push(encounterStatusHistoryUpdate);

  let provenanceCreate: BatchInputRequest<Provenance> | undefined;

  if (supervisorApprovalEnabled) {
    const extensionIndex = findExtensionIndex(
      resourcesToUpdate.encounter.extension || [],
      'awaiting-supervisor-approval'
    );

    if (extensionIndex != null && extensionIndex >= 0) {
      const awaitingSupervisorApproval = extractExtensionValue(resourcesToUpdate.encounter.extension?.[extensionIndex]);
      if (awaitingSupervisorApproval) {
        encounterPatchOps.push({
          op: 'replace',
          path: `/extension/${extensionIndex}/valueBoolean`,
          value: false,
        });
        provenanceCreate = {
          method: 'POST',
          url: '/Provenance',
          resource: createProvenanceForEncounter(
            resourcesToUpdate.encounter.id,
            user.profile.split('/')[1],
            'verifier'
          ),
        };
      }
    }
  }

  const documentPatch = createPublishExcuseNotesOps(resourcesToUpdate?.documentReferences ?? []);

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
    requests: [
      appointmentPatch,
      encounterPatch,
      ...(provenanceCreate ? [provenanceCreate] : []),
      ...documentPatch,
    ] as BatchInputRequest<FhirResource>[],
  });
};
