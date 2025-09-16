import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { FhirResource, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  extractExtensionValue,
  findExtensionIndex,
  getAddressStringForScheduleResource,
  getAppointmentMetaTagOpForStatusUpdate,
  getEncounterStatusHistoryUpdateOp,
  getPatchBinary,
  getPatientContactEmail,
  getProgressNoteChartDataRequestedFields,
  getVisitStatus,
  InPersonCompletionTemplateData,
  OTTEHR_MODULE,
  SignAppointmentInput,
  SignAppointmentResponse,
  TelemedCompletionTemplateData,
  telemedProgressNoteChartDataRequestedFields,
  visitStatusToFhirAppointmentStatusMap,
  visitStatusToFhirEncounterStatusMap,
} from 'utils';
import { getPresignedURLs } from '../../patient/appointment/get-visit-details/helpers';
import { checkOrCreateM2MClientToken, getEmailClient, makeAddressUrl, wrapHandler, ZambdaInput } from '../../shared';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, createEncounterFromAppointment } from '../../shared/candid';
import { createProvenanceForEncounter } from '../../shared/createProvenanceForEncounter';
import { createPublishExcuseNotesOps } from '../../shared/createPublishExcuseNotesOps';
import { createOystehrClient } from '../../shared/helpers';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { makeVisitNotePdfDocumentReference } from '../../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { FullAppointmentResourcePackage } from '../../shared/pdf/visit-details-pdf/types';
import { composeAndCreateVisitNotePdf } from '../../shared/pdf/visit-details-pdf/visit-note-pdf-creation';
import { getChartData } from '../get-chart-data';
import { getMedicationOrders } from '../get-medication-orders';
import { getImmunizationOrders } from '../immunization/get-orders';
import { getNameForOwner } from '../schedules/shared';
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
  const { appointmentId, timezone, secrets, supervisorApprovalEnabled } = params;

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
  const { encounter, patient, appointment, location, listResources } = visitResources;

  if (encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
  }
  if (!patient) {
    throw new Error(`No patient found for encounter ${encounter.id}`);
  }

  let candidEncounterId: string | undefined;
  try {
    console.log('[CLAIM SUBMISSION] Attempting to create encounter in candid...');
    candidEncounterId = await createEncounterFromAppointment(visitResources, secrets, oystehr);
  } catch (error) {
    console.error(`Error creating Candid encounter: ${error}, stringified error: ${JSON.stringify(error)}`);
    captureException(error, {
      tags: {
        appointmentId,
        encounterId: encounter.id,
      },
    });
  }
  console.log(`[CLAIM SUBMISSION] Candid encounter created with ID ${candidEncounterId}`);

  console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);
  const currentStatus = getVisitStatus(appointment, encounter);
  if (currentStatus) {
    await changeStatusToCompleted(
      oystehr,
      oystehrCurrentUser,
      visitResources,
      candidEncounterId,
      supervisorApprovalEnabled
    );
  }
  console.debug(`Status has been changed.`);

  const isInPersonAppointment = !!visitResources.appointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.IP);

  const chartDataPromise = getChartData(oystehr, m2mToken, visitResources.encounter.id!);
  const additionalChartDataPromise = getChartData(
    oystehr,
    m2mToken,
    visitResources.encounter.id!,
    isInPersonAppointment ? getProgressNoteChartDataRequestedFields() : telemedProgressNoteChartDataRequestedFields
  );
  const medicationOrdersPromise = getMedicationOrders(oystehr, {
    searchBy: {
      field: 'encounterId',
      value: visitResources.encounter.id!,
    },
  });

  const [chartData, additionalChartData] = (await Promise.all([chartDataPromise, additionalChartDataPromise])).map(
    (promise) => promise.response
  );
  const medicationOrders = (await medicationOrdersPromise).orders;
  const immunizationOrders = (
    await getImmunizationOrders(oystehr, {
      encounterId: visitResources.encounter.id!,
    })
  ).orders;

  console.log('Chart data received');
  try {
    const pdfInfo = await composeAndCreateVisitNotePdf(
      { chartData, additionalChartData, medicationOrders, immunizationOrders },
      visitResources,
      secrets,
      m2mToken
    );
    if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
    console.log(`Creating visit note pdf docRef`);
    await makeVisitNotePdfDocumentReference(oystehr, pdfInfo, patient.id, appointmentId, encounter.id!, listResources);
  } catch (error) {
    console.error(`Error creating visit note pdf: ${error}`);
    captureException(error, {
      tags: {
        appointmentId,
        encounterId: encounter.id,
      },
    });
  }

  try {
    // todo: decouple email sending from this endpoint
    const emailClient = getEmailClient(secrets);
    const emailEnabled = emailClient.getFeatureFlag();
    if (emailEnabled) {
      const patientEmail = getPatientContactEmail(patient);
      let prettyStartTime = '';
      let locationName = '';
      let address = '';
      if (appointment.start && visitResources.timezone) {
        prettyStartTime = DateTime.fromISO(appointment.start)
          .setZone(visitResources.timezone)
          .toFormat(DATETIME_FULL_NO_YEAR);
      }
      if (location) {
        locationName = getNameForOwner(location);
        address = getAddressStringForScheduleResource(location) ?? '';
      }
      const presignedUrls = await getPresignedURLs(oystehr, m2mToken, visitResources.encounter.id!);
      const visitNoteUrl = presignedUrls['visit-note'].presignedUrl;

      if (isInPersonAppointment) {
        const missingData: string[] = [];
        if (!patientEmail) missingData.push('patient email');
        if (!appointment.id) missingData.push('appointment ID');
        if (!locationName) missingData.push('location name');
        if (!address) missingData.push('address');
        if (!prettyStartTime) missingData.push('appointment time');
        if (!visitNoteUrl) missingData.push('visit note URL');
        if (missingData.length === 0 && location && visitNoteUrl && patientEmail) {
          // note: it's assumed that location is the schedule owner here, which is incorrect for Provider schedules
          const templateData: InPersonCompletionTemplateData = {
            location: getNameForOwner(location),
            time: prettyStartTime,
            address,
            'address-url': makeAddressUrl(address),
            'visit-note-url': visitNoteUrl,
          };
          await emailClient.sendInPersonCompletionEmail(patientEmail, templateData);
        } else {
          console.error(
            `Not sending in-person completion email, missing the following data: ${missingData.join(', ')}`
          );
        }
      } else {
        const missingData: string[] = [];
        if (!patientEmail) missingData.push('patient email');
        if (!appointment.id) missingData.push('appointment ID');
        if (!locationName) missingData.push('location name');
        if (!visitNoteUrl) missingData.push('visit note URL');
        if (missingData.length === 0 && location && visitNoteUrl && patientEmail) {
          const templateData: TelemedCompletionTemplateData = {
            location: getNameForOwner(location),
            'visit-note-url': visitNoteUrl,
          };
          await emailClient.sendVirtualCompletionEmail(patientEmail, templateData);
        } else {
          console.error(`Not sending virtual completion email, missing the following data: ${missingData.join(', ')}`);
        }
      }
    }
  } catch (error: any) {
    console.error('Error sending completion email:', error);
  }

  return {
    message: 'Appointment status successfully changed.',
  };
};

const changeStatusToCompleted = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  resourcesToUpdate: FullAppointmentResourcePackage,
  candidEncounterId: string | undefined,
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
