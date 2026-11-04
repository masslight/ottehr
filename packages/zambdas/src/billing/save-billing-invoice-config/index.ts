import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse } from 'fhir/r4b';
import { SaveInvoiceConfigBodySchema } from 'utils/lib/types/api/invoice-config.types';
import { getOrCreateInvoicingConfig } from '../../rcm/invoice-config/helpers';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateWithSchema } from '../../shared/validation';
import { createBillingClient } from '../shared';

let m2mToken: string;
const ZAMBDA_NAME = 'save-billing-invoice-config';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validated = validateWithSchema(SaveInvoiceConfigBodySchema, input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validated.secrets);
  const oystehr = createBillingClient(m2mToken, validated.secrets);

  const { questionnaire, questionnaireResponse } = await getOrCreateInvoicingConfig(oystehr);

  const savedResponse = await oystehr.fhir.update<QuestionnaireResponse>({
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
  });

  return { statusCode: 200, body: JSON.stringify({ questionnaire, questionnaireResponse: savedResponse }) };
});
