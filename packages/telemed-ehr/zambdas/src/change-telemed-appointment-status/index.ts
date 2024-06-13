import { AppClient, FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { ChargeItem } from 'fhir/r4';
import {
  ChangeTelemedAppointmentStatusInput,
  ChangeTelemedAppointmentStatusResponse,
  ApptStatus,
  mapStatusToTelemed,
} from 'ehr-utils';
import { SecretsKeys, getSecret } from '../shared';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { getVideoResources } from './helpers/fhir-utils';
import { changeStatusIfPossible } from './helpers/helpers';
import { postChargeIssueRequest } from './helpers/payments';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);

    const fhirClient = createFhirClient(m2mtoken, validatedParameters.secrets);
    const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), validatedParameters.secrets);
    console.log('Created zapToken and fhir client');

    const response = await performEffect(fhirClient, appClient, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error(JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error changing appointment status and creating a charge.' }),
    };
  }
};

export const performEffect = async (
  fhirClient: FhirClient,
  appClient: AppClient,
  params: ChangeTelemedAppointmentStatusInput,
): Promise<ChangeTelemedAppointmentStatusResponse> => {
  const { appointmentId, newStatus } = params;

  const visitResources = await getVideoResources(fhirClient, appointmentId);
  if (!visitResources) {
    {
      throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
    }
  }

  if (visitResources.encounter?.subject?.reference === undefined) {
    throw new Error(`No subject reference defined for encoutner ${visitResources.encounter?.id}`);
  }

  console.log(
    `appointment and encounter statuses: ${visitResources.appointment.status}, ${visitResources.encounter.status}`,
  );
  const currentStatus = mapStatusToTelemed(visitResources.encounter.status, visitResources.appointment.status);
  if (currentStatus) await changeStatusIfPossible(fhirClient, appClient, visitResources, currentStatus, newStatus);

  console.debug(`Status has been changed.`);

  // if we are changing from unsiged to complete only, check these things...
  if (newStatus === ApptStatus.complete && currentStatus === ApptStatus.unsigned) {
    console.debug(`Status change detected from ${currentStatus} to ${newStatus}`);

    if (visitResources.account?.id === undefined) {
      throw new Error(`No account has been found associated with the encouter ${visitResources.encounter?.id}`);
    }

    // see if charge item already exists for the encounter and if not, create it
    if (visitResources.chargeItem === undefined) {
      console.debug(`There is no existing charge item for encounter ${visitResources.encounter.id}, so creating one.`);

      const chargeItem = await fhirClient.createResource<ChargeItem>({
        resourceType: 'ChargeItem',
        status: 'billable',
        code: {
          coding: [
            {
              system: 'http://snomed.info/sct',
              code: '448337001',
              display: 'Telemedicine consultation with patient',
              userSelected: false,
            },
          ],
        },
        account: [{ reference: `Account/${visitResources.account?.id}` }],
        subject: {
          type: 'Patient',
          reference: visitResources.encounter.subject.reference,
        },
        context: {
          type: 'Encounter',
          reference: `Encounter/${visitResources.encounter.id}`,
        },
        priceOverride: {
          currency: 'USD',
          value: 100,
        },
        performingOrganization: {
          type: 'Organization',
          reference: `Organization/${getSecret(SecretsKeys.ORGANIZATION_ID, params.secrets)}`,
        },
      });
      if (chargeItem === undefined) {
        throw new Error(
          `Unable to create a charge item for appointment ${appointmentId}, encounter ${visitResources.encounter.id}`,
        );
      }
      console.log(`Charge item ${(chargeItem as ChargeItem).id} has been created.`);
    }

    // issue a call to payment service...
    const chargeOutcome = await postChargeIssueRequest(
      getSecret(SecretsKeys.PROJECT_API, params.secrets),
      m2mtoken,
      visitResources.encounter.id,
    );
    console.log(`Charge outcome: ${JSON.stringify(chargeOutcome)}`);
  }

  return { message: 'Appointment status successfully changed and charged issued.' };
};
