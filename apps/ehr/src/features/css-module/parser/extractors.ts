import {
  Appointment,
  ContactPoint,
  DocumentReference,
  Encounter,
  Extension,
  FhirResource,
  Location,
  Patient,
  QuestionnaireResponse,
} from 'fhir/r4b';
import { getQuestionnaireResponseByLinkId, isLocationVirtual } from 'utils';
import { WEIGHT_EXTENSION_URL, WEIGHT_LAST_UPDATED_EXTENSION_URL } from './constants';
import {
  AppointmentValues,
  EncounterValues,
  LocationValues,
  PatientValues,
  QuestionnaireResponseValues,
} from './types';

export const getAnswer = <T>(
  questionnaireResponse: QuestionnaireResponse | undefined,
  linkId: string,
  valueKey:
    | 'valueBoolean'
    | 'valueDecimal'
    | 'valueInteger'
    | 'valueDate'
    | 'valueDateTime'
    | 'valueTime'
    | 'valueString'
    | 'valueUri'
    | 'valueAttachment'
    | 'valueCoding'
    | 'valueQuantity'
    | 'valueReference'
): T | undefined => {
  const answer = questionnaireResponse?.item
    ?.flatMap((item) => item.item || [item])
    .find((item) => item.linkId === linkId)?.answer?.[0];

  if (answer && valueKey in answer) {
    return answer[valueKey] as T;
  }

  return undefined;
};

export const getStringAnswer = (
  questionnaireResponse: QuestionnaireResponse | undefined,
  linkId: string
): string | undefined => getAnswer<string>(questionnaireResponse, linkId, 'valueString');

export const getBooleanAnswer = (
  questionnaireResponse: QuestionnaireResponse | undefined,
  linkId: string
): boolean | undefined => getAnswer<boolean>(questionnaireResponse, linkId, 'valueBoolean');

export const extractResourceValues = <T extends FhirResource, K extends keyof T>(
  resource: T | undefined,
  keys: K[]
): Partial<Pick<T, K>> => {
  if (!resource) return {};
  return keys.reduce(
    (acc, key) => {
      if (resource[key] !== undefined) {
        acc[key] = resource[key];
      }
      return acc;
    },
    {} as Partial<Pick<T, K>>
  );
};

export const getAppointmentValues = (appointment: Appointment | undefined): AppointmentValues => {
  const values = extractResourceValues(appointment, ['id', 'start', 'end', 'status', 'description']);
  return {
    ...values,
    appointmentType: appointment?.appointmentType?.text,
  };
};

export const getPatientValues = (patient: Patient | undefined): PatientValues => {
  const values = extractResourceValues(patient, ['id', 'gender', 'birthDate']);
  if (!patient) return values;

  return {
    ...values,
    firstName: patient.name?.[0]?.given?.[0],
    lastName: patient.name?.[0]?.family,
    address: {
      ...patient.address?.[0],
      street1: patient.address?.[0]?.line?.[0],
      street2: patient.address?.[0]?.line?.[1],
    },
    email: patient.telecom?.find((telecom: ContactPoint) => telecom.system === 'email')?.value,
    phone: patient.telecom?.find((telecom: ContactPoint) => telecom.system === 'phone')?.value,
    ethnicity: getExtensionValue(patient, '/ethnicity'),
    race: getExtensionValue(patient, '/race'),
    weight: patient.extension?.find((extension) => extension.url === WEIGHT_EXTENSION_URL)?.valueString,
    weightLastUpdated: patient.extension?.find((extension) => extension.url === WEIGHT_LAST_UPDATED_EXTENSION_URL)
      ?.valueString,
  };
};

export const getExtensionValue = (patient: Patient | undefined, extensionUrl: string): string | undefined => {
  return patient?.extension?.find((extension: Extension) => extension.url.includes(extensionUrl))?.valueCodeableConcept
    ?.coding?.[0]?.display;
};

export const getLocationValues = (location: Location | undefined): LocationValues => {
  const values = extractResourceValues(location, ['id', 'name']);
  if (!location) return { ...values, address: {} };

  return {
    ...values,
    address: {
      ...location.address,
      street1: location.address?.line?.[0],
      street2: location.address?.line?.[1],
    },
    phone: location.telecom?.find((telecom: ContactPoint) => telecom.system === 'phone')?.value,
  };
};

