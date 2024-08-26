import { BatchInputRequest, FhirClient, User } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, Patient, Resource } from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  EncounterVirtualServiceExtension,
  FHIR_EXTENSION,
  PRIVATE_EXTENSION_BASE_URL,
  PUBLIC_EXTENSION_BASE_URL,
  PatientInfo,
  TELEMED_VIDEO_ROOM_CODE,
  TelemedAppointmentStatus,
  TelemedAppointmentStatusEnum,
  createUserResourcesForPatient,
  formatPhoneNumber,
  getPatchBinary,
} from 'ottehr-utils';

export const getVideoRoomResourceExtension = (resource: Resource): EncounterVirtualServiceExtension | null => {
  let resourcePrefix: string;
  let castedResource;
  if (resource.resourceType === 'Appointment') {
    castedResource = resource as Appointment;
    resourcePrefix = 'appointment';
  } else if (resource.resourceType === 'Encounter') {
    castedResource = resource as Encounter;
    resourcePrefix = 'encounter';
  } else {
    return null;
  }

  for (let index = 0; index < (castedResource.extension?.length ?? 0); index++) {
    const extension = castedResource.extension?.[index];
    if (extension?.url !== `${PUBLIC_EXTENSION_BASE_URL}/${resourcePrefix}-virtual-service-pre-release`) {
      continue;
    }
    for (let j = 0; j < (extension?.extension?.length ?? 0); j++) {
      const internalExtension = extension.extension?.[j];
      if (internalExtension?.url === 'channelType' && internalExtension.valueCoding?.code === TELEMED_VIDEO_ROOM_CODE) {
        return extension as EncounterVirtualServiceExtension;
      }
    }
  }
  return null;
};

export const mapStatusToTelemed = (
  encounterStatus: string,
  appointmentStatus: string | undefined,
): TelemedAppointmentStatus | undefined => {
  switch (encounterStatus) {
    case 'planned':
      return TelemedAppointmentStatusEnum.ready;
    case 'arrived':
      return TelemedAppointmentStatusEnum['pre-video'];
    case 'in-progress':
      return TelemedAppointmentStatusEnum['on-video'];
    case 'cancelled':
      return TelemedAppointmentStatusEnum['cancelled'];
    case 'finished':
      if (appointmentStatus === 'fulfilled') return TelemedAppointmentStatusEnum.complete;
      else return TelemedAppointmentStatusEnum.unsigned;
  }
  return undefined;
};

export const removePrefix = (prefix: string, text: string): string | undefined => {
  return text.includes(prefix) ? text.replace(prefix, '') : undefined;
};

export function checkUserPhoneNumber(patient: PatientInfo, user: User): string {
  let patientNumberToText: string | undefined = undefined;

  const isEHRUser = !user.name.startsWith('+');
  if (isEHRUser) {
    if (!patient.phoneNumber) {
      throw new Error('No phone number found for patient');
    }
    patientNumberToText = formatPhoneNumber(patient.phoneNumber);
  } else {
    // User is patient and auth0 already appends a +1 to the phone number
    patientNumberToText = user.name;
  }
  return patientNumberToText;
}

export async function createUpdateUserRelatedResources(
  fhirClient: FhirClient,
  patientInfo: PatientInfo,
  fhirPatient: Patient,
  user: User,
): Promise<{ relatedPersonRef: string | undefined; verifiedPhoneNumber: string | undefined }> {
  console.log('patient info: ' + JSON.stringify(patientInfo));

  let verifiedPhoneNumber: string | undefined = undefined;

  if (!patientInfo.id && fhirPatient.id) {
    console.log('New patient');
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account

    verifiedPhoneNumber = checkUserPhoneNumber(patientInfo, user);
    const userResource = await createUserResourcesForPatient(fhirClient, fhirPatient.id, verifiedPhoneNumber);
    const relatedPerson = userResource.relatedPerson;
    const person = userResource.person;

    console.log(5, person.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value);

    if (!person.id) {
      throw new Error('Person resource does not have an ID');
    }

    return { relatedPersonRef: `RelatedPerson/${relatedPerson.id}`, verifiedPhoneNumber: verifiedPhoneNumber };
  }

  return { relatedPersonRef: undefined, verifiedPhoneNumber: verifiedPhoneNumber };
}

