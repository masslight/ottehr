import { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  AppointmentProviderNotificationTypes,
  FAX_TASK,
  getProviderNotificationSettingsForPractitioner,
  getSecret,
  PROVIDER_NOTIFICATION_TYPE_SYSTEM,
  SecretsKeys,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { createTask } from '../../../shared/tasks';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'handle-inbound-fax';

const FAX_PAGES_EXTENSION_URL = 'https://extensions.fhir.oystehr.com/fax-pages';

let oystehrToken: string;

function getSenderFaxNumber(communication: Communication): string {
  const senderRef = communication.sender?.reference;
  if (senderRef?.startsWith('#')) {
    // Phone number reference like "#+15165483859"
    return senderRef.replace('#', '');
  }
  return senderRef ?? 'unknown';
}

function getPageCount(communication: Communication): number | undefined {
  const ext = communication.extension?.find((e) => e.url === FAX_PAGES_EXTENSION_URL);
  return ext?.valueInteger;
}

function getPdfUrl(communication: Communication): string | undefined {
  return communication.payload?.[0]?.contentAttachment?.url;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input, undefined, 2)}`);

  try {
    const { communication, secrets } = validateRequestParameters(input);

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    const senderFaxNumber = getSenderFaxNumber(communication);
    const pageCount = getPageCount(communication);
    const pdfUrl = getPdfUrl(communication);

    console.log('senderFaxNumber:', senderFaxNumber);
    console.log('pageCount:', pageCount);
    console.log('pdfUrl:', pdfUrl);

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
      const practitioners = (
        await oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [{ name: '_count', value: '100' }],
        })
      ).unbundle();

      const notificationMessage = `Inbound fax received from ${senderFaxNumber} (${pageCount ?? '?'} pages)`;
      const notificationRequests: BatchInputPostRequest<Communication>[] = [];

      for (const practitioner of practitioners) {
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
      console.warn('Failed to create provider notifications, continuing:', notifError);
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
