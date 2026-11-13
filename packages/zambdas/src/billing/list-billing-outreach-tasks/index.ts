import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Invoice, Patient } from 'fhir/r4b';
import { getBillingInvoiceClaims, INVOICE_CLAIM_TAG_SYSTEM } from 'utils/lib/fhir/billing-invoice';
import { getIdFromReference } from 'utils/lib/fhir/reference';
import { ListOutreachTasksInput, OutreachTaskSummary } from 'utils/lib/types/api/scheduled-outreach.types';
import { ListBillingOutreachTasksResponse } from 'utils/lib/types/data/billing/billing.types';
import { isValidUUID } from 'utils/lib/validation/helper';
import { listOutreachTasks } from '../../rcm/scheduled-outreach/manage-outreach-tasks';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { toBillingInvoiceSummary } from '../invoices';
import { createBillingClient, findById } from '../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'list-billing-outreach-tasks';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, searchText, ...params } = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createBillingClient(m2mToken, secrets);

  const list = await listOutreachTasks(oystehr, { ...params, ...(await searchFilter(oystehr, searchText)) });
  const invoices = await fetchInvoices(oystehr, list.tasks);
  const response: ListBillingOutreachTasksResponse = {
    ...list,
    tasks: list.tasks.map((task) => {
      const invoice = invoices.get(getIdFromReference(task.focusReference, 'Invoice') ?? '');
      return invoice
        ? {
            ...task,
            invoice: { ...toBillingInvoiceSummary(invoice), claimId: getBillingInvoiceClaims(invoice)[0]?.claimId },
          }
        : task;
    }),
  };
  return { statusCode: 200, body: JSON.stringify(response) };
});

// An ID that is not a patient is taken as a claim or invoice ID, like the search on the Invoices screen.
async function searchFilter(
  oystehr: Oystehr,
  searchText: string | undefined
): Promise<Pick<ListOutreachTasksInput, 'patientSearch' | 'focusReferences'>> {
  const id = searchText?.toLowerCase();
  if (!id || !isValidUUID(id)) return { patientSearch: searchText };
  if (await findById<Patient>(oystehr, 'Patient', id)) return { patientSearch: id };
  const claimInvoices = (
    await oystehr.fhir.search<Invoice>({
      resourceType: 'Invoice',
      params: [{ name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${id}` }],
    })
  ).unbundle();
  return { focusReferences: [`Invoice/${id}`, ...claimInvoices.map((invoice) => `Invoice/${invoice.id}`)] };
}

async function fetchInvoices(oystehr: Oystehr, tasks: OutreachTaskSummary[]): Promise<Map<string, Invoice>> {
  const ids = [...new Set(tasks.flatMap((task) => getIdFromReference(task.focusReference, 'Invoice') ?? []))];
  if (ids.length === 0) return new Map();

  const invoices = (
    await oystehr.fhir.search<Invoice>({
      resourceType: 'Invoice',
      params: [
        { name: '_id', value: ids.join(',') },
        { name: '_count', value: String(ids.length) },
      ],
    })
  ).unbundle();
  return new Map(invoices.map((invoice) => [invoice.id!, invoice]));
}
