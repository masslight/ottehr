import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter } from 'fhir/r4b';
import { decodeJwt, jwtVerify } from 'jose';
import { JSONPath } from 'jsonpath-plus';
import { DateTime } from 'luxon';
import {
  CANNOT_JOIN_CALL_NOT_STARTED_ERROR,
  FHIR_EXTENSION,
  JoinCallInput,
  JoinCallResponse,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  TELEMED_VIDEO_ROOM_CODE,
  createOystehrClient,
  getAppointmentResourceById,
  getRelatedPersonForPatient,
  getVirtualServiceResourceExtension,
  userHasAccessToPatient,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { SecretsKeys, getSecret, lambdaResponse } from 'zambda-utils';
import {
  getAuth0Token,
  getUser,
  getVideoEncounterForAppointment,
  searchInvitedParticipantResourcesByEncounterId,
} from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;
export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    if (!authorization) {
      console.log('User is not authenticated yet');
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    console.group('validateRequestParameters');
    let validatedParameters: JoinCallInput;
    try {
      validatedParameters = validateRequestParameters(input);
      console.log(JSON.stringify(validatedParameters, null, 4));
    } catch (error: any) {
      console.log(error);
      return lambdaResponse(400, { message: error.message });
    }

    const { appointmentId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const projectApiURL = getSecret(SecretsKeys.PROJECT_API, secrets);
    const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
    const telemedClientId = getSecret(SecretsKeys.AUTH0_CLIENT, secrets);
    const telemedClientSecret = getSecret(SecretsKeys.AUTH0_SECRET, secrets);

    const jwt = authorization.replace('Bearer ', '');
    const claims = decodeJwt(jwt);
    console.log('JWT claims:', claims);
    let isInvitedParticipant = false;
    let user: User | undefined;
    try {
      if (claims.iss === 'https://ottehr.com') {
        isInvitedParticipant = true;
        const secret = new TextEncoder().encode(telemedClientSecret);
        await jwtVerify(jwt, secret, {
          audience: `${websiteUrl}/waiting-room/appointment/${appointmentId}`,
        });
        if (!claims.sub) {
          throw new Error('clams.sub is expected!');
        }
      } else {
        console.log('getting user');
        user = await getUser(jwt, secrets);
        console.log(`user: ${user?.name}`);
      }
    } catch (error) {
      console.log('User verification error:', error);
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getAuth0Token(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const oystehr = createOystehrClient(
      zapehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    let appointment: Appointment | undefined = undefined;

    console.log(`getting appointment resource for id ${appointmentId}`);
    appointment = await getAppointmentResourceById(appointmentId, oystehr);
    if (!appointment) {
      console.log('Appointment is not found');
      return lambdaResponse(404, { message: 'Appointment is not found' });
    }

    const patientRef = appointment.participant.find((p) => p.actor?.reference?.match(/^Patient/) !== null)?.actor
      ?.reference;
    const patientId = patientRef?.replace(/^Patient\//, '');
    console.log('Patient ID from appointment:', patientId);
    if (!patientId) {
      throw new Error('Could not find the patient reference in appointment resource.'); // 500
    }

    let videoEncounter: Encounter | undefined = undefined;
    videoEncounter = await getVideoEncounterForAppointment(appointment.id || 'Unknown', oystehr);
    console.log('Encounter status:', videoEncounter?.status);

    if (
      !videoEncounter?.id ||
      videoEncounter.status !== 'in-progress' ||
      !getVirtualServiceResourceExtension(videoEncounter, TELEMED_VIDEO_ROOM_CODE)
    ) {
      return lambdaResponse(400, CANNOT_JOIN_CALL_NOT_STARTED_ERROR);
    }

    let userProfile: string;
    let relatedPersonRef: string | undefined;
    if (isInvitedParticipant) {
      const emailAddress = claims.sub || '';
      if (!(await isParticipantInvited(emailAddress, videoEncounter.id, oystehr))) {
        return lambdaResponse(401, { message: 'Unauthorized' });
      }
      userProfile = await getM2MUserProfile(zapehrToken, projectApiURL, telemedClientId);
    } else {
      // user is defined here cause it's not invited participant
      user = user as User;
      userProfile = user.profile;
      if (!(await userHasAccessToPatient(user, patientId, oystehr))) {
        return lambdaResponse(403, NO_READ_ACCESS_TO_PATIENT_ERROR);
      }
      const relatedPerson = await getRelatedPersonForPatient(patientId, oystehr);
      relatedPersonRef = `RelatedPerson/${relatedPerson?.id}`;
    }

    console.log('User profile:', userProfile);
    console.log('RelatedPerson:', relatedPersonRef);

    videoEncounter = await addUserToVideoEncounterIfNeeded(videoEncounter, userProfile, relatedPersonRef, oystehr);
    if (!videoEncounter.id) {
      throw new Error(`Video encounter was not found for the appointment ${appointment.id}`);
    }

    const userToken = isInvitedParticipant ? zapehrToken : jwt;
    const joinCallResponse = await joinTelemedMeeting(
      projectApiURL,
      userToken,
      videoEncounter.id,
      isInvitedParticipant
    );

    return lambdaResponse(200, joinCallResponse);
  } catch (error: any) {
    console.log(error);
    return lambdaResponse(500, { error: 'Internal error' });
  }
};

async function addUserToVideoEncounterIfNeeded(
  encounter: Encounter,
  fhirParticipantRef: string,
  fhirRelatedPersonRef: string | undefined,
  oystehr: Oystehr
): Promise<Encounter> {
  try {
    const extension = [...(encounter.extension ?? [])];
    const otherParticipantExt = extension.find((ext) => ext.url === FHIR_EXTENSION.Encounter.otherParticipants.url);

    const filter = FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url;
    const path = `$.extension[?(@.url == '${filter}')].extension[?(@.url == 'reference')].valueReference.reference`;
    const otherParticipantsDenormalized = JSONPath({ path: path, json: otherParticipantExt ?? {} });
    console.log('otherParticipantsDenormalized:', otherParticipantsDenormalized);

    const updateOperations: Operation[] = [];

    if (otherParticipantsDenormalized.includes(fhirParticipantRef)) {
      console.log(`User '${fhirParticipantRef}' is already added to the participant list.`);
    } else {
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
              reference: fhirParticipantRef,
            },
          },
        ],
      });

      updateOperations.push({
        op: 'replace',
        path: '/extension',
        value: extension,
      });
    }

    if (
      !fhirRelatedPersonRef ||
      (encounter.participant &&
        encounter.participant.findIndex((p) => p.individual?.reference === fhirRelatedPersonRef) >= 0)
    ) {
      console.log('Encounter.participant list will not be updated.');
    } else {
      console.log(`Adding RelatedPerson/'${fhirRelatedPersonRef}' to Encounter.participant.`);
      const participants = [...(encounter.participant ?? [])];
      participants.push({
        individual: {
          reference: fhirRelatedPersonRef,
        },
      });

      updateOperations.push({
        op: encounter.participant ? 'replace' : 'add',
        path: '/participant',
        value: participants,
      });
    }

    if (updateOperations.length > 0) {
      console.log(JSON.stringify(updateOperations, null, 4));
      const updatedEncounter = await oystehr.fhir.patch<Encounter>({
        resourceType: 'Encounter',
        id: encounter.id ?? '',
        operations: updateOperations,
      });
      return updatedEncounter;
    } else {
      console.log('Nothing to update for the encounter.');
      return encounter;
    }
  } catch (err) {
    console.error('Error while trying to update video encounter with user participant', err);
    throw err;
  }
}

