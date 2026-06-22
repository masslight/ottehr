import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, DocumentReference, Patient, Practitioner, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EMPLOYEE_ID_SYSTEM,
  FAX_SENT_PROVENANCE_ACTIVITY_CODING,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getFullestAvailableName,
  getSecret,
  PARTICIPATION_CODE_SYSTEM,
  SecretsKeys,
  SendFaxZambdaInput,
  VISIT_NOTE_SUMMARY_CODE,
} from 'utils';
import { checkOrCreateM2MClientToken, getUser, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
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
  const oystehr = createOystehrClient(m2mToken, validatedInput.secrets);
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

interface EffectInput {
  appointmentId: string;
  faxNumber: string;
  organizationId: string;
  patientId: string;
  media: string;
  userPractitioner: Practitioner;
}

const complexValidation = async (
  validatedInput: SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  user: User
): Promise<EffectInput> => {
  const { appointmentId, faxNumber, secrets } = validatedInput;
  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

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
      id: user.profile.split('/')[1],
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
  if (!patientId || !media) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Patient or visit note url not found');
  }
  console.log('patient id', patientId);
  console.log('media url', media);

  return { appointmentId, faxNumber, organizationId, patientId, media, userPractitioner };
};

const performEffect = async (
  input: EffectInput,
  oystehr: Oystehr,
  user: User
): Promise<{ body: string; statusCode: number }> => {
  const { appointmentId, faxNumber, organizationId, patientId, media, userPractitioner } = input;

  console.log('Sending fax to', faxNumber);
  const { communicationResource: fax } = await oystehr.fax.send({
    media,
    quality: 'standard',
    patient: `Patient/${patientId}`,
    recipientNumber: faxNumber,
    sender: `Organization/${organizationId}`,
  });
  console.log('Fax sent successfully');

  // Strip the +1 country code prefix and any non-digit characters to produce a valid FHIR id
  const containedId = faxNumber.replace(/^\+1/, '').replace(/\D/g, '');
  console.log('Creating provenance for fax');
  const provenance = await oystehr.fhir.create<Provenance>({
    resourceType: 'Provenance',
    target: [
      {
        reference: `Communication/${fax.id!}`,
      },
      {
        reference: `Appointment/${appointmentId}`,
      },
    ],
    occurredDateTime: fax.sent,
    recorded: DateTime.now().toUTC().toISO(),
    activity: {
      coding: [FAX_SENT_PROVENANCE_ACTIVITY_CODING],
    },
    agent: [
      {
        role: [
          {
            coding: [
              {
                system: PARTICIPATION_CODE_SYSTEM,
                code: 'AUT',
                display: 'author',
              },
            ],
          },
        ],
        who: {
          reference: `Practitioner/${userPractitioner.id}`,
          display: getFullestAvailableName(userPractitioner),
          identifier: {
            value: user.id,
            system: EMPLOYEE_ID_SYSTEM,
          },
        },
        onBehalfOf: {
          reference: `Organization/${organizationId}`,
        },
      },
      {
        role: [
          {
            coding: [
              {
                system: PARTICIPATION_CODE_SYSTEM,
                code: 'SBJ',
                display: 'subject',
              },
            ],
          },
        ],
        who: {
          reference: `Patient/${patientId}`,
        },
      },
      {
        role: [
          {
            coding: [
              {
                system: PARTICIPATION_CODE_SYSTEM,
                code: 'RCV',
                display: 'receiver',
              },
            ],
          },
        ],
        who: {
          reference: `#${containedId}`,
        },
      },
    ],
    contained: [
      {
        resourceType: 'Practitioner',
        id: containedId,
        telecom: [
          {
            system: 'fax',
            value: faxNumber,
          },
        ],
      },
    ],
  });
  console.log('Fax provenance created successfully', provenance.id);

  return {
    body: JSON.stringify('Fax sent'),
    statusCode: 200,
  };
};
