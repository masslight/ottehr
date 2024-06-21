import { FhirClient, User } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location } from 'fhir/r4';
import { decodeJwt, jwtVerify } from 'jose';
import {
  SecretsKeys,
  TELEMED_VIDEO_ROOM_CODE,
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
import { mapStatusToTelemed } from '../shared/appointment/helpers';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    console.log(JSON.stringify(validatedParameters, null, 4));
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

    const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
    const telemedClientSecret = getSecret(SecretsKeys.TELEMED_CLIENT_SECRET, secrets);

    const jwt = authorization.replace('Bearer ', '');
    let claims;
    let user: User | undefined;
    try {
      claims = decodeJwt(jwt);
      console.log('JWT claims:', claims);
      // invited participant case
      if (claims.iss === 'https://ottehr.com') {
        const secret = new TextEncoder().encode(telemedClientSecret);
        await jwtVerify(jwt, secret, {
          audience: `${websiteUrl}/waiting-room/appointment/${appointmentID}`,
        });
      } else {
        console.log('getting user');
        user = await getUser(jwt);
        console.log(`user: ${user.name}`);
      }
    } catch (error) {
      console.log('User verification error:', error);
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Unauthorized' }),
      };
    }

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getM2MClientToken(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
      // TODO: wonder if we need to check if it's expired at some point?
    }

    const fhirClient = createFhirClient(zapehrToken);

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

    if (
      !videoEncounter ||
      videoEncounter.status !== 'in-progress' ||
      !getVirtualServiceResourceExtension(videoEncounter, TELEMED_VIDEO_ROOM_CODE)
    ) {
      const estimatedTime = await calculateEstimatedTime(fhirClient, appointment);
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          status: 'ready',
          estimatedTime: estimatedTime,
        }),
      };
      console.log(JSON.stringify(response, null, 4));
      return response;
    } else {
      console.log(videoEncounter.status, appointment.status);
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          status: mapStatusToTelemed(videoEncounter.status, appointment.status),
          encounterId: videoEncounter?.id,
        }),
      };
      console.log(JSON.stringify(response, null, 4));
      return response;
    }
  } catch (error: any) {
    console.log(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

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
