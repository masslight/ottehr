import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItem, Encounter, Task } from 'fhir/r4b';
import {
  ChangeTelemedAppointmentStatusInput,
  ChangeTelemedAppointmentStatusResponse,
  TelemedAppointmentStatusEnum,
  getQuestionnaireResponseByLinkId,
  mapStatusToTelemed,
} from 'utils';
import { SecretsKeys, getSecret } from 'zambda-utils';

import { ZambdaInput } from 'zambda-utils';
import { getChartData } from '../get-chart-data';
import { parseCreatedResourcesBundle, saveResourceRequest } from '../shared';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, createCandidEncounter } from '../shared/candid';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { getVideoResources } from '../shared/pdf/visit-details-pdf/get-video-resources';
import { makeVisitNotePdfDocumentReference } from '../shared/pdf/visit-details-pdf/make-visit-note-pdf-document-reference';
import { composeAndCreateVisitNotePdf } from '../shared/pdf/visit-details-pdf/visit-note-pdf-creation';
import { getMyPractitionerId } from '../shared/practitioners';
import { getInsurancePlan } from './helpers/fhir-utils';
import { changeStatusIfPossible, makeAppointmentChargeItem, makeReceiptPdfDocumentReference } from './helpers/helpers';
import { composeAndCreateReceiptPdf, getPaymentDataRequest, postChargeIssueRequest } from './helpers/payments';
import { validateRequestParameters } from './validateRequestParameters';

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
  params: ChangeTelemedAppointmentStatusInput
): Promise<ChangeTelemedAppointmentStatusResponse> => {
  const { appointmentId, newStatus, secrets } = params;

  const visitResources = await getVideoResources(oystehr, appointmentId);
  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }
  const { encounter, patient, account, chargeItem, questionnaireResponse, appointment, listResources } = visitResources;
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
    throw new Error(`No subject reference defined for encoutner ${encounter?.id}`);
  }

  console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);
  const currentStatus = mapStatusToTelemed(encounter.status, appointment.status);
  if (currentStatus) {
    const myPractId = await getMyPractitionerId(oystehrCurrentUser);
    await changeStatusIfPossible(oystehr, visitResources, currentStatus, newStatus, myPractId);
  }

  console.debug(`Status has been changed.`);

  // if we are changing from unsigned to complete only, check these things...
  if (newStatus === TelemedAppointmentStatusEnum.complete && currentStatus === TelemedAppointmentStatusEnum.unsigned) {
    const createResourcesRequests: BatchInputPostRequest<ChargeItem | Task>[] = [];
    console.debug(`Status change detected from ${currentStatus} to ${newStatus}`);

    const chartData = (await getChartData(oystehr, visitResources.encounter.id!)).response;
    console.log('Chart data received');
    const pdfInfo = await composeAndCreateVisitNotePdf({ chartData }, visitResources, secrets, m2mtoken);
    if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);
    console.log(`Creating visit note pdf docRef`);
    await makeVisitNotePdfDocumentReference(oystehr, pdfInfo, patient.id, appointmentId, encounter.id!, listResources);

    const candidEncounterId = await createCandidEncounter(visitResources, secrets, oystehr);
    await addCandidEncounterIdToEncounter(candidEncounterId, encounter, oystehr);

    // if this is a self-pay encounter, create a charge item
    if (selfPayVisit) {
      if (visitResources.account?.id === undefined) {
        // TODO: add sentry notification: something is misconfigured
        console.error(
          `No account has been found associated with the a self-pay visit for encouter ${visitResources.encounter?.id}`
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
          m2mtoken,
          visitResources.encounter.id
        );
        console.log(`Charge outcome: ${JSON.stringify(chargeOutcome)}`);

        const paymentInfo = await getPaymentDataRequest(
          getSecret(SecretsKeys.PROJECT_API, params.secrets),
          m2mtoken,
          visitResources.encounter.id
        );

        const pdfInfo = await composeAndCreateReceiptPdf(paymentInfo, chartData, visitResources, secrets, m2mtoken);
        if (!patient?.id) throw new Error(`No patient has been found for encounter: ${encounter.id}`);

        const resources = await makeReceiptPdfDocumentReference(
          oystehr,
          pdfInfo,
          patient.id,
          encounter.id!,
          listResources
        );
        console.log(`createdResources: ${JSON.stringify(resources)}`);
      } catch (error) {
        console.error('Error issuing a charge for self-pay encounter.');
        // TODO: add sentry notification: we had an issue posting a charge
      }
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
