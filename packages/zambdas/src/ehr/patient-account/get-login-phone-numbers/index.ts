import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getCoding } from 'utils/lib/fhir/helpers';
import { Secrets } from 'utils/lib/secrets';
import { GetPatientLoginPhoneNumbersInput } from 'utils/lib/types/api/patient-login-phone-numbers.types';
import { INVALID_RESOURCE_ID_ERROR } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';

const ZAMBDA_NAME = 'get-login-phone-numbers';

let m2mToken: string;

interface Input extends GetPatientLoginPhoneNumbersInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (zambdaInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const input = validateRequestParameters(zambdaInput);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);
  const phoneNumbers = await getLoginPhoneNumbers(input, oystehr);
  return {
    statusCode: 200,
    body: JSON.stringify({ phoneNumbers }),
  };
});

const getLoginPhoneNumbers = async (input: Input, oystehr: Oystehr): Promise<string[]> => {
  const resources = (
    await oystehr.fhir.search<Patient | RelatedPerson>({
      resourceType: 'Patient',
      params: [
        {
          name: '_id',
          value: input.patientId,
        },
        {
          name: '_revinclude',
          value: 'RelatedPerson:patient',
        },
      ],
    })
  ).unbundle();

  const relatedPersons = resources.filter(
    (resource): resource is RelatedPerson =>
      resource.resourceType === 'RelatedPerson' &&
      getCoding(resource.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson'
  );

  if (relatedPersons.length === 0) {
    return [];
  }

  return relatedPersons
    .map((rp) => rp.telecom?.find((t) => t.system === 'sms')?.value)
    .filter((value): value is string => Boolean(value));
};

const validateRequestParameters = (input: ZambdaInput): Input => {
  const { patientId } = validateJsonBody(input);

  if (isValidUUID(patientId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('patientId');
  }

  return {
    patientId,
    secrets: input.secrets,
  };
};

export function getPersonPhone(person: Person): string | undefined {
  return person.telecom?.find((tel) => tel.system === 'phone')?.value;
}
