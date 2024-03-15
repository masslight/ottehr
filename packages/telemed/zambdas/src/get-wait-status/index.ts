import { FhirClient, User } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  FHIR_EXTENSION,
  PUBLIC_EXTENSION_BASE_URL,
  SecretsKeys,
  WaitingRoomResponse,
  ZambdaInput,
  createFhirClient,
  getAppointmentResourceById,
  getSecret,
  getVirtualServiceResourceExtension,
} from 'ottehr-utils';
import { getM2MClientToken } from '../shared';
import { estimatedTimeStatesGroups } from '../shared/appointment/constants';
import { getUser } from '../shared/auth';
import { getVideoEncounterForAppointment } from '../shared/encounters';
import { convertStatesAbbreviationsToLocationIds, getAllAppointmentsByLocations } from './utils/fhir';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, secrets, authorization } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // for now, require patient to log in
    if (!authorization) {
      console.log('User is not authenticated yet');
      // TODO: not sure what to do with yet
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    console.log('getting user');
    const user = await getUser(authorization.replace('Bearer ', ''), secrets);
    console.log(`user: ${user.name}`);

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getM2MClientToken(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
      // TODO: wonder if we need to check if it's expired at some point?
    }

    const fhirClient = createFhirClient(zapehrToken, getSecret(SecretsKeys.FHIR_API, secrets));

    let appointment: Appointment | undefined = undefined;
    // let location: Location | undefined = undefined;

    // only prebooked appointments will have an appointment id
    console.log(`getting appointment resource for id ${appointmentID}`);
    appointment = await getAppointmentResourceById(appointmentID, fhirClient);
    if (!appointment) {
      console.log('Appointment is not found');
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Appointment is not found' }),
      };
    }

    let videoEncounter: Encounter | undefined = undefined;
    videoEncounter = await getVideoEncounterForAppointment(appointment.id || 'Unknown', fhirClient);
    const estimatedTime = await calculateEstimatedTime(fhirClient, appointment);

    console.log('building get waiting room status response');
    const defaultResponse: WaitingRoomResponse = {
      status: 'not_started',
      estimatedTime: estimatedTime,
    };

    if (
      !videoEncounter ||
      videoEncounter.status !== 'in-progress' ||
      !getVirtualServiceResourceExtension(videoEncounter, 'twilio-video-group-rooms')
    ) {
      return {
        statusCode: 200,
        body: JSON.stringify(defaultResponse),
      };
    } else {
      videoEncounter = await AddUserToVideoEncounter(videoEncounter, user, fhirClient);
      const videoResponse: WaitingRoomResponse = {
        status: 'started',
        encounterId: videoEncounter.id,
        videoRoomId: videoEncounter.extension
          ?.find(
            (extensionTemp) =>
              extensionTemp.url === `${PUBLIC_EXTENSION_BASE_URL}/encounter-virtual-service-pre-release`,
          )
          ?.extension?.find((extensionTemp) => extensionTemp.url === 'addressString')?.valueString,
      };
      return {
        statusCode: 200,
        body: JSON.stringify(videoResponse),
      };
    }
  } catch (error: any) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

async function AddUserToVideoEncounter(encounter: Encounter, user: User, fhirClient: FhirClient): Promise<Encounter> {
  let updated: Encounter = {
    ...encounter,
  };
  try {
    const extension = [...(encounter.extension ?? [])];
    const otherParticipantExt = extension!.find((ext) => ext.url === FHIR_EXTENSION.Encounter.otherParticipants.url);

    otherParticipantExt?.extension?.push({
      url: FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url,
      extension: [
        {
          url: 'period',
          valuePeriod: {
            start: DateTime.now().toUTC().toISO(),
          },
        },
        {
          url: 'reference',
          valueReference: {
            reference: user.profile,
          },
        },
      ],
    });

    const updatedEncounter = await fhirClient.patchResource<Encounter>({
      resourceType: 'Encounter',
      resourceId: encounter.id ?? '',
      operations: [
        {
          op: 'replace',
          path: '/extension',
          value: extension,
        },
      ],
    });
    updated.extension = updatedEncounter.extension;
  } catch (err) {
    console.error('Error while trying to update video encounter with user participant', err);
    updated = encounter;
  }

  return updated;
}

const calculateEstimatedTime = async (
  fhirClient: FhirClient,
  appointment: Appointment,
): Promise<number | undefined> => {
  const locationId = appointment.participant
    .find((appointment) => appointment.actor?.reference?.startsWith('Location/'))
    ?.actor?.reference?.replace('Location/', '');
  if (!locationId) return undefined;

  const location = await readLocationResource(fhirClient, locationId);
  const currentState = location?.address?.state;
  if (!(location && currentState)) return undefined;

  const locationsAbbreviations = getAllStatesToSearchWith(currentState);
  const locationsIdsToSearchWith = await convertStatesAbbreviationsToLocationIds(fhirClient, locationsAbbreviations);
  const appointments = await getAllAppointmentsByLocations(fhirClient, locationsIdsToSearchWith);
  const waitingTimeInMills = calculateLongestWaitingTime(appointments);
  const additionalTime = 15 * 60_000;
  return waitingTimeInMills + additionalTime;
};

const readLocationResource = async (fhirClient: FhirClient, locationId: string): Promise<Location | undefined> => {
  const location = await fhirClient.readResource({
    resourceType: 'Location',
    resourceId: locationId,
  });
  return location as Location;
};

const getAllStatesToSearchWith = (locationAbbreviation: string): string[] => {
  // checking if current state is in statesStatusesGroup, and if it is we return whole group
  let resultGroup = [locationAbbreviation];
  estimatedTimeStatesGroups.forEach((statesGroup, index) => {
    if (statesGroup.includes(locationAbbreviation)) resultGroup = estimatedTimeStatesGroups[index];
  });
  return resultGroup;
};

const calculateLongestWaitingTime = (appointments: Appointment[]): number => {
  let longestTime = 0;
  appointments.forEach((appointment) => {
    const rawDate = appointment.created;
    if (rawDate) {
      const apptDate = new Date(rawDate);
      const timeDifference = Math.abs(new Date().getTime() - apptDate.getTime());
      if (timeDifference > longestTime) longestTime = timeDifference;
    }
  });

  return longestTime;
};
