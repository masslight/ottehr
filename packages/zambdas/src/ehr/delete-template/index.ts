import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  DeleteTemplateInputSchema,
  DeleteTemplateInputValidated,
  DeleteTemplateOutput,
  getSecret,
  GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM,
  SecretsKeys,
} from 'utils';
import { ZodError } from 'zod';
import { checkOrCreateM2MClientToken, formatZodError, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';

let m2mToken: string;

export const index = wrapHandler('delete-template', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
      body: JSON.stringify({ message: 'Template deleted successfully' }),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('delete-template', error, ENVIRONMENT);
  }
});

const validateRequestParameters = (input: ZambdaInput): DeleteTemplateInputValidated => {
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
    const validatedCore = DeleteTemplateInputSchema.parse(parsed);

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
  validatedInput: DeleteTemplateInputValidated,
  oystehr: Oystehr
): Promise<DeleteTemplateOutput> => {
  const { templateId } = validatedInput;

  // Find the holder list
  const holderListBundle = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [
      {
        name: '_tag',
        value: `${GLOBAL_TEMPLATE_META_TAG_CODE_SYSTEM}|`,
      },
    ],
  });

  const holderLists = holderListBundle.unbundle();
  if (!holderLists || holderLists.length !== 1) {
    throw new Error('Unexpectedly found no holder list or multiple holder lists');
  }
  const holderList = holderLists[0];
  if (!holderList?.id) {
    throw new Error('Could not find global template holder list');
  }

  // Find the index of the template entry in the holder list
  const entryIndex = holderList.entry?.findIndex((entry) => entry.item?.reference === `List/${templateId}`);
  if (entryIndex === undefined || entryIndex === -1) {
    throw new Error(`Template ${templateId} not found in holder list`);
  }

  // Remove the template from the holder list and delete the template resource
  await Promise.all([
    oystehr.fhir.patch({
      resourceType: 'List',
      id: holderList.id,
      operations: [
        {
          op: 'remove',
          path: `/entry/${entryIndex}`,
        },
      ],
    }),
    oystehr.fhir.delete({
      resourceType: 'List',
      id: templateId,
    }),
  ]);

  console.log(`Deleted template with id ${templateId}`);
};
