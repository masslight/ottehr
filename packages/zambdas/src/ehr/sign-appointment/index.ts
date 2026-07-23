import Oystehr, { BatchInputRequest, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { FhirResource, Provenance, Task } from 'fhir/r4b';
import {
  extractExtensionValue,
  findExtensionIndex,
  getAppointmentLockMetaTagOperations,
  getAppointmentMetaTagOpForStatusUpdate,
  getEncounterLockMetaTagOperations,
  getEncounterStatusHistoryUpdateOp,
  getFullestAvailableName,
  getInPersonVisitStatus,
  getPatchBinary,
  getSkipEmailTaskInput,
  getTaskResource,
  isAnnotationFollowupEncounter,
  SignAppointmentInput,
  SignAppointmentResponse,
  TaskIndicator,
  userMe,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  getMyPractitionerId,
  requirePractitionerNPI,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { createProvenanceForEncounter } from '../../shared/createProvenanceForEncounter';
import { createPublishExcuseNotesOps } from '../../shared/createPublishExcuseNotesOps';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { FullAppointmentResourcePackage } from '../../shared/pdf/visit-details-pdf/types';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

const ZAMBDA_NAME = 'sign-appointment';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  console.log('Created Oystehr client');

  const response = await performEffect(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const performEffect = async (
  oystehr: Oystehr,
  params: SignAppointmentInput & {
    userToken: string;
  }
): Promise<SignAppointmentResponse> => {
  const { appointmentId, encounterId, timezone, supervisorApprovalEnabled, userToken, secrets } = params;

  // Signing / co-signing a note is an NPI-gated action. Block callers whose Practitioner has no NPI
  // (e.g. the Clinician role) — this also stops the downstream claim submission the sign kicks off.
  await requirePractitionerNPI(oystehr, await getMyPractitionerId(userToken, secrets));

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId, true, encounterId);
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
  const isFollowup = isAnnotationFollowupEncounter(encounter);

  if (encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
  }
  if (!patient) {
    throw new Error(`No patient found for encounter ${encounter.id}`);
  }

  console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);
  const currentStatus = getInPersonVisitStatus(appointment, encounter);

  if (isFollowup) {
    // For follow-up encounters: only update encounter status and create PDF (no appointment updates, no email)
    if (currentStatus) {
      const userId = await getMyPractitionerId(userToken, secrets);
      await changeFollowupEncounterStatusToCompleted(oystehr, userId, visitResources, supervisorApprovalEnabled);
    }
    console.debug(`Follow-up encounter status has been changed.`);

    if (appointment.id === undefined) {
      throw new Error('Appointment ID is not defined');
    }
    const patientName = getFullestAvailableName(patient);

    const followupPDFTaskResource = getTaskResource(
      TaskIndicator.visitNotePDFAndEmail,
      `Create follow-up visit note for ${patientName}`,
      appointment.id,
      encounterId
    );
    const visitNoteTaskPromise = oystehr.fhir.create(followupPDFTaskResource);

    const taskCreationResults = await Promise.all([visitNoteTaskPromise]);
    console.log('Follow-up task creation results ', taskCreationResults);
  } else {
    // For regular encounters: keep existing behavior
    if (currentStatus) {
      const user = await userMe(userToken, secrets);
      await changeStatusToCompleted(oystehr, user, visitResources, supervisorApprovalEnabled);
    }
    console.debug(`Status has been changed.`);

    if (appointment.id === undefined) {
      throw new Error('Appointment ID is not defined');
    }
    const appointmentId = appointment.id;

    const patientName = getFullestAvailableName(patient);

    const tasks: Promise<Task>[] = [];
    // Create Task that will kick off subscription to send the claim
    const sendClaimTaskResource = getTaskResource(
      TaskIndicator.sendClaim,
      `Send claim to ${patientName}`,
      appointmentId
    );
    tasks.push(oystehr.fhir.create(sendClaimTaskResource));

    // Determine whether this sign call is a supervisor approving a visit that was pending approval.
    // The encounter was read before the status patch above, so the `awaiting-supervisor-approval`
    // extension is still `true` here in that case.
    let isSupervisorApproval = false;
    if (supervisorApprovalEnabled) {
      const extensionIndex = findExtensionIndex(
        visitResources.encounter.extension || [],
        'awaiting-supervisor-approval'
      );

      if (extensionIndex != null && extensionIndex >= 0) {
        isSupervisorApproval = !!extractExtensionValue(visitResources.encounter.extension?.[extensionIndex]);
      }
    }

    // Create the Task that kicks off the visit-note PDF (and, unless suppressed, patient email)
    // subscription. See getVisitNoteTask for why supervisor approval regenerates the PDF but skips
    // the email.
    tasks.push(oystehr.fhir.create(getVisitNoteTask(patientName, appointmentId, isSupervisorApproval)));

    const taskCreationResults = await Promise.all(tasks);
    console.log('Task creation results ', taskCreationResults);
  }

  return {
    message: 'Appointment status successfully changed.',
  };
};

/**
 * Builds the Task that triggers the visit-note PDF + patient-email subscription.
 *
 * On supervisor approval the PDF + email were already produced at provider-sign time; we still
 * regenerate the PDF so the verifier's "Approved by ..." Provenance line appears, but attach a
 * SKIP_EMAIL input so the patient is not notified a second time.
 */
export function getVisitNoteTask(
  patientName: string | undefined,
  appointmentId: string,
  isSupervisorApproval: boolean
): Task {
  const task = getTaskResource(
    TaskIndicator.visitNotePDFAndEmail,
    isSupervisorApproval ? `Regenerate visit note for ${patientName}` : `Create visit note for ${patientName}`,
    appointmentId
  );
  if (isSupervisorApproval) {
    task.input = [getSkipEmailTaskInput()];
  }
  return task;
}

const changeFollowupEncounterStatusToCompleted = async (
  oystehr: Oystehr,
  userId: string,
  resourcesToUpdate: FullAppointmentResourcePackage,
  supervisorApprovalEnabled?: boolean
): Promise<void> => {
  if (!resourcesToUpdate.encounter || !resourcesToUpdate.encounter.id) {
    throw new Error('Encounter is not defined');
  }

  const encounterStatus = visitStatusToFhirEncounterStatusMap['completed'];

  const encounterPatchOps: Operation[] = [
    {
      op: 'replace',
      path: '/status',
      value: encounterStatus,
    },
  ];

  const encounterStatusHistoryUpdate: Operation = getEncounterStatusHistoryUpdateOp(
    resourcesToUpdate.encounter,
    encounterStatus,
    'completed'
  );
  encounterPatchOps.push(encounterStatusHistoryUpdate);
  encounterPatchOps.push(...getEncounterLockMetaTagOperations(resourcesToUpdate.encounter, true));

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
          resource: createProvenanceForEncounter(resourcesToUpdate.encounter.id, userId, 'verifier'),
        };
      }
    }
  }

  const documentPatch = createPublishExcuseNotesOps(
    resourcesToUpdate?.documentReferences ?? [],
    resourcesToUpdate.encounter.id
  );

  const encounterPatch = getPatchBinary({
    resourceType: 'Encounter',
    resourceId: resourcesToUpdate.encounter.id,
    patchOperations: encounterPatchOps,
  });

  await oystehr.fhir.transaction({
    requests: [
      encounterPatch,
      ...(provenanceCreate ? [provenanceCreate] : []),
      ...documentPatch,
    ] as BatchInputRequest<FhirResource>[],
  });
};

const changeStatusToCompleted = async (
  oystehr: Oystehr,
  user: User,
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
    encounterStatus,
    'completed'
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

  const documentPatch = createPublishExcuseNotesOps(
    resourcesToUpdate?.documentReferences ?? [],
    resourcesToUpdate.encounter.id
  );

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
