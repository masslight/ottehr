import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference, Organization, Task } from 'fhir/r4b';
import { decodeJwt, errors, jwtVerify } from 'jose';
import { DateTime } from 'luxon';
import { OUTBOUND_DELIVERY_INPUT_CODES, OUTBOUND_DELIVERY_OUTPUT_CODES } from 'utils/lib/fhir/constants';
import {
  getOutboundDeliveryChannel,
  getOutboundDeliveryInput,
  getOutboundDeliveryRecipientSnapshot,
  getOutboundDeliverySenderOrganizationId,
  makeOutboundDeliveryOutput,
} from 'utils/lib/fhir/outbound-delivery';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { PROJECT_WEBSITE } from 'utils/lib/ottehr-config/branding';
import { getSecret, Secrets, SecretsKeys } from 'utils/lib/secrets';
import {
  DOCUMENT_LINK_AUDIENCE,
  DOCUMENT_LINK_TTL_MINUTES,
  OpenDocumentLinkOutput,
} from 'utils/lib/types/api/fax.types';
import { FHIR_RESOURCE_IS_GONE, FHIR_RESOURCE_NOT_FOUND, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { sendDocumentLinkEmailAttempt } from '../../shared/document-link-email';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { requireOutboundDeliveryValue } from '../../shared/outbound-delivery';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'open-document-link';
let m2mToken: string;

/** Whatever is wrong with the Task behind a link, the caller only learns that the link does not resolve. */
const LINK_NOT_FOUND = { ...FHIR_RESOURCE_NOT_FOUND('Task'), statusCode: 404 };
/** Extension on a `link-opened` output naming the client that opened it. */
const LINK_OPENED_CLIENT_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/link-opened-client';
/** A resend chain is never deep; this only guards against a malformed `partOf` loop. */
const MAX_CHAIN_HOPS = 20;

export interface LinkClient {
  ip?: string;
  userAgent?: string;
}

/**
 * Public endpoint behind the emailed document links. The token is the only input: it names the outbound email
 * attempt Task, from which the document and the recipient are resolved. A live token yields a short-lived
 * download URL; an expired token re-sends a fresh link to the recipient recorded on that Task.
 */
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { token, secrets } = validateRequestParameters(input);
  const { attemptId, expired } = await verifyDocumentLinkToken(token, secrets);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const output = await performEffect({
    attemptId,
    expired,
    secrets,
    oystehr,
    accessToken: m2mToken,
    client: readLinkClient(input.headers),
  });
  return { statusCode: 200, body: JSON.stringify(output) };
});

export async function verifyDocumentLinkToken(
  token: string,
  secrets: Secrets | null
): Promise<{ attemptId: string; expired: boolean }> {
  const secret = new TextEncoder().encode(getSecret(SecretsKeys.DOCUMENT_LINK_SECRET, secrets));
  try {
    const { payload } = await jwtVerify(token, secret, { issuer: PROJECT_WEBSITE, audience: DOCUMENT_LINK_AUDIENCE });
    if (!payload.sub) throw NOT_AUTHORIZED;
    return { attemptId: payload.sub, expired: false };
  } catch (error) {
    // jose checks the signature before the claims, so an expired token is still provably ours.
    if (error instanceof errors.JWTExpired) {
      const { sub } = decodeJwt(token);
      if (sub) return { attemptId: sub, expired: true };
    }
    console.error('Document link token rejected:', error instanceof Error ? error.message : error);
    throw NOT_AUTHORIZED;
  }
}

