import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Patient, Practitioner } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getFullestAvailableName,
  getSecret,
  removePrefix,
  SecretsKeys,
  SendFaxZambdaInput,
  standardizePhoneNumber,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getUser,
  sendFaxAttempt,
  SendFaxAttemptInput,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'send-fax';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  console.group('validateRequestParameters()');
  const validatedInput = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters() success');
  console.log('appointmentId', validatedInput.appointmentId, 'faxNumber', validatedInput.faxNumber);

  const authorization = input.headers.Authorization;
  const user = await getUser(authorization.replace('Bearer ', ''), validatedInput.secrets);

  console.group('checkOrCreateM2MClientToken() then createOystehrClient()');
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);
  console.groupEnd();
  console.debug('checkOrCreateM2MClientToken() then createOystehrClient() success');

  console.group('complexValidation()');
  const effectInput = await complexValidation(validatedInput, oystehr, user);
  console.groupEnd();
  console.debug('complexValidation() success');

  console.group('performEffect()');
  const response = await performEffect(effectInput, oystehr, user);
  console.groupEnd();
  console.debug('performEffect() success', JSON.stringify(response));

  return response;
});

const complexValidation = async (
  validatedInput: SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  user: User
): Promise<SendFaxAttemptInput> => {
  const { appointmentId, faxNumber, secrets } = validatedInput;
  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
  const practitionerId = removePrefix('Practitioner/', user.profile);
  if (!practitionerId) throw new Error('User practitioner reference is invalid');

  console.log('searching fhir for patient, visit note, and user');
  const [bundle, userPractitioner] = await Promise.all([
    // also includes other actors but i'm not using them so i won't include their types
    oystehr.fhir.search<Appointment | DocumentReference | Patient>({
      resourceType: 'Appointment',
      params: [
        {
          name: '_id',
          value: appointmentId,
        },
        {
          name: '_include',
          value: 'Appointment:actor',
        },
        {
          name: '_revinclude',
          value: 'DocumentReference:related',
        },
      ],
    }),
    oystehr.fhir.get<Practitioner>({
      resourceType: 'Practitioner',
      id: practitionerId,
    }),
  ]);

  const resources = bundle.unbundle();
  const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
  const visitNote = resources.find(
    (resource) =>
      resource.resourceType === 'DocumentReference' &&
      resource.type?.coding?.find((coding) => coding.code === VISIT_NOTE_SUMMARY_CODE)
  ) as DocumentReference;

  const patientId = patient?.id;
  const media = visitNote?.content[0].attachment.url;
  if (!patientId || !media || !visitNote.id) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Patient or visit note url not found');
  }
  console.log('patient id', patientId);
  console.log('media url', media);

  return {
    appointmentId,
    faxNumber,
    organizationId,
    patientId,
    media,
    documentReferenceId: visitNote.id,
    userPractitioner,
    recipientName: findRecipientName(patient, faxNumber),
    senderId: user.id,
  };
};

/**
 * Resolves the recipient's name for the fax log: the number typed by the user identifies a person
 * only when it matches a practitioner contained on the Patient (i.e. their PCP).
 */
export const findRecipientName = (patient: Patient, faxNumber: string): string | undefined => {
  const standardizedFaxNumber = standardizePhoneNumber(faxNumber);
  if (!standardizedFaxNumber) return undefined;
  const match = patient.contained?.find(
    (resource): resource is Practitioner =>
      resource.resourceType === 'Practitioner' &&
      Boolean(resource.telecom?.some((telecom) => standardizePhoneNumber(telecom.value) === standardizedFaxNumber))
  );
  return match?.name?.length ? getFullestAvailableName(match) : undefined;
};

const performEffect = async (
  input: SendFaxAttemptInput,
  oystehr: Oystehr,
  _user: User
): Promise<{ body: string; statusCode: number }> => {
  await sendFaxAttempt(input, oystehr);
  return {
    body: JSON.stringify('Fax sent'),
    statusCode: 200,
  };
};
