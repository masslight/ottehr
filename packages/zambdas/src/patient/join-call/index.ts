import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter } from 'fhir/r4b';
import { decodeJwt, jwtVerify } from 'jose';
import { JSONPath } from 'jsonpath-plus';
import { DateTime } from 'luxon';
import {
  CANNOT_JOIN_CALL_NOT_STARTED_ERROR,
  createOystehrClient,
  FHIR_EXTENSION,
  getAppointmentResourceById,
  getParticipantIdFromAppointment,
  getRelatedPersonsForPatient,
  getSecret,
  getVirtualServiceResourceExtension,
  JoinCallInput,
  JoinCallResponse,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  PROJECT_WEBSITE,
  SecretsKeys,
  TELEMED_VIDEO_ROOM_CODE,
} from 'utils';
import {
  getAuth0Token,
  getUser,
  getVideoEncounterForAppointment,
  lambdaResponse,
  reportMissingUserRelatedPerson,
  searchInvitedParticipantResourcesByEncounterId,
  userHasAccessToPatient,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'join-call';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
    if (claims.iss === PROJECT_WEBSITE) {
      isInvitedParticipant = true;
      const secret = new TextEncoder().encode(telemedClientSecret);
      await jwtVerify(jwt, secret, {
        audience: `${websiteUrl}/waiting-room/appointment/${appointmentId}`,
      });

      if (!claims.sub) {
        throw new Error('claims.sub is expected!');
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

  if (!oystehrToken) {
    console.log('getting m2m token for service calls');
    oystehrToken = await getAuth0Token(secrets); // keeping token externally for reuse
  } else {
    console.log('already have a token, no need to update');
  }

  const oystehr = createOystehrClient(
    oystehrToken,
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

  const patientId = getParticipantIdFromAppointment(appointment, 'Patient');

  console.log('Patient ID from appointment:', patientId);

  if (!patientId) {
    throw new Error('Could not find the patient reference in appointment resource.'); // 500
  }

  let videoEncounter: Encounter | undefined = undefined;
  videoEncounter = await getVideoEncounterForAppointment(appointment.id || 'Unknown', oystehr);

  console.log('Encounter status:', videoEncounter?.status);

  // Status can reach 'in-progress' before the video room is provisioned (e.g., via ChangeStatusDropdown); require addressString to avoid a 4006 from join.
  const virtualServiceExt = videoEncounter
    ? getVirtualServiceResourceExtension(videoEncounter, TELEMED_VIDEO_ROOM_CODE)
    : null;

  const hasMeetingAddress = (virtualServiceExt?.extension ?? []).some(
    (ext) => ext.url === 'addressString' && typeof ext.valueString === 'string' && ext.valueString.length > 0
  );

  if (!videoEncounter?.id || videoEncounter.status !== 'in-progress' || !virtualServiceExt || !hasMeetingAddress) {
    return lambdaResponse(400, CANNOT_JOIN_CALL_NOT_STARTED_ERROR);
  }

  let userProfile: string;
  let relatedPersonRefs: string[] = [];

  if (isInvitedParticipant) {
    const subject = claims.sub || '';

    if (!(await isParticipantInvited(subject, videoEncounter.id, oystehr))) {
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    userProfile = await getM2MUserProfile(oystehrToken, projectApiURL, telemedClientId);
  } else {
    user = user as User;
    userProfile = user.profile;

    if (!(await userHasAccessToPatient(user, patientId, oystehr))) {
      return lambdaResponse(403, NO_READ_ACCESS_TO_PATIENT_ERROR);
    }

    const relatedPersons = await getRelatedPersonsForPatient(patientId, oystehr);

    if (!relatedPersons.length) {
      console.log(`No user-relatedperson for patient ${patientId}; proceeding without an RP participant`);
      reportMissingUserRelatedPerson('join-call', patientId);
    } else {
      relatedPersonRefs = relatedPersons
        .filter((rp): rp is typeof rp & { id: string } => !!rp.id)
        .map((rp) => `RelatedPerson/${rp.id}`);
    }
  }

  console.log('User profile:', userProfile);
  console.log('RelatedPersons:', relatedPersonRefs);

  videoEncounter = await addUserToVideoEncounterIfNeeded(videoEncounter, userProfile, relatedPersonRefs, oystehr);

  if (!videoEncounter.id) {
    throw new Error(`Video encounter was not found for the appointment ${appointment.id}`);
  }

  const userToken = isInvitedParticipant ? oystehrToken : jwt;
  let joinCallResponse: JoinCallResponse;

  try {
    joinCallResponse = (await oystehr.telemed.joinMeeting(
      { encounterId: videoEncounter.id, anonymous: isInvitedParticipant },
      { accessToken: userToken }
    )) as JoinCallResponse;
  } catch (error: any) {
    console.error('Error joining telemed meeting:', error);

    const errorCode = error?.code ? `${error.code}` : '';
    const errorMessage: string = typeof error?.message === 'string' ? error.message : '';

    const isMissingAddressString = errorCode === '4006' || errorMessage.includes('addressString');

    // TODO: after ticket "Oystehr Map chime errors to 4-digit codes in handleChimeSDKError" is implemented, it's better to check the code instead of the message
    const isNotFoundOrExpired = errorMessage.includes('not found or expired');

    if (isMissingAddressString || isNotFoundOrExpired) {
      return lambdaResponse(400, CANNOT_JOIN_CALL_NOT_STARTED_ERROR);
    }

    throw error;
  }

  return lambdaResponse(200, joinCallResponse);
});

async function addUserToVideoEncounterIfNeeded(
  encounter: Encounter,
  fhirParticipantRef: string,
  fhirRelatedPersonRefs: string[],
  oystehr: Oystehr
): Promise<Encounter> {
  try {
    const otherParticipantsIdx = (encounter.extension ?? []).findIndex(
      (ext) => ext.url === FHIR_EXTENSION.Encounter.otherParticipants.url
    );

    const otherParticipantExt = otherParticipantsIdx >= 0 ? encounter.extension?.[otherParticipantsIdx] : undefined;
    const filter = FHIR_EXTENSION.Encounter.otherParticipants.extension.otherParticipant.url;
    const path = `$.extension[?(@.url == '${filter}')].extension[?(@.url == 'reference')].valueReference.reference`;
    const otherParticipantsDenormalized = JSONPath({ path: path, json: otherParticipantExt ?? {} });

    console.log('otherParticipantsDenormalized:', otherParticipantsDenormalized);

    const updateOperations: Operation[] = [];

    const newOtherParticipantEntry = {
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
    };

    if (otherParticipantsDenormalized.includes(fhirParticipantRef)) {
      console.log(`User '${fhirParticipantRef}' is already added to the participant list.`);
    } else if (otherParticipantsIdx >= 0) {
      // Targeted patch into the existing container avoids the lost-update race of replacing /extension.
      updateOperations.push({
        op: 'add',
        path: `/extension/${otherParticipantsIdx}/extension/-`,
        value: newOtherParticipantEntry,
      });
    } else {
      const newOtherParticipants = {
        url: FHIR_EXTENSION.Encounter.otherParticipants.url,
        extension: [newOtherParticipantEntry],
      };

      updateOperations.push({
        op: 'add',
        path: encounter.extension ? '/extension/-' : '/extension',
        value: encounter.extension ? newOtherParticipants : [newOtherParticipants],
      });
    }

    const existingParticipantRefs = new Set(
      (encounter.participant ?? []).map((p) => p.individual?.reference).filter((r): r is string => !!r)
    );

    const refsToAdd = fhirRelatedPersonRefs.filter((ref) => !existingParticipantRefs.has(ref));

    if (!refsToAdd.length) {
      console.log('Encounter.participant list will not be updated.');
    } else {
      console.log(`Adding ${refsToAdd.join(', ')} to Encounter.participant.`);
      const participants = [
        ...(encounter.participant ?? []),
        ...refsToAdd.map((ref) => ({ individual: { reference: ref } })),
      ];

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

async function isParticipantInvited(subject: string, encounterId: string, oystehr: Oystehr): Promise<boolean> {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailPattern.test(subject);
  const relatedPersons = await searchInvitedParticipantResourcesByEncounterId(encounterId, oystehr);

  const telecom: string[] = JSONPath({
    path: `$..telecom[?(@.system == "${isEmail ? 'email' : 'phone'}")].value`,
    json: relatedPersons,
  });

  console.log(`${isEmail ? 'Email addresses' : 'Phone numbers'} that were invited:`, telecom);

  return telecom.includes(subject);
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