/** The caller's address and browser, as API Gateway forwards them. Best effort: absent when not forwarded. */
export function readLinkClient(headers: Record<string, unknown> | null | undefined): LinkClient {
  const header = (name: string): string | undefined => {
    const entry = Object.entries(headers ?? {}).find(([key]) => key.toLowerCase() === name);
    return typeof entry?.[1] === 'string' && entry[1].trim() ? entry[1].trim() : undefined;
  };
  return {
    ip: header('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
    userAgent: header('user-agent'),
  };
}

export async function performEffect(args: {
  attemptId: string;
  expired: boolean;
  secrets: Secrets | null;
  oystehr: Oystehr;
  accessToken: string;
  client?: LinkClient;
}): Promise<OpenDocumentLinkOutput> {
  const { attemptId, expired, secrets, oystehr, accessToken, client } = args;

  const task = await loadLinkAttempt(oystehr, attemptId);
  const documentReferenceId = getOutboundDeliveryRecipientSnapshot(task).documentReferenceId;
  if (getOutboundDeliveryChannel(task) !== 'email' || !documentReferenceId) throw LINK_NOT_FOUND;
  if (task.status === 'cancelled') throw FHIR_RESOURCE_IS_GONE();

  if (expired) {
    // One live link per send: an old link re-sends only once the newest link has expired too.
    const newest = await findNewestAttempt(oystehr, task);
    if (newest.id !== task.id && isLinkLive(newest)) {
      return { status: 'expired', resent: false, sentAt: newest.authoredOn! };
    }
    await resendDocumentLink(newest, documentReferenceId, oystehr, secrets);
    return { status: 'expired', resent: true };
  }

  const documentReference = await oystehr.fhir.get<DocumentReference>({
    resourceType: 'DocumentReference',
    id: documentReferenceId,
  });
  const attachment = documentReference.content[0]?.attachment;
  if (!attachment?.url) throw LINK_NOT_FOUND;
  const url = await getPresignedURL(attachment.url, accessToken);
  await recordLinkOpened(oystehr, task, client);
  return { status: 'ok', url, title: attachment.title };
}

async function loadLinkAttempt(oystehr: Oystehr, attemptId: string): Promise<Task> {
  try {
    return await oystehr.fhir.get<Task>({ resourceType: 'Task', id: attemptId });
  } catch (error) {
    console.error(`Task/${attemptId} behind a document link could not be loaded`, error);
    throw LINK_NOT_FOUND;
  }
}

/** Follows `partOf` children to the most recent attempt in this send's resend chain. */
async function findNewestAttempt(oystehr: Oystehr, start: Task): Promise<Task> {
  let newest = start;
  for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
    const children = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          { name: 'part-of', value: `Task/${newest.id}` },
          { name: '_sort', value: '-authored-on' },
          { name: '_count', value: '1' },
        ],
      })
    )
      .unbundle()
      .filter((resource) => resource.resourceType === 'Task');
    if (!children[0]?.id) return newest;
    newest = children[0];
  }
  return newest;
}

/** A sent attempt whose token has not reached the link lifetime yet. */
function isLinkLive(attempt: Task): boolean {
  if (attempt.status !== 'completed' || !attempt.authoredOn) return false;
  return DateTime.fromISO(attempt.authoredOn).plus({ minutes: DOCUMENT_LINK_TTL_MINUTES }) > DateTime.now();
}

/** The audit record of an open. Best effort: a failure here must not stand between the recipient and the file. */
async function recordLinkOpened(oystehr: Oystehr, task: Task, client?: LinkClient): Promise<void> {
  const clientText = [client?.ip && `ip=${client.ip}`, client?.userAgent && `ua=${client.userAgent}`]
    .filter(Boolean)
    .join('; ');
  const opened = {
    ...makeOutboundDeliveryOutput(OUTBOUND_DELIVERY_OUTPUT_CODES.linkOpened, {
      valueDateTime: DateTime.now().toUTC().toISO() ?? new Date().toISOString(),
    }),
    ...(clientText && { extension: [{ url: LINK_OPENED_CLIENT_EXTENSION_URL, valueString: clientText }] }),
  };
  try {
    await oystehr.fhir.patch<Task>({
      resourceType: 'Task',
      id: task.id!,
      operations: [
        task.output ? { op: 'add', path: '/output/-', value: opened } : { op: 'add', path: '/output', value: [opened] },
      ],
    });
  } catch (error) {
    console.error(`Could not record link-opened on Task/${task.id}`, error);
    captureException(error);
  }
}

/** Sends a fresh link to the recipient fixed on the opened attempt; the new attempt is `partOf` the opened one. */
async function resendDocumentLink(
  task: Task,
  documentReferenceId: string,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<void> {
  const recipient = getOutboundDeliveryRecipientSnapshot(task);
  const organizationId =
    getOutboundDeliverySenderOrganizationId(task) || getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
  const organization = await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id: organizationId });

  await sendDocumentLinkEmailAttempt({
    oystehr,
    secrets,
    patientId: requireOutboundDeliveryValue(removePrefix('Patient/', task.for?.reference ?? ''), 'patient reference'),
    appointmentId: removePrefix('Appointment/', task.focus?.reference ?? '') || undefined,
    email: requireOutboundDeliveryValue(recipient.address, 'recipient address'),
    recipientName: recipient.name,
    recipientOrganization: recipient.organization,
    recipientPhone: recipient.phone,
    documentReferenceId,
    organizationId,
    organizationName: organization.name ?? '',
    senderDisplay: getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderDisplay)?.valueString,
    requesterReference: task.requester?.reference,
    senderId: getOutboundDeliveryInput(task, OUTBOUND_DELIVERY_INPUT_CODES.senderId)?.valueString,
    parentAttemptId: task.id,
  });
}
