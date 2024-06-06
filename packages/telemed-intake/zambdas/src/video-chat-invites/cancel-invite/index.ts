import { User } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, EncounterParticipant, RelatedPerson } from 'fhir/r4';
import { JSONPath } from 'jsonpath-plus';
import {
  CancelInviteParticipantRequestInput,
  SecretsKeys,
  ZambdaInput,
  createFhirClient,
  getAppointmentResourceById,
  getSecret,
  lambdaResponse,
} from 'ottehr-utils';
import {
  getM2MClientToken,
  getUser,
  getVideoEncounterForAppointment,
  searchInvitedParticipantResourcesByEncounterId,
} from '../../shared';
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
    let validatedParameters: CancelInviteParticipantRequestInput;
    try {
      validatedParameters = validateRequestParameters(input);
      console.log(JSON.stringify(validatedParameters, null, 4));
    } catch (error: any) {
      console.log(error);
      return lambdaResponse(400, { message: error.message });
    }

    const { appointmentId, emailAddress, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    let user: User;
    try {
      console.log('getting user');
      user = await getUser(authorization.replace('Bearer ', ''));
      console.log(`user: ${user.name}`);
    } catch (error) {
      console.log('getUser error:', error);
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    if (!zapehrToken) {
      console.log('getting m2m token for service calls');
      zapehrToken = await getM2MClientToken(secrets); // keeping token externally for reuse
    } else {
      console.log('already have a token, no need to update');
    }

    const fhirClient = createFhirClient(zapehrToken);

    console.log(`getting appointment resource for id ${appointmentId}`);
    const appointment: Appointment | undefined = await getAppointmentResourceById(appointmentId, fhirClient);
    if (!appointment) {
      console.log('Appointment is not found');
      return lambdaResponse(404, { message: 'Appointment is not found' });
    }

    const encounter = await getVideoEncounterForAppointment(appointment.id || 'Unknown', fhirClient);
    if (!encounter || !encounter.id) {
      throw new Error('Encounter not found.'); // 500
    }

    const relatedPersons: RelatedPerson[] = await searchInvitedParticipantResourcesByEncounterId(
      encounter.id,
      fhirClient,
    );
    const relatedPerson = findParticipantByEmail(relatedPersons, emailAddress);
    if (!relatedPerson) {
      console.log('Invite is not found.');
      return lambdaResponse(404, { message: 'Invite is not found.' });
    }

    console.log(`Found RelatedPerson for provided email: RelatedPerson/${relatedPerson.id}`);

    const participants: EncounterParticipant[] = [...(encounter.participant ?? [])];
    const remainingParticipants = participants.filter(
      (p) => p.individual?.reference !== `RelatedPerson/${relatedPerson.id}`,
    );
    console.log('Remaining participants:', remainingParticipants);

    await fhirClient.patchResource<Encounter>({
      resourceType: 'Encounter',
      resourceId: encounter.id,
      operations: [
        {
          op: 'replace',
          path: '/participant',
          value: remainingParticipants,
        },
      ],
    });

    return lambdaResponse(200, {});
  } catch (error: any) {
    console.log(error);
    return lambdaResponse(500, { error: 'Internal error' });
  }
};

function findParticipantByEmail(participants: RelatedPerson[], matchingEmail: string): RelatedPerson | undefined {
  return participants.find((p) => {
    const email = JSONPath({ path: '$.telecom[?(@.system == "email")].value', json: p })[0];
    return email === matchingEmail;
  });
}
