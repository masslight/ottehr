import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { Communication, Device, Task } from 'fhir/r4b';
import {
  createOystehrClient,
  FAX_TASK,
  getSecret,
  INVALID_INPUT_ERROR,
  OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL,
  SecretsKeys,
  TASK_CATEGORY_IDENTIFIER,
} from 'utils';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { createTask } from '../../../shared/tasks';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'handle-inbound-fax';

const FAX_PAGES_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/fax-pages';

// A single-use token stamped on the Task we attempt to create. The conditional create below
// returns the *pre-existing* Task when another delivery already won the race, so carrying our
// own token back is how we tell "I created it" from "someone else already had". Same technique
// as the outbound-delivery claim identifier.
const FAX_TASK_CLAIM_SYSTEM = ottehrIdentifierSystem('inbound-fax-task-claim');

let oystehrToken: string;

export function getSenderFaxNumber(communication: Communication): string {
  const senderRef = communication.sender?.reference;
  if (senderRef?.startsWith('#')) {
    const containedId = senderRef.slice(1);
    const containedDevice = communication.contained?.find((r) => r.resourceType === 'Device' && r.id === containedId);
    if (containedDevice && 'identifier' in containedDevice) {
      const identifiers = (containedDevice as Device).identifier ?? [];
      // Prefer the identifier explicitly marked as a phone number; only fall back to the
      // first identifier that has any value if no phone-system identifier exists.
      const phoneIdentifier =
        identifiers.find((id) => id.system === 'phone' && id.value) ?? identifiers.find((id) => id.value);
      if (phoneIdentifier?.value) {
        return phoneIdentifier.value;
      }
    }
    // Fallback: use the contained ID itself (may be a phone number directly)
    return containedId;
  }
  return senderRef ?? 'unknown';
}

export function getPageCount(communication: Communication): number | undefined {
  const ext = communication.extension?.find((e) => e.url === FAX_PAGES_EXTENSION_URL);
  return ext?.valueInteger;
}

export function getPdfUrl(communication: Communication): string | undefined {
  return communication.payload?.[0]?.contentAttachment?.url;
}

/**
 * Faxes we *sent* also land in the FHIR store as `medium=FAXWRIT` Communications — `oystehr.fax.send`
 * creates one per transmission (see `sendFaxAttempt` and `radiology/send-fax`) — so the subscription
 * criteria alone cannot tell direction. Oystehr stamps every sent fax with the outbound-fax-status
 * extension it uses to track delivery, and inbound faxes never carry it; that is the discriminator.
 *
 * Without this guard every outbound fax would file itself as an inbound one: a bogus "Inbound fax
 * from …" work item plus a notification to every provider.
 */
