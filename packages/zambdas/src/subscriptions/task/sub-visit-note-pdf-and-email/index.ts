import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  FEATURE_FLAGS_CONFIG,
  getAddressStringForScheduleResource,
  getFullestAvailableName,
  getPatientContactEmail,
  isFollowupEncounter,
  OTTEHR_MODULE,
  progressNoteChartDataRequestedFields,
  removePrefix,
  Secrets,
  TASK_INPUT_TYPE_CODES,
  TASK_INPUT_TYPE_SYSTEM,
  telemedProgressNoteChartDataRequestedFields,
} from 'utils';
import { getChartData } from '../../../ehr/get-chart-data';
import { getMedicationOrders } from '../../../ehr/get-medication-orders';
import { getImmunizationOrders } from '../../../ehr/immunization/get-orders';
import { getNameForOwner } from '../../../ehr/schedules/shared';
import { performEffect as generateVisitDetailsPdf } from '../../../ehr/visit-details/visit-details-to-pdf';
import { getPresignedURLs } from '../../../patient/appointment/get-visit-details/helpers';
import {
  buildVisitNoteEmailTemplate,
  createClinicalOystehrClient,
  createOutboundDeliveryAttempt,
  failOutboundDeliveryAttempt,
  getAuth0Token,
  getEmailClient,
  sendVisitNoteEmailAttempt,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { fetchErxPharmacies } from '../../../shared/erx';
import { getEncounterSignatures } from '../../../shared/pdf/get-encounter-signatures';
import { getUpcomingFollowUps } from '../../../shared/pdf/get-upcoming-follow-ups';
import { createProgressNotePdf } from '../../../shared/pdf/progress-note-pdf';
import { getAppointmentAndRelatedResources } from '../../../shared/pdf/visit-details-pdf/get-video-resources';
import { makeVisitNotePdfDocumentReference } from '../../../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { patchTaskStatus } from '../../helpers';
import { validateRequestParameters } from '../validateRequestParameters';

export interface TaskSubscriptionInput {
  task: Task;
  secrets: Secrets | null;
}

let oystehrToken: string;
let oystehr: Oystehr;
let taskId: string | undefined;

const ZAMBDA_NAME = 'sub-visit-note-pdf-and-email';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { task, secrets } = validatedParameters;
    console.log('task ID', task.id);
    if (!task.id) {
      throw new Error('Task ID is required');
    }
    taskId = task.id;

    // SKIP_EMAIL is set only by the addendum re-generation path, so it means "re-generation,
    // not a fresh post-sign run" — gates both the completion email and the Visit Details PDF.
    const isRegeneration = resolveSkipEmail(task);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    oystehr = createClinicalOystehrClient(oystehrToken, secrets);

    console.log('getting appointment Id from the task');
    const appointmentId = removePrefix('Appointment/', task.focus?.reference ?? '');
    console.log('appointment ID parsed: ', appointmentId);

    if (!appointmentId) {
      console.log('no appointment ID found on task');
      throw new Error('no appointment ID found on task focus');
    }

    const visitResources = await getAppointmentAndRelatedResources(
      oystehr,
      appointmentId,
      true,
      removePrefix('Encounter/', task.encounter?.reference ?? '')
    );
    if (!visitResources) {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }

    const { encounter, patient, appointment, location, listResources } = visitResources;

    if (encounter?.subject?.reference === undefined) {
      throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
    }
    if (!patient) {
      throw new Error(`No patient found for encounter ${encounter.id}`);
    }

    const isInPersonAppointment = !!visitResources.appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

    // Follow-up visits get a differently-titled visit note and no completion email.
    const isFollowupTask = isFollowupEncounter(encounter);

    const chartDataPromise = getChartData(oystehr, oystehrToken, visitResources.encounter.id!);
    const additionalChartDataPromise = getChartData(
      oystehr,
      oystehrToken,
      visitResources.encounter.id!,
      isInPersonAppointment ? progressNoteChartDataRequestedFields : telemedProgressNoteChartDataRequestedFields
    );

    const medicationOrdersPromise = getMedicationOrders(oystehr, {
      searchBy: {
        field: 'encounterId',
        value: visitResources.encounter.id!,
      },
    });

    // Follow-ups hang off the top-level encounter, so resolve to the parent if this one is a follow-up.
    const followUpParentEncounterId = removePrefix('Encounter/', encounter.partOf?.reference ?? '') ?? encounter.id!;
    const upcomingFollowUpsPromise = getUpcomingFollowUps(
      oystehr,
      followUpParentEncounterId,
      visitResources.timezone,
      encounter.id
    );

    // Signature/approval lines for the bottom of the visit note. Supplementary, so a failure here
    // must not block PDF generation or the completion email.
    const signaturesPromise = getEncounterSignatures(oystehr, visitResources.encounter.id!).catch((error) => {
      console.error(`Failed to resolve encounter signatures for encounter ${visitResources.encounter.id}:`, error);
      return { signedBy: undefined, approvedBy: undefined };
    });

    const [chartDataResult, additionalChartDataResult, medicationOrdersData, upcomingFollowUps, signatures] =
      await Promise.all([
        chartDataPromise,
        additionalChartDataPromise,
        medicationOrdersPromise,
        upcomingFollowUpsPromise,
        signaturesPromise,
      ]);
    const immunizationOrders = (
      await getImmunizationOrders(oystehr, {
        encounterIds: [visitResources.encounter.id!],
      })
    ).orders;
    const chartData = chartDataResult.response;
    const additionalChartData = additionalChartDataResult.response;
    const medicationOrders = medicationOrdersData?.orders.filter((order) => order.status !== 'cancelled');

    console.log('Chart data received');

    try {
      // Check if we should skip making visit note visible in patient portal
      const skipVisitNoteInPatientPortal = FEATURE_FLAGS_CONFIG.skipSendingVisitNoteToPatientPortalEnabled;

      const erxPharmacies = await fetchErxPharmacies(oystehr, additionalChartData?.prescribedMedications);

      // Always create the PDF
      const { pdfInfo } = await createProgressNotePdf(
        {
          patient,
          encounter,
          allChartData: {
            chartData,
            additionalChartData,
            medicationOrders,
            immunizationOrders,
          },
          appointmentPackage: visitResources,
          questionnaireResponse: visitResources.questionnaireResponse,
          upcomingFollowUps,
          erxPharmacies,
          signatures,
        },
        secrets,
        oystehrToken
      );
      if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
      if (isFollowupTask) {
        pdfInfo.title = 'Patient Follow-up Note';
      }
      console.log(`Creating visit note pdf docRef`);
      const visitNoteDocument = await makeVisitNotePdfDocumentReference(
        oystehr,
        pdfInfo,
        patient.id,
        appointmentId,
        encounter.id!,
        listResources
      );

      // Also generate the Visit Details PDF at completion so a copy exists for the medical
      // record without a manual on-demand click. Failure here must not block the visit note.
      if (shouldGenerateVisitDetailsPdf(task)) {
        try {
          await generateVisitDetailsPdf(oystehr, appointmentId, secrets, oystehrToken, visitResources.timezone);
          console.log(`Visit details pdf created for appointment ${appointmentId}`);
        } catch (visitDetailsError) {
          console.error(`Failed to generate visit details PDF for appointment ${appointmentId}:`, visitDetailsError);
        }
      }

      // Email delivery is secondary to PDF creation. Every failure in email setup, URL generation, validation, or
      // provider delivery is contained here so the PDF task keeps its existing success semantics.
      let emailSent = false;
      if (!isFollowupTask && !isRegeneration) {
        try {
          const emailClient = skipVisitNoteInPatientPortal ? undefined : getEmailClient(secrets, oystehr);
          if (emailClient?.getFeatureFlag()) {
            const patientEmail = getPatientContactEmail(patient);
            const { presignedUrls } = await getPresignedURLs(oystehr, oystehrToken, visitResources.encounter.id!);
            const visitNoteUrl = presignedUrls['visit-note']?.presignedUrl;
            if (!patientEmail) throw new Error('Patient email is required');
            if (!visitNoteDocument.id) throw new Error('Visit note DocumentReference ID is required');
            const emailTemplate = buildVisitNoteEmailTemplate({
              isInPerson: isInPersonAppointment,
              locationName: location ? getNameForOwner(location) : undefined,
              visitNoteUrl,
              address: location ? getAddressStringForScheduleResource(location) : undefined,
              prettyStartTime:
                appointment.start && visitResources.timezone
                  ? DateTime.fromISO(appointment.start).setZone(visitResources.timezone).toFormat(DATETIME_FULL_NO_YEAR)
                  : undefined,
            });
            try {
              await sendVisitNoteEmailAttempt(
                {
                  ...emailTemplate,
                  oystehr,
                  secrets,
                  patientId: patient.id,
                  appointmentId,
                  recipientEmail: patientEmail,
                  recipientName: patient.name?.length ? getFullestAvailableName(patient) : undefined,
                  documentReferenceId: visitNoteDocument.id,
                },
                emailClient
              );
              emailSent = true;
            } catch (emailError) {
              console.error(`Failed to send completion email for appointment ${appointment.id}:`, emailError);
            }
          } else if (skipVisitNoteInPatientPortal) {
            console.log('Skipping completion email to patient - visit note patient portal feature flag is enabled');
          }
        } catch (emailPreparationError) {
          console.error(
            `Could not prepare visit note completion email for appointment ${appointment.id}:`,
            emailPreparationError
          );
          // Preparation failed before sendVisitNoteEmailAttempt could create its own attempt record
          // (e.g. email client init or presigned URL generation failed), so without this the failure
          // would be invisible in Action Logs and unretryable. Record it directly.
          try {
            const failedAttempt = await createOutboundDeliveryAttempt(oystehr, {
              channel: 'email',
              patientId: patient.id,
              appointmentId,
              recipientAddress: getPatientContactEmail(patient) ?? '',
              documentReferenceId: visitNoteDocument.id,
            });
            if (failedAttempt.id) {
              await failOutboundDeliveryAttempt(oystehr, failedAttempt.id, emailPreparationError);
            }
          } catch (recordError) {
            console.error(
              `Could not record the failed visit note email attempt for appointment ${appointment.id}:`,
              recordError
            );
          }
        }
      }

      const statusMessage = emailSent ? 'PDF created and emailed successfully' : 'PDF created successfully';

      // update task status and status reason
      console.log('making patch request to update task status');
      const patchedTask = await patchTaskStatus(
        {
          task: {
            id: task.id,
          },
          taskStatusToUpdate: 'completed',
          statusReasonToUpdate: statusMessage,
        },
        oystehr
      );

      const response = {
        taskStatus: patchedTask.status,
        statusReason: patchedTask.statusReason,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    } catch (error: unknown) {
      try {
        if (oystehr && taskId)
          await patchTaskStatus(
            {
              task: {
                id: taskId,
              },
              taskStatusToUpdate: 'failed',
              statusReasonToUpdate: JSON.stringify(error),
            },
            oystehr
          );
      } catch (patchError) {
        console.error('Error patching task status in top level catch:', patchError);
      }
      throw error;
    }
  } catch (error: unknown) {
    try {
      if (oystehr && taskId)
        await patchTaskStatus(
          {
            task: {
              id: taskId,
            },
            taskStatusToUpdate: 'failed',
            statusReasonToUpdate: JSON.stringify(error),
          },
          oystehr
        );
    } catch (patchError) {
      console.error('Error patching task status in top level catch:', patchError);
    }
    throw error;
  }
});

export function resolveSkipEmail(task: Task): boolean {
  return (
    task.input?.some(
      (taskInput) =>
        taskInput.type.coding?.some(
          (c) => c.system === TASK_INPUT_TYPE_SYSTEM && c.code === TASK_INPUT_TYPE_CODES.SKIP_EMAIL
        ) && taskInput.valueString === 'true'
    ) ?? false
  );
}

/**
 * Generate the Visit Details PDF on a fresh sign, but not on an addendum re-generation:
 * an addendum changes only the clinical note, none of the data the Visit Details PDF is built
 * from. The addendum path (getChartDataPostChangeTasks) is the only caller that sets the
 * SKIP_EMAIL input, so its presence identifies a re-generation run.
 */
export function shouldGenerateVisitDetailsPdf(task: Task): boolean {
  return !resolveSkipEmail(task);
}
