import { APIGatewayProxyResult } from 'aws-lambda';
import { QuestionnaireResponse } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../../shared';
import { getOrCreateInvoicingConfig } from '../helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
export const index = wrapHandler('save-invoice-config', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validated = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validated.secrets);
  const oystehr = createOystehrClient(m2mToken, validated.secrets);

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
            linkId: 'invoicing.autoChargeOnDueDate',
            text: 'Auto-charge on due date',
            answer: [{ valueBoolean: validated.autoChargeOnDueDate }],
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
