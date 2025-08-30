import Oystehr, { BatchInputPostRequest, BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  AppointmentInsuranceRelatedResourcesExtension,
  createPatientDocumentLists,
  createUserResourcesForPatient,
  FHIR_EXTENSION,
  formatPhoneNumber,
  getPatchBinary,
  getPatientResourceWithVerifiedPhoneNumber,
  mapStatusToTelemed,
  normalizePhoneNumber,
  PATIENT_NOT_FOUND_ERROR,
  PatientInfo,
  removeTimeFromDate,
  TelemedCallStatuses,
  User,
} from 'utils';
import { checkIsEHRUser } from '../auth';
import { assertDefined } from '../helpers';

export function getPatientFromAppointment(appointment: Appointment): string | undefined {
  return appointment.participant
    .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/'))
    ?.actor?.reference?.split('/')[1];
}

export async function patchAppointmentResource(
  apptId: string,
  patchOperations: Operation[],
  oystehr: Oystehr
): Promise<Appointment> {
  try {
    const response: Appointment = await oystehr.fhir.patch({
      resourceType: 'Appointment',
      id: apptId,
      operations: patchOperations,
    });
    return response;
  } catch (error: unknown) {
    throw new Error(`Failed to patch Appointment: ${JSON.stringify(error)}`);
  }
}

export async function patchEncounterResource(
  encId: string,
  patchOperations: Operation[],
  oystehr: Oystehr
): Promise<Encounter> {
  try {
    const response: Encounter = await oystehr.fhir.patch({
      resourceType: 'Encounter',
      id: encId,
      operations: patchOperations,
    });
    return response;
  } catch (error: any) {
    console.log(`Failed to patch Encounter: ${JSON.stringify(error)}`);
    throw new Error(`Failed to patch Encounter: ${JSON.stringify(error)}`);
  }
}

export { mapStatusToTelemed };

export const telemedStatusToEncounter = (telemedStatus: TelemedCallStatuses): Encounter['status'] => {
  switch (telemedStatus) {
    case 'ready':
      return 'planned';
    case 'pre-video':
      return 'arrived';
    case 'on-video':
      return 'in-progress';
    case 'unsigned':
      return 'finished';
    case 'complete':
      return 'finished';
    case 'cancelled':
      return 'cancelled';
  }
};

export { removePrefix } from 'utils';

export interface AppointmentInsuranceRelatedResRefs {
  primaryCoverage?: string;
  primaryCoverageEligibilityRequest?: string;
  primaryCoverageEligibilityResponse?: string;
  secondaryCoverage?: string;
  secondaryCoverageEligibilityRequest?: string;
  secondaryCoverageEligibilityResponse?: string;
}

export function getInsuranceRelatedRefsFromAppointmentExtension(
  appointment: Appointment
): AppointmentInsuranceRelatedResRefs {
  const result: AppointmentInsuranceRelatedResRefs = {};
  const mainExtension = appointment.extension?.find(
    (ext) => ext.url === AppointmentInsuranceRelatedResourcesExtension.extensionUrl
  );
  mainExtension?.extension?.forEach((ext) => {
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.coverage.url)
      result.primaryCoverage = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.eligibilityRequest.url)
      result.primaryCoverageEligibilityRequest = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.primaryCoverage.eligibilityResponse.url)
      result.primaryCoverageEligibilityResponse = ext.valueReference?.reference;

    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.coverage.url)
      result.secondaryCoverage = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.eligibilityRequest.url)
      result.secondaryCoverageEligibilityRequest = ext.valueReference?.reference;
    if (ext.url === AppointmentInsuranceRelatedResourcesExtension.secondaryCoverage.eligibilityResponse.url)
      result.secondaryCoverageEligibilityResponse = ext.valueReference?.reference;
  });
  return result;
}

