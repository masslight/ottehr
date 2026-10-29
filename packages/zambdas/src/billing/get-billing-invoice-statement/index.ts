import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DocumentReference } from 'fhir/r4b';
import { getPresignedURL } from 'utils/lib/helpers/presigned-file-url/helpers';
import { generateStatement } from 'utils/lib/statements/generate-statement';
import { BillingInvoiceStatementInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { GetBillingInvoiceStatementResponse } from 'utils/lib/types/data/billing/billing.types';
import { STATEMENT_CODE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
// eslint-disable-next-line no-restricted-imports -- the statement is built from the clinical visit and chart
import { createClinicalOystehrClient } from '../../shared/helpers';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { assertZ3UrlInProject } from '../../shared/presigned-file-urls/helpers';
import { wrapHandler } from '../../shared/sentry';
import { getStatementDetails, resolveStatementAmountsSource } from '../../shared/statements/get-statement-details';
import { getHTMLStatementTemplate } from '../../shared/statements/get-statement-template';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { getInvoiceEncounterId } from '../invoices';
import { createBillingClient } from '../shared';

const ZAMBDA_NAME = 'get-billing-invoice-statement';

type GetBillingInvoiceStatementParams = ValidatedZambdaInput<typeof BillingInvoiceStatementInputSchema>;

let m2mToken: string;

// Read only. Shows the statement the EHR generates for the invoice's visit.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(BillingInvoiceStatementInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);
  const clinicalOystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, clinicalOystehr, m2mToken, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  clinicalOystehr: Oystehr,
  token: string,
  params: GetBillingInvoiceStatementParams
): Promise<GetBillingInvoiceStatementResponse> {
  const { invoiceId, secrets } = params;
  const encounterId = await getInvoiceEncounterId(oystehr, invoiceId);
  const amountsSource = await resolveStatementAmountsSource({
    secrets,
    oystehr: clinicalOystehr,
    m2mToken: token,
    billingAppInvoice: true,
  });
  const [details, pdf] = await Promise.all([
    // The generated PDF is always a standard statement.
    getStatementDetails({ encounterId, statementType: 'standard', secrets, oystehr: clinicalOystehr, amountsSource }),
    getCurrentStatementPdf(clinicalOystehr, encounterId),
  ]);

  const fileUrl = pdf?.content?.[0]?.attachment.url;
  if (fileUrl) assertZ3UrlInProject(fileUrl, secrets);
  return {
    html: generateStatement(getHTMLStatementTemplate('statement-template').template, details),
    generatedAt: pdf?.date,
    pdfUrl: fileUrl ? await getPresignedURL(fileUrl, token) : undefined,
  };
}

// Generating again supersedes the previous PDF, so only the newest one is current.
async function getCurrentStatementPdf(
  clinicalOystehr: Oystehr,
  encounterId: string
): Promise<DocumentReference | undefined> {
  const [statement] = (
    await clinicalOystehr.fhir.search<DocumentReference>({
      resourceType: 'DocumentReference',
      params: [
        { name: 'encounter', value: `Encounter/${encounterId}` },
        { name: 'type', value: STATEMENT_CODE },
        { name: 'status', value: 'current' },
        { name: '_sort', value: '-date' },
      ],
    })
  ).unbundle();
  return statement;
}
