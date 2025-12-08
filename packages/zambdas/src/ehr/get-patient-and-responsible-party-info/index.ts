import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Patient, RelatedPerson, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  FHIR_RESOURCE_NOT_FOUND,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getActiveAccountGuarantorReference,
  getEmailForIndividual,
  getFullName,
  GetPatientAndResponsiblePartyInfoEndpointOutput,
  getPatientReferenceFromAccount,
  getPhoneNumberForIndividual,
  getSecret,
  getSMSNumberForIndividual,
  mapGenderToLabel,
  PATIENT_NOT_FOUND_ERROR,
  PATIENT_PHONE_NOT_FOUND_ERROR,
  RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR,
  SecretsKeys,
  takeContainedOrFind,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'get-patient-and-responsible-party-info';

type PatientResources = { patient: Patient; responsibleParty: RelatedPerson; patientPhoneNumber: string };

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, patientId } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const patientResources = await getAndValidateFhirResources(oystehr, patientId);

    const response = complexValidation(patientResources);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    console.error('Error occurred:', error);
    return await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

async function getAndValidateFhirResources(oystehr: Oystehr, patientId: string): Promise<PatientResources> {
  console.log('🔍 Fetching FHIR resources for invoiceable patients...');

  const resourcesResponse = await oystehr.fhir.search({
    resourceType: 'Patient',
    params: [
      {
        name: '_id',
        value: patientId,
      },
      {
        name: '_revinclude',
        value: 'Account:patient',
      },
      {
        name: '_revinclude',
        value: 'RelatedPerson:patient',
      },
    ],
  });
  const resources = resourcesResponse.unbundle();
  console.log('Fetched FHIR resources:', resources.length);

  const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
  const account = resources.find(
    (resource) =>
      resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
  ) as Account;
  const relatedPerson = resources.find(
    (resource) =>
      resource.resourceType === 'RelatedPerson' &&
      (resource as RelatedPerson).relationship?.find(
        (relationship) => relationship.coding?.find((code) => code.code === 'user-relatedperson')
      )
  ) as RelatedPerson;
  if (!patient) throw PATIENT_NOT_FOUND_ERROR;
  if (!account) throw FHIR_RESOURCE_NOT_FOUND('Account');
  if (!relatedPerson) throw FHIR_RESOURCE_NOT_FOUND('RelatedPerson');

  const patientPhoneNumber = getSMSNumberForIndividual(relatedPerson);
  if (!patientPhoneNumber) throw PATIENT_PHONE_NOT_FOUND_ERROR;

  const responsiblePartyRef = getActiveAccountGuarantorReference(account);
  if (!responsiblePartyRef)
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No responsible party reference found for account: ${account.id}`);
  const responsibleParty = takeContainedOrFind(responsiblePartyRef, resources as Resource[], account) as
    | RelatedPerson
    | undefined;
  if (!responsibleParty)
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Responsible party (fhir RelatedPerson) not found for account: ${account.id}`);

  return { patient, responsibleParty, patientPhoneNumber };
}

function complexValidation(patientResources: PatientResources): GetPatientAndResponsiblePartyInfoEndpointOutput {
  const { patient, responsibleParty, patientPhoneNumber } = patientResources;

  const patientName = getFullName(patient);
  const patientDob = patient?.birthDate
    ? DateTime.fromISO(patient.birthDate)?.toFormat('MM/dd/yyyy')?.toString()
    : undefined;
  const patientGenderLabel = patient?.gender && mapGenderToLabel[patient.gender];

  const responsiblePartyName = getFullName(responsibleParty);
  const responsiblePartyPhoneNumber = getPhoneNumberForIndividual(responsibleParty);
  const responsiblePartyEmail = getEmailForIndividual(responsibleParty);

  if (!patientDob) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('DOB was not found for patient');
  if (!responsiblePartyEmail)
    throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Email was not found for responsible party');
  if (!patientGenderLabel) throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Gender was not found for patient');

  return {
    patient: {
      fullName: patientName,
      dob: patientDob,
      gender: patientGenderLabel,
      phoneNumber: patientPhoneNumber,
    },
    responsibleParty: {
      fullName: responsiblePartyName,
      email: responsiblePartyEmail,
      phoneNumber: responsiblePartyPhoneNumber,
    },
  };
}