export function checkUserPhoneNumber(patient: PatientInfo, user: User): string {
  let patientNumberToText: string | undefined = undefined;

  // If the user is the ottehr staff, which happens when using the add-patient page,
  // user.name will not be a phone number, like it would be for a patient. In this
  // case, we must insert the patient's phone number using patient.phoneNumber
  // we use .startsWith('+') because the user's phone number will start with "+"
  const isEHRUser = checkIsEHRUser(user);
  if (isEHRUser) {
    // User is ottehr staff
    if (!patient.phoneNumber) {
      throw new Error('No phone number found for patient');
    }
    patientNumberToText = formatPhoneNumber(patient.phoneNumber);
    if (!patientNumberToText) {
      throw new Error('Patient phone number has some wrong format');
    }
  } else {
    // User is patient and auth0 already appends a +1 to the phone number
    patientNumberToText = user.name;
  }
  return patientNumberToText;
}

export async function createUpdateUserRelatedResources(
  oystehr: Oystehr,
  patientInfo: PatientInfo,
  fhirPatient: Patient,
  user: User
): Promise<{ relatedPersonRef: string | undefined; verifiedPhoneNumber: string | undefined }> {
  console.log('patient info: ' + JSON.stringify(patientInfo));

  let verifiedPhoneNumber: string | undefined = undefined;

  if (!patientInfo.id && fhirPatient.id) {
    console.log('New patient');
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    verifiedPhoneNumber = checkUserPhoneNumber(patientInfo, user);
    const userResource = await createUserResourcesForPatient(oystehr, fhirPatient.id, verifiedPhoneNumber);
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

export function creatingPatientUpdateRequest(
  patient: PatientInfo,
  maybeFhirPatient: Patient
): BatchInputRequest<Patient> | undefined {
  if (!patient.id) return undefined;
  console.log(`Have patient.id, ${patient.id} fetching Patient and building PATCH request`);

  let updatePatientRequest: BatchInputRequest<Patient> | undefined = undefined;

  const patientPatchOperations: Operation[] = [];

  // store form user (aka emailUser)
  let patientExtension = maybeFhirPatient.extension || [];

  // Store weight
  const weightExtIndex = patientExtension.findIndex((ext) => ext.url === FHIR_EXTENSION.Patient.weight.url);
  const weightLastUpdatedIndex = patientExtension.findIndex(
    (ext) => ext.url === FHIR_EXTENSION.Patient.weightLastUpdated.url
  );
  if (patient.weight) {
    const newWeight = String(patient.weight);
    const weight = {
      url: FHIR_EXTENSION.Patient.weight.url,
      valueString: newWeight,
    };
    const weightLastUpdated = {
      url: FHIR_EXTENSION.Patient.weightLastUpdated.url,
      valueString: DateTime.now().toFormat('yyyy-LL-dd'),
    };
    // Check if weight exists
    if (weightExtIndex >= 0) {
      // Update weight if supplied to update weightLastUpdated
      patientExtension[weightExtIndex] = weight;
      patientExtension[weightLastUpdatedIndex] = weightLastUpdated;
    } else if (weightLastUpdatedIndex >= 0) {
      // Patient weight used to exist but has been removed, add to patch operations
      patientExtension.push(weight);
      patientExtension[weightLastUpdatedIndex] = weightLastUpdated;
    } else {
      // Since no extensions exist, it must be added via patch operations
      patientExtension.push(weight);
      patientExtension.push(weightLastUpdated);
    }
  } else if (weightLastUpdatedIndex >= 0 && weightExtIndex >= 0) {
    // Weight removed but has been provided before
    patientExtension = [...patientExtension.slice(0, weightExtIndex), ...patientExtension.slice(weightExtIndex + 1)];
    // Do not update weight last updated date
  }

  if (patient.authorizedNonLegalGuardians) {
    const extensionValue = {
      url: FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url,
      valueString: String(patient.authorizedNonLegalGuardians),
    };
    const authorizedNonLegalGuardiansIndex = patientExtension.findIndex(
      (ext) => ext.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url
    );
    if (authorizedNonLegalGuardiansIndex >= 0) {
      patientExtension[authorizedNonLegalGuardiansIndex] = extensionValue;
    } else {
      patientExtension.push(extensionValue);
    }
  }

  console.log('patient extension', patientExtension);

  patientPatchOperations.push({
    op: maybeFhirPatient.extension ? 'replace' : 'add',
    path: '/extension',
    value: patientExtension,
  });

  const emailPatchOps = getPatientPatchOpsPatientEmail(maybeFhirPatient, patient.email);
  if (emailPatchOps.length >= 1) {
    patientPatchOperations.push(...emailPatchOps);
  }

  const fhirPatientName = assertDefined(maybeFhirPatient.name, 'patient.name');

  let fhirPatientOfficialNameIndex = fhirPatientName.findIndex((name) => name.use === 'official');

  if (fhirPatientOfficialNameIndex === -1) {
    fhirPatientOfficialNameIndex = 0;
  }

  const fhirPatientMiddleName = fhirPatientName[fhirPatientOfficialNameIndex].given?.[1];

  if (patient.middleName && !fhirPatientMiddleName) {
    console.log('adding patch op to add middle name', patient.middleName);
    patientPatchOperations.push({
      op: 'add',
      path: `/name/${fhirPatientOfficialNameIndex}/given/1`,
      value: patient.middleName,
    });
  }

  const fhirPatientPreferredName = maybeFhirPatient?.name?.find((name) => name.use === 'nickname');
  const fhirPatientPreferredNameIndex = maybeFhirPatient.name?.findIndex((name) => name.use === 'nickname');

  if (patient.chosenName) {
    if (fhirPatientPreferredName) {
      if (fhirPatientPreferredName.given?.[0] !== patient.chosenName) {
        patientPatchOperations.push({
          op: 'replace',
          path: `/name/${fhirPatientPreferredNameIndex}/given/0`,
          value: patient.chosenName,
        });
      }
    } else {
      patientPatchOperations.push({
        op: 'add',
        path: `/name/-`,
        value: {
          given: [patient.chosenName],
          use: 'nickname',
        },
      });
    }
  }

  if (patient.sex !== maybeFhirPatient.gender) {
    // a value exists in the gender path on the patient resource
    if (maybeFhirPatient.gender) {
      patientPatchOperations.push({
        op: 'replace',
        path: `/gender`,
        value: patient.sex,
      });
    } else {
      patientPatchOperations.push({
        op: 'add',
        path: `/gender`,
        value: patient.sex,
      });
    }
  }

  const patientDateOfBirth = removeTimeFromDate(patient.dateOfBirth ?? '');
  if (maybeFhirPatient.birthDate !== patientDateOfBirth) {
    patientPatchOperations.push({
      op: maybeFhirPatient.birthDate ? 'replace' : 'add',
      path: '/birthDate',
      value: patientDateOfBirth,
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

export function getPatientPatchOpsPatientEmail(maybeFhirPatient: Patient, email: string | undefined): Operation[] {
  const patientPatchOperations: Operation[] = [];
  // update email
  if (email) {
    const telecom = maybeFhirPatient.telecom;
    const curEmail = telecom?.find((telecomToCheck) => telecomToCheck.system === 'email');
    const curEmailIndex = telecom?.findIndex((telecomToCheck) => telecomToCheck.system === 'email');
    // check email exists in telecom but is different
    if (telecom && curEmailIndex && curEmailIndex > -1 && email !== curEmail) {
      telecom[curEmailIndex] = {
        system: 'email',
        value: email,
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
        value: email,
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
            value: email,
          },
        ],
      });
    }
  }
  return [];
}

export function creatingPatientCreateRequest(
  patient: PatientInfo,
  isEHRUser: boolean
): BatchInputPostRequest<Patient> | undefined {
  let createPatientRequest: BatchInputPostRequest<Patient> | undefined = undefined;

  if (!patient.firstName) {
    throw new Error('First name is undefined');
  }
  console.log('building patient resource');
  const patientResource: Patient = {
    resourceType: 'Patient',
    name: [
      {
        given: patient.middleName ? [patient.firstName, patient.middleName] : [patient.firstName],
        family: patient.lastName,
        use: 'official',
      },
    ],
    birthDate: removeTimeFromDate(patient.dateOfBirth ?? ''),
    gender: patient.sex,
    active: true,
  };
  if (patient.chosenName) {
    patientResource.name!.push({
      given: [patient.chosenName],
      use: 'nickname',
    });
  }
  if (patient.tags?.length) {
    patientResource.meta = {
      tag: patient.tags,
    };
  }
  if (patient.weight) {
    patientResource.extension?.push({
      url: FHIR_EXTENSION.Patient.weight.url,
      valueString: String(patient.weight),
    });
    patientResource.extension?.push({
      url: FHIR_EXTENSION.Patient.weightLastUpdated.url,
      valueString: DateTime.now().toFormat('yyyy-LL-dd'),
    });
  }

  if (patient.email) {
    if (isEHRUser) {
      patientResource.telecom = [
        {
          system: 'email',
          value: patient.email,
        },
        {
          system: 'phone',
          value: normalizePhoneNumber(patient.phoneNumber),
        },
      ];
    } else {
      patientResource.telecom = [
        {
          system: 'email',
          value: patient.email,
        },
      ];
    }
  }

  if (patient.address) {
    patientResource.address = patient.address;
  }

  if (patient.authorizedNonLegalGuardians) {
    if (!patientResource.extension) {
      patientResource.extension = [];
    }
    patientResource.extension.push({
      url: FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url,
      valueString: String(patient.authorizedNonLegalGuardians),
    });
  }

  console.log('creating patient request for new patient resource');
  createPatientRequest = {
    method: 'POST',
    url: '/Patient',
    fullUrl: `urn:uuid:${uuid()}`,
    resource: patientResource,
  };

  return createPatientRequest;
}

export async function generatePatientRelatedRequests(
  user: User,
  patient: PatientInfo,
  oystehr: Oystehr
): Promise<{
  updatePatientRequest: BatchInputRequest<Patient> | undefined;
  createPatientRequest: BatchInputPostRequest<Patient> | undefined;
  listRequests: BatchInputRequest<List>[];
  verifiedPhoneNumber: string | undefined;
  isEHRUser: boolean;
  maybeFhirPatient: Patient | undefined;
}> {
  let maybeFhirPatient: Patient | undefined = undefined;
  let updatePatientRequest: BatchInputRequest<Patient> | undefined = undefined;
  let createPatientRequest: BatchInputPostRequest<Patient> | undefined = undefined;
  let verifiedPhoneNumber: string | undefined = undefined;
  const listRequests: BatchInputRequest<List>[] = [];
  // if the user is the ottehr staff, which happens when using the add-patient page,
  // user.name will not be a phone number, like it would be for a patient. In this
  // case, we must insert the patient's phone number using patient.phoneNumber
  // we use .startsWith('+') because the user's phone number will start with "+"
  const isEHRUser = checkIsEHRUser(user);

  // if it is a returning patient
  if (patient.id) {
    console.log(`Have patient.id, ${patient.id} fetching Patient and building PATCH request`);
    const { patient: foundPatient, verifiedPhoneNumber: foundPhoneNumber } =
      await getPatientResourceWithVerifiedPhoneNumber(patient.id, oystehr);
    maybeFhirPatient = foundPatient;
    verifiedPhoneNumber = foundPhoneNumber;
    if (!maybeFhirPatient) {
      throw PATIENT_NOT_FOUND_ERROR;
    }

    updatePatientRequest = creatingPatientUpdateRequest(patient, maybeFhirPatient);
  } else {
    createPatientRequest = creatingPatientCreateRequest(patient, isEHRUser);

    if (createPatientRequest?.fullUrl) {
      const patientLists = createPatientDocumentLists(createPatientRequest.fullUrl);
      listRequests.push(
        ...patientLists.map(
          (list): BatchInputPostRequest<List> => ({
            method: 'POST',
            url: '/List',
            resource: list,
          })
        )
      );
    }
  }

  return {
    updatePatientRequest,
    createPatientRequest,
    listRequests,
    verifiedPhoneNumber,
    isEHRUser,
    maybeFhirPatient,
  };
}