export async function creatingPatientUpdateRequest(
  patient: PatientInfo,
  maybeFhirPatient: Patient,
): Promise<BatchInputRequest | undefined> {
  if (!patient.id) return undefined;
  console.log(`Have patient.id, ${patient.id} fetching Patient and building PATCH request`);

  let updatePatientRequest: BatchInputRequest | undefined = undefined;

  const patientPatchOperations: Operation[] = [];

  // store form user (aka emailUser)
  const formUser = {
    url: FHIR_EXTENSION.Patient.formUser.url,
    valueString: patient.emailUser,
  };
  const patientExtension = maybeFhirPatient.extension || [];
  if (patientExtension.length > 0) {
    const formUserExt = patientExtension.find((ext) => ext.url === FHIR_EXTENSION.Patient.formUser.url);
    // check if formUser exists and needs to be updated and if so, update
    if (formUserExt && formUserExt.valueString !== patient.emailUser) {
      const formUserExtIndex = patientExtension.findIndex((ext) => ext.url === FHIR_EXTENSION.Patient.formUser.url);
      patientExtension[formUserExtIndex] = formUser;
    } else if (!formUserExt) {
      // if form user does not exist within the extension
      // push to patientExtension array
      patientExtension.push(formUser);
    }
  } else {
    // since no extensions exist, it must be added via patch operations
    patientExtension.push(formUser);
  }

  console.log('patient extension', patientExtension);

  patientPatchOperations.push({
    op: maybeFhirPatient.extension ? 'replace' : 'add',
    path: '/extension',
    value: patientExtension,
  });

  // update email
  if (patient.emailUser === 'Patient') {
    const telecom = maybeFhirPatient.telecom;
    const curEmail = telecom?.find((tele) => tele.system === 'email');
    const curEmailidx = telecom?.findIndex((tele) => tele.system === 'email');
    // check email exists in telecom but is different
    if (telecom && curEmailidx && curEmailidx > -1 && patient.email !== curEmail) {
      telecom[curEmailidx] = {
        system: 'email',
        value: patient.email,
      };
      patientPatchOperations.push({
        op: 'replace',
        path: '/telecom',
        value: telecom,
      });
    }
    // check if telecom exists but without email
    if (telecom && !curEmail) {
      telecom.push({
        system: 'email',
        value: patient.email,
      });
      patientPatchOperations.push({
        op: 'replace',
        path: '/telecom',
        value: telecom,
      });
    }
    // add if no telecom
    if (!telecom) {
      patientPatchOperations.push({
        op: 'add',
        path: '/telecom',
        value: [
          {
            system: 'email',
            value: patient.email,
          },
        ],
      });
    }
  }

  if (patient.emailUser === 'Parent/Guardian') {
    const patientContacts = maybeFhirPatient.contact;
    if (!patientContacts) {
      // no existing contacts, add email
      patientPatchOperations.push({
        op: 'add',
        path: '/contact',
        value: [
          {
            relationship: [
              {
                coding: [
                  {
                    system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
                    code: patient.emailUser,
                    display: patient.emailUser,
                  },
                ],
              },
            ],
            telecom: [{ system: 'email', value: patient.email }],
          },
        ],
      });
    } else {
      // check if different
      const guardianContact = patientContacts.find((contact) =>
        contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian'),
      );
      const guardianContactIdx = patientContacts.findIndex((contact) =>
        contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian'),
      );
      const guardianEmail = guardianContact?.telecom?.find((telecom) => telecom.system === 'email')?.value;
      const guardianEmailIdx = guardianContact?.telecom?.findIndex((telecom) => telecom.system === 'email');
      if (patient.email !== guardianEmail) {
        patientPatchOperations.push({
          op: 'replace',
          path: `/contact/${guardianContactIdx}/telecom/${guardianEmailIdx}`,
          value: { system: 'email', value: patient.email },
        });
      }
    }
  }

  if (patient.sex !== maybeFhirPatient.gender) {
    patientPatchOperations.push({
      op: maybeFhirPatient.gender ? 'replace' : 'add',
      path: '/gender',
      value: patient.sex,
    });
  }

  if (patientPatchOperations.length >= 1) {
    console.log('getting patch binary for patient operations');
    updatePatientRequest = getPatchBinary({
      resourceType: 'Patient',
      resourceId: patient.id,
      patchOperations: patientPatchOperations,
    });
  }

  return updatePatientRequest;
}
