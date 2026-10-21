import { APIGatewayProxyResult } from 'aws-lambda';
import { DeviceRequest, Encounter, Practitioner } from 'fhir/r4b';
import { isPhoneNumberValid, removePrefix } from 'utils/lib/helpers/helpers';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { SendDmeOrderFaxInputSchema, SendDmeOrderFaxResponse } from 'utils/lib/types/api/dme.types';
import { INVALID_INPUT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, getUser, getUserToken } from '../../../shared/auth';
import { isDmeOrderDeleted, isDmeOrderExternal, parseDmeOrder } from '../../../shared/dme';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { sendFaxAttempt } from '../../../shared/send-fax-attempt';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { getOrCreateDmeOrderForm } from '../get-dme-order-pdf/helpers';

let m2mToken: string;

const ZAMBDA_NAME = 'send-dme-order-fax';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const userToken = getUserToken(input);
  const { deviceRequestId, faxNumber: rawFaxNumber, secrets } = validateWithSchema(SendDmeOrderFaxInputSchema, input);
  if (!isPhoneNumberValid(rawFaxNumber)) throw INVALID_INPUT_ERROR('"faxNumber" is not a valid phone number');
  const faxNumber = `+1${rawFaxNumber.replace(/\D/g, '').slice(-10)}`;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const user = await getUser(userToken, secrets);
  const practitionerId = removePrefix('Practitioner/', user.profile);
  if (!practitionerId) throw new Error('User practitioner reference is invalid');

  const [deviceRequest, userPractitioner] = await Promise.all([
    oystehr.fhir.get<DeviceRequest>({ resourceType: 'DeviceRequest', id: deviceRequestId }),
    oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId }),
  ]);
  if (isDmeOrderDeleted(deviceRequest)) throw INVALID_INPUT_ERROR('This DME order has been deleted');
  if (!isDmeOrderExternal(deviceRequest)) throw INVALID_INPUT_ERROR('Only external DME orders can be faxed');

  const patientId = removePrefix('Patient/', deviceRequest.subject.reference ?? '');
  const encounterId = removePrefix('Encounter/', deviceRequest.encounter?.reference ?? '');
  const [form, encounter] = await Promise.all([
    // the form on file is faxed, so the recipient gets the document that was printed and reviewed here
    getOrCreateDmeOrderForm(deviceRequestId, secrets, m2mToken, oystehr),
    encounterId ? oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId }) : undefined,
  ]);
  if (!patientId || !form.documentReference.id) throw new Error('DME order form is missing its patient or document');

  const attempt = await sendFaxAttempt(
    {
      appointmentId: removePrefix('Appointment/', encounter?.appointment?.[0]?.reference ?? '') || undefined,
      faxNumber,
      organizationId: getSecret(SecretsKeys.ORGANIZATION_ID, secrets),
      patientId,
      media: form.mediaUrl,
      documentReferenceId: form.documentReference.id,
      userPractitioner,
      recipientName: parseDmeOrder(deviceRequest, {}).thirdParty?.name,
      senderId: user.id,
    },
    oystehr
  );

  const response: SendDmeOrderFaxResponse = { outboundAttemptId: attempt.id! };
  return { statusCode: 200, body: JSON.stringify(response) };
});
