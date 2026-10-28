import { APIGatewayProxyResult } from 'aws-lambda';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { listTemplates } from '../shared/list-templates';

export const ListTemplatesSchema = z.object({
  includeVersionData: z.boolean(),
  includeDiagnoses: z.boolean().optional(),
});

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('list-templates', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedInput = validateWithSchema(ListTemplatesSchema, input);

  const { secrets } = validatedInput;
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const templates = await listTemplates(validatedInput, oystehr);

  return {
    statusCode: 200,
    body: JSON.stringify(templates),
  };
});
