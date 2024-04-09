import { FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter } from 'fhir/r4';
import { InitTelemedSessionResponse, PUBLIC_EXTENSION_BASE_URL } from 'ehr-utils';
import { SecretsKeys, getAuth0Token, getSecret } from '../shared';
import { createAppClient, createFhirClient, getVideoRoomResourceExtension } from '../shared/helpers';
import { CreateTelemedVideoRoomResponse } from '../shared/types/telemed/video-room.types';
import { Secrets, ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import { createVideoRoom } from './video-room-creation';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { appointmentId, secrets, userId } = validateRequestParameters(input);

    console.log('Getting token');
    const token = await getAuth0Token(secrets);
    console.log('token', token);

    const fhirClient = createFhirClient(token, secrets);

    console.log(`Getting appointment ${appointmentId}`);
    const { appointment, encounters } = await getAppointmentWithEncounters({ appointmentId, fhirClient });

    const videoEncounter = encounters.find((enc) => Boolean(getVideoRoomResourceExtension(enc)));
    if (!videoEncounter) {
      throw new Error(`Appointment ${appointmentId} doesn't have virtual video encounter`);
    }
    const appClient = createAppClient(token, secrets);
    console.log(`Creating video room`);
    const encounterResource = await createVideoRoom(
      appointment,
      videoEncounter,
      fhirClient,
      userId,
      secrets,
      appClient,
    );
    console.log(`Encounter for video room id: ${encounterResource.id}`);

    console.log(`Getting video room token`);
    const userToken: string = input.headers.Authorization.replace('Bearer ', '');
    const videoToken = await execGetVideoRoomTokenRequest(secrets, encounterResource.id, userToken);
    console.log(`Video room token received: ${videoToken}. Sending response to client`);

    const output: InitTelemedSessionResponse = {
      videoToken,
      videoRoomId: getVideoRoomIdFromEncounter(encounterResource),
      encounterId: encounterResource.id!,
    };
    return {
      body: JSON.stringify(output),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error initiating video room for appointment' }),
      statusCode: 500,
    };
  }
};

async function getAppointmentWithEncounters({
  fhirClient: fhirClient,
  appointmentId,
}: {
  appointmentId: Appointment['id'];
  fhirClient: FhirClient;
}): Promise<{ appointment: Appointment; encounters: Encounter[] }> {
  const resources = await fhirClient.searchResources({
    resourceType: 'Appointment',
    searchParams: [
      {
        name: '_id',
        value: appointmentId || '',
      },
      {
        name: '_revinclude',
        value: 'Encounter:appointment',
      },
    ],
  });

  const fhirAppointment = resources.find((res) => res.resourceType === 'Appointment') as Appointment;

  const encounters = resources.filter(
    (resourceTemp) =>
      resourceTemp.resourceType === 'Encounter' &&
      (resourceTemp as Encounter).appointment?.[0].reference === `Appointment/${fhirAppointment.id}`,
  ) as Encounter[];
  return { appointment: fhirAppointment, encounters };
}

const getVideoRoomIdFromEncounter = (encounter: CreateTelemedVideoRoomResponse['encounter']): string => {
  for (let index = 0; index < encounter.extension?.length; index++) {
    const extension = encounter.extension[index];
    if (extension.url !== `${PUBLIC_EXTENSION_BASE_URL}/encounter-virtual-service-pre-release`) {
      continue;
    }
    let currentExtensionWithVideoRoom = false;

    for (let j = 0; j < extension?.extension?.length; j++) {
      const internalExtension = extension.extension[j];

      if (
        !currentExtensionWithVideoRoom &&
        internalExtension.url === 'channelType' &&
        internalExtension.valueCoding?.code === 'twilio-video-group-rooms'
      ) {
        currentExtensionWithVideoRoom = true;
      } else if (currentExtensionWithVideoRoom && internalExtension.url === 'addressString') {
        return internalExtension.valueString;
      }
    }
  }
  throw new Error(`Video room Id not found on telemed video encounter: ${JSON.stringify(encounter.extension)}`);
};

const execGetVideoRoomTokenRequest = async (
  secrets: Secrets | null,
  encounterId: Encounter['id'],
  userToken: string,
): Promise<string> => {
  /** HINT: for this request to work - user should have the role with access policy rules as described in
   * https://docs.zapehr.com/reference/get_telemed-token
   * Also user should be listed in Encounter.participants prop or other-participants extension
   * */
  const response = await fetch(
    `${getSecret(SecretsKeys.PROJECT_API, secrets)}/telemed/token?encounterId=${encounterId}`,
    {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
      method: 'GET',
    },
  );
  if (!response.ok) {
    throw new Error(`Getting telemed token call failed: ${response.statusText}`);
  }

  const responseData = await response.json();
  return responseData.token;
};
