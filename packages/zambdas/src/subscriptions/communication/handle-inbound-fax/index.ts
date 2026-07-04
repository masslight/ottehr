import { BatchInputPostRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Device, Practitioner, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentProviderNotificationTypes,
  createOystehrClient,
  FAX_TASK,
  getProviderNotificationSettingsForPractitioner,
  getSecret,
  INVALID_INPUT_ERROR,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  SecretsKeys,
} from 'utils';
import { fetchAllPages, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { createTask } from '../../../shared/tasks';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'handle-inbound-fax';

const FAX_PAGES_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/fax-pages';

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

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`[${ZAMBDA_NAME}] handler start, body length: ${input.body?.length ?? 0}`);

  try {
    const { communication, secrets } = validateRequestParameters(input);

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
    // inbound-fax Task already exists for it, no-op instead of duplicating the Task and
    // re-sending notifications.
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

    const newTask = createTask(
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
    );

    const result = await oystehr.fhir.create(newTask);

    console.log('Created fax task:', result.id);

    // Create provider notifications for all practitioners with task notifications enabled
    try {
      let practitioners: Practitioner[] = [];
      await fetchAllPages(async (offset, count) => {
        const bundle = await oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [
            { name: '_count', value: count.toString() },
            { name: '_offset', value: offset.toString() },
          ],
        });
        practitioners = practitioners.concat(bundle.unbundle());
        return bundle;
      }, 500);

      // Deactivating a user sets Practitioner.active = false (see user-activation); exclude
      // those, but keep practitioners that predate the flag (active undefined).
      const activePractitioners = practitioners.filter((practitioner) => practitioner.active !== false);

      const notificationMessage = `Inbound fax received from ${senderFaxNumber} (${pageCount ?? '?'} pages)`;
      const notificationRequests: BatchInputPostRequest<Communication>[] = [];

      for (const practitioner of activePractitioners) {
        const settings = getProviderNotificationSettingsForPractitioner(practitioner);
        if (settings?.taskNotificationsEnabled && practitioner.id) {
          notificationRequests.push({
            method: 'POST',
            url: '/Communication',
            resource: {
              resourceType: 'Communication',
              category: [
                {
                  coding: [
                    {
                      system: PROVIDER_NOTIFICATION_TYPE_SYSTEM,
                      code: AppointmentProviderNotificationTypes.inbound_fax,
                    },
                  ],
                },
              ],
              sent: DateTime.utc().toISO()!,
              status: 'in-progress',
              basedOn: [{ reference: `Task/${result.id}` }],
              recipient: [{ reference: `Practitioner/${practitioner.id}` }],
              payload: [{ contentString: notificationMessage }],
            },
          });
        }
      }

      if (notificationRequests.length > 0) {
        await oystehr.fhir.transaction({ requests: notificationRequests });
        console.log(`Created ${notificationRequests.length} provider notifications`);
      } else {
        console.log('No practitioners with task notifications enabled');
      }
    } catch (notifError) {
      // The fax Task itself was created successfully; a notification fan-out failure should
      // not fail ingestion (the subscription would re-fire and duplicate work), but it must
      // be visible to operators.
      console.error(`[${ZAMBDA_NAME}] failed to create provider notifications, continuing:`, notifError);
      captureException(notifError);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ taskId: result.id }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
