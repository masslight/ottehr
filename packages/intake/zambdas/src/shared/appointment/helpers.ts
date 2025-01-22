import Oystehr, { BatchInputPostRequest, BatchInputRequest, User } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { List, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { uuid } from 'short-uuid';
import {
  FHIR_EXTENSION,
  PATIENT_NOT_FOUND_ERROR,
  PatientInfo,
  createPatientDocumentLists,
  createUserResourcesForPatient,
  formatPhoneNumber,
  getPatchBinary,
  getPatientResourceWithVerifiedPhoneNumber,
  removeTimeFromDate,
} from 'utils';

export function checkUserPhoneNumber(patient: PatientInfo, user: User): string {
  let patientNumberToText: string | undefined = undefined;

  // If the user is the ottehr staff, which happens when using the add-patient page,
  // user.name will not be a phone number, like it would be for a patient. In this
  // case, we must insert the patient's phone number using patient.phoneNumber
  // we use .startsWith('+') because the user's phone number will start with "+"
  const isEHRUser = !user.name.startsWith('+');
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

  // Update chosen name
  const chosenNameExtMaybe = patientExtension.find((ext) => ext.url === FHIR_EXTENSION.Patient.chosenName.url);
  const chosenNameExtIndex = patientExtension.findIndex((ext) => ext.url === FHIR_EXTENSION.Patient.chosenName.url);
  if (patient.chosenName) {
    const chosenName = {
      url: FHIR_EXTENSION.Patient.chosenName.url,
      valueString: patient.chosenName,
    };
    // Check if chosenName exists
    if (chosenNameExtMaybe) {
      // Thus chosenNameExtIndex !== -1
      const chosenNameExt = chosenNameExtMaybe;
      if (chosenNameExt.valueString !== patient.chosenName) {
        // Update if chosenName needs to be updated
        patientExtension[chosenNameExtIndex] = chosenName;
      } else {
        // If chosenName does not exist within the extension, add it
        patientExtension.push(chosenName);
      }
    } else {
      // Since no extensions exist, it must be added via patch operations
      patientExtension.push(chosenName);
    }
  } else if (chosenNameExtIndex >= 0) {
    // Since chosenName exists within the extension but no new name is provided, delete the old one
    patientExtension = [
      ...patientExtension.slice(0, chosenNameExtIndex),
      ...patientExtension.slice(chosenNameExtIndex + 1),
    ];
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

  const fhirPatientMiddleName = maybeFhirPatient?.name?.[0].given?.[1];

  if (patient.middleName && !fhirPatientMiddleName) {
    console.log('adding patch op to add middle name', patient.middleName);
    patientPatchOperations.push({
      op: 'add',
      path: `/name/0/given/1`,
      value: patient.middleName,
    });
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
    const curEmail = telecom?.find((tele) => tele.system === 'email');
    const curEmailidx = telecom?.findIndex((tele) => tele.system === 'email');
    // check email exists in telecom but is different
    if (telecom && curEmailidx && curEmailidx > -1 && email !== curEmail) {
      telecom[curEmailidx] = {
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
      },
    ],
    birthDate: removeTimeFromDate(patient.dateOfBirth ?? ''),
    gender: patient.sex,
    active: true,
  };
  if (patient.chosenName) {
    patientResource.extension?.push({
      url: FHIR_EXTENSION.Patient.chosenName.url,
      valueString: patient.chosenName,
    });
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
          value: patient.phoneNumber,
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
  const isEHRUser = !user.name.startsWith('+');

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