export function isOutboundFax(communication: Communication): boolean {
  return !!communication.extension?.some((ext) => ext.url === OYSTEHR_OUTBOUND_FAX_STATUS_EXTENSION_URL);
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start, body length: ${input.body?.length ?? 0}`);

  try {
    const { communication, secrets } = validateRequestParameters(input);

    // Bail before doing any work (no token, no client, no searches): outbound faxes match the same
    // subscription criteria and are by far the higher-volume case.
    if (isOutboundFax(communication)) {
      console.log(
        `[${ZAMBDA_NAME}] Communication/${communication.id} is an outbound fax; skipping (not an inbound fax)`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ skipped: 'outbound-fax' }),
      };
    }

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );

    const senderFaxNumber = getSenderFaxNumber(communication);
    const pageCount = getPageCount(communication);
    const pdfUrl = getPdfUrl(communication);

    console.log('senderFaxNumber:', senderFaxNumber);
    console.log('pageCount:', pageCount);
    console.log('pdfUrl:', pdfUrl);

    if (!pdfUrl) {
      throw INVALID_INPUT_ERROR(`Communication/${communication.id} has no PDF attachment URL`);
    }

    // Idempotency: FHIR subscriptions can re-fire for the same Communication. If an
    // inbound-fax Task already exists for it, no-op instead of duplicating the work item
    // (a second Task would also mean a second round of notifications from the cron).
    const existingFaxTasks = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [{ name: 'based-on', value: `Communication/${communication.id}` }],
      })
    )
      .unbundle()
      .filter((existing) => existing.groupIdentifier?.value === FAX_TASK.category);

    if (existingFaxTasks.length > 0) {
      const existingTaskId = existingFaxTasks[0].id;
      console.log(
        `[${ZAMBDA_NAME}] inbound-fax Task/${existingTaskId} already exists for Communication/${communication.id}; skipping (idempotent no-op)`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ taskId: existingTaskId, alreadyProcessed: true }),
      };
    }

    const claimToken = randomUUID();
    const newTask: Task = {
      ...createTask(
        {
          category: FAX_TASK.category,
          title: `Inbound fax from ${senderFaxNumber} (${pageCount ?? '?'} pages)`,
          code: {
            system: FAX_TASK.system,
            code: FAX_TASK.code.matchInboundFax,
          },
          input: [
            { type: FAX_TASK.input.senderFaxNumber, valueString: senderFaxNumber },
            { type: FAX_TASK.input.pageCount, valueString: pageCount != null ? String(pageCount) : undefined },
            { type: FAX_TASK.input.communicationId, valueString: communication.id },
            { type: FAX_TASK.input.pdfUrl, valueString: pdfUrl },
            { type: FAX_TASK.input.receivedDate, valueString: communication.received ?? communication.sent },
          ],
          basedOn: [`Communication/${communication.id}`],
        },
        true
      ),
      identifier: [{ system: FAX_TASK_CLAIM_SYSTEM, value: claimToken }],
    };

    // Conditional create (If-None-Exist): the search above is a cheap fast path, but
    // search-then-create is not atomic, so two deliveries arriving at once would both see zero
    // tasks and both create one. Letting the server do the existence check makes "at most one
    // work item per fax" hold even under concurrent delivery.
    let result: Task;
    try {
      result = await oystehr.fhir.create<Task>(newTask, {
        ifNoneExist: [
          { name: 'based-on', value: `Communication/${communication.id}` },
          { name: 'group-identifier', value: `${TASK_CATEGORY_IDENTIFIER}|${FAX_TASK.category}` },
        ],
      });
    } catch (error) {
      // A conditional create whose criteria match more than one resource fails with 412. That
      // means fax tasks already exist for this Communication, so ingestion is already done —
      // report it, but don't fail (a failure would have the subscription retry forever).
      console.error(`[${ZAMBDA_NAME}] conditional create failed for Communication/${communication.id}:`, error);
      captureException(error);
      return {
        statusCode: 200,
        body: JSON.stringify({ alreadyProcessed: true }),
      };
    }

    // The conditional create matched an existing Task rather than creating ours: another
    // delivery of this same fax won the race and already created the work item.
    const ownsClaim = result.identifier?.some(
      (identifier) => identifier.system === FAX_TASK_CLAIM_SYSTEM && identifier.value === claimToken
    );
    if (!ownsClaim) {
      console.log(
        `[${ZAMBDA_NAME}] conditional create matched existing Task/${result.id} for Communication/${communication.id}; skipping (idempotent no-op)`
      );
      return {
        statusCode: 200,
        body: JSON.stringify({ taskId: result.id, alreadyProcessed: true }),
      };
    }

    console.log('Created fax task:', result.id);

    // Notifying staff is deliberately NOT done here. The `notifications-updater` cron already
    // notifies subscribers of any newly created task in a category, honoring each practitioner's V2
    // preferences (enabled, delivery method, location filter, assigned-to) with its own idempotency
    // tag — `FAX_TASK.category` is registered in `TASK_CODE_TO_UI_CATEGORY` so inbound faxes flow
    // through it like every other category. Fanning out from here instead would ignore those
    // preferences and scan every Practitioner in the project inside a subscription handler.

    return {
      statusCode: 200,
      body: JSON.stringify({ taskId: result.id }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
