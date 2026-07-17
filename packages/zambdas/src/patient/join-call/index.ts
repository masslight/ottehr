import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, RelatedPerson } from 'fhir/r4b';
import { decodeJwt, jwtVerify } from 'jose';
import {
  CANNOT_JOIN_CALL_NOT_STARTED_ERROR,
  createOystehrClient,
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
import { addUserToVideoEncounterIfNeeded } from './helpers';
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

  const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
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

  console.log(`getting appointment resource for id ${appointmentId}`);
  const appointment: Appointment | undefined = await getAppointmentResourceById(appointmentId, oystehr);

  if (!appointment) {
    console.log('Appointment is not found');
    return lambdaResponse(404, { message: 'Appointment is not found' });
  }

  const patientId = getParticipantIdFromAppointment(appointment, 'Patient');

  console.log('Patient ID from appointment:', patientId);

  if (!patientId) {
    throw new Error('Could not find the patient reference in appointment resource.'); // 500
  }

  if (!appointment.id) {
    throw new Error(`Appointment resource returned without id for appointment ${appointmentId}`);
  }

  let videoEncounter: Encounter | undefined = await getVideoEncounterForAppointment(appointment.id, oystehr);

  console.log('Encounter status:', videoEncounter?.status);

  // Status can reach 'in-progress' before the video room is provisioned (e.g., via ChangeStatusDropdown); require addressString to avoid a 4006 from join.
  const virtualServiceExt = videoEncounter
    ? getVirtualServiceResourceExtension(videoEncounter, TELEMED_VIDEO_ROOM_CODE)
    : null;

  const hasMeetingAddress = (virtualServiceExt?.extension ?? []).some(
    (ext) => ext.url === 'addressString' && typeof ext.valueString === 'string' && ext.valueString.length > 0
  );

  if (!videoEncounter?.id || videoEncounter.status !== 'in-progress' || !hasMeetingAddress) {
    return lambdaResponse(400, CANNOT_JOIN_CALL_NOT_STARTED_ERROR);
  }

  let otherParticipantRef: string | undefined;
  let relatedPersonRefs: string[] = [];

  if (isInvitedParticipant) {
    const subject = claims.sub || '';
    const invitedParticipantRef = await getInvitedParticipantRef(subject, videoEncounter.id, oystehr);

    if (!invitedParticipantRef) {
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    relatedPersonRefs = [invitedParticipantRef];
  } else {
    user = user as User;
    otherParticipantRef = user.profile;

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

  console.log('Other participant reference:', otherParticipantRef);
  console.log('RelatedPersons:', relatedPersonRefs);

  videoEncounter = await addUserToVideoEncounterIfNeeded(
    videoEncounter,
    otherParticipantRef,
    relatedPersonRefs,
    oystehr
  );

  if (!videoEncounter.id) {
    throw new Error(`Video encounter was not found for the appointment ${appointment.id}`);
  }

  const userToken = isInvitedParticipant ? oystehrToken : jwt;
  try {
    const joinCallResponse = (await oystehr.telemed.joinMeeting(
      { encounterId: videoEncounter.id, anonymous: isInvitedParticipant },
      { accessToken: userToken }
    )) as JoinCallResponse;

    return lambdaResponse(200, joinCallResponse);
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
});

async function getInvitedParticipantRef(
  subject: string,
  encounterId: string,
  oystehr: Oystehr
): Promise<string | undefined> {
  const relatedPersons = await searchInvitedParticipantResourcesByEncounterId(encounterId, oystehr);
  return findInvitedParticipantRefBySubject(subject, relatedPersons);
}

export function findInvitedParticipantRefBySubject(
  subject: string,
  relatedPersons: RelatedPerson[]
): string | undefined {
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmail = emailPattern.test(subject);
  const telecomSystems = isEmail ? ['email'] : ['phone', 'sms'];

  const relatedPerson = relatedPersons.find((rp) => {
    return rp.telecom?.some(
      (telecomTemp) =>
        telecomTemp.system && telecomSystems.includes(telecomTemp.system) && telecomTemp.value === subject
    );
  });

  return relatedPerson?.id ? `RelatedPerson/${relatedPerson.id}` : undefined;
}
