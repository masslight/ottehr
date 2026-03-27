import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  getSecret,
  RenameTemplateInputSchema,
  RenameTemplateInputValidated,
  RenameTemplateOutput,
  SecretsKeys,
} from 'utils';
import { ZodError } from 'zod';
import { checkOrCreateM2MClientToken, formatZodError, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';

let m2mToken: string;

export const index = wrapHandler('rename-template', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedInput = validateRequestParameters(input);
    console.groupEnd();
    console.debug('validateRequestParameters success', JSON.stringify(validatedInput));

    const { secrets } = validatedInput;
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.group('performEffect');
    await performEffect(validatedInput, oystehr);
    console.groupEnd();
    console.debug('performEffect success');

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Template renamed successfully' }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('rename-template', error, ENVIRONMENT);
  }
});

const validateRequestParameters = (input: ZambdaInput): RenameTemplateInputValidated => {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(input.body);
  } catch {
    throw new Error('Invalid JSON in request body.');
  }

  try {
    const validatedCore = RenameTemplateInputSchema.parse(parsed);

    return {
      ...validatedCore,
      secrets: input.secrets,
    };
  } catch (err) {
    if (err instanceof ZodError) {
      throw new Error(`Invalid request parameters: ${formatZodError(err)}`);
    }
    throw err;
  }
};

const performEffect = async (
  validatedInput: RenameTemplateInputValidated,
  oystehr: Oystehr
): Promise<RenameTemplateOutput> => {
  const { templateId, newName } = validatedInput;

  await oystehr.fhir.patch({
    resourceType: 'List',
    id: templateId,
    operations: [
      {
        op: 'replace',
        path: '/title',
        value: newName,
      },
    ],
  });

  console.log(`Renamed template ${templateId} to '${newName}'`);
};
