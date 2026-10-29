import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getBillingInvoiceClaims,
  INVOICE_CLAIM_TAG_SYSTEM,
  INVOICE_FACILITY_TAG_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_INVOICE_LIST_STATUSES } from 'utils/lib/types/data/billing/billing.constants';
import { SearchBillingInvoicesInputSchema } from 'utils/lib/types/data/billing/billing.schemas';
import { BillingInvoiceListItem, SearchBillingInvoicesResponse } from 'utils/lib/types/data/billing/billing.types';
import { MISCONFIGURED_ENVIRONMENT_ERROR } from 'utils/lib/types/errors';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { isOttehrBillingInvoicingInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';
import { getClaimServiceDate } from '../claim-search';
import { toBillingInvoiceSummary } from '../invoices';
import { createBillingClient, fhirName } from '../shared';

const ZAMBDA_NAME = 'search-billing-invoices';
const DEFAULT_PAGE_SIZE = 25;

type SearchBillingInvoicesParams = ValidatedZambdaInput<typeof SearchBillingInvoicesInputSchema>;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(SearchBillingInvoicesInputSchema, input);
  if (!isOttehrBillingInvoicingInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Invoicing is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: Oystehr,
  params: SearchBillingInvoicesParams
): Promise<SearchBillingInvoicesResponse> {
  const pageSize = params.pageSize ?? DEFAULT_PAGE_SIZE;
  const offset = params.offset ?? 0;
  const searchParams = [
    { name: 'status', value: params.status ?? BILLING_INVOICE_LIST_STATUSES.join(',') },
    { name: '_include', value: 'Invoice:patient' },
    { name: '_sort', value: '-date' },
    { name: '_total', value: 'accurate' },
    { name: '_count', value: String(pageSize) },
    { name: '_offset', value: String(offset) },
  ];
  if (params.searchText) {
    const claimId = params.searchText.toLowerCase();
    searchParams.push(
      isValidUUID(claimId)
        ? { name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${claimId}` }
        : { name: 'patient.name', value: params.searchText }
    );
  }
  if (params.facilityId) {
    searchParams.push({ name: '_tag', value: `${INVOICE_FACILITY_TAG_SYSTEM}|${params.facilityId}` });
  }
  if (params.issuedFrom) searchParams.push({ name: 'date', value: `ge${params.issuedFrom}` });
  if (params.issuedTo) searchParams.push({ name: 'date', value: `le${params.issuedTo}` });

  const bundle = await oystehr.fhir.search<Invoice | Patient>({ resourceType: 'Invoice', params: searchParams });
  const resources = bundle.unbundle();
  const invoices = resources.filter((resource): resource is Invoice => resource.resourceType === 'Invoice');
  const patientsByRef = new Map(
    resources
      .filter((resource): resource is Patient => resource.resourceType === 'Patient')
      .map((patient) => [`Patient/${patient.id}`, patient])
  );
  const claimsById = await fetchClaims(oystehr, invoices);

  return {
    invoices: invoices.map((invoice) => toListItem(invoice, patientsByRef, claimsById)),
    total: bundle.total ?? 0,
    offset,
    pageSize,
  };
}

// Claim links use extensions, so load the claims separately.
async function fetchClaims(oystehr: Oystehr, invoices: Invoice[]): Promise<Map<string, Claim>> {
  const claimIds = [
    ...new Set(invoices.flatMap((invoice) => getBillingInvoiceClaims(invoice).map((line) => line.claimId))),
  ];
  if (claimIds.length === 0) return new Map();

  const claims = (
    await oystehr.fhir.search<Claim>({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: claimIds.join(',') },
        { name: '_count', value: String(claimIds.length) },
      ],
    })
  ).unbundle();
  return new Map(claims.map((claim) => [claim.id!, claim]));
}

function toListItem(
  invoice: Invoice,
  patientsByRef: Map<string, Patient>,
  claimsById: Map<string, Claim>
): BillingInvoiceListItem {
  const [line] = getBillingInvoiceClaims(invoice);
  const claim = line && claimsById.get(line.claimId);
  const serviceDate = claim && getClaimServiceDate(claim);
  return {
    ...toBillingInvoiceSummary(invoice),
    patientName: fhirName(patientsByRef.get(invoice.subject?.reference ?? '')),
    claimId: line?.claimId,
    serviceDate: serviceDate ? DateTime.fromISO(serviceDate, { setZone: true }).toISODate() ?? '' : '',
  };
}
