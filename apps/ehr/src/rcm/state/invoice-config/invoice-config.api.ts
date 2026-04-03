import Oystehr from '@oystehr/sdk';
import { Questionnaire, QuestionnaireResponse } from 'fhir/r4b';
import { chooseJson } from 'utils';

const GET_INVOICE_CONFIG_ZAMBDA_ID = 'get-invoice-config';
const SAVE_INVOICE_CONFIG_ZAMBDA_ID = 'save-invoice-config';

export interface InvoiceConfigResponse {
  questionnaire: Questionnaire;
  questionnaireResponse: QuestionnaireResponse;
}

export interface SaveInvoiceConfigInput {
  dueDaysFromGeneration: number;
  autoChargeOnDueDate: boolean;
  defaultSmsTemplate: string;
  defaultInvoiceMemo: string;
}

export const getInvoiceConfig = async (oystehr: Oystehr): Promise<InvoiceConfigResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: GET_INVOICE_CONFIG_ZAMBDA_ID,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};

export const saveInvoiceConfig = async (
  oystehr: Oystehr,
  parameters: SaveInvoiceConfigInput
): Promise<InvoiceConfigResponse> => {
  try {
    const response = await oystehr.zambda.execute({
      id: SAVE_INVOICE_CONFIG_ZAMBDA_ID,
      ...parameters,
    });
    return chooseJson(response);
  } catch (error: unknown) {
    console.log(error);
    throw error;
  }
};
