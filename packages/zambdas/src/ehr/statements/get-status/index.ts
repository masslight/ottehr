import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Task } from 'fhir/r4b';
import { getSecret, MISSING_REQUEST_BODY, MISSING_REQUEST_SECRETS, Secrets, SecretsKeys } from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getPostGridLetter,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'get-statement-status';
const SEND_STATEMENT_BY_EMAIL_TASK_CODE = 'send-statement-by-email';

interface GetStatementStatusInput {
  encounterId: string;
  secrets: Secrets;
}

interface StatementStatusResponse {
  encounterId: string;
  communication: {
    found: boolean;
    id?: string;
    status?: Communication['status'];
    sent?: string;
  };
  sendStatementByEmailTask: {
    found: boolean;
    id?: string;
    status?: Task['status'];
    authoredOn?: string;
  };
  mailProcessor: {
    found: boolean;
    letterId?: string;
    source?: 'communication' | 'task';
    status?: string;
    sendDate?: string;
    url?: string;
    fetchError?: string;
  };
}

let oystehrToken: string;

function validateRequestParameters(input: ZambdaInput): GetStatementStatusInput {
  if (!input.body) throw MISSING_REQUEST_BODY;
  if (!input.secrets) throw MISSING_REQUEST_SECRETS;

  const body = JSON.parse(input.body) as Record<string, unknown>;
  const encounterId = body.encounterId;
  if (typeof encounterId !== 'string' || encounterId.trim().length === 0) {
    throw new Error('encounterId is required');
  }

  return {
    encounterId,
    secrets: input.secrets,
  };
}

async function createOystehr(secrets: Secrets): Promise<Oystehr> {
  if (oystehrToken == null) {
    oystehrToken = await getAuth0Token(secrets);
  }
  return createOystehrClient(oystehrToken, secrets);
}

function isStatementCommunication(resource: Communication): boolean {
  const hasStatementPayload =
    resource.payload?.some((payload) => payload.contentString?.toLowerCase().includes('statement')) ?? false;
  const hasMailVendorExtension =
    resource.extension?.some((ext) => ext.url === 'https://extensions.fhir.ottehr.com/mail-vendor') ?? false;
  const hasMailMedium =
    resource.medium?.some((medium) => medium.coding?.some((coding) => coding.code === 'MAILWRIT')) ?? false;

  return hasStatementPayload || hasMailVendorExtension || hasMailMedium;
}

function sortByDateDesc<T>(items: T[], getDate: (item: T) => string | undefined): T[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(getDate(a) ?? '') || 0;
    const bTime = Date.parse(getDate(b) ?? '') || 0;
    return bTime - aTime;
  });
}

function getPostGridLetterIdFromCommunication(resource: Communication | undefined): string | undefined {
  const mailVendorExtension = resource?.extension?.find(
    (ext) => ext.url === 'https://extensions.fhir.ottehr.com/mail-vendor'
  );
  return mailVendorExtension?.extension?.find((ext) => ext.url === 'vendor-letter-id')?.valueString;
}

function getPostGridLetterIdFromTask(task: Task | undefined): string | undefined {
  const valueFromInput = task?.input?.find(
    (input) => input.type.coding?.some((coding) => coding.code === 'vendor-letter-id')
  )?.valueString;
  if (valueFromInput) return valueFromInput;

  const valueFromOutput = task?.output?.find(
    (output) => output.type.coding?.some((coding) => coding.code === 'vendor-letter-id')
  )?.valueString;
  if (valueFromOutput) return valueFromOutput;

  return undefined;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedInput = validateRequestParameters(input);
    const { encounterId, secrets } = validatedInput;
    const oystehr = await createOystehr(secrets);

    const encounterReference = `Encounter/${encounterId}`;

    const communications = (
      await oystehr.fhir.search<Communication>({
        resourceType: 'Communication',
        params: [
          {
            name: 'encounter',
            value: encounterReference,
          },
        ],
      })
    ).unbundle();

    const statementCommunications = sortByDateDesc(
      communications.filter((resource) => isStatementCommunication(resource)),
      (resource) => resource.sent ?? resource.meta?.lastUpdated
    );
    const latestCommunication = statementCommunications[0];

    const sendStatementByEmailTasks = (
      await oystehr.fhir.search<Task>({
        resourceType: 'Task',
        params: [
          {
            name: 'encounter',
            value: encounterReference,
          },
          {
            name: 'code',
            value: `|${SEND_STATEMENT_BY_EMAIL_TASK_CODE}`,
          },
        ],
      })
    ).unbundle();

    const latestSendStatementByEmailTask = sortByDateDesc(
      sendStatementByEmailTasks,
      (resource) => resource.authoredOn ?? resource.meta?.lastUpdated
    )[0];

    const communicationLetterId = getPostGridLetterIdFromCommunication(latestCommunication);
    const taskLetterId = getPostGridLetterIdFromTask(latestSendStatementByEmailTask);
    const postGridLetterId = communicationLetterId ?? taskLetterId;

    let mailProcessor: StatementStatusResponse['mailProcessor'] = {
      found: false,
    };

    if (postGridLetterId) {
      try {
        const postGridLetter = await getPostGridLetter(postGridLetterId, secrets);
        mailProcessor = {
          found: true,
          letterId: postGridLetter.id,
          source: communicationLetterId ? 'communication' : 'task',
          status: postGridLetter.status,
          sendDate: postGridLetter.sendDate,
          url: postGridLetter.url,
        };
      } catch (error: unknown) {
        mailProcessor = {
          found: false,
          letterId: postGridLetterId,
          source: communicationLetterId ? 'communication' : 'task',
          fetchError: error instanceof Error ? error.message : String(error),
        };
      }
    }

    const response: StatementStatusResponse = {
      encounterId,
      communication: latestCommunication
        ? {
            found: true,
            id: latestCommunication.id,
            status: latestCommunication.status,
            sent: latestCommunication.sent,
          }
        : {
            found: false,
          },
      sendStatementByEmailTask: latestSendStatementByEmailTask
        ? {
            found: true,
            id: latestSendStatementByEmailTask.id,
            status: latestSendStatementByEmailTask.status,
            authoredOn: latestSendStatementByEmailTask.authoredOn,
          }
        : {
            found: false,
          },
      mailProcessor,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const environment = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, environment);
  }
});
