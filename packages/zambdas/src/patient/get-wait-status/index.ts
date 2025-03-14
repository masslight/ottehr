import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location } from 'fhir/r4b';
import { decodeJwt, jwtVerify } from 'jose';
import {
  TelemedAppointmentStatusEnum,
  createOystehrClient,
  getAppointmentResourceById,
  getLocationIdFromAppointment,
  mapStatusToTelemed,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { SecretsKeys, getSecret } from 'zambda-utils';
import { getAuth0Token } from '../shared';
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
    const telemedClientSecret = getSecret(SecretsKeys.AUTH0_SECRET, secrets);

    const jwt = authorization.replace('Bearer ', '');
    let claims;
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
        const user = await getUser(jwt, secrets);
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
      zapehrToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
      // TODO: wonder if we need to check if it's expired at some point?
    }

    const oystehr = createOystehrClient(
      zapehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    console.log(`getting appointment resource for id ${appointmentID}`);
    const [appointment, videoEncounter] = await Promise.all([
      getAppointmentResourceById(appointmentID, oystehr),
      getVideoEncounterForAppointment(appointmentID || 'Unknown', oystehr),
    ]);

    if (!appointment || !videoEncounter) {
      console.log(`Appointment/Encounter is not found for appointment id ${appointmentID}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Appointment is not found' }),
      };
    }

    console.log(`Encounter found for appointment id ${appointmentID}: `, JSON.stringify(videoEncounter));

    const locationId = getLocationIdFromAppointment(appointment);

    if (!locationId) {
      console.log(`Location ID is not found in appointment: ${JSON.stringify(appointment)}`);
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Location ID not found in appointment' }),
      };
    }

    const telemedStatus = mapStatusToTelemed(videoEncounter.status, appointment.status);

    if (telemedStatus === 'ready' || telemedStatus === 'pre-video' || telemedStatus === 'on-video') {
      const appointments = await getAppointmentsForLocation(oystehr, locationId);

      const estimatedTime = calculateEstimatedTime(appointments);
      const numberInLine = getNumberInLine(appointments, appointmentID);

      const response = {
        statusCode: 200,
        body: JSON.stringify({
          status: telemedStatus === 'on-video' ? telemedStatus : TelemedAppointmentStatusEnum.ready,
          estimatedTime: estimatedTime,
          numberInLine: numberInLine,
          encounterId: telemedStatus === 'on-video' ? videoEncounter?.id : undefined,
        }),
      };
      console.log(JSON.stringify(response, null, 4));
      return response;
    } else {
      console.log(videoEncounter.status, appointment.status);
      const response = {
        statusCode: 200,
        body: JSON.stringify({
          status: telemedStatus === 'cancelled' ? telemedStatus : TelemedAppointmentStatusEnum.complete,
        }),
      };
      console.log(JSON.stringify(response, null, 4));
      return response;
    }
  } catch (error: any) {
    console.log(error, JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

const getAppointmentsForLocation = async (oystehr: Oystehr, locationId: string): Promise<Appointment[]> => {
  const location = await readLocationResource(oystehr, locationId);
  const currentState = location?.address?.state;
  if (!(location && currentState)) return [];

  const statesGroup = getStatesGroupForSearch(currentState);
  const locationsIdsToSearchWith = await convertStatesAbbreviationsToLocationIds(oystehr, statesGroup);

  return await getAllAppointmentsByLocations(oystehr, locationsIdsToSearchWith);
};

const calculateEstimatedTime = (appointments: Appointment[]): number | undefined => {
  const waitingTimeInMills = calculateLongestWaitingTime(appointments);
  const additionalTime = 15 * 60_000;
  return waitingTimeInMills + additionalTime;
};

const getNumberInLine = (appointments: Appointment[], appointmentId: string): number => {
  for (let i = 0; i < appointments.length; i++) {
    if (appointments[i].id === appointmentId) {
      return i + 1;
    }
  }
  return 0;
};

const readLocationResource = async (oystehr: Oystehr, locationId: string): Promise<Location> => {
  const location = await oystehr.fhir.get<Location>({
    resourceType: 'Location',
    id: locationId,
  });
  return location;
};

const getStatesGroupForSearch = (currentState: string): string[] => {
  return estimatedTimeStatesGroups.find((group) => group.includes(currentState)) || [currentState];
};

const calculateLongestWaitingTime = (appointments: Appointment[]): number => {
  let longestTime = 0;
  appointments.forEach((appointment) => {
    const rawDate = appointment.start;
    if (rawDate) {
      const apptDate = new Date(rawDate);
      const timeDifference = Math.abs(new Date().getTime() - apptDate.getTime());
      if (timeDifference > longestTime) longestTime = timeDifference;
    }
  });

  return longestTime;
};