export const getEncounterValues = (encounter: Encounter | undefined): EncounterValues =>
  extractResourceValues(encounter, ['id', 'status']);

export const getQuestionnaireResponseValues = (
  questionnaireResponse: QuestionnaireResponse | undefined
): QuestionnaireResponseValues => {
  if (!questionnaireResponse) return {};

  const questionnaireResponseKeys = {
    willBe18: 'patient-will-be-18',
    isNewPatient: 'is-new-qrs-patient',
    firstName: 'patient-first-name',
    lastName: 'patient-last-name',
    birthDateYear: 'patient-dob-year',
    birthDateMonth: 'patient-dob-month',
    birthDateDay: 'patient-dob-day',
    birthSex: 'patient-birth-sex',
    addressStreet1: 'patient-street-address',
    addressStreet2: 'patient-street-address-2',
    addressCity: 'patient-city',
    addressState: 'patient-state',
    addressZip: 'patient-zip',
    fillingOutAs: 'patient-filling-out-as',
    guardianEmail: 'guardian-email',
    guardianNumber: 'guardian-number',
    ethnicity: 'patient-ethnicity',
    race: 'patient-race',
    pronouns: 'patient-pronouns',
    customPronouns: 'patient-pronouns-custom',
  } as const;

  const result = {} as QuestionnaireResponseValues;

  for (const [key, linkId] of Object.entries(questionnaireResponseKeys)) {
    const stringValue = getStringAnswer(questionnaireResponse, linkId);
    const booleanValue = getBooleanAnswer(questionnaireResponse, linkId);
    result[key as keyof QuestionnaireResponseValues] = (stringValue ?? booleanValue) as any;
  }

  if (result.birthDateYear && result.birthDateMonth && result.birthDateDay) {
    result.birthDate = `${result.birthDateYear}-${result.birthDateMonth}-${result.birthDateDay}`;
  }

  return result;
};

export const extractUrlsFromAppointmentData = (resourceBundle: FhirResource[], documentCode: string): string[] => {
  return resourceBundle
    .filter(
      (resource: FhirResource): resource is DocumentReference =>
        resource.resourceType === 'DocumentReference' &&
        resource.status === 'current' &&
        resource.type?.coding?.[0].code === documentCode
    )
    .flatMap((documentReference) =>
      documentReference.content
        .map((content) => content.attachment.url)
        .filter((url): url is string => url !== undefined)
    );
};

export const getResources = (
  resourceBundle: FhirResource[] | null
): Partial<{
  appointment: Appointment;
  patient: Patient;
  location: Location;
  locationVirtual: Location;
  encounter: Encounter;
  questionnaireResponse: QuestionnaireResponse;
}> => {
  if (!resourceBundle) return {};

  const findResources = <T extends FhirResource>(resourceType: string): T[] | undefined =>
    resourceBundle.filter((resource: FhirResource) => resource.resourceType === resourceType) as T[] | undefined;

  const locations = findResources<Location>('Location');
  const virtualLocation = locations?.find(isLocationVirtual);
  const physicalLocation = locations?.find((location) => !isLocationVirtual(location));

  return {
    appointment: findResources<Appointment>('Appointment')?.[0],
    patient: findResources<Patient>('Patient')?.[0],
    location: physicalLocation,
    locationVirtual: virtualLocation,
    encounter: findResources<Encounter>('Encounter')?.[0],
    questionnaireResponse: findResources<QuestionnaireResponse>('QuestionnaireResponse')?.[0],
  };
};

export const getAllergies = (questionnaireResponse: QuestionnaireResponse | undefined): string | undefined => {
  const knownAllergies = getQuestionnaireResponseByLinkId('allergies', questionnaireResponse)?.answer?.[0]?.valueArray;
  return knownAllergies
    ? knownAllergies.map((answer) => answer['allergies-form-agent-substance']).join(', ')
    : undefined;
};

export const getHospitalizations = (questionnaireResponse: QuestionnaireResponse | undefined): string[] | undefined => {
  const knownHospitalizations = getQuestionnaireResponseByLinkId('hospitalization', questionnaireResponse)?.answer?.[0]
    ?.valueArray;
  return knownHospitalizations ? knownHospitalizations.map((item) => item.display) : undefined;
};
