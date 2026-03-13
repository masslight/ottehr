import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication, Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { ERX_TASK, getSecret, Secrets, SecretsKeys, TASK_ASSIGNED_DATE_TIME_EXTENSION_URL } from 'utils';
import { getAuth0Token, topLevelCatch, wrapHandler } from '../../../shared';
import { assertDefined, createOystehrClient, validateJsonBody } from '../../../shared/helpers';
import { createTask } from '../../../shared/tasks';
import { ZambdaInput } from '../../../shared/types';

const ZAMBDA_NAME = 'erx-notification-subscription';

interface Input {
  communication: Communication;
  secrets: Secrets | null;
}

let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const { communication, secrets } = validateRequestParameters(input);

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    const practitioner = assertDefined(
      (
        await oystehr.fhir.search<Practitioner>({
          resourceType: 'Practitioner',
          params: [{ name: '_id', value: communication.recipient?.[0].reference?.split('/')[1] ?? '' }],
        })
      ).unbundle()[0],
      'practitioner'
    );

    const task = createTask({
      category: ERX_TASK.category,
      title: 'Provide [name] has notifications in DoseSpot',
      code: {
        system: ERX_TASK.system,
        code: ERX_TASK.code.providerNotification,
      },
      basedOn: ['Communication/' + communication.id],
    });

    task.status = 'in-progress';
    task.owner = {
      reference: 'Practitioner/' + practitioner.id,
      display: practitioner.name?.[0] != null ? oystehr?.fhir.formatHumanName(practitioner.name[0]) : 'Unknown',
      extension: [
        {
          url: TASK_ASSIGNED_DATE_TIME_EXTENSION_URL,
          valueDateTime: DateTime.now().toISO(),
        },
      ],
    };

    const createdTask = await oystehr.fhir.create(task);

    return {
      statusCode: 200,
      body: JSON.stringify({
        taskId: createdTask.id,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

function validateRequestParameters(input: ZambdaInput): Input {
  const body = validateJsonBody(input);

  if (body.resourceType !== 'Communication') {
    throw new Error(`Request body must be a Communication resource`);
  }

  return {
    communication: body as Communication,
    secrets: input.secrets,
  };
}
