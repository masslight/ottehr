import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItem, Encounter, Task } from 'fhir/r4b';
import {
  ChangeTelemedAppointmentStatusInput,
  ChangeTelemedAppointmentStatusResponse,
  getPatientContactEmail,
  getQuestionnaireResponseByLinkId,
  getSecret,
  mapStatusToTelemed,
  SecretsKeys,
  TelemedAppointmentStatusEnum,
  TelemedCompletionTemplateData,
  telemedProgressNoteChartDataRequestedFields,
} from 'utils';
import { getPresignedURLs } from '../../patient/appointment/get-visit-details/helpers';
import {
  CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
  checkOrCreateM2MClientToken,
  createEncounterFromAppointment,
  createOystehrClient,
  getEmailClient,
  getMyPractitionerId,
  parseCreatedResourcesBundle,
  saveResourceRequest,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { getAppointmentAndRelatedResources } from '../../shared/pdf/visit-details-pdf/get-video-resources';
import { makeVisitNotePdfDocumentReference } from '../../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { composeAndCreateVisitNotePdf } from '../../shared/pdf/visit-details-pdf/visit-note-pdf-creation';
import { getChartData } from '../get-chart-data';
import { getNameForOwner } from '../schedules/shared';
import { getInsurancePlan } from './helpers/fhir-utils';
import { changeStatusIfPossible, makeAppointmentChargeItem, makeReceiptPdfDocumentReference } from './helpers/helpers';
import { composeAndCreateReceiptPdf, getPaymentDataRequest, postChargeIssueRequest } from './helpers/payments';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;
const ZAMBDA_NAME = 'change-telemed-appointment-status';

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
  params: ChangeTelemedAppointmentStatusInput
): Promise<ChangeTelemedAppointmentStatusResponse> => {
  const { appointmentId, newStatus, secrets } = params;

  const visitResources = await getAppointmentAndRelatedResources(oystehr, appointmentId);
  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }
  const { encounter, patient, account, chargeItem, questionnaireResponse, appointment, location, listResources } =
    visitResources;
  if (!patient) {
    throw new Error(`No patient has been found for appointment ${appointmentId}`);
  }
  const insuranceCompanyID = getQuestionnaireResponseByLinkId('insurance-carrier', questionnaireResponse)?.answer?.[0]
    .valueString;
  if (insuranceCompanyID) {
    visitResources.insurancePlan = await getInsurancePlan(oystehr, insuranceCompanyID);
  }
  console.log(
    `Checking different ids here. Account id: ${visitResources.account?.id}. Encounter id: ${encounter.id}. Patient id: ${patient?.id}. Charge item id: ${chargeItem?.id}. Account id: ${account?.id}`
  );
  const paymentOption =
    getQuestionnaireResponseByLinkId('payment-option', questionnaireResponse)?.answer?.[0]?.valueString || '';
  const selfPayVisit: boolean = paymentOption.toUpperCase() === 'self-pay'.toUpperCase();

  if (encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encounter ${encounter?.id}`);
  }

  console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);
  const currentStatus = mapStatusToTelemed(encounter.status, appointment.status);
  if (currentStatus) {
    const myPractitionerId = await getMyPractitionerId(oystehrCurrentUser);
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
    await changeStatusIfPossible(oystehr, visitResources, currentStatus, newStatus, myPractitionerId, ENVIRONMENT);
  }

  console.debug(`Status has been changed.`);

  // if we are changing from unsigned to complete only, check these things...
  if (newStatus === TelemedAppointmentStatusEnum.complete && currentStatus === TelemedAppointmentStatusEnum.unsigned) {
    const createResourcesRequests: BatchInputPostRequest<ChargeItem | Task>[] = [];
    console.debug(`Status change detected from ${currentStatus} to ${newStatus}`);

    const chartDataPromise = getChartData(oystehr, m2mToken, visitResources.encounter.id!);
    const additionalChartDataPromise = getChartData(
      oystehr,
      m2mToken,
      visitResources.encounter.id!,
      telemedProgressNoteChartDataRequestedFields
    );

    const [chartData, additionalChartData] = (await Promise.all([chartDataPromise, additionalChartDataPromise])).map(
      (promise) => promise.response
    );

    console.log('Chart data received');
    try {
      const pdfInfo = await composeAndCreateVisitNotePdf(
        { chartData, additionalChartData },
        visitResources,
        secrets,
        m2mToken
      );
      if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
      console.log(`Creating visit note pdf docRef`);
      await makeVisitNotePdfDocumentReference(
        oystehr,
        pdfInfo,
        patient.id,
        appointmentId,
        encounter.id!,
        listResources
      );
    } catch (error) {
      console.error(`Error creating visit note pdf: ${error}`);
      captureException(error, {
        tags: {
          appointmentId,
          encounterId: encounter.id,
        },
      });
    }

    let candidEncounterId: string | undefined;
    try {
      if (!secrets) throw new Error('Secrets are not defined, cannot create Candid encounter.');
      console.log('[CLAIM SUBMISSION] Attempting to create telemed encounter in candid...');
      candidEncounterId = await createEncounterFromAppointment(visitResources, secrets, oystehr);
    } catch (error) {
      console.error(`Error creating Candid encounter: ${error}, stringified error: ${JSON.stringify(error)}`);
      captureException(error, {
        tags: {
          appointmentId,
          encounterId: encounter.id,
        },
      });
      // longer term we probably want a more decoupled approach where the candid synching is offloaded and tracked
      // for now prevent this failure from causing the endpoint to error out
    }
    console.log(`[CLAIM SUBMISSION] Candid telemed encounter created with ID ${candidEncounterId}`);
    await addCandidEncounterIdToEncounter(candidEncounterId, encounter, oystehr);

    // if this is a self-pay encounter, create a charge item
    if (selfPayVisit) {
      if (visitResources.account?.id === undefined) {
        // TODO: add sentry notification: something is misconfigured
        console.error(
          `No account has been found associated with the a self-pay visit for encounter ${visitResources.encounter?.id}`
        );
      }
      // see if charge item already exists for the encounter and if not, create it
      if (chargeItem === undefined) {
        console.debug(
          `There is no existing charge item for encounter ${visitResources.encounter.id}, so creating one.`
        );

        const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, params.secrets);
        createResourcesRequests.push(
          saveResourceRequest(makeAppointmentChargeItem(encounter, organizationId, account))
        );
      }
    }

    console.log('before creating resources');
    if (createResourcesRequests.length > 0) {
      const transactionBundle = await oystehr.fhir.transaction({
        requests: createResourcesRequests,
      });
      const resources = parseCreatedResourcesBundle(transactionBundle);
      console.log(`createdResources: ${JSON.stringify(resources)}`);

      if (selfPayVisit) {
        const newChargeItem = resources.find((res) => res.resourceType === 'ChargeItem');
        if (newChargeItem === undefined) {
          // TODO: add sentry notification: something is misconfigured, need a charge item for a charge to be made
          console.error(
            `Unable to create a charge item for appointment ${appointmentId}, encounter ${visitResources.encounter.id}`
          );
        } else {
          console.log(`Charge item ${newChargeItem.id} has been created.`);
        }
      }
    }

    // if this is a self-pay encounter, try to issue a call to payment service
    if (selfPayVisit) {
      try {
        const chargeOutcome = await postChargeIssueRequest(
          getSecret(SecretsKeys.PROJECT_API, params.secrets),
          m2mToken,
          visitResources.encounter.id
        );
        console.log(`Charge outcome: ${JSON.stringify(chargeOutcome)}`);

        const paymentInfo = await getPaymentDataRequest(
          getSecret(SecretsKeys.PROJECT_API, params.secrets),
          m2mToken,
          visitResources.encounter.id
        );

        const pdfInfo = await composeAndCreateReceiptPdf(paymentInfo, chartData, visitResources, secrets, m2mToken);
        if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);

        const resources = await makeReceiptPdfDocumentReference(
          oystehr,
          pdfInfo,
          patient.id,
          encounter.id!,
          listResources
        );
        console.log(`createdResources: ${JSON.stringify(resources)}`);
      } catch {
        console.error('Error issuing a charge for self-pay encounter.');
        captureException(Error, {
          tags: {
            appointmentId,
            encounterId: encounter.id,
          },
        });
      }
    }
    // todo: decouple email sending from this endpoint
    const emailClient = getEmailClient(secrets);
    const emailEnabled = emailClient.getFeatureFlag();
    const patientEmail = getPatientContactEmail(patient);
    if (emailEnabled && location && patientEmail) {
      const locationName = getNameForOwner(location) ?? '';
      const presignedUrls = await getPresignedURLs(oystehr, m2mToken, visitResources.encounter.id!);
      const visitNoteUrl = presignedUrls['visit-note'].presignedUrl;

      const templateData: TelemedCompletionTemplateData = {
        location: locationName,
        'visit-note-url': visitNoteUrl || '',
      };
      await emailClient.sendVirtualCompletionEmail(patientEmail, templateData);
    }
  }
  return {
    message: selfPayVisit
      ? 'Appointment status successfully changed and appropriate charged issued.'
      : 'Appointment status successfully changed.',
  };
};

const addCandidEncounterIdToEncounter = async (
  candidEncounterId: string | undefined,
  encounter: Encounter,
  oystehr: Oystehr
): Promise<void> => {
  const encounterId = encounter.id;
  if (candidEncounterId == null || encounterId == null) {
    return;
  }
  const identifier = {
    system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM,
    value: candidEncounterId,
  };
  await oystehr.fhir.patch({
    resourceType: 'Encounter',
    id: encounterId,
    operations: [
      {
        op: 'add',
        path: encounter.identifier != null ? '/identifier/-' : '/identifier',
        value: encounter.identifier != null ? identifier : [identifier],
      },
    ],
  });
};
