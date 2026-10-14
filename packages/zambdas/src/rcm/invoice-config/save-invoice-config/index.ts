import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse } from 'fhir/r4b';
import { z } from 'zod';
import { checkOrCreateM2MClientToken } from '../../../shared/auth';
import { createClinicalOystehrClient } from '../../../shared/helpers';
import { wrapHandler } from '../../../shared/sentry';
import { ZambdaInput } from '../../../shared/types/common';
import { validateWithSchema } from '../../../shared/validation';
import { getOrCreateInvoicingConfig } from '../helpers';

const DUE_DAYS_MESSAGE = 'dueDaysFromGeneration must be an integer between 1 and 365';

export const SaveInvoiceConfigBodySchema = z.object({
  dueDaysFromGeneration: z
    .number({ invalid_type_error: DUE_DAYS_MESSAGE })
    .int(DUE_DAYS_MESSAGE)
    .min(1, DUE_DAYS_MESSAGE)
    .max(365, DUE_DAYS_MESSAGE),
  defaultSmsTemplate: z
    .string({ invalid_type_error: 'defaultSmsTemplate must be a non-empty string' })
    .refine((value) => value.trim().length > 0, 'defaultSmsTemplate must be a non-empty string'),
  defaultInvoiceMemo: z
    .string({ invalid_type_error: 'defaultInvoiceMemo must be a non-empty string' })
    .refine((value) => value.trim().length > 0, 'defaultInvoiceMemo must be a non-empty string'),
});

let m2mToken: string;
export const index = wrapHandler('save-invoice-config', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validated = validateWithSchema(SaveInvoiceConfigBodySchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validated.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validated.secrets);

  // Get or create the config pair (ensures Questionnaire + Response exist)
  const { questionnaire, questionnaireResponse } = await getOrCreateInvoicingConfig(oystehr);

  // Build updated QuestionnaireResponse items
  const updatedResponse: QuestionnaireResponse = {
    ...questionnaireResponse,
    questionnaire: `Questionnaire/${questionnaire.id}`,
    status: 'completed',
    authored: new Date().toISOString(),
    item: [
      {
        linkId: 'invoicing',
        text: 'Invoicing Settings',
        item: [
          {
            linkId: 'invoicing.dueDaysFromGeneration',
            text: 'Days until invoice due (from generation date)',
            answer: [{ valueInteger: validated.dueDaysFromGeneration }],
          },
          {
            linkId: 'invoicing.defaultSmsTemplate',
            text: 'Default SMS message template',
            answer: [{ valueString: validated.defaultSmsTemplate }],
          },
          {
            linkId: 'invoicing.defaultInvoiceMemo',
            text: 'Default invoice memo template',
            answer: [{ valueString: validated.defaultInvoiceMemo }],
          },
        ],
      },
    ],
  };

  const savedResponse = await oystehr.fhir.update<QuestionnaireResponse>(updatedResponse);

  return {
    statusCode: 200,
    body: JSON.stringify({ questionnaire, questionnaireResponse: savedResponse }),
  };
});
