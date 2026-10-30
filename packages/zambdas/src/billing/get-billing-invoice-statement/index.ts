import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { chooseJson } from 'utils/lib/helpers/oystehrApi';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { generateStatement, StatementDetails } from 'utils/lib/statements/generate-statement';
import { BillingInvoiceStatementInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { GetBillingInvoiceStatementResponse } from 'utils/lib/types/data/billing/billing.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { assertZ3UrlInProject } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { getHTMLStatementTemplate } from '../../shared/statements/get-statement-template';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { getInvoiceEncounterId } from '../invoices';
import { createBillingClient } from '../shared';

const ZAMBDA_NAME = 'get-billing-invoice-statement';
const GET_STATEMENT_DETAILS_ZAMBDA_KEY = 'get-statement-details';
const GET_STATEMENT_STATUS_ZAMBDA_KEY = 'get-statement-status';

type GetBillingInvoiceStatementParams = ValidatedZambdaInput<typeof BillingInvoiceStatementInputSchema>;

// The part of the clinical get-statement-status response this endpoint uses.
interface StatementStatus {
  generated: { generated: boolean; lastGenerated?: string; url?: string };
}

let m2mToken: string;

// Read only. Shows the statement the EHR generates for the invoice's visit. The visit, the chart and the
// current PDF are clinical, so the EHR's own statement endpoints read them.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(BillingInvoiceStatementInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, m2mToken, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  token: string,
  params: GetBillingInvoiceStatementParams
): Promise<GetBillingInvoiceStatementResponse> {
  const { invoiceId, secrets } = params;
  const encounterId = await getInvoiceEncounterId(oystehr, invoiceId);
  const [details, status] = await Promise.all([
    // The generated PDF is always a standard statement, and its amounts come from the billing claim.
    oystehr.zambda
      .execute({
        id: GET_STATEMENT_DETAILS_ZAMBDA_KEY,
        encounterId,
        statementType: 'standard',
        billingAppInvoice: true,
      })
      .then((response) => chooseJson<StatementDetails>(response)),
    oystehr.zambda
      .execute({ id: GET_STATEMENT_STATUS_ZAMBDA_KEY, encounterId })
      .then((response) => chooseJson<StatementStatus>(response)),
  ]);

  const fileUrl = status.generated.url;
  if (fileUrl) assertZ3UrlInProject(fileUrl, secrets);
  return {
    html: generateStatement(getHTMLStatementTemplate('statement-template').template, details),
    generatedAt: status.generated.lastGenerated,
    pdfUrl: fileUrl ? await getPresignedURL(fileUrl, token) : undefined,
  };
}
