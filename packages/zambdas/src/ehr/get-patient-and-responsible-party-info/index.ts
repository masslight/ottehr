import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Patient, RelatedPerson, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getActiveAccountGuarantorReference,
  getEmailForIndividual,
  getFullName,
  GetPatientAndResponsiblePartyInfoEndpointOutput,
  getPatientReferenceFromAccount,
  getPhoneNumberForIndividual,
  getSecret,
  getSMSNumberForIndividual,
  mapGenderToLabel,
  SecretsKeys,
  takeContainedOrFind,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getRelatedPersonForPatient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'get-patient-and-responsible-party-info';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, patientId } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const response = await performEffect(oystehr, patientId);

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

async function performEffect(
  oystehr: any,
  patientId: string
): Promise<GetPatientAndResponsiblePartyInfoEndpointOutput> {
  const patientResources = await getFhirPatientResources(oystehr, patientId);
  if (!patientResources) throw new Error(`Patient resources not found for patient: ${patientId}`);
  const { patient, responsibleParty, patientPhoneNumber } = patientResources;

  const patientName = getFullName(patient);
  const patientDob = patient?.birthDate
    ? DateTime.fromISO(patient.birthDate)?.toFormat('MM/dd/yyyy')?.toString()
    : undefined;
  const patientGenderLabel = patient?.gender && mapGenderToLabel[patient.gender];

  const responsiblePartyName = getFullName(responsibleParty);
  const responsiblePartyPhoneNumber = getPhoneNumberForIndividual(responsibleParty);
  const responsiblePartyEmail = getEmailForIndividual(responsibleParty);

  if (!patientDob) throw new Error('Date of birth was not found for patient');
  if (!responsiblePartyEmail) throw new Error('Email was not found for responsible party');
  if (!patientGenderLabel) throw new Error('Gender was not found for patient');
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
      phoneNumber: responsiblePartyPhoneNumber, // todo: verify what fields will be here in different responsible party modes?
    },
  };
}

async function getFhirPatientResources(
  oystehr: Oystehr,
  patientId: string
): Promise<{ patient: Patient; responsibleParty: RelatedPerson; patientPhoneNumber: string } | undefined> {
  try {
    console.log('🔍 Fetching FHIR resources for invoiceable patients...');

    const [resourcesResponse, relatedPerson] = await Promise.all([
      oystehr.fhir.search({
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
        ],
      }),
      getRelatedPersonForPatient(patientId, oystehr),
    ]);
    const resources = resourcesResponse.unbundle();
    console.log('Fetched FHIR resources:', resources.length);

    const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
    const account = resources.find(
      (resource) =>
        resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
    ) as Account;
    if (!patient || !account) return undefined;

    if (!relatedPerson) throw new Error(`No related person found for patient: ${patientId}`);
    const patientPhoneNumber = getSMSNumberForIndividual(relatedPerson);
    if (!patientPhoneNumber) throw new Error(`No verified phone number found for patient: ${patientId}`);

    const responsiblePartyRef = getActiveAccountGuarantorReference(account);
    if (!responsiblePartyRef) throw new Error(`No responsible party reference found for account: ${account.id}`);
    const responsibleParty = takeContainedOrFind(responsiblePartyRef, resources as Resource[], account) as
      | RelatedPerson
      | undefined;
    if (!responsibleParty) throw new Error(`No responsible party found for account: ${account.id}`);

    return { patient, responsibleParty, patientPhoneNumber };
  } catch (error) {
    const errorMessage = `Error fetching FHIR resources for patient ${patientId}: ${error}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }
}
