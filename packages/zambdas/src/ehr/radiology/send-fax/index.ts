import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EMPLOYEE_ID_SYSTEM,
  FAX_SENT_PROVENANCE_ACTIVITY_CODING,
  PARTICIPATION_CODE_SYSTEM,
} from 'utils/lib/fhir/constants';
import { getFullestAvailableName } from 'utils/lib/fhir/patient';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import { SendRadiologyOrderFaxZambdaInput, SendRadiologyOrderFaxZambdaOutput } from 'utils/lib/types/api/radiology';
import { checkOrCreateM2MClientToken, getUser } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { getOrCreateRadiologyOrderForm } from '../shared/order-form-resources';
import { validateInput, validateSecrets } from './validation';

let m2mToken: string;

const ZAMBDA_NAME = 'radiology-send-fax';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);
  const { body, callerAccessToken } = validateInput(unsafeInput);

  const user = await getUser(callerAccessToken, secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output = await performEffect(body, secrets, m2mToken, oystehr, user);

  return { statusCode: 200, body: JSON.stringify(output) };
});

const performEffect = async (
  body: SendRadiologyOrderFaxZambdaInput,
  secrets: Secrets,
  token: string,
  oystehr: Oystehr,
  user: User
): Promise<SendRadiologyOrderFaxZambdaOutput> => {
  const { serviceRequestId, faxNumber } = body;
  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);

  // Fax the form on file so the recipient gets the document that was printed and reviewed here.
  const { mediaUrl: media, patientId } = await getOrCreateRadiologyOrderForm(serviceRequestId, secrets, token, oystehr);

  console.log('Sending radiology order fax to', faxNumber);
  const { communicationResource: fax } = await oystehr.fax.send({
    media,
    quality: 'standard',
    patient: `Patient/${patientId}`,
    recipientNumber: faxNumber,
    sender: `Organization/${organizationId}`,
  });

  await writeFaxProvenance(fax.id!, fax.sent, serviceRequestId, patientId, faxNumber, organizationId, user, oystehr);

  return { communicationId: fax.id! };
};

const writeFaxProvenance = async (
  communicationId: string,
  sentDateTime: string | undefined,
  serviceRequestId: string,
  patientId: string,
  faxNumber: string,
  organizationId: string,
  user: User,
  oystehr: Oystehr
): Promise<void> => {
  const userPractitioner = await oystehr.fhir.get<Practitioner>({
    resourceType: 'Practitioner',
    id: user.profile.split('/')[1],
  });
  // Strip the +1 country code and non-digits to produce a valid FHIR contained id.
  const containedId = faxNumber.replace(/^\+1/, '').replace(/\D/g, '');

  await oystehr.fhir.create<Provenance>({
    resourceType: 'Provenance',
    target: [{ reference: `Communication/${communicationId}` }, { reference: `ServiceRequest/${serviceRequestId}` }],
    occurredDateTime: sentDateTime,
    recorded: DateTime.now().toUTC().toISO() ?? undefined,
    activity: { coding: [FAX_SENT_PROVENANCE_ACTIVITY_CODING] },
    agent: [
      {
        role: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: 'AUT', display: 'author' }] }],
        who: {
          reference: `Practitioner/${userPractitioner.id}`,
          display: getFullestAvailableName(userPractitioner),
          identifier: { value: user.id, system: EMPLOYEE_ID_SYSTEM },
        },
        onBehalfOf: { reference: `Organization/${organizationId}` },
      },
      {
        role: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: 'SBJ', display: 'subject' }] }],
        who: { reference: `Patient/${patientId}` },
      },
      {
        role: [{ coding: [{ system: PARTICIPATION_CODE_SYSTEM, code: 'RCV', display: 'receiver' }] }],
        who: { reference: `#${containedId}` },
      },
    ],
    contained: [
      {
        resourceType: 'Practitioner',
        id: containedId,
        telecom: [{ system: 'fax', value: faxNumber }],
      },
    ],
  });
};
