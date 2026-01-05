import Oystehr, { FhirPatchParams, User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, ContactPoint, Encounter, Location, Patient, RelatedPerson } from 'fhir/r4b';
import { SignJWT } from 'jose';
import { JSONPath } from 'jsonpath-plus';
import {
  createOystehrClient,
  FHIR_RESOURCE_NOT_FOUND,
  formatPhoneNumber,
  getSecret,
  getVirtualServiceResourceExtension,
  PROJECT_WEBSITE,
  SecretsKeys,
  TELEMED_VIDEO_ROOM_CODE,
  VideoChatCreateInviteInput,
  VideoChatCreateInviteResponse,
} from 'utils';
import { getNameForOwner } from '../../../ehr/schedules/shared';
import {
  getAuth0Token,
  getEmailClient,
  getUser,
  lambdaResponse,
  sendSms,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;
const ZAMBDA_NAME = 'telemed-create-invites';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const authorization = input.headers.Authorization;
    if (!authorization) {
      console.log('User is not authenticated yet');
      return lambdaResponse(401, { message: 'Unauthorized' });
    }

    console.group('validateRequestParameters');
    let validatedParameters: VideoChatCreateInviteInput;
    try {
      validatedParameters = validateRequestParameters(input);
    } catch (error: any) {
      console.log(error);
      return lambdaResponse(400, { message: error.message });
    }

    const { appointmentId, firstName, lastName, phoneNumber, emailAddress, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const websiteUrl = getSecret(SecretsKeys.WEBSITE_URL, secrets);
    const telemedClientSecret = getSecret(SecretsKeys.AUTH0_SECRET, secrets);

    let user: User;
    try {
      console.log('getting user');
      user = await getUser(authorization.replace('Bearer ', ''), secrets);
      console.log(`user: ${user.name}`);
    } catch (error) {
      console.log('getUser error:', error);
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

    const { encounter, appointment, relatedPersons, patient, location } = await getAppointmentResources(
      oystehr,
      appointmentId
    );

    const emailAddresses: string[] = JSONPath({
      path: '$..telecom[?(@.system == "email")].value',
      json: relatedPersons,
    });
    console.log('Email addresses invited so far:', emailAddresses);
    if (emailAddresses.includes(emailAddress)) {
      console.log(`Email address '${emailAddress}' is already invited.`);
      return lambdaResponse(400, { message: `Email address '${emailAddress}' is already invited.` });
    }

    const patientRef = appointment.participant.find((p) => p.actor?.reference?.match(/^Patient/) !== null)?.actor
      ?.reference;
    console.log('Patient reference from appointment:', patientRef);
    if (!patientRef) {
      throw new Error('Could not find the patient reference in appointment resource.');
    }

    const relatedPerson = await createRelatedPerson(
      firstName,
      lastName,
      phoneNumber,
      emailAddress,
      patientRef,
      oystehr
    );
    console.log('Created RelatedPerson.id:', relatedPerson.id);

    const relatedPersonRef = `RelatedPerson/${relatedPerson.id}`;
    await addParticipantToEncounterIfNeeded(encounter, relatedPersonRef, oystehr);

    const secret = new TextEncoder().encode(telemedClientSecret);
    const alg = 'HS256';

    const jwt = await new SignJWT()
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setIssuer(PROJECT_WEBSITE)
      .setSubject(emailAddress || phoneNumber)
      .setAudience(`${websiteUrl}/waiting-room/appointment/${appointmentId}`)
      .setExpirationTime('24h')
      .sign(secret);

    const inviteUrl = `${websiteUrl}/invited-waiting-room?appointment_id=${appointmentId}&token=${jwt}`;

    const chosenName = patient?.name?.find((name) => name.use === 'nickname')?.given?.[0];
    const patientChosenName = chosenName || patient?.name?.[0].given?.[0] || 'Patient';

    const locationName = location ? getNameForOwner(location) ?? '' : '';
    if (emailAddress) {
      const emailClient = getEmailClient(secrets);
      await emailClient.sendVideoChatInvitationEmail(emailAddress, {
        'join-visit-url': inviteUrl,
        'patient-name': patientChosenName,
        location: locationName,
      });
    }

    if (relatedPerson) {
      let rawPhone = relatedPerson.telecom?.find((telecom) => telecom.system === 'sms')?.value;
      if (rawPhone) {
        rawPhone = rawPhone.replace(/[()\s-]/g, '');
        const phone = formatPhoneNumber(rawPhone);
        const message = `You have been invited to join a telemedicine visit with ${patientChosenName}. Please click ${inviteUrl} to join.`;
        console.log(`Sms data: recipient: ${relatedPersonRef}; verifiedPhoneNumber: ${phone};`);

        const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
        await sendSms(message, relatedPersonRef, oystehr, ENVIRONMENT);
      }
    }

    const result: VideoChatCreateInviteResponse = {
      inviteUrl: inviteUrl,
    };
    return lambdaResponse(200, result);
  } catch (error: any) {
    console.log(error);
    return topLevelCatch('create-invite', error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

async function createRelatedPerson(
  firstName: string,
  lastName: string,
  phoneNumber: string | undefined,
  emailAddress: string | undefined,
  fhirPatientRef: string,
  oystehr: Oystehr
): Promise<RelatedPerson> {
  const telecom: ContactPoint[] = [];
  if (emailAddress) {
    telecom.push({
      value: emailAddress,
      system: 'email',
    });
  }
  if (phoneNumber) {
    telecom.push(
      {
        value: phoneNumber,
        system: 'phone',
      },
      {
        value: phoneNumber,
        system: 'sms',
      }
    );
  }
  const data: RelatedPerson = {
    resourceType: 'RelatedPerson',
    active: true,
    name: [
      {
        given: [firstName],
        family: lastName,
      },
    ],
    patient: {
      reference: fhirPatientRef,
    },
    relationship: [
      {
        coding: [
          {
            code: 'WIT',
            system: 'http://terminology.hl7.org/CodeSystem/v3-ParticipationType',
          },
        ],
      },
    ],
    telecom,
  };

  const response: RelatedPerson = await oystehr.fhir.create(data);
  return response;
}

async function addParticipantToEncounterIfNeeded(
  encounter: Encounter,
  fhirRelatedPersonRef: string,
  oystehr: Oystehr
): Promise<Encounter> {
  try {
    if (
      encounter.participant &&
      encounter.participant.findIndex((p) => p.individual?.reference === fhirRelatedPersonRef) >= 0
    ) {
      console.log(`RelatedPerson '${fhirRelatedPersonRef}' is already added to the encounter.`);
      console.log('Nothing to update for the encounter.');
      return encounter;
    } else {
      const participants = [...(encounter.participant ?? [])];
      participants.push({
        individual: {
          reference: fhirRelatedPersonRef,
        },
      });

      const patch: FhirPatchParams<Encounter> = {
        resourceType: 'Encounter',
        id: encounter.id ?? '',
        operations: [
          {
            op: encounter.participant ? ('replace' as const) : ('add' as const),
            path: '/participant',
            value: participants,
          },
        ],
      };
      console.log('Encounter patch op:', JSON.stringify(patch, null, 4));
      const updatedEncounter = await oystehr.fhir.patch<Encounter>(patch);

      console.log(`Updated Encounter/${updatedEncounter.id}`);

      return updatedEncounter;
    }
  } catch (err) {
    console.error('Error while trying to update video encounter with user participant.');
    throw err;
  }
}

async function getAppointmentResources(
  oystehr: Oystehr,
  appointmentId: string
): Promise<{
  appointment: Appointment;
  encounter: Encounter;
  relatedPersons: RelatedPerson[];
  patient?: Patient;
  location?: Location;
}> {
  const response = await oystehr.fhir.search({
    resourceType: 'Encounter',
    params: [
      {
        name: 'appointment',
        value: `Appointment/${appointmentId}`,
      },
      {
        name: '_include',
        value: 'Encounter:appointment',
      },
      {
        name: '_include',
        value: 'Encounter:participant',
      },
      {
        name: '_include',
        value: 'Encounter:subject',
      },
      {
        name: '_include:iterate',
        value: 'Appointment:location',
      },
    ],
  });
  const resources = response.unbundle();

  // looking for virtual encounter
  const encounter = resources.find(
    (r) =>
      r.resourceType === 'Encounter' &&
      Boolean(getVirtualServiceResourceExtension(r as Encounter, TELEMED_VIDEO_ROOM_CODE))
  ) as Encounter | undefined;
  if (!encounter) throw FHIR_RESOURCE_NOT_FOUND('Encounter');

  const appointment = resources.find(
    (r) =>
      r.id !== undefined &&
      r.resourceType === 'Appointment' &&
      encounter?.appointment?.find((a) => a.reference?.includes(r.id!))
  ) as Appointment | undefined;
  if (!appointment) throw FHIR_RESOURCE_NOT_FOUND('Appointment');

  const relatedPersons = resources.filter(
    (r) => r.resourceType === 'RelatedPerson' && r.relationship?.[0]?.coding?.[0]?.code === 'WIT'
  ) as RelatedPerson[];

  const patient = resources.find((r) => r.resourceType === 'Patient') as Patient | undefined;

  const location = resources.find((r) => r.resourceType === 'Location') as Location | undefined;

  return {
    appointment,
    encounter,
    relatedPersons,
    patient,
    location,
  };
}