async function isParticipantInvited(emailAddress: string, encounterId: string, oystehr: Oystehr): Promise<boolean> {
  const relatedPersons = await searchInvitedParticipantResourcesByEncounterId(encounterId, oystehr);
  const emailAddresses: string[] = JSONPath({ path: '$..telecom[?(@.system == "email")].value', json: relatedPersons });
  console.log('Email addresses that were invited:', emailAddresses);
  return emailAddresses.includes(emailAddress);
}

async function joinTelemedMeeting(
  projectApiURL: string,
  userToken: string,
  encounterId: string,
  anonymous = false
): Promise<JoinCallResponse> {
  const joinUrl = `${projectApiURL}/telemed/v2/meeting/${encounterId}/join${anonymous ? '?anonymous=true' : ''}`;
  const response = await fetch(joinUrl, {
    headers: {
      Authorization: `Bearer ${userToken}`,
      'content-type': 'application/json',
    },
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`API call failed: ${JSON.stringify(await response.json())}`);
  }

  return (await response.json()) as JoinCallResponse;
}

async function getM2MUserProfile(token: string, projectApiURL: string, telemedClientId: string): Promise<any> {
  try {
    const url = `${projectApiURL}/m2m`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch M2M user details: ${response.statusText}`);
    }

    const data = await response.json();
    const telemedDevice = data.find((device: any) => device.clientId === telemedClientId);
    if (!telemedDevice) {
      throw new Error('No device matches the provided AUTH0_CLIENT');
    }
    return telemedDevice.profile;
  } catch (error: any) {
    console.error('Error fetching M2M user details:', error);
    throw error;
  }
}
