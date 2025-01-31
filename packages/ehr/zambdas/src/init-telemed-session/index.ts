import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter } from 'fhir/r4b';
import { InitTelemedSessionResponse, MeetingData } from 'utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { checkOrCreateM2MClientToken, createOystehrClient, getVideoRoomResourceExtension } from '../shared/helpers';
import { ZambdaInput } from 'zambda-utils';
import { validateRequestParameters } from './validateRequestParameters';
import { createVideoRoom } from './video-room-creation';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    console.log('Validating input');
    const { appointmentId, secrets } = validateRequestParameters(input);

    console.log('Getting token');
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    console.log('token', m2mtoken);

    const oystehr = createOystehrClient(m2mtoken, secrets);

    console.log(`Getting appointment ${appointmentId}`);
    const { appointment, encounters } = await getAppointmentWithEncounters({ appointmentId, oystehr });

    const videoEncounter = encounters.find((enc) => Boolean(getVideoRoomResourceExtension(enc)));
    if (!videoEncounter) {
      throw new Error(`Appointment ${appointmentId} doesn't have virtual video encounter`);
    }
    console.log(`Creating video room`);
    const encounterResource = await createVideoRoom(appointment, videoEncounter, oystehr, secrets);
    console.log(`Encounter for video room id: ${encounterResource.id}`);

    console.log(`Getting video room token`);
    const userToken: string = input.headers.Authorization.replace('Bearer ', '');
    const meetingData = await execJoinVideoRoomRequest(secrets, encounterResource.id, userToken);
    console.log(`Video room token received: ${meetingData}. Sending response to client`);

    const output: InitTelemedSessionResponse = {
      meetingData,
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
  oystehr,
  appointmentId,
}: {
  appointmentId: Appointment['id'];
  oystehr: Oystehr;
}): Promise<{ appointment: Appointment; encounters: Encounter[] }> {
  const resources = (
    await oystehr.fhir.search<Appointment | Encounter>({
      resourceType: 'Appointment',
      params: [
        {
          name: '_id',
          value: appointmentId || '',
        },
        {
          name: '_revinclude',
          value: 'Encounter:appointment',
        },
      ],
    })
  ).unbundle();

  const fhirAppointment = resources.find((res) => res.resourceType === 'Appointment') as Appointment;

  const encounters = resources.filter(
    (resourceTemp) =>
      resourceTemp.resourceType === 'Encounter' &&
      (resourceTemp as Encounter).appointment?.[0].reference === `Appointment/${fhirAppointment.id}`
  ) as Encounter[];
  return { appointment: fhirAppointment, encounters };
}

const execJoinVideoRoomRequest = async (
  secrets: Secrets | null,
  encounterId: Encounter['id'],
  userToken: string
): Promise<MeetingData> => {
  /** HINT: for this request to work - user should have the role with access policy rules as described in
   * https://docs.zapehr.com/reference/get_telemed-token
   * Also user should be listed in Encounter.participants prop or other-participants extension
   * */
  const response = await fetch(
    `${getSecret(SecretsKeys.PROJECT_API, secrets)}/telemed/v2/meeting/${encounterId}/join`,
    {
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
      method: 'GET',
    }
  );
  if (!response.ok) {
    throw new Error(`Getting telemed token call failed: ${response.statusText}`);
  }

  const responseData = (await response.json()) as MeetingData;
  return responseData;
};
