import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, ContactPoint, Encounter, Patient, RelatedPerson } from 'fhir/r4b';
import { SignJWT } from 'jose';
import { JSONPath } from 'jsonpath-plus';
import {
  FHIR_EXTENSION,
  VideoChatCreateInviteInput,
  VideoChatCreateInviteResponse,
  createOystehrClient,
  formatPhoneNumber,
  getAppointmentResourceById,
} from 'utils';
import { SecretsKeys, ZambdaInput, getSecret, lambdaResponse } from 'zambda-utils';
import {
  getAuth0Token,
  getUser,
  getVideoEncounterForAppointment,
  sendSms,
  sendVideoChatInvititationEmail,
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

    console.log(`getting appointment resource for id ${appointmentId}`);
    const appointment: Appointment | undefined = await getAppointmentResourceById(appointmentId, oystehr);
    if (!appointment) {
      console.log('Appointment is not found');
      return lambdaResponse(404, { message: 'Appointment is not found' });
    }

    const encounter = await getVideoEncounterForAppointment(appointment.id || 'Unknown', oystehr);
    if (!encounter || !encounter.id) {
      throw new Error('Encounter not found.'); // 500
    }

    // Fetch patient and invited participant info from FHIR in one go
    const allParticipants = await searchParticipantResourcesByEncounterId(encounter.id, oystehr);
    const relatedPersons = filterInvitedParticipantResources(allParticipants);
    const patientResource = filterPatientResources(allParticipants)[0];

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
      .setIssuer('https://ottehr.com')
      .setSubject(emailAddress)
      .setAudience(`${websiteUrl}/waiting-room/appointment/${appointmentId}`)
      .setExpirationTime('24h')
      .sign(secret);

    const inviteUrl = `${websiteUrl}/invited-waiting-room?appointment_id=${appointmentId}&token=${jwt}`;

    const chosenName = patientResource.extension?.find((ext) => ext.url === FHIR_EXTENSION.Patient.chosenName.url)
      ?.valueString;
    const patientChosenName = chosenName || patientResource.name?.[0].given?.[0] || 'Patient';

    if (emailAddress) {
      await sendVideoChatInvititationEmail({
        toAddress: emailAddress,
        inviteUrl: inviteUrl,
        patientName: patientChosenName,
        secrets: secrets,
      });
    }

    if (relatedPerson) {
      let rawPhone = relatedPerson.telecom?.find((telecom) => telecom.system === 'sms')?.value;
      if (rawPhone) {
        rawPhone = rawPhone.replace(/[()\s-]/g, '');
        const phone = formatPhoneNumber(rawPhone);
        const message = `You have been invited to join a telemedicine visit with ${patientChosenName}. Please click ${inviteUrl} to join.`;
        console.log(`Sms data: recipient: ${relatedPersonRef}; verifiedPhoneNumber: ${phone};`);

        await sendSms(message, zapehrToken, relatedPersonRef, secrets);
      }
    }

    const result: VideoChatCreateInviteResponse = {
      inviteUrl: inviteUrl,
    };
    return lambdaResponse(200, result);
  } catch (error: any) {
    console.log(error);
    return lambdaResponse(500, { error: 'Internal error' });
  }
};

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

      const patch = {
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

async function searchParticipantResourcesByEncounterId(
  encounterId: string,
  oystehr: Oystehr
): Promise<(Patient | RelatedPerson)[]> {
  const allResources = (
    await oystehr.fhir.search<Encounter | Patient | RelatedPerson>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
        },
        {
          name: '_include',
          value: 'Encounter:participant',
        },
        {
          name: '_include',
          value: 'Encounter:subject',
        },
      ],
    })
  ).unbundle();

  const participants: (RelatedPerson | Patient)[] = allResources.filter(
    (r): r is RelatedPerson | Patient => r.resourceType === 'RelatedPerson' || r.resourceType === 'Patient'
  );
  return participants;
}

function filterInvitedParticipantResources(participants: (RelatedPerson | Patient)[]): RelatedPerson[] {
  const relatedPersons = <RelatedPerson[]>participants.filter((r) => r.resourceType === 'RelatedPerson');
  return relatedPersons.filter((r) => r.relationship?.[0].coding?.[0].code === 'WIT');
}

function filterPatientResources(participants: (RelatedPerson | Patient)[]): Patient[] {
  return <Patient[]>participants.filter((r) => r.resourceType === 'Patient');
}
