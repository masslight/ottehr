import { APIGatewayProxyResult } from 'aws-lambda';
import { Claim, Invoice, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getBillingInvoiceClaims,
  INVOICE_CLAIM_TAG_SYSTEM,
  INVOICE_FACILITY_TAG_SYSTEM,
} from 'utils/lib/fhir/billing-invoice';
import { BILLING_INVOICE_LIST_STATUSES } from 'utils/lib/types/data/billing/billing.constants';
import { BillingInvoiceListItem, SearchBillingInvoicesResponse } from 'utils/lib/types/data/billing/billing.types';
import { isValidUUID } from 'utils/lib/validation/helper';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { getClaimServiceDate } from '../claim-search';
import { toBillingInvoiceSummary } from '../invoices';
import {
  BillingOystehr,
  createBillingClient,
  fhirName,
  findById,
  patientSearchParam,
  resolveLinkedPatientIds,
} from '../shared';
import { SearchBillingInvoicesParams, validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'search-billing-invoices';
const DEFAULT_PAGE_SIZE = 25;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createBillingClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);
  return { statusCode: 200, body: JSON.stringify(response) };
});

export async function performEffect(
  oystehr: BillingOystehr,
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
    const text = params.searchText.trim();
    const uuid = isValidUUID(text.toLowerCase()) ? text.toLowerCase() : undefined;
    const patient = uuid ? await findById<Patient>(oystehr, 'Patient', uuid) : undefined;
    if (patient) {
      const patientIds = await resolveLinkedPatientIds({ oystehr, patientId: patient.id! });
      searchParams.push(patientSearchParam(patientIds));
    } else {
      searchParams.push(
        uuid ? { name: '_tag', value: `${INVOICE_CLAIM_TAG_SYSTEM}|${uuid}` } : { name: 'patient.name', value: text }
      );
    }
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
async function fetchClaims(oystehr: BillingOystehr, invoices: Invoice[]): Promise<Map<string, Claim>> {
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
  const patient = patientsByRef.get(invoice.subject?.reference ?? '');
  return {
    ...toBillingInvoiceSummary(invoice),
    patientId: patient?.id,
    patientName: fhirName(patient),
    claimId: line?.claimId,
    serviceDate: serviceDate ? DateTime.fromISO(serviceDate, { setZone: true }).toISODate() ?? '' : '',
  };
}
