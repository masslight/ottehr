import Oystehr from '@oystehr/sdk';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { InvoiceConfigResponse, SaveInvoiceConfigInput } from 'utils/lib/types/api/invoice-config.types';

const GET_INVOICE_CONFIG_ZAMBDA_ID = 'get-invoice-config';
const SAVE_INVOICE_CONFIG_ZAMBDA_ID = 'save-invoice-config';

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
