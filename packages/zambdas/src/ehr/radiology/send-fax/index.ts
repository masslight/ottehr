import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Practitioner, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  EMPLOYEE_ID_SYSTEM,
  FAX_SENT_PROVENANCE_ACTIVITY_CODING,
  getFullestAvailableName,
  getSecret,
  PARTICIPATION_CODE_SYSTEM,
  Secrets,
  SecretsKeys,
  SendRadiologyOrderFaxZambdaInput,
  SendRadiologyOrderFaxZambdaOutput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  getUser,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { createRadiologyOrderFormPDF } from '../../../shared/pdf/radiology-order-form-pdf';
import { gatherRadiologyOrderFormInput } from '../shared/order-form-resources';
import { validateInput, validateSecrets } from './validation';

let m2mToken: string;

const ZAMBDA_NAME = 'radiology-send-fax';

export const index = wrapHandler(ZAMBDA_NAME, async (unsafeInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const secrets = validateSecrets(unsafeInput.secrets);
  const { body } = validateInput(unsafeInput);

  const user = await getUser(unsafeInput.headers.Authorization.replace('Bearer ', ''), secrets);

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

  // Regenerate the order-form PDF so the faxed copy reflects the current order, then fax the Z3 media.
  const { input, refs } = await gatherRadiologyOrderFormInput(serviceRequestId, oystehr);
  const { documentReference } = await createRadiologyOrderFormPDF(input, refs, secrets, token);
  const media = documentReference.content?.[0]?.attachment?.url;
  if (!media) {
    throw new Error('Radiology order form PDF has no media URL to fax');
  }

  console.log('Sending radiology order fax to', faxNumber);
  const { communicationResource: fax } = await oystehr.fax.send({
    media,
    quality: 'standard',
    patient: `Patient/${refs.patientId}`,
    recipientNumber: faxNumber,
    sender: `Organization/${organizationId}`,
  });

  await writeFaxProvenance(
    fax.id!,
    fax.sent,
    refs.serviceRequestId,
    refs.patientId,
    faxNumber,
    organizationId,
    user,
    oystehr
  );

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
