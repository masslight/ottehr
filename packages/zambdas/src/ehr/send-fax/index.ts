import Oystehr, { User } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Patient, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BUCKET_NAMES,
  FaxRecipient,
  getFullestAvailableName,
  getSecret,
  INVALID_INPUT_ERROR,
  MIME_TYPES,
  removePrefix,
  Secrets,
  SecretsKeys,
  SendFaxZambdaInput,
  SendFaxZambdaOutput,
  standardizePhoneNumber,
} from 'utils';
import {
  assembleFaxPacket,
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  FaxContent,
  FaxCoverAssets,
  FaxSender,
  FaxTransmission,
  getUser,
  loadFaxCoverAssets,
  renderFaxContent,
  resolveFaxSender,
  resolveFaxTransmissions,
  sendFaxAttempt,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'send-fax';

const COVER_TIMESTAMP_FORMAT = 'MM/dd/yyyy hh:mm a';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters()');
  const validatedInput = validateRequestParameters(input);
  console.groupEnd();
  console.debug('validateRequestParameters() success');
  console.log('fax target', validatedInput.target.type, 'recipients', validatedInput.recipients.length);

  const authorization = input.headers.Authorization;
  const user = await getUser(authorization.replace('Bearer ', ''), validatedInput.secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedInput.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedInput.secrets);

  const output = await performEffect(validatedInput, oystehr, user);

  return { statusCode: 200, body: JSON.stringify(output) };
});

const performEffect = async (
  input: SendFaxZambdaInput & Pick<ZambdaInput, 'secrets'>,
  oystehr: Oystehr,
  user: User
): Promise<SendFaxZambdaOutput> => {
  const { target, recipients, secrets } = input;
  const organizationId = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
  const practitionerId = removePrefix('Practitioner/', user.profile);
  if (!practitionerId) throw new Error('User practitioner reference is invalid');

  const [transmissions, userPractitioner] = await Promise.all([
    resolveFaxTransmissions(target, oystehr),
    oystehr.fhir.get<Practitioner>({ resourceType: 'Practitioner', id: practitionerId }),
  ]);

  const [{ sender, timezone: organizationTimezone }, coverAssets] = await Promise.all([
    resolveFaxSender(oystehr, organizationId, getFullestAvailableName(userPractitioner)),
    loadFaxCoverAssets(),
  ]);

  const attemptIds: string[] = [];
  let failureCount = 0;

  for (const transmission of transmissions) {
    // Lazily render once. Starting this after each recipient's attempt is persisted means download
    // and parsing failures are auditable without re-downloading documents for every recipient.
    let contentPromise: Promise<FaxContent> | undefined;
    const getContent = (): Promise<FaxContent> =>
      (contentPromise ??= renderFaxContent(transmission.attachments, m2mToken));
    for (const recipient of recipients) {
      try {
        const attemptId = await sendOneFax(
          {
            transmission,
            getContent,
            recipient,
            sender,
            coverAssets,
            organizationId,
            organizationTimezone,
            userPractitioner,
            secrets,
          },
          oystehr,
          user
        );
        attemptIds.push(attemptId);
      } catch (error) {
        // The attempt is already recorded as failed; keep going so one bad number doesn't
        // cost the other recipients their copy.
        console.error(`Failed to fax ${transmission.cover.title}: ${String(error)}`);
        failureCount++;
      }
    }
  }

  if (!attemptIds.length) {
    throw failureCount
      ? new Error('Every fax in this request failed to send')
      : INVALID_INPUT_ERROR('There are no faxable documents for this selection');
  }
  return { attemptIds, failureCount };
};

interface SendOneFaxInput {
  transmission: FaxTransmission;
  getContent: () => Promise<FaxContent>;
  recipient: FaxRecipient;
  sender: FaxSender;
  coverAssets: FaxCoverAssets;
  organizationId: string;
  /** Stamps faxes that don't belong to a single visit, which have no office timezone of their own. */
  organizationTimezone: string;
  userPractitioner: Practitioner;
  secrets: Secrets | null;
}

const sendOneFax = async (input: SendOneFaxInput, oystehr: Oystehr, user: User): Promise<string> => {
  const {
    transmission,
    getContent,
    recipient,
    sender,
    coverAssets,
    organizationId,
    organizationTimezone,
    userPractitioner,
    secrets,
  } = input;

  const media = makeZ3Url({
    secrets,
    patientID: transmission.patientId,
    bucketName: BUCKET_NAMES.OUTBOUND_FAXES,
    // Each recipient gets their own cover sheet, so each transmission is a distinct file.
    fileName: `fax_${randomUUID()}.pdf`,
  });
  const attempt = await sendFaxAttempt(
    {
      appointmentId: transmission.appointmentId,
      faxNumber: recipient.faxNumber,
      organizationId,
      patientId: transmission.patientId,
      media,
      documentReferenceId: transmission.documentReferenceId,
      userPractitioner,
      recipientName: recipient.name ?? findRecipientName(transmission.patient, recipient.faxNumber),
      senderId: user.id,
    },
    oystehr,
    async () => {
      const content = await getContent();
      if (content.pageCount === 0) {
        throw INVALID_INPUT_ERROR('There are no faxable documents for this selection');
      }
      const packet = await assembleFaxPacket(
        content,
        transmission.cover,
        {
          recipient,
          sender,
          generatedAt: DateTime.now()
            .setZone(transmission.timezone ?? organizationTimezone)
            .toFormat(COVER_TIMESTAMP_FORMAT),
        },
        coverAssets
      );
      await uploadObjectToZ3(packet, await createPresignedUrl(m2mToken, media, 'upload'), MIME_TYPES.PDF);
    }
  );
  if (!attempt.id) throw new Error('Outbound fax attempt was created without an id');
  return attempt.id;
};

/**
 * Names an unnamed recipient for the fax log: the number typed by the user identifies a person only
 * when it matches a practitioner contained on the Patient (i.e. their PCP).
 */
export const findRecipientName = (patient: Patient, faxNumber: string): string | undefined => {
  const standardizedFaxNumber = standardizePhoneNumber(faxNumber);
  if (!standardizedFaxNumber) return undefined;
  const match = patient.contained?.find(
    (resource): resource is Practitioner =>
      resource.resourceType === 'Practitioner' &&
      Boolean(
        resource.telecom?.some(
          (telecom) => telecom.system === 'fax' && standardizePhoneNumber(telecom.value) === standardizedFaxNumber
        )
      )
  );
  return match?.name?.length ? getFullestAvailableName(match) : undefined;
};
